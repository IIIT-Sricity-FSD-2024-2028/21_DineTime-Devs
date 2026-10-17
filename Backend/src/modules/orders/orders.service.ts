import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateId } from 'src/common/utils/id.util';
import { Role } from 'src/common/enums/role.enum';
import { Order } from 'src/common/types/schema.types';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { CreateOrderDto, UpdateOrderDto } from 'src/modules/orders/dto/orders.dto';
import { MenuRepository } from 'src/repositories/menu.repository';
import { OrderRepository } from 'src/repositories/order.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly menuRepository: MenuRepository,
    private readonly notificationsService: NotificationsService,
    private readonly restaurantRepository: RestaurantRepository,
  ) {}

  private decorate(order: Order) {
    const items = this.orderRepository.findOrderItems(order.id).map((item) => ({
      ...item, item_name: item.item_name || this.menuRepository.findById(item.item_id)?.item_name || 'Menu item',
      line_total: item.price * item.quantity,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    // Match the existing diner cart's 10% order tax.
    const tax = Number((subtotal * 0.1).toFixed(2));
    return { ...order, status: order.order_status, items, subtotal, tax,
      total: Number((subtotal + tax).toFixed(2)) };
  }

  private managerCanRead(reservationId: string, userId?: string) {
    const reservation = this.reservationRepository.findById(reservationId);
    return Boolean(userId && reservation &&
      this.restaurantRepository.findById(reservation.restaurant_id)?.manager_id === userId);
  }

  findAll(reservationId?: string, role?: Role, userId?: string) {
    if (role === Role.MANAGER && (!userId ||
        (reservationId && !this.managerCanRead(reservationId, userId)))) {
      throw new ForbiddenException('You can only view orders for your restaurant');
    }
    const orders = reservationId ? this.orderRepository.findOrdersByReservationId(reservationId)
      : this.orderRepository.findAllOrders();
    return orders.filter((order) => role !== Role.MANAGER || this.managerCanRead(order.reservation_id, userId))
      .map((order) => this.decorate(order));
  }

  findOne(id: string, role?: Role, userId?: string) {
    const order = this.orderRepository.findOrderById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (role === Role.MANAGER && !this.managerCanRead(order.reservation_id, userId)) {
      throw new ForbiddenException('You can only view orders for your restaurant');
    }
    return this.decorate(order);
  }

  create(dto: CreateOrderDto, userId?: string) {
    const reservation = this.reservationRepository.findById(dto.reservation_id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    if (userId && reservation.user_id !== userId) {
      throw new ForbiddenException('You can only place orders for your own reservation');
    }

    if (reservation.reservation_status !== 'checked_in') {
      throw new BadRequestException('Please check in before placing an order');
    }

    if (dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    dto.items.forEach((item) => {
      const menuItem = this.menuRepository.findById(item.item_id);
      if (!menuItem) {
        throw new NotFoundException(`Menu item not found: ${item.item_id}`);
      }
      if (!menuItem.availability) {
        throw new BadRequestException(`Menu item unavailable: ${menuItem.item_name}`);
      }
      if (menuItem.restaurant_id !== reservation.restaurant_id) {
        throw new BadRequestException('Menu item does not belong to this reservation restaurant');
      }
    });

    const order = this.orderRepository.createOrder({
      id: generateId('order'),
      reservation_id: dto.reservation_id,
      order_status: 'placed',
      order_time: new Date().toISOString(),
    });

    dto.items.forEach((item) =>
      this.orderRepository.createOrderItem({
        order_id: order.id,
        item_id: item.item_id,
        quantity: item.quantity,
        price: this.menuRepository.findById(item.item_id)!.price,
        item_name: this.menuRepository.findById(item.item_id)!.item_name,
      }),
    );

    this.notificationsService.create(
      reservation.user_id,
      'Order placed successfully',
      'order_update',
    );

    return this.decorate(order);
  }

  update(id: string, dto: UpdateOrderDto) {
    const order = this.orderRepository.findOrderById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updated = this.orderRepository.updateOrder(id, dto);
    if (!updated) {
      throw new NotFoundException('Order not found');
    }

    const reservation = this.reservationRepository.findById(updated.reservation_id);
    if (reservation) {
      this.notificationsService.create(
        reservation.user_id,
        `Order status updated to ${updated.order_status}`,
        'order_update',
      );
    }

    return {
      ...updated,
      status: updated.order_status,
      items: this.orderRepository.findOrderItems(updated.id),
    };
  }

  delete(id: string) {
    const deleted = this.orderRepository.removeOrder(id);
    if (!deleted) {
      throw new NotFoundException('Order not found');
    }

    return { deleted: true };
  }
}
