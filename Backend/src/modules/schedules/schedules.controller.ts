import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { dataObjectSchema } from 'src/common/swagger/schemas';
import { CreateScheduleRuleDto, RemoveScheduleRulesDto, ResetDateScheduleDto, UpdateDateScheduleDto, UpdateDefaultLayoutDto, UpdateWeeklyScheduleDto } from './dto/schedules.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('schedules')
@ApiHeader({ name: 'role', required: true, description: 'manager | super_user' })
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Get()
  @ApiOperation({ summary: 'Get a restaurant weekly schedule and exceptions' })
  @ApiQuery({ name: 'restaurant_id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  find(@Query('restaurant_id') restaurantId: string) {
    return { data: this.schedules.get(restaurantId) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Patch(':restaurantId/weekly')
  @ApiParam({ name: 'restaurantId' })
  @ApiBody({ type: UpdateWeeklyScheduleDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  updateWeekly(@Param('restaurantId') restaurantId: string, @Body() dto: UpdateWeeklyScheduleDto) {
    return { data: this.schedules.updateWeekly(restaurantId, dto) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Patch(':restaurantId/date')
  @ApiParam({ name: 'restaurantId' })
  @ApiBody({ type: UpdateDateScheduleDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  updateDate(@Param('restaurantId') restaurantId: string, @Body() dto: UpdateDateScheduleDto) {
    return { data: this.schedules.updateDate(restaurantId, dto) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Patch(':restaurantId/date/reset')
  resetDate(@Param('restaurantId') restaurantId: string, @Body() dto: ResetDateScheduleDto) {
    return { data: this.schedules.resetDate(restaurantId, dto.start_date) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Patch(':restaurantId/default-layout')
  @ApiParam({ name: 'restaurantId' })
  @ApiBody({ type: UpdateDefaultLayoutDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  updateDefaultLayout(@Param('restaurantId') restaurantId: string, @Body() dto: UpdateDefaultLayoutDto) {
    return { data: this.schedules.updateDefaultLayout(restaurantId, dto.layout) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Post('rules')
  @ApiBody({ type: CreateScheduleRuleDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  createRule(@Body() dto: CreateScheduleRuleDto) {
    return { data: this.schedules.createRule(dto.restaurant_id, dto) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Delete(':restaurantId/rules')
  @ApiParam({ name: 'restaurantId' })
  @ApiOkResponse({ schema: dataObjectSchema })
  removeRules(@Param('restaurantId') restaurantId: string, @Body() dto: RemoveScheduleRulesDto) {
    return { data: this.schedules.removeRules(restaurantId, dto.rule_ids) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Delete(':restaurantId/rules/:ruleId')
  @ApiParam({ name: 'restaurantId' })
  @ApiParam({ name: 'ruleId' })
  @ApiOkResponse({ schema: dataObjectSchema })
  removeRule(@Param('restaurantId') restaurantId: string, @Param('ruleId') ruleId: string) {
    return { data: this.schedules.removeRule(restaurantId, ruleId) };
  }
}
