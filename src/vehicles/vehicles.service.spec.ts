import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchVehiclesDto, SortBy, TransmissionType } from './dto/search-vehicles.dto';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prismaService: PrismaService;
  let cacheManager: any;

  const mockPrismaService = {
    vehicle: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheManager = module.get(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchVehicles', () => {
    const baseDto: SearchVehiclesDto = {
      start_date: '2024-02-01',
      end_date: '2024-02-07',
      page: 1,
      limit: 20,
    };

    it('should throw BadRequestException when end_date is before start_date', async () => {
      const dto: SearchVehiclesDto = {
        ...baseDto,
        start_date: '2024-02-07',
        end_date: '2024-02-01',
      };

      await expect(service.searchVehicles(dto)).rejects.toThrow(BadRequestException);
    });

    it('should return cached results when available', async () => {
      const cachedResponse = {
        data: [],
        meta: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockCacheManager.get.mockResolvedValue(cachedResponse);

      const result = await service.searchVehicles(baseDto);

      expect(result).toEqual(cachedResponse);
      expect(mockPrismaService.vehicle.findMany).not.toHaveBeenCalled();
    });

    it('should return search results and cache them', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.count.mockResolvedValue(1);
      mockPrismaService.vehicle.findMany.mockResolvedValue([
        {
          id: 'vehicle-1',
          make: 'Toyota',
          model: 'Corolla',
          year: 2022,
          dailyRate: 75.0,
          currency: 'USD',
          transmission: 'auto',
          seats: 5,
          locationText: 'Kingston, Jamaica',
          createdAt: new Date('2024-01-01'),
          owner: {
            id: 'owner-1',
            firstName: 'John',
            lastName: 'Doe',
            isVerified: true,
          },
          images: [{ url: 'https://example.com/image.jpg' }],
          reviews: [{ rating: 5 }, { rating: 4 }],
        },
      ]);

      const result = await service.searchVehicles(baseDto);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].make).toBe('Toyota');
      expect(result.data[0].averageRating).toBe(4.5);
      expect(result.data[0].totalReviews).toBe(2);
      expect(result.data[0].owner.isVerified).toBe(true);
      expect(result.meta.totalItems).toBe(1);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should apply all filters correctly', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.count.mockResolvedValue(0);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);

      const dto: SearchVehiclesDto = {
        ...baseDto,
        location: 'Kingston',
        min_price: 50,
        max_price: 100,
        transmission: TransmissionType.AUTO,
        min_seats: 4,
        sort_by: SortBy.PRICE_ASC,
      };

      await service.searchVehicles(dto);

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isAvailable: true,
            locationText: { contains: 'Kingston', mode: 'insensitive' },
            dailyRate: { gte: 50, lte: 100 },
            transmission: 'auto',
            seats: { gte: 4 },
          }),
          orderBy: { dailyRate: 'asc' },
        }),
      );
    });
  });
});
