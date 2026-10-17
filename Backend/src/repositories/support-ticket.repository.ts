import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { SupportTicket, TicketRaiserRole, TicketStatus } from 'src/common/types/schema.types';

@Injectable()
export class SupportTicketRepository {
  private readonly tickets: SupportTicket[] = store.collection<SupportTicket>('tickets');

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

    const now=new Date().toISOString();
    const changed=payload.status && payload.status!==ticket.status;
    const notes=payload.resolution_notes || (payload.linked_reservation_id ? 'Linked reservation '+payload.linked_reservation_id:payload.linked_restaurant_id ? 'Linked restaurant '+payload.linked_restaurant_id:undefined);
    if(changed || notes) ticket.history=[...(ticket.history || []),{at:now,status:payload.status || ticket.status,actor_id:payload.assigned_admin_id || ticket.assigned_admin_id,notes}];
    Object.assign(ticket, payload, { updated_at: now });
    return ticket;
  }
}
