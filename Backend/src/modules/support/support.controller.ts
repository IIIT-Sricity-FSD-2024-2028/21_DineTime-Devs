import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { dataArraySchema, dataObjectSchema } from 'src/common/swagger/schemas';
import { ticketAttachmentMulterConfig } from 'src/common/upload/multer.config';
import { TicketRaiserRole, TicketStatus } from 'src/common/types/schema.types';
import {
  ClaimTicketDto,
  CreateSupportTicketDto,
  LinkTicketDto,
  ResolveTicketDto,
  TicketDecisionDto,
} from 'src/modules/support/dto/support.dto';
import { SupportService } from 'src/modules/support/support.service';

const actingRole = (req: Request): Role | undefined =>
  ((req as unknown as { user?: { role?: Role } }).user?.role) ||
  (req.headers.role as Role | undefined);

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Roles(Role.DINER, Role.MANAGER)
  @Post('tickets')
  @UseInterceptors(FilesInterceptor('attachments', 5, ticketAttachmentMulterConfig))
  @ApiOperation({ summary: 'Raise a support ticket (diner or manager)' })
  @ApiHeader({ name: 'role', required: true, description: 'diner | manager' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateSupportTicketDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  create(
    @Body() dto: CreateSupportTicketDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const attachments = (files || []).map((file) => `/uploads/tickets/${file.filename}`);
    return { data: this.supportService.create(dto, attachments) };
  }

  @Roles(Role.DINER, Role.MANAGER)
  @Get('tickets/mine')
  @ApiOperation({ summary: 'List tickets raised by the current diner or manager' })
  @ApiQuery({ name: 'user_id', required: true })
  @ApiOkResponse({ schema: dataArraySchema })
  findMine(@Query('user_id') userId: string) {
    return { data: this.supportService.findMine(userId) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Get('tickets')
  @ApiOperation({ summary: 'List support tickets (support admin, super admin read-only)' })
  @ApiHeader({ name: 'role', required: true, description: 'support_admin | super_user' })
  @ApiQuery({ name: 'raised_by_role', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(
    @Query('raised_by_role') raisedByRole?: TicketRaiserRole,
    @Query('status') status?: TicketStatus,
  ) {
    return { data: this.supportService.findAll(raisedByRole, status) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get a single ticket' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  findOne(@Param('id') id: string) {
    return { data: this.supportService.findOne(id) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Get('lookup/reservation/:id')
  @ApiOperation({ summary: 'Look up a reservation and its related records' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  lookupReservation(@Param('id') id: string) {
    return { data: this.supportService.lookupReservation(id) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Get('lookup/restaurant/:id')
  @ApiOperation({ summary: 'Look up a restaurant and its booking stats' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  lookupRestaurant(@Param('id') id: string) {
    return { data: this.supportService.lookupRestaurant(id) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Get('lookup/diner/:id')
  @ApiOperation({ summary: "Look up a diner's profile and full reservation history" })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  lookupDiner(@Param('id') id: string) {
    return { data: this.supportService.lookupDiner(id) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Get('lookup/manager/:id')
  @ApiOperation({ summary: "Look up a manager's restaurant(s) and booking stats" })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  lookupManager(@Param('id') id: string) {
    return { data: this.supportService.lookupManager(id) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Patch('tickets/:id/claim')
  @ApiOperation({ summary: 'Support admin claims a ticket for review' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ClaimTicketDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  claim(@Param('id') id: string, @Body() dto: ClaimTicketDto, @Req() req: Request) {
    return { data: this.supportService.claim(id, dto, actingRole(req)) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Patch('tickets/:id/link')
  @ApiOperation({ summary: 'Attach a verified reservation/restaurant id to a ticket' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: LinkTicketDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  link(@Param('id') id: string, @Body() dto: LinkTicketDto, @Req() req: Request) {
    return { data: this.supportService.link(id, dto, actingRole(req)) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Patch('tickets/:id/decision')
  @ApiOperation({ summary: 'Support admin decides: approve refund, deny refund, or escalate technical issue' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: TicketDecisionDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  decision(@Param('id') id: string, @Body() dto: TicketDecisionDto, @Req() req: Request) {
    return { data: this.supportService.decision(id, dto, actingRole(req)) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Patch('tickets/:id/resolve')
  @ApiOperation({ summary: 'Resolve a ticket (support admin generally; super admin only on escalated tickets)' })
  @ApiHeader({ name: 'role', required: true, description: 'support_admin | super_user' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ResolveTicketDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  resolve(@Param('id') id: string, @Body() dto: ResolveTicketDto, @Req() req: Request) {
    return { data: this.supportService.resolve(id, dto, actingRole(req)) };
  }

  @Roles(Role.SUPPORT_ADMIN)
  @Patch('tickets/:id/reject')
  @ApiOperation({ summary: 'Reject a ticket as invalid' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ResolveTicketDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  reject(@Param('id') id: string, @Body() dto: ResolveTicketDto, @Req() req: Request) {
    return { data: this.supportService.reject(id, dto, actingRole(req)) };
  }
}
