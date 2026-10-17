import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { Order, OrderItem } from 'src/common/types/schema.types';

@Injectable()
export class OrderRepository {
  private readonly orders: Order[] = store.collection<Order>('orders');
  private readonly orderItems: OrderItem[] = store.collection<OrderItem>('orderItems');

  findAllOrders(): Order[] {
    return [...this.orders];
  }

  findOrderById(id: string): Order | undefined {
    return this.orders.find((item) => item.id === id);
  }

  findOrdersByReservationId(reservationId: string): Order[] {
    return this.orders.filter((item) => item.reservation_id === reservationId);
  }

  createOrder(order: Order): Order {
    this.orders.push(order);
    return order;
  }

  updateOrder(id: string, payload: Partial<Order>): Order | undefined {
    const order = this.findOrderById(id);
    if (!order) {
      return undefined;
    }

    Object.assign(order, payload);
    return order;
  }

  removeOrder(id: string): boolean {
    const index = this.orders.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.orders.splice(index, 1);
    for (let i = this.orderItems.length - 1; i >= 0; i -= 1) {
      if (this.orderItems[i].order_id === id) {
        this.orderItems.splice(i, 1);
      }
    }

    return true;
  }

  createOrderItem(item: OrderItem): OrderItem {
    this.orderItems.push(item);
    return item;
  }

  findOrderItems(orderId: string): OrderItem[] {
    return this.orderItems.filter((item) => item.order_id === orderId);
  }

  replaceOrderItems(orderId: string, items: OrderItem[]): OrderItem[] {
    for (let i = this.orderItems.length - 1; i >= 0; i -= 1) {
      if (this.orderItems[i].order_id === orderId) {
        this.orderItems.splice(i, 1);
      }
    }

    this.orderItems.push(...items);
    return items;
  }
}
