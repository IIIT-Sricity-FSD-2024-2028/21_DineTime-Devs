import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateCheckinDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reservation_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  staff_id: string;
}

export class WalkInDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name:string;
  @IsString() @Matches(/^[0-9]{10}$/) phone:string;
  @IsInt() @Min(1) guest_count:number;
  @IsString() @IsNotEmpty() table_id:string;
  @IsString() @IsNotEmpty() slot_id:string;
}
