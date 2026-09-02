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
  ) {}

  create(dto: CreateSupportTicketDto, attachments: string[]) {
    const raiser = this.userRepository.findById(dto.raised_by_user_id);
    if (!raiser) {
      throw new BadRequestException('Raising user not found');
    }

    const now = new Date().toISOString();
    const ticket = this.ticketRepository.create({
      id: generateId('ticket'),
      raised_by_user_id: dto.raised_by_user_id,
      raised_by_role: dto.raised_by_role,
      category: dto.category,
      subject: dto.subject,
      description: dto.description,
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
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
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

    if (dto.decision === 'refund_approved') {
      status = 'escalated_finance_team';
      message = 'Your support ticket was verified and escalated to our finance team for a refund.';
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
