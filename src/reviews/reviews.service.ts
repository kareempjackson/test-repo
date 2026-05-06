import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto, ReviewListResponseDto } from './dto/review-response.dto';

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

    const reviewType = isRenter ? ReviewType.CAR_REVIEW : ReviewType.RENTER_REVIEW;

    const existingReview = await this.prisma.review.findFirst({
      where: {
        bookingId,
        reviewType,
      },
    });

    if (existingReview) {
      throw new BadRequestException(
        `You have already left a ${isRenter ? 'car' : 'renter'} review for this booking`,
      );
    }

    const reviewData: any = {
      booking: { connect: { id: bookingId } },
      reviewer: { connect: { id: userId } },
      reviewType,
      rating: dto.rating,
      comment: dto.comment,
    };

    if (isRenter) {
      reviewData.vehicle = { connect: { id: booking.vehicleId } };
    } else {
      reviewData.reviewee = { connect: { id: booking.renterId } };
    }

    const review = await this.prisma.review.create({
      data: reviewData,
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (isRenter) {
      await this.updateVehicleAverageRating(booking.vehicleId);
    } else {
      await this.updateUserAverageRating(booking.renterId);
    }

    return this.mapToResponseDto(review);
  }

  async getVehicleReviews(vehicleId: string): Promise<ReviewListResponseDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const reviews = await this.prisma.review.findMany({
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
    });

    return {
      reviews: reviews.map((r) => this.mapToResponseDto(r)),
      averageRating: vehicle.averageRating || 0,
      totalCount: reviews.length,
    };
  }

  async getUserReviews(userId: string): Promise<ReviewListResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const reviews = await this.prisma.review.findMany({
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
    });

    return {
      reviews: reviews.map((r) => this.mapToResponseDto(r)),
      averageRating: user.averageRating || 0,
      totalCount: reviews.length,
    };
  }

  private async updateVehicleAverageRating(vehicleId: string): Promise<void> {
    const result = await this.prisma.review.aggregate({
      where: {
        vehicleId,
        reviewType: ReviewType.CAR_REVIEW,
      },
      _avg: { rating: true },
    });

    const averageRating = result._avg.rating || 0;

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { averageRating: Math.round(averageRating * 100) / 100 },
    });
  }

  private async updateUserAverageRating(userId: string): Promise<void> {
    const result = await this.prisma.review.aggregate({
      where: {
        revieweeId: userId,
        reviewType: ReviewType.RENTER_REVIEW,
      },
      _avg: { rating: true },
    });

    const averageRating = result._avg.rating || 0;

    await this.prisma.user.update({
      where: { id: userId },
      data: { averageRating: Math.round(averageRating * 100) / 100 },
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
