import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ReviewsService, ReviewType } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto, PaginatedReviewsResponseDto } from './dto/review-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('bookings/:id/reviews/car')
  @UseGuards(JwtAuthGuard)
  async createCarReview(
    @Param('id') bookingId: string,
    @Body() dto: CreateReviewDto,
    @Request() req: any,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.createReview(
      bookingId,
      req.user.id,
      ReviewType.CAR_REVIEW,
      dto,
    );
  }

  @Post('bookings/:id/reviews/renter')
  @UseGuards(JwtAuthGuard)
  async createRenterReview(
    @Param('id') bookingId: string,
    @Body() dto: CreateReviewDto,
    @Request() req: any,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.createReview(
      bookingId,
      req.user.id,
      ReviewType.RENTER_REVIEW,
      dto,
    );
  }

  @Get('vehicles/:id/reviews')
  async getVehicleReviews(
    @Param('id') vehicleId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PaginatedReviewsResponseDto> {
    return this.reviewsService.getVehicleReviews(vehicleId, page, limit);
  }

  @Get('users/:id/reviews')
  async getUserReviews(
    @Param('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PaginatedReviewsResponseDto> {
    return this.reviewsService.getUserReviews(userId, page, limit);
  }
}
