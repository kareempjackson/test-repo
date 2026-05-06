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
        specs: dto.specs ?? {},
        status: VehicleStatus.ACTIVE,
      },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        images: true,
      },
    });

    // Initialize availability for next 90 days
    await this.initializeAvailability(vehicle.id);

    return vehicle;
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    return vehicle;
  }

  async update(
    id: string,
    dto: UpdateVehicleDto,
    userId: string,
    userRole: UserRole,
  ) {
    const vehicle = await this.findOne(id);
    this.verifyOwnership(vehicle.ownerId, userId, userRole);

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(dto.make && { make: dto.make }),
        ...(dto.model && { model: dto.model }),
        ...(dto.year && { year: dto.year }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.dailyRate && { dailyRate: dto.dailyRate }),
        ...(dto.location && { location: dto.location }),
        ...(dto.specs && { specs: dto.specs }),
      },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async softDelete(id: string, userId: string, userRole: UserRole) {
    const vehicle = await this.findOne(id);
    this.verifyOwnership(vehicle.ownerId, userId, userRole);

    await this.prisma.vehicle.update({
      where: { id },
      data: { status: VehicleStatus.INACTIVE },
    });
  }

  async getUploadUrl(
    vehicleId: string,
    dto: UploadImageDto,
    userId: string,
    userRole: UserRole,
  ) {
    const vehicle = await this.findOne(vehicleId);
    this.verifyOwnership(vehicle.ownerId, userId, userRole);

    const imageCount = await this.prisma.vehicleImage.count({
      where: { vehicleId },
    });

    if (imageCount >= MAX_IMAGES_PER_VEHICLE) {
      throw new BadRequestException(
        `Maximum of ${MAX_IMAGES_PER_VEHICLE} images per vehicle allowed`,
      );
    }

    const key = `vehicles/${vehicleId}/${Date.now()}-${dto.filename}`;
    const { uploadUrl, publicUrl } = await this.uploadService.getSignedUploadUrl(
      key,
      dto.contentType,
    );

    // Create image record
    const image = await this.prisma.vehicleImage.create({
      data: {
        vehicleId,
        url: publicUrl,
        key,
        order: imageCount,
      },
    });

    return {
      uploadUrl,
      publicUrl,
      imageId: image.id,
    };
  }

  async getAvailability(vehicleId: string) {
    await this.findOne(vehicleId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + AVAILABILITY_DAYS);

    const availability = await this.prisma.vehicleAvailability.findMany({
      where: {
        vehicleId,
        date: {
          gte: today,
          lt: endDate,
        },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        isAvailable: true,
      },
    });

    return {
      vehicleId,
      availability,
    };
  }

  async updateAvailability(
    vehicleId: string,
    dto: UpdateAvailabilityDto,
    userId: string,
    userRole: UserRole,
  ) {
    const vehicle = await this.findOne(vehicleId);
    this.verifyOwnership(vehicle.ownerId, userId, userRole);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + AVAILABILITY_DAYS);

    // Validate dates
    for (const entry of dto.dates) {
      const date = new Date(entry.date);
      if (date < today || date >= maxDate) {
        throw new BadRequestException(
          `Date ${entry.date} is outside the allowed range (today to ${AVAILABILITY_DAYS} days)`,
        );
      }
    }

    // Upsert availability records
    await Promise.all(
      dto.dates.map((entry) =>
        this.prisma.vehicleAvailability.upsert({
          where: {
            vehicleId_date: {
              vehicleId,
              date: new Date(entry.date),
            },
          },
          update: { isAvailable: entry.isAvailable },
          create: {
            vehicleId,
            date: new Date(entry.date),
            isAvailable: entry.isAvailable,
          },
        }),
      ),
    );

    return this.getAvailability(vehicleId);
  }

  private async initializeAvailability(vehicleId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < AVAILABILITY_DAYS; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push({
        vehicleId,
        date,
        isAvailable: true,
      });
    }

    await this.prisma.vehicleAvailability.createMany({
      data: dates,
      skipDuplicates: true,
    });
  }

  private verifyOwnership(
    ownerId: string,
    userId: string,
    userRole: UserRole,
  ) {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    if (ownerId !== userId) {
      throw new ForbiddenException('You can only modify your own vehicles');
    }
  }
}
