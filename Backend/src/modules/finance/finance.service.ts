import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { Payment } from 'src/common/types/schema.types';
import { autoSettleOverduePayments, netPayout, settlementDeadline } from 'src/common/utils/settlement.util';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import {
  BlockPaymentDto,
  BlockPayoutDto,
  FinanceRefundDecisionDto,
  SettleAllPayoutsDto,
} from 'src/modules/finance/dto/finance.dto';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { SupportTicketRepository } from 'src/repositories/support-ticket.repository';
import { UserRepository } from 'src/repositories/user.repository';

@Injectable()
export class FinanceService {
  constructor(
    private readonly ticketRepository: SupportTicketRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  private requireFinanceAdmin(actingRole?: Role) {
    if (actingRole !== Role.FINANCE_ADMIN) {
      throw new ForbiddenException('Only the finance team can perform this action');
    }
  }

  private sweep() {
    autoSettleOverduePayments(this.paymentRepository, this.reservationRepository, this.restaurantRepository);
  }

  private restaurantForPayment(payment: Payment) {
    const reservation = this.reservationRepository.findById(payment.reservation_id);
    return reservation ? this.restaurantRepository.findById(reservation.restaurant_id) : undefined;
  }

  private dinerForPayment(payment: Payment) {
    const reservation = this.reservationRepository.findById(payment.reservation_id);
    return reservation ? this.userRepository.findById(reservation.user_id) : undefined;
  }

  private enrichTicket(ticket: {
    status: string;
    linked_reservation_id?: string;
    linked_restaurant_id?: string;
  }) {
    const reservation = ticket.linked_reservation_id
      ? this.reservationRepository.findById(ticket.linked_reservation_id)
      : undefined;
    const restaurant = ticket.linked_restaurant_id
      ? this.restaurantRepository.findById(ticket.linked_restaurant_id)
      : reservation
        ? this.restaurantRepository.findById(reservation.restaurant_id)
        : undefined;
    const payment = reservation
      ? this.paymentRepository
          .findByReservationId(reservation.id)
          .find((p) => p.payment_status === 'paid' || p.payment_status === 'refunded')
      : undefined;

    return {
      ...ticket,
      reservation,
      restaurant,
      payment,
      settled: ticket.status !== 'escalated_finance_team',
    };
  }

  listRefunds(actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    return this.ticketRepository
      .findAll()
      .filter((ticket) => ticket.decision === 'refund_approved')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((ticket) => this.enrichTicket(ticket));
  }

  findRefund(id: string, actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    const ticket = this.ticketRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return this.enrichTicket(ticket);
  }

  decideRefund(id: string, dto: FinanceRefundDecisionDto, actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    const ticket = this.ticketRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.status !== 'escalated_finance_team') {
      throw new BadRequestException('Ticket is not awaiting a finance decision');
    }

    const now = new Date().toISOString();
    let refundedAmount: number | undefined;

    if (dto.approve) {
      const reservation = ticket.linked_reservation_id
        ? this.reservationRepository.findById(ticket.linked_reservation_id)
        : undefined;
      const payment = reservation
        ? this.paymentRepository.findByReservationId(reservation.id).find((p) => p.payment_status === 'paid')
        : undefined;

      if (payment) {
        this.paymentRepository.update(payment.id, {
          payment_status: 'refunded',
          refunded_amount: payment.deposit_amount,
        });
        refundedAmount = payment.deposit_amount;
      }

      const updated = this.ticketRepository.update(id, {
        status: 'resolved',
        resolution_notes: dto.notes,
        assigned_admin_id: dto.admin_id,
        resolved_at: now,
      });

      this.notificationsService.create(
        ticket.raised_by_user_id,
        refundedAmount
          ? `Your refund of ₹${refundedAmount} has been processed.`
          : `Your refund request was approved: ${dto.notes}`,
        'refund_processed',
      );

      return { ...updated, refunded_amount: refundedAmount };
    }

    const updated = this.ticketRepository.update(id, {
      status: 'rejected',
      resolution_notes: dto.notes,
      assigned_admin_id: dto.admin_id,
      resolved_at: now,
    });

    this.notificationsService.create(
      ticket.raised_by_user_id,
      `Your refund request was denied by our finance team: ${dto.notes}`,
      'refund_processed',
    );

    return updated;
  }

  listPayouts(actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    this.sweep();

    return this.restaurantRepository.findAll().map((restaurant) => {
      const reservations = this.reservationRepository.findByRestaurantId(restaurant.id);
      const payments = reservations.flatMap((reservation) =>
        this.paymentRepository.findByReservationId(reservation.id).filter((p) => p.payment_status === 'paid'),
      );

      const pending = payments.filter((p) => !p.settled_at);
      const settled = payments.filter((p) => p.settled_at);

      return {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        payout_blocked: Boolean(restaurant.payout_blocked),
        pending_payout: pending.reduce((sum, p) => sum + netPayout(p), 0),
        pending_reservation_count: pending.length,
        settled_payout: settled.reduce((sum, p) => sum + netPayout(p), 0),
        settled_reservation_count: settled.length,
      };
    });
  }

  listPendingPayments(actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    this.sweep();

    return this.paymentRepository
      .findAll()
      .filter((payment) => payment.payment_status === 'paid' && !payment.settled_at)
      .sort((a, b) => a.payment_time.localeCompare(b.payment_time))
      .map((payment) => {
        const restaurant = this.restaurantForPayment(payment);
        const daysRemaining = Math.max(
          0,
          Math.ceil((settlementDeadline(payment) - Date.now()) / (24 * 60 * 60 * 1000)),
        );

        return {
          payment_id: payment.id,
          reservation_id: payment.reservation_id,
          restaurant_id: restaurant?.id,
          restaurant_name: restaurant?.name,
          net_amount: netPayout(payment),
          payment_time: payment.payment_time,
          days_remaining: daysRemaining,
          blocked: Boolean(payment.payout_blocked),
          restaurant_blocked: Boolean(restaurant?.payout_blocked),
        };
      });
  }

