import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';
import { UserStatus } from 'src/common/types/schema.types';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password_hash: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_license_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  government_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verified_status?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restaurant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employee_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role_type?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password_hash?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_license_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  government_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verified_status?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restaurant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employee_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role_type?: string;
}
