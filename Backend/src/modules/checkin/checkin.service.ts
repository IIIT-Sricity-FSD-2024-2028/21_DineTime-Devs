import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashSync } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { Role } from 'src/common/enums/role.enum';
import { indiaToday } from 'src/common/utils/india-time.util';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { withinOperatingHours } from 'src/common/utils/operating-hours.util';
import { TableRepository } from 'src/repositories/table.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { generateId } from 'src/common/utils/id.util';
import { reservationTableIds } from 'src/common/utils/reservation-tables.util';
import { CreateCheckinDto, WalkInDto } from 'src/modules/checkin/dto/checkin.dto';
import { CheckinRepository } from 'src/repositories/checkin.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';

@Injectable()
export class CheckinService {
  constructor(
    private readonly checkinRepository: CheckinRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly tables:TableRepository, private readonly slots:TimeSlotRepository, private readonly users:UserRepository,
    private readonly restaurants: RestaurantRepository,
    private readonly payments: PaymentRepository,
  ) {}

  walkIn(dto:WalkInDto,staffId:string) {
    const restaurantId=this.users.getStaffDetails(staffId)?.restaurant_id;
    const table=this.tables.findById(dto.table_id),slot=this.slots.findById(dto.slot_id);
    if(!table || !slot || table.restaurant_id!==restaurantId || slot.restaurant_id!==restaurantId || slot.slot_date!==indiaToday() || slot.published===false) throw new BadRequestException('Choose an available session today at your restaurant.');
    const restaurant = this.restaurants.findById(restaurantId!);
    if (!restaurant || restaurant.is_closed) throw new BadRequestException('This restaurant is closed.');
    if (!withinOperatingHours(slot.start_time, slot.end_time, restaurant)) throw new BadRequestException('Choose a session within restaurant operating hours.');
    const snapshot=slot.table_layout?.find((t)=>t.table_id===table.id);
    if(slot.table_layout && !snapshot) throw new BadRequestException('This table is not in the selected session.');
    if((snapshot?.capacity ?? table.capacity)<dto.guest_count) throw new BadRequestException('The selected table cannot seat this party.');
    const allocation=this.tableSlotRepository.findByTableAndSlot(table.id,slot.id);
    if(allocation?.status!=='available' || this.reservationRepository.findByTableAndSlot(table.id,slot.id)) throw new BadRequestException('This table is no longer available.');
    let diner=this.users.findAll().find((user)=>user.role===Role.DINER && user.phone===dto.phone);
    if(!diner) diner=this.users.create({id:generateId('guest'),name:dto.name.trim(),phone:dto.phone,email:`walkin.${randomUUID()}@dinetime.local`,password_hash:hashSync(randomUUID(),10),role:Role.DINER,status:'inactive',created_at:new Date().toISOString(),city:'Bengaluru',country:'India'});
    const reservation=this.reservationRepository.create({id:generateId('reservation'),user_id:diner.id,restaurant_id:restaurantId!,slot_id:slot.id,table_id:table.id,guest_count:dto.guest_count,reservation_status:'reserved',created_at:new Date().toISOString()});
    slot.layout_locked_at ||= new Date().toISOString();slot.revision=(slot.revision || 0)+1;
    return {...reservation,checkin:this.create({reservation_id:reservation.id,staff_id:staffId})};
  }

  findAll() {
    return this.checkinRepository.findAll();
  }

  create(dto: CreateCheckinDto) {
    const reservation = this.reservationRepository.findById(dto.reservation_id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.reservation_status !== 'reserved') {
      throw new BadRequestException('Check-in is only allowed for reserved bookings');
    }
    if(reservation.hold_expires_at && !this.payments.findByReservationId(reservation.id).some(p=>p.payment_status==='paid'))throw new BadRequestException('Online reservations require a confirmed payment before check-in.');

    const existing = this.checkinRepository.findByReservationId(dto.reservation_id);
    if (existing) {
      throw new BadRequestException('Check-in already exists for this reservation');
    }

    if (!reservation.table_id || !reservation.slot_id) {
      throw new BadRequestException('Reservation is missing table or slot reference');
    }

    const checkin = this.checkinRepository.create({
      checkin_id: generateId('checkin'),
      reservation_id: dto.reservation_id,
      staff_id: dto.staff_id,
      checkin_time: new Date().toISOString(),
    });

    this.reservationRepository.update(reservation.id, { reservation_status: 'checked_in' });
    reservationTableIds(reservation).forEach((tableId) =>
      this.tableSlotRepository.updateStatus(tableId, reservation.slot_id, 'occupied'));

    return checkin;
  }
}
