import { Module } from '@nestjs/common';
import { TimeslotsController } from 'src/modules/timeslots/timeslots.controller';
import { TimeslotsService } from 'src/modules/timeslots/timeslots.service';
import { SchedulesModule } from 'src/modules/schedules/schedules.module';

@Module({
  controllers: [TimeslotsController],
  providers: [TimeslotsService],
  imports: [SchedulesModule],
  exports: [TimeslotsService],
})
export class TimeslotsModule {}
