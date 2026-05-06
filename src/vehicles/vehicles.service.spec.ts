import { Test, TestingModule } from '@nestjs/testing';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SearchVehiclesDto, SortBy, TransmissionType } from './dto/search-vehicles.dto';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prismaService: PrismaService;
  let cacheManager: any;

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
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchVehicles', () => {
    const mockSearchDto: SearchVehiclesDto = {
      start_date: '2024-03-01',
      end_date: '2024-03-05',
      page: 1,
    };

    const mockVehicles = [
      {
        id: 'vehicle-1',
        make: 'Toyota',
        model: 'Corolla',
        year: 2022,
        daily_rate: 50,
        transmission: 'auto',
        seats: 5,
        location_text: 'Kingston, Jamaica',
        latitude: 18.0179,
        longitude: -76.8099,
        is_available: true,
        created_at: new Date(),
        owner: {
          id: 'owner-1',
          first_name: 'John',
          last_name: 'Doe',
          is_verified: true,
        },
        images: [{ image_url: 'https://example.com/car1.jpg' }],
        reviews: [{ rating: 5 }, { rating: 4 }],
      },
    ];

    it('should return cached results if available', async () => {
      const cachedResult = {
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

      mockCacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.searchVehicles(mockSearchDto);

      expect(result).toEqual(cachedResult);
      expect(mockPrismaService.vehicle.findMany).not.toHaveBeenCalled();
    });

    it('should query database when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue(mockVehicles);
      mockPrismaService.vehicle.count.mockResolvedValue(1);

      const result = await service.searchVehicles(mockSearchDto);

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalled();
      expect(mockPrismaService.vehicle.count).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].average_rating).toBe(4.5);
    });

    it('should filter by location', async () => {
      const searchWithLocation: SearchVehiclesDto = {
        ...mockSearchDto,
        location: 'Kingston',
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);
      mockPrismaService.vehicle.count.mockResolvedValue(0);

      await service.searchVehicles(searchWithLocation);

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location_text: expect.objectContaining({
              contains: 'Kingston',
              mode: 'insensitive',
            }),
          }),
        }),
      );
    });

    it('should filter by price range', async () => {
      const searchWithPrice: SearchVehiclesDto = {
        ...mockSearchDto,
        min_price: 30,
        max_price: 100,
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);
      mockPrismaService.vehicle.count.mockResolvedValue(0);

      await service.searchVehicles(searchWithPrice);

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            daily_rate: expect.objectContaining({
              gte: 30,
              lte: 100,
            }),
          }),
        }),
      );
    });

    it('should filter by transmission type', async () => {
      const searchWithTransmission: SearchVehiclesDto = {
        ...mockSearchDto,
        transmission: TransmissionType.MANUAL,
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);
      mockPrismaService.vehicle.count.mockResolvedValue(0);

      await service.searchVehicles(searchWithTransmission);

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transmission: 'manual',
          }),
        }),
      );
    });

    it('should sort by price ascending', async () => {
      const searchWithSort: SearchVehiclesDto = {
        ...mockSearchDto,
        sort_by: SortBy.PRICE_ASC,
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue([]);
      mockPrismaService.vehicle.count.mockResolvedValue(0);

      await service.searchVehicles(searchWithSort);

      expect(mockPrismaService.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { daily_rate: 'asc' },
        }),
      );
    });

    it('should cache search results', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.vehicle.findMany.mockResolvedValue(mockVehicles);
      mockPrismaService.vehicle.count.mockResolvedValue(1);

      await service.searchVehicles(mockSearchDto);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        300000,
      );
    });
  });
});
