import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateId } from 'src/common/utils/id.util';
import {
  CreateReservationDto,
  UpdateReservationDto,
} from 'src/modules/reservations/dto/reservations.dto';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly tableRepository: TableRepository,
    private readonly timeSlotRepository: TimeSlotRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll(userId?: string, restaurantId?: string) {
    if (restaurantId) {
      return this.reservationRepository.findAll()
        .filter((reservation) => reservation.restaurant_id === restaurantId)
        .map((reservation) => ({
          ...reservation,
          status: reservation.reservation_status,
        }));
    }

    if (userId) {
      return this.reservationRepository.findByUserId(userId).map((reservation) => ({
        ...reservation,
        status: reservation.reservation_status,
      }));
    }

    return this.reservationRepository.findAll().map((reservation) => ({
      ...reservation,
      status: reservation.reservation_status,
    }));
  }

  findOne(id: string) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return {
      ...reservation,
      status: reservation.reservation_status,
    };
  }

  create(dto: CreateReservationDto) {
    const table = this.tableRepository.findById(dto.table_id);
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    if (table.restaurant_id !== dto.restaurant_id) {
      throw new BadRequestException('Table does not belong to the restaurant');
    }

    if (table.capacity < dto.guest_count) {
      throw new BadRequestException('Guest count exceeds table capacity');
    }

    const slot = this.timeSlotRepository.findById(dto.slot_id);
    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    if (slot.restaurant_id !== dto.restaurant_id) {
      throw new BadRequestException('Time slot does not belong to the restaurant');
    }

    const tableSlot = this.tableSlotRepository.findByTableAndSlot(
      dto.table_id,
      dto.slot_id,
    );
    if (!tableSlot) {
      throw new NotFoundException('Table slot not found');
    }

    const existingReservation = this.reservationRepository.findByTableAndSlot(
      dto.table_id,
      dto.slot_id,
    );

    // Idempotent behavior: if the same user submits the same reservation again,
    // return the existing reservation instead of failing the core flow.
    if (
      existingReservation &&
      existingReservation.reservation_status !== 'cancelled' &&
      existingReservation.user_id === dto.user_id
    ) {
      return {
        ...existingReservation,
        status: existingReservation.reservation_status,
      };
    }

    if (tableSlot.status !== 'available') {
      throw new BadRequestException('Selected table slot is not available');
    }

    if (existingReservation && existingReservation.reservation_status !== 'cancelled') {
      throw new BadRequestException('Table already reserved for this slot');
    }

    const reservation = this.reservationRepository.create({
      id: generateId('reservation'),
      user_id: dto.user_id,
      restaurant_id: dto.restaurant_id,
      table_id: dto.table_id,
      slot_id: dto.slot_id,
      guest_count: dto.guest_count,
          reservation_status: 'reserved',
          created_at: new Date().toISOString(),
    });

    this.tableSlotRepository.updateStatus(dto.table_id, dto.slot_id, 'reserved');

    this.notificationsService.create(
      dto.user_id,
      'Reservation confirmed',
      'reservation_confirmation',
    );

    return {
      ...reservation,
      status: reservation.reservation_status,
    };
  }

  update(id: string, dto: UpdateReservationDto) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (
      dto.reservation_status === 'completed' &&
      reservation.reservation_status !== 'checked_in'
    ) {
      throw new BadRequestException(
        'Reservation can be completed only after check-in',
      );
    }

    const updated = this.reservationRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Reservation not found');
    }

    if (dto.reservation_status && reservation.table_id && reservation.slot_id) {
      const nextTableSlotStatus =
        dto.reservation_status === 'checked_in'
          ? 'occupied'
          : dto.reservation_status === 'reserved'
            ? 'reserved'
            : 'available';

      this.tableSlotRepository.updateStatus(
        reservation.table_id,
        reservation.slot_id,
        nextTableSlotStatus,
      );
    }

    return {
      ...updated,
      status: updated.reservation_status,
    };
  }

  delete(id: string) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    const deleted = this.reservationRepository.remove(id);
    if (!deleted) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.table_id && reservation.slot_id) {
      this.tableSlotRepository.updateStatus(
        reservation.table_id,
        reservation.slot_id,
        'available',
      );
    }

    return { deleted: true };
  }
}
