import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ReadOnlyForSuperUserGuard } from 'src/common/guards/read-only-for-super-user.guard';
import {
  dataArraySchema,
  dataObjectSchema,
  deletedSchema,
} from 'src/common/swagger/schemas';
import { getActingRole as actingRole } from 'src/common/utils/acting-role.util';
import {
  CreateReservationDto,
  UpdateReservationDto,
} from 'src/modules/reservations/dto/reservations.dto';
import { ReservationsService } from 'src/modules/reservations/reservations.service';

@ApiTags('reservations')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff' })
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get()
  @ApiOperation({ summary: 'List reservations' })
  @ApiQuery({ name: 'user_id', required: false })
  @ApiQuery({ name: 'restaurant_id', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(
    @Query('user_id') userId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return { data: this.reservationsService.findAll(userId, restaurantId) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get(':id')
  @ApiOperation({ summary: 'Get reservation by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  findOne(@Param('id') id: string) {
    return { data: this.reservationsService.findOne(id) };
  }

  @Roles(Role.DINER)
  @UseGuards(ReadOnlyForSuperUserGuard)
  @Post()
  @ApiOperation({ summary: 'Create reservation' })
  @ApiBody({ type: CreateReservationDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid reservation payload' })
  create(@Body() dto: CreateReservationDto) {
    return { data: this.reservationsService.create(dto) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @UseGuards(ReadOnlyForSuperUserGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update reservation' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateReservationDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid reservation payload' })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  update(@Param('id') id: string, @Body() dto: UpdateReservationDto, @Req() req: Request) {
    return { data: this.reservationsService.update(id, dto, actingRole(req)) };
  }

  @Roles(Role.DINER, Role.SUPER_USER)
  @UseGuards(ReadOnlyForSuperUserGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete reservation' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  delete(@Param('id') id: string) {
    return { data: this.reservationsService.delete(id) };
  }
}
