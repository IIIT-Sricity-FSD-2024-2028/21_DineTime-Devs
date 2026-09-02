import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateManagerDetailsDto {
  @ApiProperty()
  @IsString()
  manager_id: string;

  @ApiProperty()
  @IsString()
  business_license_number: string;
}

export class UpdateManagerDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_license_number?: string;
}

export class RegisterManagerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  business_license_number: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  restaurant_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cuisine_type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class ReviewManagerDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsString()
  @IsNotEmpty()
  decision: 'approved' | 'rejected';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reviewer_id: string;
}
