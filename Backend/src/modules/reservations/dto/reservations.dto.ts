import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ReservationStatus } from 'src/common/types/schema.types';

export class CreateReservationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  restaurant_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  table_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slot_id: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  guest_count: number;
}

export class UpdateReservationDto {
  @ApiPropertyOptional({
    enum: ['reserved', 'checked_in', 'completed', 'cancelled', 'no_show'],
  })
  @IsOptional()
  @IsEnum(['reserved', 'checked_in', 'completed', 'cancelled', 'no_show'])
  reservation_status?: ReservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  guest_count?: number;
}

export class ModifyReservationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  restaurant_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slot_id: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  table_ids: string[];

  @ApiProperty()
  @IsInt()
  @Min(1)
  guest_count: number;

}
