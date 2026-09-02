import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const RAISER_ROLES = ['diner', 'manager'] as const;
const CATEGORIES = ['refund', 'technical', 'other'] as const;
const DECISIONS = ['refund_approved', 'refund_denied', 'escalated_technical'] as const;

export class CreateSupportTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  raised_by_user_id: string;

  @ApiProperty({ enum: RAISER_ROLES })
  @IsIn(RAISER_ROLES)
  raised_by_role: 'diner' | 'manager';

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category: 'refund' | 'technical' | 'other';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  subject: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;
}

export class TicketDecisionDto {
  @ApiProperty({ enum: DECISIONS })
  @IsIn(DECISIONS)
  decision: 'refund_approved' | 'refund_denied' | 'escalated_technical';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  notes: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  admin_id: string;
}

export class ResolveTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  resolution_notes: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  admin_id: string;
}

export class ClaimTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  admin_id: string;
}

export class LinkTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reservation_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restaurant_id?: string;
}
