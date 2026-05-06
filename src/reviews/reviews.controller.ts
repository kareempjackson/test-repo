import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('bookings/:id/reviews')
  @UseGuards(JwtAuthGuard)
  async createReview(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() dto: CreateReviewDto,
    @Req() req: any,
  ) {
    return this.reviewsService.createReview(bookingId, req.user.id, dto);
  }

  @Get('vehicles/:id/reviews')
  async getVehicleReviews(
    @Param('id', ParseUUIDPipe) vehicleId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.getVehicleReviews(
      vehicleId,
      pagination.page,
      pagination.limit,
    );
  }

  @Get('users/:id/reviews')
  async getUserReviews(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.getUserReviews(
      userId,
      pagination.page,
      pagination.limit,
    );
  }
}
