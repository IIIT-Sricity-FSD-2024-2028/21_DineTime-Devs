import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { generateId } from 'src/common/utils/id.util';
import { TicketRaiserRole, TicketStatus } from 'src/common/types/schema.types';
import {
  ClaimTicketDto,
  CreateSupportTicketDto,
  LinkTicketDto,
  ResolveTicketDto,
  TicketDecisionDto,
} from 'src/modules/support/dto/support.dto';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { CheckinRepository } from 'src/repositories/checkin.repository';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { SupportTicketRepository } from 'src/repositories/support-ticket.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { UserRepository } from 'src/repositories/user.repository';

@Injectable()
export class SupportService {
  constructor(
    private readonly ticketRepository: SupportTicketRepository,
    private readonly userRepository: UserRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly checkinRepository: CheckinRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly notificationsService: NotificationsService,
    private readonly timeSlotRepository: TimeSlotRepository,
  ) {}

  managerContext(managerId: string) {
    const restaurants = this.restaurantRepository.findByManagerId(managerId);
    const restaurantIds = new Set(restaurants.map((restaurant) => restaurant.id));
    const staff = this.userRepository.findAll()
      .filter((user) => user.role === Role.STAFF && restaurantIds.has(this.userRepository.getStaffDetails(user.id)?.restaurant_id || ''))
      .map((user) => ({ id: user.id, name: user.name, email: user.email, ...this.userRepository.getStaffDetails(user.id) }));
    const reservations = this.reservationRepository.findAll()
      .filter((reservation) => restaurantIds.has(reservation.restaurant_id));
    const reservationIds = new Set(reservations.map((reservation) => reservation.id));
    return {
      restaurants,
      staff,
      reservations: reservations.map((reservation) => ({
        ...reservation,
        diner_name: this.userRepository.findById(reservation.user_id)?.name || 'Diner',
        slot: this.timeSlotRepository.findById(reservation.slot_id),
      })),
      slots: restaurants.flatMap((restaurant) => this.timeSlotRepository.findByRestaurantId(restaurant.id)),
      payments: this.paymentRepository.findAll().filter((payment) => reservationIds.has(payment.reservation_id)),
    };
  }

