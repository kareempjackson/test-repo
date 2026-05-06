import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UploadImageDto } from './dto/upload-image.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async createVehicle(
    @Body() createVehicleDto: CreateVehicleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.vehiclesService.create(createVehicleDto, userId);
  }

  @Get(':id')
  @Public()
  async getVehicle(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.vehiclesService.update(id, updateVehicleDto, userId, userRole);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    await this.vehiclesService.softDelete(id, userId, userRole);
  }

  @Post(':id/images')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() uploadImageDto: UploadImageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.vehiclesService.getUploadUrl(id, uploadImageDto, userId, userRole);
  }

  @Get(':id/availability')
  @Public()
  async getAvailability(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.getAvailability(id);
  }

  @Put(':id/availability')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAvailabilityDto: UpdateAvailabilityDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.vehiclesService.updateAvailability(id, updateAvailabilityDto, userId, userRole);
  }
}
