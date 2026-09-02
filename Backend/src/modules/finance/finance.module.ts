import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { FinanceController } from 'src/modules/finance/finance.controller';
import { FinanceService } from 'src/modules/finance/finance.service';

@Module({
  imports: [NotificationsModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
