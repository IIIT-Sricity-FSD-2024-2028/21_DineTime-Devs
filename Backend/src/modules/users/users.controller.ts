import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  ApiTags,
} from '@nestjs/swagger';
import { Role } from 'src/common/enums/role.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  dataArraySchema,
  dataObjectSchema,
  deletedSchema,
} from 'src/common/swagger/schemas';
import { profilePhotoMulterConfig } from 'src/common/upload/multer.config';
import { CreateUserDto, UpdateUserDto } from 'src/modules/users/dto/users.dto';
import { UsersService } from 'src/modules/users/users.service';

@ApiTags('users')
@ApiHeader({ name: 'role', required: true, description: 'diner | manager | staff | super_user' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll() {
    return { data: this.usersService.findAll() };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'User not found' })
  findOne(@Param('id') id: string) {
    return { data: this.usersService.findOne(id) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.SUPER_USER)
  @Post()
  @ApiOperation({ summary: 'Create user (registration or admin creation)' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid user payload' })
  create(@Body() dto: CreateUserDto) {
    return { data: this.usersService.create(dto) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid user payload' })
  @ApiNotFoundResponse({ description: 'User not found' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return { data: this.usersService.update(id, dto) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF, Role.SUPER_USER)
  @Post(':id/upload-photo')
  @UseInterceptors(FileInterceptor('photo', profilePhotoMulterConfig))
  @ApiOperation({ summary: 'Upload user profile photo' })
  @ApiParam({ name: 'id' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['photo'],
    },
  })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid profile photo upload' })
  @ApiNotFoundResponse({ description: 'User not found' })
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }

    return {
      data: this.usersService.uploadPhoto(
        id,
        `/uploads/profiles/${file.filename}`,
      ),
    };
  }

  @Roles(Role.MANAGER, Role.SUPER_USER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'User not found' })
  remove(@Param('id') id: string) {
    return { data: this.usersService.remove(id) };
  }
}
