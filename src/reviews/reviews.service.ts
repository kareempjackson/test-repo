import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto, ReviewType } from './dto/create-review.dto';
import { ReviewResponseDto, PaginatedReviewsResponseDto } from './dto/review-response.dto';
import { ReviewType as PrismaReviewType } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    bookingId: string,
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'completed') {
      throw new BadRequestException('Reviews can only be submitted for completed bookings');
    }

    const prismaReviewType = dto.type === ReviewType.VEHICLE_REVIEW 
      ? PrismaReviewType.vehicle_review 
      : PrismaReviewType.renter_review;

    if (dto.type === ReviewType.VEHICLE_REVIEW) {
      if (booking.renterId !== userId) {
        throw new ForbiddenException('Only the renter can leave a vehicle review');
      }
    } else if (dto.type === ReviewType.RENTER_REVIEW) {
      if (booking.vehicle.ownerId !== userId) {
        throw new ForbiddenException('Only the vehicle owner can leave a renter review');
      }
    }

    const existingReview = await this.prisma.review.findUnique({
      where: {
        bookingId_type: {
          bookingId,
          type: prismaReviewType,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException(`A ${dto.type} already exists for this booking`);
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const reviewData: any = {
        bookingId,
        authorId: userId,
        type: prismaReviewType,
        rating: dto.rating,
        comment: dto.comment,
      };

      if (dto.type === ReviewType.VEHICLE_REVIEW) {
        reviewData.vehicleId = booking.vehicleId;
      } else {
        reviewData.subjectId = booking.renterId;
      }

      const createdReview = await tx.review.create({
        data: reviewData,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (dto.type === ReviewType.VEHICLE_REVIEW) {
        const vehicleReviews = await tx.review.aggregate({
          where: {
            vehicleId: booking.vehicleId,
            type: PrismaReviewType.vehicle_review,
          },
          _avg: { rating: true },
          _count: { id: true },
        });

        await tx.vehicle.update({
          where: { id: booking.vehicleId },
          data: {
            averageRating: vehicleReviews._avg.rating || 0,
            totalReviews: vehicleReviews._count.id,
          },
        });
      } else {
        const renterReviews = await tx.review.aggregate({
          where: {
            subjectId: booking.renterId,
            type: PrismaReviewType.renter_review,
          },
          _avg: { rating: true },
          _count: { id: true },
        });

        await tx.user.update({
          where: { id: booking.renterId },
          data: {
            averageRating: renterReviews._avg.rating || 0,
            totalReviews: renterReviews._count.id,
          },
        });
      }

      return createdReview;
    });

    return this.mapToResponseDto(review);
  }

  async getVehicleReviews(
    vehicleId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedReviewsResponseDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          vehicleId,
          type: PrismaReviewType.vehicle_review,
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          vehicleId,
          type: PrismaReviewType.vehicle_review,
        },
      }),
    ]);

    return {
      data: reviews.map((r) => this.mapToResponseDto(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserReviews(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedReviewsResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          subjectId: userId,
          type: PrismaReviewType.renter_review,
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          subjectId: userId,
          type: PrismaReviewType.renter_review,
        },
      }),
    ]);

    return {
      data: reviews.map((r) => this.mapToResponseDto(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private mapToResponseDto(review: any): ReviewResponseDto {
    return {
      id: review.id,
      bookingId: review.bookingId,
      type: review.type === PrismaReviewType.vehicle_review 
        ? ReviewType.VEHICLE_REVIEW 
        : ReviewType.RENTER_REVIEW,
      rating: review.rating,
      comment: review.comment,
      author: {
        id: review.author.id,
        fullName: review.author.fullName,
        avatarUrl: review.author.avatarUrl,
      },
      createdAt: review.createdAt,
    };
  }
}
