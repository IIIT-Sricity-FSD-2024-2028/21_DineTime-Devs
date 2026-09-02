import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { SupportController } from 'src/modules/support/support.controller';
import { SupportService } from 'src/modules/support/support.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
