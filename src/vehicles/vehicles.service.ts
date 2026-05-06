import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UploadImageDto } from './dto/upload-image.dto';
import { VehicleStatus, UserRole } from '@prisma/client';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

const MAX_IMAGES_PER_VEHICLE = 10;
const AVAILABILITY_DAYS = 90;

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async create(dto: CreateVehicleDto, ownerId: string) {
    const vehicle = await this.prisma.vehicle.create({
      data: {
        ownerId,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        description: dto.description,
        dailyRate: dto.dailyRate,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        specs: dto.specs || {},
        status: VehicleStatus.ACTIVE,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return vehicle;
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto, user: AuthenticatedUser) {
    const vehicle = await this.findVehicleOrThrow(id);
    this.assertOwnership(vehicle, user);

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: {
        make: dto.make,
        model: dto.model,
        year: dto.year,
        description: dto.description,
        dailyRate: dto.dailyRate,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        specs: dto.specs,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return updated;
  }

  async softDelete(id: string, user: AuthenticatedUser) {
    const vehicle = await this.findVehicleOrThrow(id);
    this.assertOwnership(vehicle, user);

    await this.prisma.vehicle.update({
      where: { id },
      data: { status: VehicleStatus.INACTIVE },
    });
  }

  async getUploadUrl(id: string, dto: UploadImageDto, user: AuthenticatedUser) {
    const vehicle = await this.findVehicleOrThrow(id);
    this.assertOwnership(vehicle, user);

    const imageCount = await this.prisma.vehicleImage.count({
      where: { vehicleId: id },
    });

    if (imageCount >= MAX_IMAGES_PER_VEHICLE) {
      throw new BadRequestException(
        `Maximum of ${MAX_IMAGES_PER_VEHICLE} images allowed per vehicle`,
      );
    }

    const key = `vehicles/${id}/${Date.now()}-${dto.filename}`;
    const signedUrl = await this.uploadService.getSignedUploadUrl(key, dto.contentType);

    const image = await this.prisma.vehicleImage.create({
      data: {
        vehicleId: id,
        url: signedUrl.publicUrl,
        key,
        isPrimary: imageCount === 0,
        sortOrder: imageCount,
      },
    });

    return {
      uploadUrl: signedUrl.uploadUrl,
      publicUrl: signedUrl.publicUrl,
      image,
    };
  }

  async getAvailability(id: string) {
    await this.findVehicleOrThrow(id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + AVAILABILITY_DAYS);

    const existingAvailability = await this.prisma.vehicleAvailability.findMany({
      where: {
        vehicleId: id,
        date: {
          gte: today,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    const availabilityMap = new Map(
      existingAvailability.map((a) => [a.date.toISOString().split('T')[0], a]),
    );

    const result = [];
    const currentDate = new Date(today);

    for (let i = 0; i < AVAILABILITY_DAYS; i++) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const existing = availabilityMap.get(dateKey);

      result.push({
        date: dateKey,
        isAvailable: existing ? existing.isAvailable : true,
        price: existing?.price || null,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  async updateAvailability(
    id: string,
    dto: UpdateAvailabilityDto,
    user: AuthenticatedUser,
  ) {
    const vehicle = await this.findVehicleOrThrow(id);
    this.assertOwnership(vehicle, user);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + AVAILABILITY_DAYS);

    const operations = dto.dates.map((dateEntry) => {
      const date = new Date(dateEntry.date);
      date.setHours(0, 0, 0, 0);

      if (date < today || date > maxDate) {
        throw new BadRequestException(
          `Date ${dateEntry.date} is outside the allowed range (today to ${AVAILABILITY_DAYS} days)`,
        );
      }

      return this.prisma.vehicleAvailability.upsert({
        where: {
          vehicleId_date: {
            vehicleId: id,
            date,
          },
        },
        create: {
          vehicleId: id,
          date,
          isAvailable: dateEntry.isAvailable,
          price: dateEntry.price,
        },
        update: {
          isAvailable: dateEntry.isAvailable,
          price: dateEntry.price,
        },
      });
    });

    await this.prisma.$transaction(operations);

    return this.getAvailability(id);
  }

  private async findVehicleOrThrow(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  private assertOwnership(vehicle: { ownerId: string }, user: AuthenticatedUser) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (vehicle.ownerId !== user.id) {
      throw new ForbiddenException('You can only manage your own vehicles');
    }
  }
}
