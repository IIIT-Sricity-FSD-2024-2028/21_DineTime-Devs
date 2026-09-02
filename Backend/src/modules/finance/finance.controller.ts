import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { DenySuperUserGuard } from 'src/common/guards/deny-super-user.guard';
import { dataArraySchema, dataObjectSchema } from 'src/common/swagger/schemas';
import { getActingRole as actingRole } from 'src/common/utils/acting-role.util';
import {
  BlockPaymentDto,
  BlockPayoutDto,
  FinanceRefundDecisionDto,
  SettleAllPayoutsDto,
} from 'src/modules/finance/dto/finance.dto';
import { FinanceService } from 'src/modules/finance/finance.service';

@ApiTags('finance')
@ApiHeader({ name: 'role', required: true, description: 'finance_admin' })
@Roles(Role.FINANCE_ADMIN)
@UseGuards(DenySuperUserGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('refunds')
  @ApiOperation({ summary: 'List support tickets escalated to finance for a refund decision' })
  @ApiOkResponse({ schema: dataArraySchema })
  listRefunds(@Req() req: Request) {
    return { data: this.financeService.listRefunds(actingRole(req)) };
  }

  @Get('refunds/:id')
  @ApiOperation({ summary: 'Get a single escalated refund ticket with its linked reservation/payment' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  findRefund(@Param('id') id: string, @Req() req: Request) {
    return { data: this.financeService.findRefund(id, actingRole(req)) };
  }

  @Patch('refunds/:id/decision')
  @ApiOperation({ summary: 'Approve (process the refund) or deny an escalated refund ticket' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  decideRefund(
    @Param('id') id: string,
    @Body() dto: FinanceRefundDecisionDto,
    @Req() req: Request,
  ) {
    return { data: this.financeService.decideRefund(id, dto, actingRole(req)) };
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Per-restaurant payout ledger (pending vs settled)' })
  @ApiOkResponse({ schema: dataArraySchema })
  listPayouts(@Req() req: Request) {
    return { data: this.financeService.listPayouts(actingRole(req)) };
  }

  @Get('payouts/pending-payments')
  @ApiOperation({ summary: 'Flat list of individual settlement-eligible payments across all restaurants' })
  @ApiOkResponse({ schema: dataArraySchema })
  listPendingPayments(@Req() req: Request) {
    return { data: this.financeService.listPendingPayments(actingRole(req)) };
  }

  @Post('payouts/settle-all')
  @ApiOperation({ summary: 'Settle every eligible, unblocked payment at once' })
  @ApiOkResponse({ schema: dataObjectSchema })
  settleAll(@Body() dto: SettleAllPayoutsDto, @Req() req: Request) {
    return { data: this.financeService.settleAll(dto, actingRole(req)) };
  }

  @Patch('payouts/:restaurantId/block')
  @ApiOperation({ summary: 'Block or unblock payouts to a specific restaurant' })
  @ApiParam({ name: 'restaurantId' })
  @ApiOkResponse({ schema: dataObjectSchema })
  blockPayout(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: BlockPayoutDto,
    @Req() req: Request,
  ) {
    return { data: this.financeService.blockPayout(restaurantId, dto, actingRole(req)) };
  }

  @Patch('payouts/payments/:paymentId/block')
  @ApiOperation({ summary: 'Block or unblock a specific payment from being settled' })
  @ApiParam({ name: 'paymentId' })
  @ApiOkResponse({ schema: dataObjectSchema })
  blockPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: BlockPaymentDto,
    @Req() req: Request,
  ) {
    return { data: this.financeService.blockPayment(paymentId, dto, actingRole(req)) };
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Platform revenue breakdown (diner fees vs restaurant commission)' })
  @ApiOkResponse({ schema: dataObjectSchema })
  revenueSummary(@Req() req: Request) {
    return { data: this.financeService.revenueSummary(actingRole(req)) };
  }

  @Get('payments/recent')
  @ApiOperation({ summary: 'Most recent reservation payments' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  recentPayments(@Query('limit') limit: string | undefined, @Req() req: Request) {
    return { data: this.financeService.recentPayments(actingRole(req), limit ? Number(limit) : undefined) };
  }

  @Get('payments/top-restaurants')
  @ApiOperation({ summary: 'Top restaurants by total reservation payments' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  topRestaurantsByPayments(@Query('limit') limit: string | undefined, @Req() req: Request) {
    return { data: this.financeService.topRestaurantsByPayments(actingRole(req), limit ? Number(limit) : undefined) };
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Platform-wide booking/restaurant analytics' })
  @ApiOkResponse({ schema: dataObjectSchema })
  platformAnalytics(@Req() req: Request) {
    return { data: this.financeService.platformAnalytics(actingRole(req)) };
  }

  @Get('refund-audit')
  @ApiOperation({ summary: 'Audit trail of every transaction, optionally filtered by status' })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  refundAudit(@Query('status') status: string | undefined, @Req() req: Request) {
    return { data: this.financeService.refundAudit(actingRole(req), status) };
  }
}
