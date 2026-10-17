import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const RAISER_ROLES = ['diner', 'manager'] as const;
const CATEGORIES = ['refund', 'technical', 'other'] as const;
const DECISIONS = ['refund_approved', 'refund_denied', 'escalated_technical', 'finance_review'] as const;

export class CreateSupportTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restaurant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slot_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payment_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reservation_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['payment_refund_issue', 'reservation_issue', 'checkin_seating_issue', 'restaurant_unavailable', 'restaurant_experience', 'app_reservation_changes', 'payment_problem', 'refund_not_received', 'reservation_problem', 'checkin_problem', 'app_problem', 'order_problem', 'payout_missing', 'payout_incorrect', 'availability_problem', 'verification_problem', 'staff_issue', 'customer_dispute_no_show', 'other'])
  issue_code?: string;

  @ApiPropertyOptional({ enum: ['all', 'individual'] })
  @IsOptional()
  @IsIn(['all', 'individual'])
  affected_staff_scope?: 'all' | 'individual';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  affected_staff_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  issue_note?: string;

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
  decision: 'refund_approved' | 'refund_denied' | 'escalated_technical' | 'finance_review';

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
