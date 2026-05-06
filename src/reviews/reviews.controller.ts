import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto, ReviewListResponseDto } from './dto/review-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('bookings/:id/reviews')
  async createReview(
    @Param('id') bookingId: string,
    @Body() dto: CreateReviewDto,
    @Request() req: any,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.createReview(bookingId, req.user.sub, dto);
  }

  @Get('vehicles/:id/reviews')
  async getVehicleReviews(
    @Param('id') vehicleId: string,
  ): Promise<ReviewListResponseDto> {
    return this.reviewsService.getVehicleReviews(vehicleId);
  }

  @Get('users/:id/reviews')
  async getUserReviews(
    @Param('id') userId: string,
  ): Promise<ReviewListResponseDto> {
    return this.reviewsService.getUserReviews(userId);
  }
}
