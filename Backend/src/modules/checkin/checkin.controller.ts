import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { dataArraySchema, dataObjectSchema } from 'src/common/swagger/schemas';
import { CheckinService } from 'src/modules/checkin/checkin.service';
import { CreateCheckinDto, WalkInDto } from 'src/modules/checkin/dto/checkin.dto';

@ApiTags('checkin')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff' })
@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Roles(Role.STAFF)
  @Post('walk-in')
  walkIn(@Body() dto:WalkInDto,@Req() req:{user:{sub:string}}) {
    return {data:this.checkinService.walkIn(dto,req.user.sub)};
  }

  @Roles(Role.STAFF)
  @Get()
  @ApiOperation({ summary: 'List check-ins' })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll() {
    return { data: this.checkinService.findAll() };
  }

  @Roles(Role.STAFF)
  @Post()
  @ApiOperation({ summary: 'Create check-in' })
  @ApiBody({ type: CreateCheckinDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid check-in payload' })
  create(@Body() dto: CreateCheckinDto) {
    return { data: this.checkinService.create(dto) };
  }
}
