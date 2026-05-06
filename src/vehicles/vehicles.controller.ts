import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { SearchVehiclesDto } from './dto/search-vehicles.dto';
import { VehicleSearchResponseDto } from './dto/vehicle-search-response.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchVehicles(
    @Query() searchDto: SearchVehiclesDto,
  ): Promise<VehicleSearchResponseDto> {
    return this.vehiclesService.searchVehicles(searchDto);
  }
}
