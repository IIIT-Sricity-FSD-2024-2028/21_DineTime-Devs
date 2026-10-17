import { Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { dataArraySchema, dataObjectSchema } from 'src/common/swagger/schemas';
import {
  SeedRestaurantTableSlotsDto,
  UpdateTableSlotStatusDto,
} from 'src/modules/tableslots/dto/tableslots.dto';
import { TableslotsService } from 'src/modules/tableslots/tableslots.service';
import { getActingRole } from 'src/common/utils/acting-role.util';

@ApiTags('tableslots')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff | super_user' })
@Controller('tableslots')
export class TableslotsController {
  constructor(private readonly tableslotsService: TableslotsService) {}

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get()
  @ApiOperation({ summary: 'List table slots' })
  @ApiQuery({ name: 'restaurant_id', required: false })
  @ApiQuery({ name: 'slot_id', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(
    @Query('restaurant_id') restaurantId?: string,
    @Query('slot_id') slotId?: string,
  ) {
    return { data: this.tableslotsService.findAll(restaurantId, slotId) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get('availability')
  @ApiOperation({ summary: 'Get table slot availability' })
  @ApiQuery({ name: 'restaurant_id' })
  @ApiQuery({ name: 'slot_id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  getAvailability(
    @Query('restaurant_id') restaurantId: string,
    @Query('slot_id') slotId: string,
  ) {
    return { data: this.tableslotsService.getAvailability(restaurantId, slotId) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Post('seed')
  @ApiOperation({ summary: 'Create missing table-slot availability for a restaurant' })
  @ApiBody({ type: SeedRestaurantTableSlotsDto })
  @ApiOkResponse({ schema: dataArraySchema })
  seed(@Body() dto: SeedRestaurantTableSlotsDto) {
    return { data: this.tableslotsService.seedRestaurantSlots(dto.restaurant_id) };
  }

  @Roles(Role.MANAGER, Role.STAFF)
  @Patch('status')
  @ApiOperation({ summary: 'Update table slot status' })
  @ApiBody({ type: UpdateTableSlotStatusDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid table slot status payload' })
  updateStatus(@Body() dto: UpdateTableSlotStatusDto, @Req() req: Request) {
    return { data: this.tableslotsService.updateStatus(dto, getActingRole(req)) };
  }
}
