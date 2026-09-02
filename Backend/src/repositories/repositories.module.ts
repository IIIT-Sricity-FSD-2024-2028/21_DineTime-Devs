import { Global, Module } from '@nestjs/common';
import { CheckinRepository } from 'src/repositories/checkin.repository';
import { MenuRepository } from 'src/repositories/menu.repository';
import { NotificationRepository } from 'src/repositories/notification.repository';
import { OrderRepository } from 'src/repositories/order.repository';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { ReviewRepository } from 'src/repositories/review.repository';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { SupportTicketRepository } from 'src/repositories/support-ticket.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { UserRepository } from 'src/repositories/user.repository';

const repositories = [
  UserRepository,
  RestaurantRepository,
  TableRepository,
  TimeSlotRepository,
  TableSlotRepository,
  ReservationRepository,
  CheckinRepository,
  PaymentRepository,
  MenuRepository,
  OrderRepository,
  ReviewRepository,
  NotificationRepository,
  SettingsRepository,
  SupportTicketRepository,
];

@Global()
@Module({
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
