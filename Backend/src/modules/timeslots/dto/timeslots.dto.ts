import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTimeSlotDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  restaurant_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slot_date: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  start_time: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  end_time: string;
}

export class UpdateTimeSlotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  revision?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restaurant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slot_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  start_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  end_time?: string;
}

export class SlotTableDto {
  @IsString() @IsNotEmpty() table_id: string;
  @IsInt() @Min(1) @Max(100) capacity: number;
  @IsOptional() @IsInt() @Min(0) @Max(7) x?:number;
  @IsOptional() @IsInt() @Min(0) @Max(15) y?:number;
  @IsOptional() @IsEnum(['round','square']) shape?:'round'|'square';
}
export class SaveSlotLayoutDto {
  @IsInt() @Min(0) revision: number;
  // An empty date-specific layout is valid: it means no tables are offered for
  // that service. The weekly default still requires at least one table.
  @IsArray() @ArrayMaxSize(100) @ArrayUnique((entry: SlotTableDto)=>entry.table_id)
  @ValidateNested({each:true}) @Type(()=>SlotTableDto) tables: SlotTableDto[];
}

export class ResetSlotLayoutDto {
  @IsInt() @Min(0) revision: number;
}
