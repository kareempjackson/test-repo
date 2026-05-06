export interface VehicleOwner {
  id: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
}

export interface VehicleSearchResult {
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
  primary_image_url: string | null;
  average_rating: number | null;
  review_count: number;
  owner: VehicleOwner;
  created_at: Date;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface VehicleSearchResponse {
  data: VehicleSearchResult[];
  meta: PaginationMeta;
}
