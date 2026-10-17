import { Module } from '@nestjs/common';
import { TableslotsController } from 'src/modules/tableslots/tableslots.controller';
import { TableslotsService } from 'src/modules/tableslots/tableslots.service';
import { SchedulesModule } from 'src/modules/schedules/schedules.module';

@Module({
  controllers: [TableslotsController],
  providers: [TableslotsService],
  imports: [SchedulesModule],
  exports: [TableslotsService],
})
export class TableslotsModule {}
