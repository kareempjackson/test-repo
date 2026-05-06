import { ReviewType } from './create-review.dto';

export class ReviewAuthorDto {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export class ReviewResponseDto {
  id: string;
  bookingId: string;
  type: ReviewType;
  rating: number;
  comment: string;
  author: ReviewAuthorDto;
  createdAt: Date;
}

export class PaginatedReviewsResponseDto {
  data: ReviewResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
