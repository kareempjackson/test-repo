import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';
import { SortBy, TransmissionType } from './dto/search-vehicles.dto';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prismaService: PrismaService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };

  const mockPrismaService = {
    vehicle: {
      findMany: jest.fn(),
      count: jest.fn(),
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
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureEndDate = new Date();
    futureEndDate.setDate(futureEndDate.getDate() + 10);

    const validDto = {
      start_date: futureDate.toISOString().split('T')[0],
      end_date: futureEndDate.toISOString().split('T')[0],
    };

    it('should throw BadRequestException when start_date is after end_date', async () => {
      const invalidDto = {
        start_date: futureEndDate.toISOString().split('T')[0],
        end_date: futureDate.toISOString().split('T')[0],
      };

      await expect(service.searchVehicles(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when start_date is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const invalidDto = {
        start_date: pastDate.toISOString().split('T')[0],
        end_date: futureDate.toISOString().split('T')[0],
      };

      await expect(service.searchVehicles(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should return cached results when available', async () => {
      const cachedResponse = {
        data: [],
        meta: {
          current_page: 1,
          per_page: 20,
          total_items: 0,
          total_pages: 0,
          has_next_page: false,
          has_previous_page: false,
        },
      };

      cacheManager.get.mockResolvedValue(cachedResponse);

      const result = await service.searchVehicles(validDto);

      expect(result).toEqual(cachedResponse);
      expect(mockPrismaService.vehicle.findMany).not.toHaveBeenCalled();
    });

    it('should query database and cache results when cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);
      mockPrismaService.vehicle.count.mockResolvedValue(0);

      const result = await service.searchVehicles(validDto);

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalled();
      expect(mockPrismaService.vehicle.count).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalled();
      expect(result.data).toEqual([]);
    });

    it('should apply location filter when provided', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);
      mockPrismaService.vehicle.count.mockResolvedValue(0);

      await service.searchVehicles({ ...validDto, location: 'Kingston' });

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location_text: { contains: 'Kingston', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should apply price filters when provided', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);
      mockPrismaService.vehicle.count.mockResolvedValue(0);

      await service.searchVehicles({ ...validDto, min_price: 50, max_price: 150 });

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            daily_rate: { gte: 50, lte: 150 },
          }),
        }),
      );
    });

    it('should apply transmission filter when provided', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);
      mockPrismaService.vehicle.count.mockResolvedValue(0);

      await service.searchVehicles({ ...validDto, transmission: TransmissionType.AUTO });

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transmission: 'automatic',
          }),
        }),
      );
    });

    it('should calculate average rating correctly', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([
        {
          id: '1',
          make: 'Toyota',
          model: 'Camry',
          year: 2022,
          daily_rate: 75,
          transmission: 'automatic',
          seats: 5,
          location_text: 'Kingston, Jamaica',
          latitude: null,
          longitude: null,
          created_at: new Date(),
          owner: {
            id: 'owner-1',
            first_name: 'John',
            last_name: 'Doe',
            is_verified: true,
          },
          images: [{ image_url: 'https://example.com/car.jpg' }],
          reviews: [{ rating: 4 }, { rating: 5 }, { rating: 4 }],
        },
      ]);
      mockPrismaService.vehicle.count.mockResolvedValue(1);

      const result = await service.searchVehicles(validDto);

      expect(result.data[0].average_rating).toBe(4.3);
      expect(result.data[0].review_count).toBe(3);
    });
  });
});
