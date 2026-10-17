import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { Notification } from 'src/common/types/schema.types';

@Injectable()
export class NotificationRepository {
  private readonly notifications: Notification[] = store.collection<Notification>('notifications');

  findAll(): Notification[] {
    return [...this.notifications];
  }

  findById(id: string): Notification | undefined {
    return this.notifications.find((item) => item.id === id);
  }

  findByUserId(userId: string): Notification[] {
    return this.notifications.filter((item) => item.user_id === userId);
  }

  create(notification: Notification): Notification {
    this.notifications.push(notification);
    return notification;
  }

  update(id: string, payload: Partial<Notification>): Notification | undefined {
    const notification = this.findById(id);
    if (!notification) {
      return undefined;
    }

    Object.assign(notification, payload);
    return notification;
  }

  remove(id: string): boolean {
    const index = this.notifications.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.notifications.splice(index, 1);
    return true;
  }
}
