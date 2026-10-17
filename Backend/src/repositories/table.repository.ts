import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { Table } from 'src/common/types/schema.types';

@Injectable()
export class TableRepository {
  private readonly tables: Table[] = store.collection<Table>('tables');

  findAll(): Table[] {
    return [...this.tables];
  }

  findById(id: string): Table | undefined {
    return this.tables.find((item) => item.id === id);
  }

  findByRestaurantId(restaurantId: string, includeInactive = false): Table[] {
    return this.tables.filter((item) => item.restaurant_id === restaurantId && (includeInactive || item.status !== 'inactive'));
  }

  create(table: Table): Table {
    this.tables.push(table);
    return table;
  }

  update(id: string, payload: Partial<Table>): Table | undefined {
    const table = this.findById(id);
    if (!table) {
      return undefined;
    }

    Object.assign(table, payload);
    return table;
  }

  remove(id: string): boolean {
    const index = this.tables.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.tables.splice(index, 1);
    return true;
  }
}