  create(dto: CreateSupportTicketDto, attachments: string[], userId?: string) {
    const raiser = this.userRepository.findById(dto.raised_by_user_id);
    if (!raiser) {
      throw new BadRequestException('Raising user not found');
    }
    if (raiser.role !== dto.raised_by_role) {
      throw new BadRequestException('Ticket role does not match the raising user');
    }
    if (userId && userId !== dto.raised_by_user_id) {
      throw new ForbiddenException('You can only raise your own support ticket');
    }
    const reservation = dto.reservation_id ? this.reservationRepository.findById(dto.reservation_id) : undefined;
    if (dto.reservation_id && (!reservation || (dto.raised_by_role === 'diner'
        ? reservation.user_id !== dto.raised_by_user_id
        : this.restaurantRepository.findById(reservation.restaurant_id)?.manager_id !== dto.raised_by_user_id))) {
      throw new BadRequestException('Select one of your own reservations');
    }
    let linkedRestaurantId = reservation?.restaurant_id;
    if (dto.restaurant_id) {
      const restaurant = this.restaurantRepository.findById(dto.restaurant_id);
      if (!restaurant || (dto.raised_by_role === 'manager' && restaurant.manager_id !== dto.raised_by_user_id) ||
          (reservation && reservation.restaurant_id !== dto.restaurant_id)) {
        throw new BadRequestException('Select a restaurant linked to your account or reservation');
      }
      linkedRestaurantId = restaurant.id;
    }
    if (dto.slot_id) {
      const slot = this.timeSlotRepository.findById(dto.slot_id);
      if (!slot || (linkedRestaurantId && slot.restaurant_id !== linkedRestaurantId)) {
        throw new BadRequestException('Select a service belonging to your restaurant');
      }
      linkedRestaurantId ||= slot.restaurant_id;
    }
    if (dto.payment_id) {
      const payment = this.paymentRepository.findById(dto.payment_id);
      const paymentReservation = payment && this.reservationRepository.findById(payment.reservation_id);
      const paymentRestaurantId = payment?.restaurant_id || paymentReservation?.restaurant_id;
      if (!payment || !paymentReservation || !paymentRestaurantId ||
          (dto.raised_by_role === 'manager' && this.restaurantRepository.findById(paymentRestaurantId)?.manager_id !== dto.raised_by_user_id) ||
          (dto.raised_by_role === 'diner' && paymentReservation.user_id !== dto.raised_by_user_id) ||
          (linkedRestaurantId && linkedRestaurantId !== paymentRestaurantId)) {
        throw new BadRequestException('Select a payment linked to your account or restaurant');
      }
      linkedRestaurantId ||= paymentRestaurantId;
    }
    const reservationRequiredForManager = ['customer_dispute_no_show', 'checkin_problem'].includes(dto.issue_code || '');
    if ((dto.raised_by_role === 'diner' && dto.issue_code && !['app_problem', 'other'].includes(dto.issue_code) && !reservation) ||
        (dto.raised_by_role === 'manager' && reservationRequiredForManager && !reservation)) {
      throw new BadRequestException('Select the affected reservation');
    }
    if (dto.raised_by_role === 'diner' && !dto.issue_note?.trim()) {
      throw new BadRequestException('Please add a short note so support can help with your issue');
    }
    if (dto.raised_by_role === 'diner' && !dto.issue_code) {
      throw new BadRequestException('Select what happened before raising a support ticket');
    }

    let affectedStaffId: string | undefined;
    let affectedStaffName: string | undefined;
    if (dto.raised_by_role === 'manager') {
      const managerIssueCodes = ['customer_dispute_no_show', 'staff_issue', 'app_problem', 'other', 'checkin_problem', 'payout_missing'];
      if (!dto.issue_code || !managerIssueCodes.includes(dto.issue_code)) {
        throw new BadRequestException('Choose one of the available manager support issues');
      }
      if (dto.issue_code === 'staff_issue') {
        if (dto.affected_staff_scope === 'all') {
          if (dto.affected_staff_id) throw new BadRequestException('Choose all staff or one staff member');
        } else if (dto.affected_staff_scope === 'individual' && dto.affected_staff_id) {
          const staffUser = this.userRepository.findById(dto.affected_staff_id);
          const staffDetails = this.userRepository.getStaffDetails(dto.affected_staff_id);
          if (!staffUser || staffUser.role !== Role.STAFF || !staffDetails || staffDetails.restaurant_id !== linkedRestaurantId ||
              this.restaurantRepository.findById(staffDetails.restaurant_id)?.manager_id !== dto.raised_by_user_id) {
            throw new BadRequestException('Choose a staff member from your restaurant');
          }
          affectedStaffId = staffUser.id;
          affectedStaffName = staffUser.name;
        } else {
          throw new BadRequestException('Choose all staff or one staff member');
        }
        if (!dto.issue_note?.trim()) throw new BadRequestException('Describe the staff issue');
      }
      if (dto.issue_code === 'other' && !dto.issue_note?.trim()) {
        throw new BadRequestException('Describe the issue');
      }
    }

    const now = new Date().toISOString();
    const ticket = this.ticketRepository.create({
      id: generateId('ticket'),
      raised_by_user_id: dto.raised_by_user_id,
      raised_by_role: dto.raised_by_role,
      category: dto.category,
      subject: dto.subject,
      description: dto.description,
      issue_code: dto.issue_code,
      issue_note: dto.issue_note,
      affected_staff_scope: dto.issue_code === 'staff_issue' ? dto.affected_staff_scope : undefined,
      affected_staff_id: affectedStaffId,
      affected_staff_name: affectedStaffName,
      linked_reservation_id: reservation?.id,
      linked_restaurant_id: linkedRestaurantId,
      linked_slot_id: dto.slot_id,
      linked_payment_id: dto.payment_id,
      attachments,
      status: 'open',
      created_at: now,
      updated_at: now,
    });

    return ticket;
  }

