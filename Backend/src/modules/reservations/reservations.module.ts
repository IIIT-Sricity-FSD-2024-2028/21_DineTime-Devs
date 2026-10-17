import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { ReservationsController } from 'src/modules/reservations/reservations.controller';
import { ReservationsService } from 'src/modules/reservations/reservations.service';
import { SchedulesModule } from 'src/modules/schedules/schedules.module';

@Module({
  imports: [NotificationsModule, SchedulesModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
