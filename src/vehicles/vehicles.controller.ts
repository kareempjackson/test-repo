import { Controller, Get, Query, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { SearchVehiclesDto, SortBy, TransmissionType } from './dto/search-vehicles.dto';
import { VehicleSearchResponseDto } from './dto/vehicle-search-response.dto';

@ApiTags('Vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search available vehicles',
    description:
      'Search for vehicles available for rent within a date range. Supports filtering by location, price, transmission, seats, and sorting options.',
  })
  @ApiQuery({ name: 'start_date', required: true, type: String, example: '2024-02-01' })
  @ApiQuery({ name: 'end_date', required: true, type: String, example: '2024-02-07' })
  @ApiQuery({ name: 'location', required: false, type: String, example: 'Kingston' })
  @ApiQuery({ name: 'min_price', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'max_price', required: false, type: Number, example: 200 })
  @ApiQuery({ name: 'transmission', required: false, enum: TransmissionType })
  @ApiQuery({ name: 'min_seats', required: false, type: Number, example: 4 })
  @ApiQuery({ name: 'sort_by', required: false, enum: SortBy, example: SortBy.PRICE_ASC })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of available vehicles',
    type: VehicleSearchResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters',
  })
  async searchVehicles(@Query() dto: SearchVehiclesDto): Promise<VehicleSearchResponseDto> {
    return this.vehiclesService.searchVehicles(dto);
  }
}
