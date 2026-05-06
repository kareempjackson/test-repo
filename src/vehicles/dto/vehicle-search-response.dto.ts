import { ApiProperty } from '@nestjs/swagger';

export class VehicleOwnerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  isVerified: boolean;
}

export class VehicleSearchItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  make: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  year: number;

  @ApiProperty()
  dailyRate: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  transmission: string;

  @ApiProperty()
  seats: number;

  @ApiProperty()
  locationText: string;

  @ApiProperty({ nullable: true })
  primaryImageUrl: string | null;

  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  totalReviews: number;

  @ApiProperty()
  owner: VehicleOwnerDto;

  @ApiProperty()
  createdAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty()
  currentPage: number;

  @ApiProperty()
  itemsPerPage: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPreviousPage: boolean;
}

export class VehicleSearchResponseDto {
  @ApiProperty({ type: [VehicleSearchItemDto] })
  data: VehicleSearchItemDto[];

  @ApiProperty()
  meta: PaginationMetaDto;
}
