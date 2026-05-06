export class VehicleOwnerDto {
  id: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
}

export class VehicleSearchItemDto {
  id: string;
  make: string;
  model: string;
  year: number;
  daily_rate: number;
  transmission: string;
  seats: number;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  primary_image: string | null;
  average_rating: number | null;
  total_reviews: number;
  owner: VehicleOwnerDto;
  created_at: Date;
}

export class PaginationMetaDto {
  current_page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export class VehicleSearchResponseDto {
  data: VehicleSearchItemDto[];
  meta: PaginationMetaDto;
}
