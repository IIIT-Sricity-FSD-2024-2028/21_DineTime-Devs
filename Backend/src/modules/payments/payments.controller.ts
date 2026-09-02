import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
import { DenySuperUserGuard } from 'src/common/guards/deny-super-user.guard';
import {
  dataArraySchema,
  dataObjectSchema,
  deletedSchema,
} from 'src/common/swagger/schemas';
import { CreatePaymentDto, UpdatePaymentDto } from 'src/modules/payments/dto/payments.dto';
import { PaymentsService } from 'src/modules/payments/payments.service';

@ApiTags('payments')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff' })
@UseGuards(DenySuperUserGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles(Role.DINER, Role.STAFF)
  @Get()
  @ApiOperation({ summary: 'List payments' })
  @ApiQuery({ name: 'reservation_id', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(@Query('reservation_id') reservationId?: string) {
    return { data: this.paymentsService.findAll(reservationId) };
  }

  @Roles(Role.DINER, Role.STAFF)
  @Get(':id')
  @ApiOperation({ summary: 'Get payment by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  findOne(@Param('id') id: string) {
    return { data: this.paymentsService.findOne(id) };
  }

  @Roles(Role.DINER)
  @Post()
  @ApiOperation({ summary: 'Create payment' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid payment payload' })
  create(@Body() dto: CreatePaymentDto) {
    return { data: this.paymentsService.create(dto) };
  }

  @Roles(Role.DINER, Role.STAFF)
  @Patch(':id')
  @ApiOperation({ summary: 'Update payment' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdatePaymentDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid payment payload' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return { data: this.paymentsService.update(id, dto) };
  }

  @Roles(Role.DINER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete payment' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  delete(@Param('id') id: string) {
    return { data: this.paymentsService.delete(id) };
  }
}
