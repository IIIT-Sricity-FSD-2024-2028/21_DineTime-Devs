import { Injectable } from '@nestjs/common';
import { TableSlot, TableSlotStatus } from 'src/common/types/schema.types';
import { store } from 'src/common/storage/memory-store';
@Injectable()
export class TableSlotRepository {
  private readonly tableSlots: TableSlot[] = store.collection<TableSlot>('tableSlots');
  findAll() { return [...this.tableSlots]; }
  findByTableAndSlot(tableId: string, slotId: string) { return this.tableSlots.find((entry) => entry.table_id === tableId && entry.slot_id === slotId); }
  findBySlotId(slotId: string) { return this.tableSlots.filter((entry) => entry.slot_id === slotId); }
  create(entry: TableSlot): TableSlot {
    const existing = this.findByTableAndSlot(entry.table_id, entry.slot_id);
    if (existing) return existing;
    this.tableSlots.push({ ...entry }); return this.tableSlots[this.tableSlots.length - 1];
  }
  updateStatus(tableId: string, slotId: string, status: TableSlotStatus) {
    const entry = this.findByTableAndSlot(tableId, slotId);
    if (entry) {
      entry.status = status;
      delete entry.manual_status;
      delete entry.manual_block;
    }
    return entry;
  }
  setManualStatus(tableId: string, slotId: string, status: TableSlotStatus) {
    const entry = this.findByTableAndSlot(tableId, slotId);
    if (!entry) return undefined;
    entry.status = status;
    if (status === 'available') delete entry.manual_status;
    else entry.manual_status = status;
    if (status === 'blocked') entry.manual_block = true;
    else delete entry.manual_block;
    return entry;
  }
  removeByTableAndSlot(tableId: string, slotId: string) {
    const index = this.tableSlots.findIndex((entry) => entry.table_id === tableId && entry.slot_id === slotId);
    if (index === -1) return false;
    this.tableSlots.splice(index, 1);
    return true;
  }
  removeByTableId(id: string) { for (let i=this.tableSlots.length-1;i>=0;i--) if(this.tableSlots[i].table_id===id) this.tableSlots.splice(i,1); }
  removeBySlotId(id: string) { for (let i=this.tableSlots.length-1;i>=0;i--) if(this.tableSlots[i].slot_id===id) this.tableSlots.splice(i,1); }
}
