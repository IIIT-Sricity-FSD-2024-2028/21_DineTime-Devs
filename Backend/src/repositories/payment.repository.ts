import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { Payment } from 'src/common/types/schema.types';

@Injectable()
export class PaymentRepository {
  private readonly payments: Payment[] = store.collection<Payment>('payments');

  findAll(): Payment[] {
    return [...this.payments];
  }

  findById(id: string): Payment | undefined {
    return this.payments.find((item) => item.id === id);
  }

  findByReservationId(reservationId: string): Payment[] {
    return this.payments.filter((item) => item.reservation_id === reservationId);
  }

  create(payment: Payment): Payment {
    this.payments.push(payment);
    return payment;
  }

  update(id: string, payload: Partial<Payment>): Payment | undefined {
    const payment = this.findById(id);
    if (!payment) {
      return undefined;
    }

    Object.assign(payment, payload);
    return payment;
  }

  remove(id: string): boolean {
    const index = this.payments.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.payments.splice(index, 1);
    return true;
  }
}
