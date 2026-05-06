import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SearchVehiclesDto, SortBy, TransmissionType } from './dto/search-vehicles.dto';
import {
  VehicleSearchResponseDto,
  VehicleSearchItemDto,
} from './dto/vehicle-search-response.dto';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class VehiclesService {
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_PREFIX = 'vehicle_search:';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async searchVehicles(dto: SearchVehiclesDto): Promise<VehicleSearchResponseDto> {
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    if (endDate <= startDate) {
      throw new BadRequestException('end_date must be after start_date');
    }

    const cacheKey = this.generateCacheKey(dto);
    const cached = await this.cacheManager.get<VehicleSearchResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereConditions: Prisma.VehicleWhereInput = {
      isAvailable: true,
    };

    // Location text search (case-insensitive contains)
    if (dto.location) {
      whereConditions.locationText = {
        contains: dto.location,
        mode: 'insensitive',
      };
    }

    // Price filters
    if (dto.min_price !== undefined || dto.max_price !== undefined) {
      whereConditions.dailyRate = {};
      if (dto.min_price !== undefined) {
        whereConditions.dailyRate.gte = dto.min_price;
      }
      if (dto.max_price !== undefined) {
        whereConditions.dailyRate.lte = dto.max_price;
      }
    }

    // Transmission filter
    if (dto.transmission) {
      whereConditions.transmission = dto.transmission === TransmissionType.AUTO ? 'auto' : 'manual';
    }

    // Minimum seats filter
    if (dto.min_seats !== undefined) {
      whereConditions.seats = {
        gte: dto.min_seats,
      };
    }

    // Availability check: exclude vehicles with overlapping bookings
    whereConditions.bookings = {
      none: {
        AND: [
          { status: { in: ['confirmed', 'pending'] } },
          { startDate: { lt: endDate } },
          { endDate: { gt: startDate } },
        ],
      },
    };

    // Build order by clause
    const orderBy = this.buildOrderBy(dto.sort_by ?? SortBy.NEWEST);

    // Execute count and find in parallel
    const [totalItems, vehicles] = await Promise.all([
      this.prisma.vehicle.count({ where: whereConditions }),
      this.prisma.vehicle.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              isVerified: true,
            },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true },
          },
          reviews: {
            select: { rating: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    const data: VehicleSearchItemDto[] = vehicles.map((vehicle) => {
      const ratings = vehicle.reviews.map((r) => r.rating);
      const averageRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : 0;

      return {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        dailyRate: Number(vehicle.dailyRate),
        currency: vehicle.currency,
        transmission: vehicle.transmission,
        seats: vehicle.seats,
        locationText: vehicle.locationText,
        primaryImageUrl: vehicle.images[0]?.url ?? null,
        averageRating,
        totalReviews: ratings.length,
        owner: {
          id: vehicle.owner.id,
          firstName: vehicle.owner.firstName,
          lastName: vehicle.owner.lastName,
          isVerified: vehicle.owner.isVerified,
        },
        createdAt: vehicle.createdAt,
      };
    });

    // Sort by rating if needed (done in memory since it's computed)
    if (dto.sort_by === SortBy.RATING_DESC) {
      data.sort((a, b) => b.averageRating - a.averageRating);
    }

    const response: VehicleSearchResponseDto = {
      data,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };

    // Cache the result
    await this.cacheManager.set(cacheKey, response, this.CACHE_TTL_MS);

    return response;
  }

  private buildOrderBy(
    sortBy: SortBy,
  ): Prisma.VehicleOrderByWithRelationInput | Prisma.VehicleOrderByWithRelationInput[] {
    switch (sortBy) {
      case SortBy.PRICE_ASC:
        return { dailyRate: 'asc' };
      case SortBy.PRICE_DESC:
        return { dailyRate: 'desc' };
      case SortBy.NEWEST:
        return { createdAt: 'desc' };
      case SortBy.RATING_DESC:
        // Rating is computed, so we'll sort in memory after fetching
        // Default to newest for the DB query
        return { createdAt: 'desc' };
      default:
        return { createdAt: 'desc' };
    }
  }

  private generateCacheKey(dto: SearchVehiclesDto): string {
    const normalized = {
      start_date: dto.start_date,
      end_date: dto.end_date,
      location: dto.location?.toLowerCase().trim(),
      min_price: dto.min_price,
      max_price: dto.max_price,
      transmission: dto.transmission,
      min_seats: dto.min_seats,
      sort_by: dto.sort_by,
      page: dto.page,
      limit: dto.limit,
    };
    const hash = crypto.createHash('md5').update(JSON.stringify(normalized)).digest('hex');
    return `${this.CACHE_PREFIX}${hash}`;
  }
}
