export class ReviewResponseDto {
  id: string;
  bookingId: string;
  reviewerId: string;
  revieweeId: string | null;
  vehicleId: string | null;
  reviewType: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export class ReviewListResponseDto {
  reviews: ReviewResponseDto[];
  averageRating: number;
  totalCount: number;
}