  findMine(userId: string) {
    return this.ticketRepository
      .findByRaiser(userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((ticket) => {
        const reservation = ticket.linked_reservation_id ? this.reservationRepository.findById(ticket.linked_reservation_id) : undefined;
        if (ticket.raised_by_role !== 'diner' || reservation?.user_id !== userId) return ticket;
        // Legacy refunds may have payment records but no ticket-level receipt.
        // Report the reservation total without inventing a receipt for this ticket.
        const refundedCents = this.paymentRepository.findByReservationId(reservation.id)
          .filter((payment) => ['paid', 'refunded'].includes(payment.payment_status))
          .reduce((sum, payment) => sum + Math.round((payment.refunded_amount || 0) * 100), 0);
        return { ...ticket, reservation_refunded_amount: refundedCents / 100 };
      });
  }

  findAll(raisedByRole?: TicketRaiserRole, status?: TicketStatus) {
    let tickets = this.ticketRepository.findAll();
    if (raisedByRole) {
      tickets = tickets.filter((ticket) => ticket.raised_by_role === raisedByRole);
    }
    if (status) {
      tickets = tickets.filter((ticket) => ticket.status === status);
    }
    return tickets.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  findOne(id: string) {
    const ticket = this.ticketRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private requireSupportAdmin(actingRole?: Role) {
    if (actingRole !== Role.SUPPORT_ADMIN) {
      throw new ForbiddenException('Only the support team can perform this action');
    }
  }

  claim(id: string, dto: ClaimTicketDto, actingRole?: Role) {
    this.requireSupportAdmin(actingRole);
    const ticket = this.findOne(id);

    if (ticket.status === 'escalated_super_admin') {
      throw new BadRequestException('Ticket is already escalated to the super admin');
    }

    return this.ticketRepository.update(id, {
      status: 'in_review',
      assigned_admin_id: dto.admin_id,
    });
  }

  link(id: string, dto: LinkTicketDto, actingRole?: Role) {
    this.requireSupportAdmin(actingRole);
    this.findOne(id);

    if (dto.reservation_id && !this.reservationRepository.findById(dto.reservation_id)) {
      throw new BadRequestException('Reservation not found');
    }

    if (dto.restaurant_id && !this.restaurantRepository.findById(dto.restaurant_id)) {
      throw new BadRequestException('Restaurant not found');
    }

    const payload: Record<string, string> = {};
    if (dto.reservation_id) payload.linked_reservation_id = dto.reservation_id;
    if (dto.restaurant_id) payload.linked_restaurant_id = dto.restaurant_id;

    return this.ticketRepository.update(id, payload);
  }

  decision(id: string, dto: TicketDecisionDto, actingRole?: Role) {
    this.requireSupportAdmin(actingRole);
    const ticket = this.findOne(id);

    if (ticket.status === 'resolved' || ticket.status === 'rejected') {
      throw new BadRequestException('Ticket is already closed');
    }
    if (ticket.status === 'escalated_super_admin') {
      throw new BadRequestException('Ticket is locked while escalated to the super admin');
    }

    const now = new Date().toISOString();
    let status: TicketStatus;
    let message: string;

    if (dto.decision === 'refund_approved' || dto.decision === 'finance_review') {
      status = 'escalated_finance_team';
      message = dto.decision === 'refund_approved'
        ? 'Your support ticket was verified and escalated to our finance team for a refund.'
        : 'Your support ticket was escalated to our finance team for review.';
    } else if (dto.decision === 'refund_denied') {
      status = 'resolved';
      message = `Your support ticket was reviewed — no refund applicable. ${dto.notes}`;
    } else {
      status = 'escalated_super_admin';
      message = 'Your technical issue has been escalated to our platform admin team.';
    }

    const updated = this.ticketRepository.update(id, {
      status,
      decision: dto.decision,
      assigned_admin_id: dto.admin_id,
      resolution_notes: dto.notes,
      resolved_at: status === 'resolved' ? now : undefined,
    });

    this.notificationsService.create(ticket.raised_by_user_id, message, 'support_ticket');

    return updated;
  }

  resolve(id: string, dto: ResolveTicketDto, actingRole?: Role) {
    const ticket = this.findOne(id);

    if (ticket.status === 'resolved' || ticket.status === 'rejected') {
      throw new BadRequestException('Ticket is already closed');
    }

    if (ticket.status === 'escalated_super_admin') {
      if (actingRole !== Role.SUPER_USER) {
        throw new ForbiddenException('Only the super admin can resolve an escalated ticket');
      }
    } else {
      this.requireSupportAdmin(actingRole);
    }

    const now = new Date().toISOString();
    const updated = this.ticketRepository.update(id, {
      status: 'resolved',
      resolution_notes: dto.resolution_notes,
      assigned_admin_id: dto.admin_id,
      resolved_at: now,
    });

    this.notificationsService.create(
      ticket.raised_by_user_id,
      `Your issue has been resolved: ${dto.resolution_notes}`,
      'support_ticket',
    );

    return updated;
  }

  reject(id: string, dto: ResolveTicketDto, actingRole?: Role) {
    this.requireSupportAdmin(actingRole);
    const ticket = this.findOne(id);

    if (ticket.status === 'resolved' || ticket.status === 'rejected') {
      throw new BadRequestException('Ticket is already closed');
    }
    if (ticket.status === 'escalated_super_admin') {
      throw new BadRequestException('Ticket is locked while escalated to the super admin');
    }

    const now = new Date().toISOString();
    const updated = this.ticketRepository.update(id, {
      status: 'rejected',
      resolution_notes: dto.resolution_notes,
      assigned_admin_id: dto.admin_id,
      resolved_at: now,
    });

    this.notificationsService.create(
      ticket.raised_by_user_id,
      `Your support ticket was closed: ${dto.resolution_notes}`,
      'support_ticket',
    );

    return updated;
  }

  lookupReservation(id: string) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    const restaurant = this.restaurantRepository.findById(reservation.restaurant_id);
    const diner = this.userRepository.findById(reservation.user_id);
    const checkin = this.checkinRepository.findByReservationId(reservation.id);
    const payments = this.paymentRepository.findByReservationId(reservation.id);

    return { reservation, restaurant, diner, checkin, payments };
  }

  lookupRestaurant(id: string) {
    const restaurant = this.restaurantRepository.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const manager = this.userRepository.findById(restaurant.manager_id);
    const reservations = this.reservationRepository.findByRestaurantId(id);
    const stats = {
      total: reservations.length,
      completed: reservations.filter((r) => r.reservation_status === 'completed').length,
      cancelled: reservations.filter((r) => r.reservation_status === 'cancelled').length,
      no_show: reservations.filter((r) => r.reservation_status === 'no_show').length,
    };

    return { restaurant, manager, stats };
  }

  lookupDiner(id: string) {
    const diner = this.userRepository.findById(id);
    if (!diner || diner.role !== Role.DINER) {
      throw new NotFoundException('Diner not found');
    }

    const dinerDetails = this.userRepository.getDinerDetails(id);
    const reservations = this.reservationRepository
      .findByUserId(id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return { diner, dinerDetails, reservations };
  }

  lookupManager(id: string) {
    const manager = this.userRepository.findById(id);
    if (!manager || manager.role !== Role.MANAGER) {
      throw new NotFoundException('Manager not found');
    }

    const restaurants = this.restaurantRepository.findByManagerId(id);
    const reservations = restaurants.flatMap((restaurant) =>
      this.reservationRepository.findByRestaurantId(restaurant.id),
    );
    const stats = {
      total: reservations.length,
      completed: reservations.filter((r) => r.reservation_status === 'completed').length,
      cancelled: reservations.filter((r) => r.reservation_status === 'cancelled').length,
      no_show: reservations.filter((r) => r.reservation_status === 'no_show').length,
    };

    return { manager, restaurants, stats };
  }
}
