import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { MenuItem } from 'src/common/types/schema.types';

@Injectable()
export class MenuRepository {
  private readonly menuItems: MenuItem[] = store.collection<MenuItem>('menuItems');

  findAll(): MenuItem[] {
    return [...this.menuItems];
  }

  findById(id: string): MenuItem | undefined {
    return this.menuItems.find((item) => item.id === id);
  }

  findByRestaurantId(restaurantId: string): MenuItem[] {
    return this.menuItems.filter((item) => item.restaurant_id === restaurantId);
  }

  create(item: MenuItem): MenuItem {
    this.menuItems.push(item);
    return item;
  }

  update(id: string, payload: Partial<MenuItem>): MenuItem | undefined {
    const item = this.findById(id);
    if (!item) {
      return undefined;
    }

    Object.assign(item, payload);
    return item;
  }

  remove(id: string): boolean {
    const index = this.menuItems.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.menuItems.splice(index, 1);
    return true;
  }
}
