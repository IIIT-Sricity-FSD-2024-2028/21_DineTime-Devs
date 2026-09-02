import { Module } from '@nestjs/common';
import { ManagerModule } from 'src/modules/manager/manager.module';
import { VerificationController } from 'src/modules/verification/verification.controller';

@Module({
  imports: [ManagerModule],
  controllers: [VerificationController],
})
export class VerificationModule {}
