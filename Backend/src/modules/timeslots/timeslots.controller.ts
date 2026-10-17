import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
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
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  dataArraySchema,
  dataObjectSchema,
  deletedSchema,
} from 'src/common/swagger/schemas';
import {
  CreateTimeSlotDto,
  ResetSlotLayoutDto,
  SaveSlotLayoutDto,
  UpdateTimeSlotDto,
} from 'src/modules/timeslots/dto/timeslots.dto';
import { TimeslotsService } from 'src/modules/timeslots/timeslots.service';

@ApiTags('timeslots')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff | super_user' })
@Controller('timeslots')
export class TimeslotsController {
  constructor(private readonly timeslotsService: TimeslotsService) {}

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get()
  @ApiOperation({ summary: 'List time slots' })
  @ApiQuery({ name: 'restaurant_id', required: false })
  @ApiQuery({ name: 'slot_date', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(
    @Query('restaurant_id') restaurantId?: string,
    @Query('slot_date') slotDate?: string,
    @Req() req?: Request,
  ) {
    return { data: this.timeslotsService.findAll(restaurantId, slotDate, (req as Request & { user?: { role?: Role } })?.user?.role === Role.DINER) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get(':id')
  @ApiOperation({ summary: 'Get time slot by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Time slot not found' })
  findOne(@Param('id') id: string) {
    return { data: this.timeslotsService.findOne(id) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Post()
  @ApiOperation({ summary: 'Create time slot' })
  @ApiBody({ type: CreateTimeSlotDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid time slot payload' })
  create(@Body() dto: CreateTimeSlotDto) {
    return { data: this.timeslotsService.create(dto) };
  }

  @Roles(Role.MANAGER)
  @Patch(':id/layout/reset')
  resetLayout(@Param('id') id:string,@Body() dto:ResetSlotLayoutDto) {
    return {data:this.timeslotsService.resetLayout(id,dto.revision)};
  }

  @Roles(Role.MANAGER)
  @Patch(':id/layout')
  saveLayout(@Param('id') id:string,@Body() dto:SaveSlotLayoutDto) {
    return {data:this.timeslotsService.saveLayout(id,dto)};
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update time slot' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateTimeSlotDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid time slot payload' })
  @ApiNotFoundResponse({ description: 'Time slot not found' })
  update(@Param('id') id: string, @Body() dto: UpdateTimeSlotDto) {
    return { data: this.timeslotsService.update(id, dto) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete time slot' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'Time slot not found' })
  delete(@Param('id') id: string) {
    return { data: this.timeslotsService.delete(id) };
  }
}
