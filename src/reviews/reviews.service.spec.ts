import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewType } from './dto/create-review.dto';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    booking: {
      findUnique: jest.fn(),
    },
    review: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    vehicle: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    const mockBooking = {
      id: 'booking-1',
      vehicleId: 'vehicle-1',
      renterId: 'renter-1',
      status: 'completed',
      vehicle: {
        id: 'vehicle-1',
        ownerId: 'owner-1',
      },
    };

    it('should throw NotFoundException when booking does not exist', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.createReview('booking-1', 'user-1', {
          type: ReviewType.VEHICLE_REVIEW,
          rating: 5,
          comment: 'This is a great vehicle to rent!',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when booking is not completed', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: 'pending',
      });

      await expect(
        service.createReview('booking-1', 'renter-1', {
          type: ReviewType.VEHICLE_REVIEW,
          rating: 5,
          comment: 'This is a great vehicle to rent!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when non-renter tries to review vehicle', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.createReview('booking-1', 'wrong-user', {
          type: ReviewType.VEHICLE_REVIEW,
          rating: 5,
          comment: 'This is a great vehicle to rent!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when non-owner tries to review renter', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.createReview('booking-1', 'wrong-user', {
          type: ReviewType.RENTER_REVIEW,
          rating: 5,
          comment: 'This renter was very responsible!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when review already exists', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.review.findUnique.mockResolvedValue({ id: 'existing-review' });

      await expect(
        service.createReview('booking-1', 'renter-1', {
          type: ReviewType.VEHICLE_REVIEW,
          rating: 5,
          comment: 'This is a great vehicle to rent!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create vehicle review and update vehicle average rating', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.review.findUnique.mockResolvedValue(null);
      mockPrismaService.review.create.mockResolvedValue({
        id: 'review-1',
        bookingId: 'booking-1',
        authorId: 'renter-1',
        type: 'vehicle_review',
        rating: 5,
        comment: 'This is a great vehicle to rent!',
        createdAt: new Date(),
        author: {
          id: 'renter-1',
          fullName: 'John Doe',
          avatarUrl: null,
        },
      });
      mockPrismaService.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { id: 10 },
      });

      const result = await service.createReview('booking-1', 'renter-1', {
        type: ReviewType.VEHICLE_REVIEW,
        rating: 5,
        comment: 'This is a great vehicle to rent!',
      });

      expect(result).toBeDefined();
      expect(result.rating).toBe(5);
      expect(mockPrismaService.vehicle.update).toHaveBeenCalled();
    });
  });

  describe('getVehicleReviews', () => {
    it('should throw NotFoundException when vehicle does not exist', async () => {
      mockPrismaService.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.getVehicleReviews('vehicle-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return paginated vehicle reviews', async () => {
      mockPrismaService.vehicle.findUnique.mockResolvedValue({ id: 'vehicle-1' });
      mockPrismaService.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          bookingId: 'booking-1',
          type: 'vehicle_review',
          rating: 5,
          comment: 'Great car!',
          createdAt: new Date(),
          author: { id: 'user-1', fullName: 'John', avatarUrl: null },
        },
      ]);
      mockPrismaService.review.count.mockResolvedValue(1);

      const result = await service.getVehicleReviews('vehicle-1', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getUserReviews', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserReviews('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return paginated user reviews', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          bookingId: 'booking-1',
          type: 'renter_review',
          rating: 4,
          comment: 'Good renter, took care of the car!',
          createdAt: new Date(),
          author: { id: 'owner-1', fullName: 'Jane', avatarUrl: null },
        },
      ]);
      mockPrismaService.review.count.mockResolvedValue(1);

      const result = await service.getUserReviews('user-1', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
