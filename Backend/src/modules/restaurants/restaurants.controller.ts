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
  UploadedFile,
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
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  dataArraySchema,
  dataObjectSchema,
  deletedSchema,
} from 'src/common/swagger/schemas';
import { multerConfig } from 'src/common/upload/multer.config';
import {
  CreateLocationDto,
  CreateRestaurantDto,
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

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get('locations/:id')
  @ApiOperation({ summary: 'Get restaurant location by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Location not found' })
  findLocation(@Param('id') id: string) {
    return { data: this.restaurantsService.findLocation(id) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get()
  @ApiOperation({ summary: 'List restaurants' })
  @ApiQuery({ name: 'city', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(@Query('city') city?: string) {
    return { data: this.restaurantsService.findAll(city) };
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

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Post()
  @ApiOperation({ summary: 'Create restaurant' })
  @ApiBody({ type: CreateRestaurantDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid restaurant payload' })
  create(@Body() dto: CreateRestaurantDto) {
    return { data: this.restaurantsService.create(dto) };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
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

  @Roles(Role.MANAGER, Role.SUPER_USER)
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
  @Delete(':id')
  @ApiOperation({ summary: 'Delete restaurant' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  delete(@Param('id') id: string) {
    return { data: this.restaurantsService.delete(id) };
  }
}
