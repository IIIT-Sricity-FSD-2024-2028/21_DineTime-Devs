import { Injectable } from '@nestjs/common';
import { SupportTicket, TicketRaiserRole, TicketStatus } from 'src/common/types/schema.types';

@Injectable()
export class SupportTicketRepository {
  private readonly tickets: SupportTicket[] = [];

  findAll(): SupportTicket[] {
    return [...this.tickets];
  }

  findById(id: string): SupportTicket | undefined {
    return this.tickets.find((item) => item.id === id);
  }

  findByRaiser(userId: string): SupportTicket[] {
    return this.tickets.filter((item) => item.raised_by_user_id === userId);
  }

  findByRole(role: TicketRaiserRole): SupportTicket[] {
    return this.tickets.filter((item) => item.raised_by_role === role);
  }

  findByStatus(status: TicketStatus): SupportTicket[] {
    return this.tickets.filter((item) => item.status === status);
  }

  create(ticket: SupportTicket): SupportTicket {
    this.tickets.push(ticket);
    return ticket;
  }

  update(id: string, payload: Partial<SupportTicket>): SupportTicket | undefined {
    const ticket = this.findById(id);
    if (!ticket) {
      return undefined;
    }

    Object.assign(ticket, payload, { updated_at: new Date().toISOString() });
    return ticket;
  }
}
