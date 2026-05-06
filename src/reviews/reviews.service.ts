import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto, PaginatedReviewsResponseDto } from './dto/review-response.dto';

export enum ReviewType {
  CAR_REVIEW = 'CAR_REVIEW',
  RENTER_REVIEW = 'RENTER_REVIEW',
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    bookingId: string,
    userId: string,
    reviewType: ReviewType,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: {
          include: { owner: true },
        },
        renter: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException('Reviews can only be left for completed bookings');
    }

    const isRenter = booking.renterId === userId;
    const isOwner = booking.vehicle.ownerId === userId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenException('You are not authorized to review this booking');
    }

    if (reviewType === ReviewType.CAR_REVIEW && !isRenter) {
      throw new ForbiddenException('Only the renter can leave a car review');
    }

    if (reviewType === ReviewType.RENTER_REVIEW && !isOwner) {
      throw new ForbiddenException('Only the vehicle owner can leave a renter review');
    }

    const existingReview = await this.prisma.review.findFirst({
      where: {
        bookingId,
        reviewType,
      },
    });

    if (existingReview) {
      throw new BadRequestException(
        `A ${reviewType === ReviewType.CAR_REVIEW ? 'car' : 'renter'} review already exists for this booking`,
      );
    }

    const reviewData: any = {
      bookingId,
      reviewerId: userId,
      reviewType,
      rating: dto.rating,
      comment: dto.comment,
    };

    if (reviewType === ReviewType.CAR_REVIEW) {
      reviewData.vehicleId = booking.vehicleId;
    } else {
      reviewData.revieweeId = booking.renterId;
    }

    const review = await this.prisma.review.create({
      data: reviewData,
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (reviewType === ReviewType.CAR_REVIEW) {
      await this.updateVehicleAverageRating(booking.vehicleId);
    } else {
      await this.updateUserAverageRating(booking.renterId);
    }

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
          reviewType: ReviewType.CAR_REVIEW,
        },
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          vehicleId,
          reviewType: ReviewType.CAR_REVIEW,
        },
      }),
    ]);

    return {
      reviews: reviews.map(this.mapToResponseDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
          revieweeId: userId,
          reviewType: ReviewType.RENTER_REVIEW,
        },
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          revieweeId: userId,
          reviewType: ReviewType.RENTER_REVIEW,
        },
      }),
    ]);

    return {
      reviews: reviews.map(this.mapToResponseDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async updateVehicleAverageRating(vehicleId: string): Promise<void> {
    const result = await this.prisma.review.aggregate({
      where: {
        vehicleId,
        reviewType: ReviewType.CAR_REVIEW,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        averageRating: result._avg.rating || 0,
        totalReviews: result._count.rating,
      },
    });
  }

  private async updateUserAverageRating(userId: string): Promise<void> {
    const result = await this.prisma.review.aggregate({
      where: {
        revieweeId: userId,
        reviewType: ReviewType.RENTER_REVIEW,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        renterRating: result._avg.rating || 0,
        totalRenterReviews: result._count.rating,
      },
    });
  }

  private mapToResponseDto(review: any): ReviewResponseDto {
    return {
      id: review.id,
      bookingId: review.bookingId,
      reviewerId: review.reviewerId,
      revieweeId: review.revieweeId,
      vehicleId: review.vehicleId,
      reviewType: review.reviewType,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      reviewer: review.reviewer,
    };
  }
}
