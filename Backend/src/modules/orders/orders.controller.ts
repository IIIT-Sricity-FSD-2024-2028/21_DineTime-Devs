import { GoneException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { getActingRole } from 'src/common/utils/acting-role.util';
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
import { CreateOrderDto, UpdateOrderDto } from 'src/modules/orders/dto/orders.dto';
import { OrdersService } from 'src/modules/orders/orders.service';

@ApiTags('orders')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff' })
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(Role.DINER, Role.STAFF, Role.MANAGER)
  @Get()
  @ApiOperation({ summary: 'List orders' })
  @ApiQuery({ name: 'reservation_id', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(@Req() req: Request, @Query('reservation_id') reservationId?: string) {
    const userId = (req as Request & { user?: { sub?: string } }).user?.sub;
    return { data: this.ordersService.findAll(reservationId, getActingRole(req), userId) };
  }

  @Roles(Role.DINER, Role.STAFF, Role.MANAGER)
  @Get(':id')
  @ApiOperation({ summary: 'Get order by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as Request & { user?: { sub?: string } }).user?.sub;
    return { data: this.ordersService.findOne(id, getActingRole(req), userId) };
  }

  @Roles(Role.DINER)
  @Post()
  @ApiOperation({ summary: 'Create order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid order payload' })
  create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    const userId = (req as Request & { user?: { sub?: string } }).user?.sub;
    throw new GoneException('Online order placement is no longer available. You can still view the restaurant menu.');
  }

  @Roles(Role.STAFF)
  @Patch(':id')
  @ApiOperation({ summary: 'Update order' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateOrderDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid order payload' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return { data: this.ordersService.update(id, dto) };
  }

  @Roles(Role.DINER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete order' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  remove(@Param('id') id: string) {
    return { data: this.ordersService.delete(id) };
  }
}