  blockPayment(paymentId: string, dto: BlockPaymentDto, actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    const payment = this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const updated = this.paymentRepository.update(paymentId, { payout_blocked: dto.blocked });
    return { payment_id: paymentId, blocked: Boolean(updated?.payout_blocked) };
  }

  settleAll(dto: SettleAllPayoutsDto, actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    this.sweep();

    const eligible = this.paymentRepository
      .findAll()
      .filter((payment) => payment.payment_status === 'paid' && !payment.settled_at);

    let settledCount = 0;
    let settledAmount = 0;
    let blockedSkipped = 0;
    const now = new Date().toISOString();

    eligible.forEach((payment) => {
      const restaurant = this.restaurantForPayment(payment);
      if (payment.payout_blocked || restaurant?.payout_blocked) {
        blockedSkipped += 1;
        return;
      }
      this.paymentRepository.update(payment.id, { settled_at: now, settled_by: 'finance' });
      settledCount += 1;
      settledAmount += netPayout(payment);
    });

    return {
      settled_count: settledCount,
      settled_amount: settledAmount,
      blocked_count: blockedSkipped,
      settled_at: now,
    };
  }

  blockPayout(restaurantId: string, dto: BlockPayoutDto, actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    const restaurant = this.restaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const updated = this.restaurantRepository.update(restaurantId, { payout_blocked: dto.blocked });
    return { restaurant_id: restaurantId, payout_blocked: Boolean(updated?.payout_blocked) };
  }

  revenueSummary(actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    this.sweep();

    const payments = this.paymentRepository
      .findAll()
      .filter((payment) => payment.payment_status === 'paid' || payment.payment_status === 'refunded');

    const totals = payments.reduce(
      (acc, payment) => {
        acc.total_paid_by_diners += payment.amount || 0;
        acc.diner_platform_fees += payment.diner_platform_fee || 0;
        acc.restaurant_platform_fees += payment.restaurant_platform_fee || 0;
        acc.refunded_deposits += payment.refunded_amount || 0;
        return acc;
      },
      { total_paid_by_diners: 0, diner_platform_fees: 0, restaurant_platform_fees: 0, refunded_deposits: 0 },
    );

    const total_payouts_settled = this.paymentRepository
      .findAll()
      .filter((payment) => payment.payment_status === 'paid' && payment.settled_at)
      .reduce((sum, payment) => sum + netPayout(payment), 0);

    return {
      ...totals,
      total_platform_revenue: totals.diner_platform_fees + totals.restaurant_platform_fees,
      total_payouts_settled,
      reservation_count: payments.length,
    };
  }

  recentPayments(actingRole?: Role, limit = 10) {
    this.requireFinanceAdmin(actingRole);
    this.sweep();

    return this.paymentRepository
      .findAll()
      .filter((payment) => payment.payment_status === 'paid' || payment.payment_status === 'refunded')
      .sort((a, b) => b.payment_time.localeCompare(a.payment_time))
      .slice(0, limit)
      .map((payment) => {
        const restaurant = this.restaurantForPayment(payment);
        const diner = this.dinerForPayment(payment);

        return {
          payment_id: payment.id,
          reservation_id: payment.reservation_id,
          restaurant_name: restaurant?.name,
          diner_name: diner?.name,
          amount: payment.amount,
          status: payment.payment_status,
          payment_time: payment.payment_time,
        };
      });
  }

  topRestaurantsByPayments(actingRole?: Role, limit = 5) {
    this.requireFinanceAdmin(actingRole);
    this.sweep();

    const totalsByRestaurant = new Map<string, { total: number; count: number }>();
    this.paymentRepository
      .findAll()
      .filter((payment) => payment.payment_status === 'paid' || payment.payment_status === 'refunded')
      .forEach((payment) => {
        const restaurant = this.restaurantForPayment(payment);
        if (!restaurant) return;
        const entry = totalsByRestaurant.get(restaurant.id) || { total: 0, count: 0 };
        entry.total += payment.amount || 0;
        entry.count += 1;
        totalsByRestaurant.set(restaurant.id, entry);
      });

    return Array.from(totalsByRestaurant.entries())
      .map(([restaurantId, entry]) => ({
        restaurant_id: restaurantId,
        restaurant_name: this.restaurantRepository.findById(restaurantId)?.name,
        total_paid: entry.total,
        payment_count: entry.count,
      }))
      .sort((a, b) => b.total_paid - a.total_paid)
      .slice(0, limit);
  }

  platformAnalytics(actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);

    return {
      total_restaurants: this.restaurantRepository.findAll().length,
      total_bookings: this.reservationRepository.findAll().length,
    };
  }

  refundAudit(actingRole?: Role, status?: string) {
    this.requireFinanceAdmin(actingRole);
    this.sweep();

    return this.paymentRepository
      .findAll()
      .filter((payment) => !status || payment.payment_status === status)
      .sort((a, b) => b.payment_time.localeCompare(a.payment_time))
      .map((payment) => {
        const restaurant = this.restaurantForPayment(payment);
        const diner = this.dinerForPayment(payment);

        return {
          payment_id: payment.id,
          reservation_id: payment.reservation_id,
          restaurant_name: restaurant?.name,
          diner_name: diner?.name,
          status: payment.payment_status,
          amount: payment.amount,
          refunded_amount: payment.refunded_amount,
          settled_at: payment.settled_at,
          settled_by: payment.settled_by,
          payment_time: payment.payment_time,
        };
      });
  }
}
