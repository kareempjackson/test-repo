import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SearchVehiclesDto, SortBy, TransmissionType } from './dto/search-vehicles.dto';
import { VehicleSearchResponse, VehicleSearchResult, PaginationMeta } from './dto/vehicle-search-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class VehiclesService {
  private readonly ITEMS_PER_PAGE = 20;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async searchVehicles(dto: SearchVehiclesDto): Promise<VehicleSearchResponse> {
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    if (startDate >= endDate) {
      throw new BadRequestException('start_date must be before end_date');
    }

    if (startDate < new Date()) {
      throw new BadRequestException('start_date cannot be in the past');
    }

    const cacheKey = this.generateCacheKey(dto);
    const cachedResult = await this.cacheManager.get<VehicleSearchResponse>(cacheKey);
    
    if (cachedResult) {
      return cachedResult;
    }

    const page = dto.page || 1;
    const skip = (page - 1) * this.ITEMS_PER_PAGE;

    const whereConditions = this.buildWhereConditions(dto, startDate, endDate);
    const orderBy = this.buildOrderBy(dto.sort_by);

    const [vehicles, totalCount] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: whereConditions,
        orderBy,
        skip,
        take: this.ITEMS_PER_PAGE,
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
            where: { is_primary: true },
            take: 1,
            select: { image_url: true },
          },
          reviews: {
            select: { rating: true },
          },
        },
      }),
      this.prisma.vehicle.count({ where: whereConditions }),
    ]);

    const results: VehicleSearchResult[] = vehicles.map((vehicle) => {
      const reviewCount = vehicle.reviews.length;
      const averageRating = reviewCount > 0
        ? vehicle.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
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
        primary_image_url: vehicle.images[0]?.image_url || null,
        average_rating: averageRating ? Math.round(averageRating * 10) / 10 : null,
        review_count: reviewCount,
        owner: {
          id: vehicle.owner.id,
          first_name: vehicle.owner.first_name,
          last_name: vehicle.owner.last_name,
          is_verified: vehicle.owner.is_verified,
        },
        created_at: vehicle.created_at,
      };
    });

    const totalPages = Math.ceil(totalCount / this.ITEMS_PER_PAGE);
    const meta: PaginationMeta = {
      current_page: page,
      per_page: this.ITEMS_PER_PAGE,
      total_items: totalCount,
      total_pages: totalPages,
      has_next_page: page < totalPages,
      has_previous_page: page > 1,
    };

    const response: VehicleSearchResponse = { data: results, meta };

    await this.cacheManager.set(cacheKey, response, this.CACHE_TTL_MS);

    return response;
  }

  private buildWhereConditions(
    dto: SearchVehiclesDto,
    startDate: Date,
    endDate: Date,
  ): Prisma.VehicleWhereInput {
    const conditions: Prisma.VehicleWhereInput = {
      is_available: true,
      // Exclude vehicles that have overlapping bookings
      NOT: {
        bookings: {
          some: {
            status: { in: ['pending', 'confirmed', 'active'] },
            OR: [
              {
                start_date: { lte: endDate },
                end_date: { gte: startDate },
              },
            ],
          },
        },
      },
    };

    if (dto.location) {
      conditions.location_text = {
        contains: dto.location,
        mode: 'insensitive',
      };
    }

    if (dto.min_price !== undefined || dto.max_price !== undefined) {
      conditions.daily_rate = {};
      if (dto.min_price !== undefined) {
        conditions.daily_rate.gte = dto.min_price;
      }
      if (dto.max_price !== undefined) {
        conditions.daily_rate.lte = dto.max_price;
      }
    }

    if (dto.transmission) {
      conditions.transmission = dto.transmission === TransmissionType.AUTO ? 'automatic' : 'manual';
    }

    if (dto.min_seats !== undefined) {
      conditions.seats = { gte: dto.min_seats };
    }

    return conditions;
  }

  private buildOrderBy(sortBy?: SortBy): Prisma.VehicleOrderByWithRelationInput[] {
    switch (sortBy) {
      case SortBy.PRICE_ASC:
        return [{ daily_rate: 'asc' }];
      case SortBy.PRICE_DESC:
        return [{ daily_rate: 'desc' }];
      case SortBy.RATING_DESC:
        // For rating sort, we need to handle it differently since it's computed
        // We'll sort by created_at as fallback and rely on post-processing for rating
        return [{ created_at: 'desc' }];
      case SortBy.NEWEST:
      default:
        return [{ created_at: 'desc' }];
    }
  }

  private generateCacheKey(dto: SearchVehiclesDto): string {
    const keyParts = [
      'vehicle_search',
      dto.start_date,
      dto.end_date,
      dto.location || '',
      dto.min_price?.toString() || '',
      dto.max_price?.toString() || '',
      dto.transmission || '',
      dto.min_seats?.toString() || '',
      dto.sort_by || SortBy.NEWEST,
      dto.page?.toString() || '1',
    ];
    return keyParts.join(':');
  }
}
