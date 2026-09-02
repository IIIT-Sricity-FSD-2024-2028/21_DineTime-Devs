import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UserStatus } from 'src/common/types/schema.types';

export class CreateRestaurantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  manager_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cuisine_type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_tables?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  rating_avg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_reviews?: number;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: UserStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  image_urls?: string[];

  @ApiPropertyOptional({ description: 'Reservation deposit charged per guest (INR)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reservation_fee_per_guest?: number;

  @ApiPropertyOptional({ description: 'Minutes before the reservation time after which a diner can no longer cancel' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cancellation_cutoff_minutes?: number;

  @ApiPropertyOptional({ description: 'Minutes after the reservation time the table is held before staff can mark a no-show' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  no_show_grace_minutes?: number;

  @ApiPropertyOptional({ description: 'Daily opening time, HH:MM' })
  @IsOptional()
  @IsString()
  opens_at?: string;

  @ApiPropertyOptional({ description: 'Daily closing time, HH:MM' })
  @IsOptional()
  @IsString()
  closes_at?: string;
}

export class UpdateRestaurantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manager_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cuisine_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_tables?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  rating_avg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_reviews?: number;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: UserStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  image_urls?: string[];

  @ApiPropertyOptional({ description: 'Reservation deposit charged per guest (INR)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reservation_fee_per_guest?: number;

  @ApiPropertyOptional({ description: 'Minutes before the reservation time after which a diner can no longer cancel' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cancellation_cutoff_minutes?: number;

  @ApiPropertyOptional({ description: 'Minutes after the reservation time the table is held before staff can mark a no-show' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  no_show_grace_minutes?: number;

  @ApiPropertyOptional({ description: 'Daily opening time, HH:MM' })
  @IsOptional()
  @IsString()
  opens_at?: string;

  @ApiPropertyOptional({ description: 'Daily closing time, HH:MM' })
  @IsOptional()
  @IsString()
  closes_at?: string;
}

export class ServingStatusDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  manager_id: string;

  @ApiProperty()
  @IsBoolean()
  is_open: boolean;
}

export class CreateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  country: string;
}
