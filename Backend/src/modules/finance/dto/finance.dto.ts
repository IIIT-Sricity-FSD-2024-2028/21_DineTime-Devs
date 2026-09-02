import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class FinanceRefundDecisionDto {
  @ApiProperty({ description: 'true to approve and process the refund, false to deny it' })
  @IsBoolean()
  approve: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  notes: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  admin_id: string;
}

export class SettleAllPayoutsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  admin_id: string;
}

export class BlockPayoutDto {
  @ApiProperty({ description: 'true to block this restaurant from receiving payouts, false to unblock' })
  @IsBoolean()
  blocked: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  admin_id: string;
}

export class BlockPaymentDto {
  @ApiProperty({ description: 'true to block this specific payment from being settled, false to unblock' })
  @IsBoolean()
  blocked: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  admin_id: string;
}
