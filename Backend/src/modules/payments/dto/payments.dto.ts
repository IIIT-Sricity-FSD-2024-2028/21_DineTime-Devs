import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentStatus } from 'src/common/types/schema.types';

export class CreatePaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reservation_id: string;

  @ApiPropertyOptional({ description: 'Ignored — the server computes the canonical amount from the reservation' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  payment_method: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transaction_ref: string;

  @ApiProperty({ enum: ['pending', 'paid', 'failed'] })
  @IsEnum(['pending', 'paid', 'failed'])
  payment_status: PaymentStatus;
}

export class UpdatePaymentDto {
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsString()
  payment_method?: string;

  @ApiPropertyOptional()
  @IsString()
  transaction_ref?: string;

  @ApiPropertyOptional({ enum: ['pending', 'paid', 'failed'] })
  @IsEnum(['pending', 'paid', 'failed'])
  payment_status?: PaymentStatus;
}
