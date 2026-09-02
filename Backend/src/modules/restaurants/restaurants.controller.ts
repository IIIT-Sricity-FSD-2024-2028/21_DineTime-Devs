import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ReadOnlyForSuperUserGuard } from 'src/common/guards/read-only-for-super-user.guard';
import {
  dataArraySchema,
  dataObjectSchema,
  deletedSchema,
} from 'src/common/swagger/schemas';
import { multerConfig } from 'src/common/upload/multer.config';
import { getActingRole as actingRole } from 'src/common/utils/acting-role.util';
import {
  CreateLocationDto,
  CreateRestaurantDto,
  ServingStatusDto,
  UpdateRestaurantDto,
} from 'src/modules/restaurants/dto/restaurants.dto';
import { RestaurantsService } from 'src/modules/restaurants/restaurants.service';

@ApiTags('restaurants')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff' })
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Post('locations')
  @ApiOperation({ summary: 'Create restaurant location' })
  @ApiBody({ type: CreateLocationDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid location payload' })
  createLocation(@Body() dto: CreateLocationDto) {
    return { data: this.restaurantsService.createLocation(dto) };
  }

  @Get('locations')
  @ApiOperation({ summary: 'List all restaurant locations (public — used during manager registration)' })
  @ApiOkResponse({ schema: dataArraySchema })
  findAllLocations() {
    return { data: this.restaurantsService.findAllLocations() };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get('locations/:id')
  @ApiOperation({ summary: 'Get restaurant location by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Location not found' })
  findLocation(@Param('id') id: string) {
    return { data: this.restaurantsService.findLocation(id) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER, Role.FINANCE_ADMIN)
  @Get()
  @ApiOperation({ summary: 'List restaurants' })
  @ApiQuery({ name: 'city', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(@Query('city') city: string | undefined, @Req() req: Request) {
    return { data: this.restaurantsService.findAll(city, actingRole(req)) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get(':id')
  @ApiOperation({ summary: 'Get restaurant by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  findOne(@Param('id') id: string) {
    return { data: this.restaurantsService.findOne(id) };
  }

  @Roles(Role.MANAGER)
  @Get(':id/revenue')
  @ApiOperation({ summary: 'Revenue collected from diners vs. paid out by finance for this restaurant (owning manager only)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'manager_id', required: true })
  @ApiOkResponse({ schema: dataObjectSchema })
  revenue(@Param('id') id: string, @Query('manager_id') managerId: string) {
    return { data: this.restaurantsService.revenue(id, managerId) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @UseGuards(ReadOnlyForSuperUserGuard)
  @Post()
  @ApiOperation({ summary: 'Create restaurant' })
  @ApiBody({ type: CreateRestaurantDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid restaurant payload' })
  create(@Body() dto: CreateRestaurantDto) {
    return { data: this.restaurantsService.create(dto) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @UseGuards(ReadOnlyForSuperUserGuard)
  @Post(':id/upload-image')
  @UseInterceptors(FileInterceptor('image', multerConfig))
  @ApiOperation({ summary: 'Upload a restaurant image' })
  @ApiParam({ name: 'id' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['image'],
    },
  })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid image upload' })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    return {
      data: this.restaurantsService.uploadImage(
        id,
        `/uploads/restaurants/${file.filename}`,
      ),
    };
  }

  @Roles(Role.MANAGER)
  @Patch(':id/serving-status')
  @ApiOperation({ summary: 'Open or close a restaurant for diner visibility (manager, verified only)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ServingStatusDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Restaurant not verified or not owned by this manager' })
  setServingStatus(@Param('id') id: string, @Body() dto: ServingStatusDto) {
    return { data: this.restaurantsService.setServingStatus(id, dto.manager_id, dto.is_open) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @UseGuards(ReadOnlyForSuperUserGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update restaurant' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateRestaurantDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid restaurant payload' })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  update(@Param('id') id: string, @Body() dto: UpdateRestaurantDto) {
    return { data: this.restaurantsService.update(id, dto) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @UseGuards(ReadOnlyForSuperUserGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete restaurant' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  delete(@Param('id') id: string) {
    return { data: this.restaurantsService.delete(id) };
  }
}
