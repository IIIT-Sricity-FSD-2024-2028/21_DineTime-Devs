import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { dataArraySchema, dataObjectSchema, deletedSchema } from 'src/common/swagger/schemas';
import {
  CreateSubAdminDto,
  SubAdminLoginDto,
  SubAdminTeam,
  UpdateSubAdminDto,
} from 'src/modules/sub-admin/dto/sub-admin.dto';
import { SubAdminService } from 'src/modules/sub-admin/sub-admin.service';

@ApiTags('sub-admin')
@Controller('sub-admin')
export class SubAdminController {
  constructor(private readonly subAdminService: SubAdminService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login as a sub-admin (support, finance, or verification team)' })
  @ApiBody({ type: SubAdminLoginDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() dto: SubAdminLoginDto) {
    return { data: await this.subAdminService.login(dto) };
  }

  @Roles(Role.SUPER_USER)
  @ApiHeader({ name: 'role', required: true, description: 'super_user' })
  @Post()
  @ApiOperation({ summary: 'Create a sub-admin account (super admin only)' })
  @ApiBody({ type: CreateSubAdminDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  async create(@Body() dto: CreateSubAdminDto) {
    return { data: await this.subAdminService.create(dto) };
  }

  @Roles(Role.SUPER_USER)
  @ApiHeader({ name: 'role', required: true, description: 'super_user' })
  @Get()
  @ApiOperation({ summary: 'List sub-admin accounts' })
  @ApiQuery({ name: 'team', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(@Query('team') team?: SubAdminTeam) {
    return { data: this.subAdminService.findAll(team) };
  }

  @Roles(Role.SUPER_USER)
  @ApiHeader({ name: 'role', required: true, description: 'super_user' })
  @Patch(':id')
  @ApiOperation({ summary: 'Update a sub-admin account (status, password, details)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateSubAdminDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  async update(@Param('id') id: string, @Body() dto: UpdateSubAdminDto) {
    return { data: await this.subAdminService.update(id, dto) };
  }

  @Roles(Role.SUPER_USER)
  @ApiHeader({ name: 'role', required: true, description: 'super_user' })
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sub-admin account' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  remove(@Param('id') id: string) {
    return { data: this.subAdminService.remove(id) };
  }
}
