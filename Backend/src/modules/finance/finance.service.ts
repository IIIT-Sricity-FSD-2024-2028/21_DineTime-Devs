import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { Payment, SupportTicket } from 'src/common/types/schema.types';
import { generateId } from 'src/common/utils/id.util';
import { payoutEntries, releaseEligible, releasePayment, releaseState } from 'src/common/utils/settlement.util';
import { CheckinRepository } from 'src/repositories/checkin.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { NoShowDecisionDto } from './dto/finance.dto';
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
    private readonly checkins:CheckinRepository,private readonly slots:TimeSlotRepository,
  ) {}

  private requireFinanceAdmin(actingRole?: Role) {
    if (actingRole !== Role.FINANCE_ADMIN) {
      throw new ForbiddenException('Only the finance team can perform this action');
    }
  }


  private restaurantForPayment(payment: Payment) {
    const reservation = this.reservationRepository.findById(payment.reservation_id);
    const restaurantId = payment.restaurant_id || reservation?.restaurant_id;
    return restaurantId ? this.restaurantRepository.findById(restaurantId) : undefined;
  }

  private dinerForPayment(payment: Payment) {
    const reservation = this.reservationRepository.findById(payment.reservation_id);
    return reservation ? this.userRepository.findById(reservation.user_id) : undefined;
  }

  private remainingRefundCents(payment: Payment) {
    const paid = Math.round(payment.amount * 100);
    const fee = Math.round((payment.diner_platform_fee || 0) * 100);
    const refunded = Math.round((payment.refunded_amount || 0) * 100);
    if (![paid, fee, refunded].every(Number.isFinite) || paid < 0 || fee < 0 || fee > paid || refunded < 0 || refunded > paid) {
      throw new BadRequestException('Payment amounts must be reconciled before refunding.');
    }
    return Math.max(0, paid - fee - refunded);
  }

  private enrichTicket(ticket: SupportTicket) {
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
    const payments = reservation ? this.paymentRepository.findByReservationId(reservation.id)
      .filter((entry) => ['paid', 'refunded'].includes(entry.payment_status)) : [];

    return {
      ...ticket,
      reservation,
      restaurant,
      payment,
      payments,
      total_paid_amount: Math.round(payments.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100,
      diner_platform_fee_amount: payments.reduce((sum, entry) => sum + Math.round((entry.diner_platform_fee || 0) * 100), 0) / 100,
      refund_eligible_amount: payments.reduce((sum, entry) => sum + Math.max(0, Math.round(entry.amount * 100) - Math.round((entry.diner_platform_fee || 0) * 100)), 0) / 100,
      already_refunded_amount: payments.reduce((sum, entry) => sum + Math.round((entry.refunded_amount || 0) * 100), 0) / 100,
      refundable_amount: payments.reduce((sum, entry) => sum + this.remainingRefundCents(entry), 0) / 100,
      refunded_amount: ticket.refund?.amount,
      settled: ticket.status !== 'escalated_finance_team',
    };
  }

  listRefunds(actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);
    return this.ticketRepository
      .findAll()
      .filter((ticket) => ticket.decision === 'refund_approved' || ticket.decision === 'payout_review' || ticket.decision === 'finance_review')
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
    if (ticket.refund) {
      if (!dto.approve) throw new BadRequestException('This ticket already has a recorded refund.');
      return this.enrichTicket(ticket);
    }
    if (ticket.status !== 'escalated_finance_team') {
      throw new BadRequestException('Ticket is not awaiting a finance decision');
    }

    const now = new Date().toISOString();
    if (!dto.notes.trim()) throw new BadRequestException('Record the reason for this decision.');
    if(ticket.decision==='payout_review' || ticket.raised_by_role==='manager') {
      const updated=this.ticketRepository.update(id,{status:dto.approve ? 'resolved':'rejected',resolution_notes:dto.notes,assigned_admin_id:dto.admin_id,resolved_at:now});
      this.notificationsService.create(ticket.raised_by_user_id,`Your payout issue was reviewed: ${dto.notes}`,'support_ticket');
      return updated;
    }
    if (dto.approve) {
      const reservation = ticket.linked_reservation_id
        ? this.reservationRepository.findById(ticket.linked_reservation_id)
        : undefined;
      if (!reservation || reservation.user_id !== ticket.raised_by_user_id) throw new BadRequestException('Link a reservation belonging to this diner before approving a refund.');
      if (ticket.linked_payment_id && this.paymentRepository.findById(ticket.linked_payment_id)?.reservation_id !== reservation.id) {
        throw new BadRequestException('The linked payment does not belong to this reservation.');
      }
      const payments = this.paymentRepository.findByReservationId(reservation.id).filter((payment) => ['paid', 'refunded'].includes(payment.payment_status));
      const remaining = payments.map((payment) => {
        return { payment, cents: this.remainingRefundCents(payment) };
      }).filter((entry) => entry.cents > 0);
      const refundCents = remaining.reduce((sum, entry) => sum + entry.cents, 0);
      if (!refundCents) throw new BadRequestException('This reservation has no remaining paid amount to refund.');
      const refund: NonNullable<SupportTicket['refund']> = {
        id: generateId('refund'), reservation_id: reservation.id, diner_id: reservation.user_id,
        amount: refundCents / 100, processed_at: now, processed_by: dto.admin_id, mode: 'demo',
        payments: remaining.map(({ payment, cents }) => ({ payment_id: payment.id, amount: cents / 100 })),
      };
      for (const { payment, cents } of remaining) {
        this.paymentRepository.update(payment.id, {
          payment_status: 'refunded', refunded_amount: (Math.round((payment.refunded_amount || 0) * 100) + cents) / 100, release_status: 'refunded',
          refund_transactions: [...(payment.refund_transactions || []), { refund_id: refund.id, ticket_id: ticket.id, amount: cents / 100, processed_at: now, processed_by: dto.admin_id }],
        });
      }

      const updated = this.ticketRepository.update(id, {
        status: 'resolved',
        resolution_notes: dto.notes,
        assigned_admin_id: dto.admin_id,
        resolved_at: now,
        refund,
      });

      this.notificationsService.create(
        ticket.raised_by_user_id,
        `Refund of ₹${refund.amount} recorded for reservation ${reservation.id}. Reference: ${refund.id} (demo payment).`,
        'refund_processed',
      );

      return this.enrichTicket(updated!);
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

  private entries() {
    return this.paymentRepository.findAll().filter((payment) => ['paid', 'refunded'].includes(payment.payment_status))
      .flatMap((payment) => payoutEntries(payment, this.reservationRepository.findById(payment.reservation_id)?.restaurant_id)
        .filter((entry) => payment.payment_status === 'paid' || entry.settled_at)
        .map((entry) => ({ ...entry, payment })));
  }

  listPayouts(actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);

    return this.restaurantRepository.findAll().map((restaurant) => {
      const payments = this.entries().filter((entry) => entry.restaurant_id === restaurant.id);

      const pending = payments.filter((p) => !p.settled_at);
      const settled = payments.filter((p) => p.settled_at);

      return {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        payout_blocked: Boolean(restaurant.payout_blocked),
        pending_payout: pending.reduce((sum, p) => sum + p.amount, 0),
        pending_reservation_count: new Set(pending.map((entry) => entry.payment.reservation_id)).size,
        settled_payout: settled.reduce((sum, p) => sum + p.amount, 0),
        settled_reservation_count: new Set(settled.map((entry) => entry.payment.reservation_id)).size,
      };
    });
  }

  listPendingPayments(actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);

    return this.entries().filter((entry) => !entry.settled_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((entry) => {
        const restaurant = entry.restaurant_id ? this.restaurantRepository.findById(entry.restaurant_id) : undefined;
        return {
          payment_id: entry.payment.id, adjustment_id: entry.id === entry.payment.id ? undefined : entry.id,
          reservation_id: entry.payment.reservation_id, restaurant_id: restaurant?.id, restaurant_name: restaurant?.name,
          net_amount: entry.amount, payment_time: entry.created_at,
          release_status:releaseState(entry.payment,this.reservationRepository.findById(entry.payment.reservation_id)),
          eligible:releaseEligible(this.reservationRepository.findById(entry.payment.reservation_id)),
          release_attempts:entry.payment.release_attempts || [],mode:'demo',
          blocked: Boolean(entry.payment.payout_blocked), restaurant_blocked: Boolean(restaurant?.payout_blocked),
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
    if(updated && updated.release_status==='blocked' && !dto.blocked)updated.release_status=releaseEligible(this.reservationRepository.findById(updated.reservation_id)) ? 'pending':'held';
    return { payment_id: paymentId, blocked: Boolean(updated?.payout_blocked) };
  }

  settleAll(dto: SettleAllPayoutsDto, actingRole?: Role) {
    this.requireFinanceAdmin(actingRole);

    const eligible = this.paymentRepository.findAll().filter(payment=>payment.payment_status==='paid' && releaseEligible(this.reservationRepository.findById(payment.reservation_id)) && payoutEntries(payment).some(entry=>!entry.settled_at));
    let settledCount = 0, settledAmount = 0, blockedSkipped = 0;
    const now = new Date().toISOString();
    eligible.forEach((payment) => {
      const pending=payoutEntries(payment).filter(entry=>!entry.settled_at);
      if(releasePayment(this.paymentRepository,payment,this.reservationRepository.findById(payment.reservation_id),this.restaurantRepository,dto.admin_id,'finance')) {
        settledCount+=pending.length;settledAmount+=pending.reduce((sum,entry)=>sum+entry.amount,0);
      } else blockedSkipped++;
    });

    return {
      settled_count: settledCount,
      settled_amount: settledAmount,
      blocked_count: blockedSkipped,
      settled_at: now,
    };
  }

  retryRelease(paymentId:string,actorId:string,actingRole?:Role) {
    this.requireFinanceAdmin(actingRole);
    const payment=this.paymentRepository.findById(paymentId);
    if(!payment)throw new NotFoundException('Payment not found');
    const reservation=this.reservationRepository.findById(payment.reservation_id);
    if(!releaseEligible(reservation) || payment.payment_status!=='paid')throw new BadRequestException('Only completed bookings or finance-approved no-shows can release funds.');
    releasePayment(this.paymentRepository,payment,reservation,this.restaurantRepository,actorId);
    return {...payment,release_status:releaseState(payment,reservation)};
  }
  listNoShows(actingRole?:Role) {
    this.requireFinanceAdmin(actingRole);
    return this.reservationRepository.findAll().filter(r=>r.reservation_status==='no_show').map(reservation=>({
      ...reservation,restaurant:this.restaurantRepository.findById(reservation.restaurant_id),diner:this.userRepository.findById(reservation.user_id),
      payment:this.paymentRepository.findByReservationId(reservation.id).find(p=>['paid','refunded'].includes(p.payment_status)),
      slot:this.slots.findById(reservation.slot_id),checkin:this.checkins.findByReservationId(reservation.id),
      disputes:this.ticketRepository.findAll().filter(t=>t.linked_reservation_id===reservation.id),
      overdue:!reservation.no_show_review && Date.now()-Date.parse(reservation.no_show_at || reservation.created_at)>86400000,
    })).sort((a,b)=>Number(Boolean(a.no_show_review))-Number(Boolean(b.no_show_review)) || (a.no_show_at || a.created_at).localeCompare(b.no_show_at || b.created_at));
  }
  decideNoShow(id:string,dto:NoShowDecisionDto,actingRole?:Role) {
    this.requireFinanceAdmin(actingRole);
    const reservation=this.reservationRepository.findById(id);
    if(!reservation || reservation.reservation_status!=='no_show')throw new BadRequestException('Choose a no-show reservation.');
    if(!dto.notes.trim() || dto.notes.trim().length<3)throw new BadRequestException('Record the reason for this decision.');
    if(reservation.no_show_review) {
      if(reservation.no_show_review.decision===dto.decision)return reservation;
      throw new BadRequestException('Finance has already decided this case.');
    }
    const payment=this.paymentRepository.findByReservationId(id).find(p=>p.payment_status==='paid');
    if(!payment)throw new BadRequestException('No held payment is available for this case.');
    if(payment.settled_at || payment.payout_adjustments?.some(p=>p.settled_at))throw new BadRequestException('Released funds require reconciliation before a no-show decision.');
    reservation.no_show_review={decision:dto.decision,notes:dto.notes.trim(),actor_id:dto.admin_id,at:new Date().toISOString()};
    if(dto.decision==='release')releasePayment(this.paymentRepository,payment,reservation,this.restaurantRepository,dto.admin_id);
    else {payment.payment_status='refunded';payment.refunded_amount=dto.decision==='refund_full' ? payment.amount:payment.deposit_amount;payment.release_status='refunded';}
    this.notificationsService.create(reservation.user_id,`No-show review: ${dto.decision.replaceAll('_',' ')}. ${dto.notes.trim()}`,'finance_review');
    return reservation;
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

    const payments = this.paymentRepository
      .findAll()
      .filter((payment) => payment.payment_status === 'paid' || payment.payment_status === 'refunded');

    const totals = payments.reduce(
      (acc, payment) => {
        acc.total_paid_by_diners += payment.amount || 0;
        acc.diner_platform_fees += payment.payment_status==='refunded' && payment.refunded_amount===payment.amount ? 0:payment.diner_platform_fee || 0;
        acc.restaurant_platform_fees += payment.payment_status==='refunded' ? 0:payment.restaurant_platform_fee || 0;
        acc.refunded_deposits += payment.refunded_amount || 0;
        return acc;
      },
      { total_paid_by_diners: 0, diner_platform_fees: 0, restaurant_platform_fees: 0, refunded_deposits: 0 },
    );

    const total_payouts_settled = this.entries().filter((entry) => entry.settled_at)
      .reduce((sum, entry) => sum + entry.amount, 0);

    return {
      ...totals,
      total_refunded: totals.refunded_deposits,
      net_diner_payments: Math.round((totals.total_paid_by_diners - totals.refunded_deposits) * 100) / 100,
      finance_balance: Math.round((totals.total_paid_by_diners - totals.refunded_deposits - total_payouts_settled) * 100) / 100,
      total_platform_revenue: totals.diner_platform_fees + totals.restaurant_platform_fees,
      total_payouts_settled,
      reservation_count: payments.length,
    };
  }

  recentPayments(actingRole?: Role, limit = 10) {
    this.requireFinanceAdmin(actingRole);

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
          diner_platform_fee: payment.diner_platform_fee,
          deposit_amount: payment.deposit_amount,
          refunded_amount: payment.refunded_amount,
          refund_transactions: payment.refund_transactions || [],
          settled_at: payment.settled_at,
          settled_by: payment.settled_by,
          payment_time: payment.payment_time,
          release_status:releaseState(payment,this.reservationRepository.findById(payment.reservation_id)),
          release_attempts:payment.release_attempts || [],mode:'demo',
        };
      });
  }
}
