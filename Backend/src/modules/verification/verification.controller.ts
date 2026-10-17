import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { dataArraySchema, dataObjectSchema } from 'src/common/swagger/schemas';
import { ManagerVerificationStatus } from 'src/common/types/schema.types';
import { ReviewManagerDto } from 'src/modules/manager/dto/manager.dto';
import { ManagerService } from 'src/modules/manager/manager.service';
import { UserRepository } from 'src/repositories/user.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';

@ApiTags('verification')
@ApiHeader({ name: 'role', required: true, description: 'verification_admin | super_user' })
@Controller('verification')
export class VerificationController {
  constructor(
    private readonly managerService: ManagerService,
    private readonly userRepository: UserRepository,
    private readonly restaurantRepository: RestaurantRepository,
  ) {}

  private actingAdminLocation(req: Request): { role?: Role; locationId?: string } {
    const role = ((req as unknown as { user?: { role?: Role; sub?: string } }).user?.role) ||
      (req.headers.role as Role | undefined);
    const adminId = (req as unknown as { user?: { sub?: string } }).user?.sub ||
      (req.headers['admin-id'] as string | undefined);

    if (role === Role.SUPER_USER) {
      return { role };
    }

    const admin = adminId ? this.userRepository.findById(adminId) : undefined;
    return { role, locationId: admin?.location_id };
  }

  @Get('teams')
  @ApiOperation({ summary: 'List active Verification Team locations for manager registration' })
  @ApiOkResponse({ schema: dataArraySchema })
  findTeams() {
    const locations = new Map(this.restaurantRepository.findAllLocations().map((location) => [location.id, location]));
    return { data: [...new Map(this.userRepository.findAll()
      .filter((user) => user.role === Role.VERIFICATION_ADMIN && user.status === 'active' && user.location_id)
      .map((user) => locations.get(user.location_id!))
      .filter((location): location is NonNullable<typeof location> => Boolean(location))
      .map((location) => [location.id, { location_id: location.id, city: location.city }])).values()] };
  }

  @Roles(Role.VERIFICATION_ADMIN)
  @Get('applications')
  @ApiOperation({ summary: 'List manager verification applications for the assigned location' })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findApplications(@Query('status') status: ManagerVerificationStatus | undefined, @Req() req: Request) {
    const { role, locationId } = this.actingAdminLocation(req);
    const effectiveLocationId = role === Role.SUPER_USER ? undefined : locationId;
    return { data: this.managerService.findApplications(effectiveLocationId, status) };
  }

  @Roles(Role.VERIFICATION_ADMIN)
  @Get('applications/:id')
  @ApiOperation({ summary: 'Get a single manager application' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  findApplicationDetail(@Param('id') id: string) {
    return { data: this.managerService.findApplicationDetail(id) };
  }

  @Roles(Role.VERIFICATION_ADMIN)
  @Patch('applications/:id/review')
  @ApiOperation({ summary: 'Approve or reject a manager verification application' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ReviewManagerDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  review(@Param('id') id: string, @Body() dto: ReviewManagerDto) {
    return { data: this.managerService.review(id, dto) };
  }
}
