import { Injectable, OnApplicationBootstrap, OnApplicationShutdown, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { defer, lastValueFrom, Observable } from 'rxjs';
import { store } from './memory-store';
import { warmIdCounters } from 'src/common/utils/id.util';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { bookingTerms, deadlineFor, expireUnpaidHolds } from 'src/common/utils/booking-lifecycle.util';
import { autoSettleOverduePayments } from 'src/common/utils/settlement.util';

@Injectable()
export class MemoryStateService implements OnApplicationBootstrap, OnApplicationShutdown {
  private settlementTimer?: ReturnType<typeof setInterval>;
  constructor(private readonly slots: TimeSlotRepository, private readonly tables: TableRepository,
    private readonly reservations: ReservationRepository, private readonly allocations: TableSlotRepository,
    private readonly payments:PaymentRepository,private readonly restaurants:RestaurantRepository) {}
  async onApplicationBootstrap() {
    await store.transaction(() => {
      warmIdCounters(store.snapshot());
      for (const reservation of this.reservations.findAll()) {
        const slot=this.slots.findById(reservation.slot_id),restaurant=this.restaurants.findById(reservation.restaurant_id);
        if(!reservation.booking_terms && restaurant)reservation.booking_terms=bookingTerms(restaurant);
        if(!reservation.cancellation_deadline && slot) {
          const deadlines=[deadlineFor(slot,reservation.booking_terms?.cancellation_cutoff_minutes || 0)];
          for(const history of reservation.modification_history || []) {
            const oldSlot=this.slots.findById(history.slot_id),oldRestaurant=this.restaurants.findById(history.restaurant_id);
            if(oldSlot && oldRestaurant)deadlines.push(deadlineFor(oldSlot,oldRestaurant.cancellation_cutoff_minutes));
          }
          reservation.cancellation_deadline=deadlines.sort()[0];
        }
      }
      for (const slot of this.slots.findAll()) {
        if (!slot.table_layout) slot.table_layout = this.tables.findByRestaurantId(slot.restaurant_id).map((table) => ({table_id:table.id,table_number:table.table_number,capacity:table.capacity}));
        slot.published ??= true; slot.revision ??= 0;
        const history = this.reservations.findAll().find((r) => (r.slot_id === slot.id && (!r.hold_expires_at || r.confirmed_at)) || r.modification_history?.some((h) => h.slot_id === slot.id));
        if (history) slot.layout_locked_at ||= history.created_at;
      }
      // Keep explicit blocked allocations even when they have no reservation.
      for (const allocation of this.allocations.findAll()) {
        if (allocation.status !== 'available' && !this.reservations.findByTableAndSlot(allocation.table_id,allocation.slot_id)) allocation.manual_block ??= true;
      }
    });
    const settle = () => {
      void store.transaction(() => autoSettleOverduePayments(this.payments, this.reservations, this.restaurants))
        .catch((error) => console.error('Automatic payout settlement failed:', error));
    };
    settle();
    this.settlementTimer = setInterval(settle, 60_000);
    this.settlementTimer.unref?.();
  }
  onApplicationShutdown() { if (this.settlementTimer) clearInterval(this.settlementTimer); store.close(); }
}
function publicResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicResponse);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'password_hash').map(([key,item]) => [key,publicResponse(item)]));
  return value;
}
@Injectable()
export class MemoryStateInterceptor implements NestInterceptor {
  constructor(private readonly reservations:ReservationRepository,private readonly payments:PaymentRepository,private readonly allocations:TableSlotRepository) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return defer(() => store.transaction(async () => {
      const req=context.switchToHttp().getRequest();
      expireUnpaidHolds(this.reservations,this.payments,this.allocations);
      const result=await lastValueFrom(next.handle());
      const resource=req.path.split('/').filter(Boolean)[0];
      if(req.method==='GET' && result && typeof result==='object' && Array.isArray(result.data)) {
        const state=store.snapshot();
        const recordRestaurant=(row:any):string|undefined => row.restaurant_id ||
          (resource==='restaurants' ? row.id : undefined) ||
          (resource==='tableslots' ? (state.tables as any[])?.find((t)=>t.id===row.table_id)?.restaurant_id : undefined) ||
          (row.reservation_id ? (state.reservations as any[])?.find((r)=>r.id===row.reservation_id)?.restaurant_id : undefined);
        if (req.allowedRestaurantIds) result.data=result.data.filter((row:any)=>req.allowedRestaurantIds.includes(recordRestaurant(row)) && row.published!==false);
        if (req.restaurantScope?.length && ['restaurants','payments','orders','checkin'].includes(resource)) result.data=result.data.filter((row:any)=>req.restaurantScope.includes(recordRestaurant(row)));
        if(req.user?.role==='diner' && ['payments','orders'].includes(resource)) result.data=result.data.filter((row:any)=>(state.reservations as any[])?.some((r)=>r.id===row.reservation_id && r.user_id===req.user.sub));
      }
      return publicResponse(result);
    }));
  }
}
