import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TableSlotStatus } from 'src/common/types/schema.types';

export class SeedRestaurantTableSlotsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  restaurant_id: string;
}

export class UpdateTableSlotStatusDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  table_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slot_id: string;

  @ApiProperty({ enum: ['available', 'reserved', 'occupied', 'blocked'] })
  @IsEnum(['available', 'reserved', 'occupied', 'blocked'])
  status: TableSlotStatus;
}
