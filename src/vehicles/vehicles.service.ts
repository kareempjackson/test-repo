import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchVehiclesDto, SortBy } from './dto/search-vehicles.dto';
import { VehicleSearchResponseDto, VehicleSearchItemDto } from './dto/vehicle-search-response.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';

@Injectable()
export class VehiclesService {
  private readonly PAGE_SIZE = 20;
  private readonly CACHE_TTL = 300000; // 5 minutes in milliseconds

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async searchVehicles(dto: SearchVehiclesDto): Promise<VehicleSearchResponseDto> {
    const cacheKey = this.buildCacheKey(dto);
    
    const cached = await this.cacheManager.get<VehicleSearchResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.executeSearch(dto);
    
    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
    
    return result;
  }

  private buildCacheKey(dto: SearchVehiclesDto): string {
    const params = [
      `sd:${dto.start_date}`,
      `ed:${dto.end_date}`,
      dto.location ? `loc:${dto.location}` : '',
      dto.min_price !== undefined ? `minp:${dto.min_price}` : '',
      dto.max_price !== undefined ? `maxp:${dto.max_price}` : '',
      dto.transmission ? `trans:${dto.transmission}` : '',
      dto.min_seats !== undefined ? `seats:${dto.min_seats}` : '',
      dto.sort_by ? `sort:${dto.sort_by}` : '',
      `page:${dto.page || 1}`,
    ].filter(Boolean).join('|');
    
    return `vehicle_search:${params}`;
  }

  private async executeSearch(dto: SearchVehiclesDto): Promise<VehicleSearchResponseDto> {
    const page = dto.page || 1;
    const skip = (page - 1) * this.PAGE_SIZE;
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    const whereConditions: Prisma.VehicleWhereInput = {
      is_available: true,
      ...(dto.location && {
        location_text: {
          contains: dto.location,
          mode: 'insensitive' as Prisma.QueryMode,
        },
      }),
      ...(dto.min_price !== undefined && {
        daily_rate: {
          gte: dto.min_price,
        },
      }),
      ...(dto.max_price !== undefined && {
        daily_rate: {
          ...(dto.min_price !== undefined ? { gte: dto.min_price } : {}),
          lte: dto.max_price,
        },
      }),
      ...(dto.transmission && {
        transmission: dto.transmission,
      }),
      ...(dto.min_seats !== undefined && {
        seats: {
          gte: dto.min_seats,
        },
      }),
      // Exclude vehicles that have confirmed/pending bookings overlapping with requested dates
      NOT: {
        bookings: {
          some: {
            status: {
              in: ['confirmed', 'pending'],
            },
            AND: [
              {
                start_date: {
                  lte: endDate,
                },
              },
              {
                end_date: {
                  gte: startDate,
                },
              },
            ],
          },
        },
      },
    };

    const orderBy = this.buildOrderBy(dto.sort_by);

    const [vehicles, totalCount] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: whereConditions,
        include: {
          owner: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              is_verified: true,
            },
          },
          images: {
            where: {
              is_primary: true,
            },
            take: 1,
            select: {
              image_url: true,
            },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
        },
        orderBy,
        skip,
        take: this.PAGE_SIZE,
      }),
      this.prisma.vehicle.count({
        where: whereConditions,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / this.PAGE_SIZE);

    const data: VehicleSearchItemDto[] = vehicles.map((vehicle) => {
      const ratings = vehicle.reviews.map((r) => r.rating);
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : null;

      return {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        daily_rate: Number(vehicle.daily_rate),
        transmission: vehicle.transmission,
        seats: vehicle.seats,
        location_text: vehicle.location_text,
        latitude: vehicle.latitude ? Number(vehicle.latitude) : null,
        longitude: vehicle.longitude ? Number(vehicle.longitude) : null,
        primary_image: vehicle.images[0]?.image_url || null,
        average_rating: averageRating ? Math.round(averageRating * 10) / 10 : null,
        total_reviews: vehicle.reviews.length,
        owner: {
          id: vehicle.owner.id,
          first_name: vehicle.owner.first_name,
          last_name: vehicle.owner.last_name,
          is_verified: vehicle.owner.is_verified,
        },
        created_at: vehicle.created_at,
      };
    });

    // Sort by rating if needed (done in memory since we calculated average)
    if (dto.sort_by === SortBy.RATING_DESC) {
      data.sort((a, b) => {
        if (a.average_rating === null && b.average_rating === null) return 0;
        if (a.average_rating === null) return 1;
        if (b.average_rating === null) return -1;
        return b.average_rating - a.average_rating;
      });
    }

    return {
      data,
      meta: {
        current_page: page,
        per_page: this.PAGE_SIZE,
        total_items: totalCount,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_previous_page: page > 1,
      },
    };
  }

  private buildOrderBy(sortBy?: SortBy): Prisma.VehicleOrderByWithRelationInput {
    switch (sortBy) {
      case SortBy.PRICE_ASC:
        return { daily_rate: 'asc' };
      case SortBy.PRICE_DESC:
        return { daily_rate: 'desc' };
      case SortBy.NEWEST:
        return { created_at: 'desc' };
      case SortBy.RATING_DESC:
        // Rating sorting handled in memory after aggregation
        return { created_at: 'desc' };
      default:
        return { created_at: 'desc' };
    }
  }
}
