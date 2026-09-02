import { Module } from '@nestjs/common';
import { SubAdminController } from 'src/modules/sub-admin/sub-admin.controller';
import { SubAdminService } from 'src/modules/sub-admin/sub-admin.service';

@Module({
  controllers: [SubAdminController],
  providers: [SubAdminService],
})
export class SubAdminModule {}
