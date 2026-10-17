import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const ruleTypes = ['hours', 'closure', 'table_block', 'slot'] as const;
const scopes = ['date'] as const;

export class WeeklyScheduleDayDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt() @Min(0) @Max(6)
  weekday: number;

  @ApiProperty()
  @IsBoolean()
  is_closed: boolean;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  open_time: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  close_time: string;

  @ApiProperty({ default: 120 })
  @IsInt() @Min(30) @Max(480)
  slot_duration_minutes: number;

  @ApiProperty({ default: 0 })
  @IsInt() @Min(0) @Max(120)
  buffer_minutes: number;

  @ApiPropertyOptional({ type: [Object] })
  @Allow()
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WeeklyTimeSlotDto)
  slots?: WeeklyTimeSlotDto[];
}

export class WeeklyTimeSlotDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  start_time: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  end_time: string;
}

export class UpdateWeeklyScheduleDto {
  @ApiProperty({ type: [WeeklyScheduleDayDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => WeeklyScheduleDayDto)
  weekly: WeeklyScheduleDayDto[];
}

export class UpdateDateScheduleDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  start_date: string;

  @ApiProperty()
  @IsBoolean()
  is_closed: boolean;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  open_time: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  close_time: string;

  @ApiProperty({ type: [WeeklyTimeSlotDto] })
  @Allow()
  @IsArray() @ValidateNested({ each: true }) @Type(() => WeeklyTimeSlotDto)
  slots: WeeklyTimeSlotDto[];

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  reason?: string;
}

export class DefaultLayoutTableDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  table_id: string;

  @ApiProperty()
  @IsInt() @Min(1) @Max(100)
  capacity: number;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(7)
  x?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(15)
  y?: number;

  @ApiPropertyOptional({ enum: ['round', 'square'] })
  @IsOptional() @IsEnum(['round', 'square'])
  shape?: 'round' | 'square';
}

export class UpdateDefaultLayoutDto {
  @ApiProperty({ type: [DefaultLayoutTableDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => DefaultLayoutTableDto)
  layout: DefaultLayoutTableDto[];
}

export class ResetDateScheduleDto {
  @IsString() @IsNotEmpty()
  start_date: string;
}

export class CreateScheduleRuleDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  restaurant_id: string;

  @ApiProperty({ enum: ruleTypes })
  @IsEnum(ruleTypes)
  type: typeof ruleTypes[number];

  @ApiProperty({ enum: scopes })
  @IsEnum(scopes)
  scope: typeof scopes[number];

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  start_date?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  open_time?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  close_time?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  start_time?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  end_time?: string;

  @ApiPropertyOptional({ enum: ['add', 'remove'] })
  @IsOptional() @IsEnum(['add', 'remove'])
  slot_action?: 'add' | 'remove';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  table_ids?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  reason?: string;
}

export class RemoveScheduleRulesDto {
  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true })
  rule_ids: string[];
}
