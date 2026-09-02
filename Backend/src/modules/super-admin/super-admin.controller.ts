import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { dataObjectSchema } from 'src/common/swagger/schemas';
import {
  ChangeSuperAdminPasswordDto,
  SuperAdminLoginDto,
} from 'src/modules/super-admin/dto/super-admin.dto';
import { SuperAdminService } from 'src/modules/super-admin/super-admin.service';

@ApiTags('super-admin')
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login as super admin' })
  @ApiBody({ type: SuperAdminLoginDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() dto: SuperAdminLoginDto) {
    return { data: await this.superAdminService.login(dto) };
  }

  @Roles(Role.SUPER_USER)
  @ApiHeader({ name: 'role', required: true, description: 'super_user' })
  @Get('profile/:id')
  @ApiOperation({ summary: 'Get super admin profile' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Super admin not found' })
  getProfile(@Param('id') id: string) {
    return { data: this.superAdminService.getProfile(id) };
  }

  @Roles(Role.SUPER_USER)
  @ApiHeader({ name: 'role', required: true, description: 'super_user' })
  @Get('summary')
  @ApiOperation({ summary: 'Get global super admin dashboard summary' })
  @ApiOkResponse({ schema: dataObjectSchema })
  getSummary() {
    return { data: this.superAdminService.getSummary() };
  }

  @Roles(Role.SUPER_USER)
  @ApiHeader({ name: 'role', required: true, description: 'super_user' })
  @Patch('password')
  @ApiOperation({ summary: 'Change super admin password' })
  @ApiBody({ type: ChangeSuperAdminPasswordDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid password change payload' })
  async changePassword(@Body() dto: ChangeSuperAdminPasswordDto) {
    return { data: await this.superAdminService.changePassword(dto) };
  }
}
