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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UploadImageDto } from './dto/upload-image.dto';
import { UserRole } from '@prisma/client';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createVehicleDto: CreateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiclesService.create(createVehicleDto, user.id);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiclesService.update(id, updateVehicleDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.vehiclesService.softDelete(id, user);
  }

  @Post(':id/images')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() uploadImageDto: UploadImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiclesService.getUploadUrl(id, uploadImageDto, user);
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiclesService.updateAvailability(id, updateAvailabilityDto, user);
  }
}
