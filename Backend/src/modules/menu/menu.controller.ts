import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
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
import { CreateMenuItemDto, UpdateMenuItemDto } from 'src/modules/menu/dto/menu.dto';
import { MenuService } from 'src/modules/menu/menu.service';

@ApiTags('menu')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff' })
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF)
  @Get()
  @ApiOperation({ summary: 'List menu items' })
  @ApiQuery({ name: 'restaurant_id', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(@Query('restaurant_id') restaurantId?: string) {
    return { data: this.menuService.findAll(restaurantId) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF)
  @Get(':id')
  @ApiOperation({ summary: 'Get menu item by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Menu item not found' })
  findOne(@Param('id') id: string) {
    return { data: this.menuService.findOne(id) };
  }

  @Roles(Role.MANAGER)
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image', multerConfig))
  @ApiOperation({ summary: 'Upload a menu item image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
      required: ['image'],
    },
  })
  @ApiOkResponse({ schema: dataObjectSchema })
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Menu image file is required');
    }

    return { data: { image_url: `/uploads/restaurants/${file.filename}` } };
  }

  @Roles(Role.MANAGER)
  @Post()
  @ApiOperation({ summary: 'Create menu item' })
  @ApiBody({ type: CreateMenuItemDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid menu item payload' })
  create(@Body() dto: CreateMenuItemDto) {
    return { data: this.menuService.create(dto) };
  }

  @Roles(Role.MANAGER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update menu item' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateMenuItemDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid menu item payload' })
  @ApiNotFoundResponse({ description: 'Menu item not found' })
  update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return { data: this.menuService.update(id, dto) };
  }

  @Roles(Role.MANAGER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete menu item' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'Menu item not found' })
  delete(@Param('id') id: string) {
    return { data: this.menuService.delete(id) };
  }
}
