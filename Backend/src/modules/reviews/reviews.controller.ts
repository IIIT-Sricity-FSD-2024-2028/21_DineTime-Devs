import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
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
import { CreateReviewDto, UpdateReviewDto, UpdateReviewReplyDto } from 'src/modules/reviews/dto/reviews.dto';
import { ReviewsService } from 'src/modules/reviews/reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF)
  @Get()
  @ApiOperation({ summary: 'List reviews' })
  @ApiQuery({ name: 'restaurant_id', required: false })
  @ApiOkResponse({ schema: dataArraySchema })
  findAll(@Query('restaurant_id') restaurantId?: string) {
    return { data: this.reviewsService.findAll(restaurantId) };
  }

  @Roles(Role.DINER, Role.MANAGER, Role.STAFF)
  @Get(':id')
  @ApiOperation({ summary: 'Get review by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Review not found' })
  findOne(@Param('id') id: string) {
    return { data: this.reviewsService.findOne(id) };
  }

  @Roles(Role.DINER)
  @Post()
  @ApiOperation({ summary: 'Create review' })
  @ApiBody({ type: CreateReviewDto })
  @ApiCreatedResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid review payload' })
  create(@Body() dto: CreateReviewDto) {
    return { data: this.reviewsService.create(dto) };
  }

  @Roles(Role.DINER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update review' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateReviewDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiBadRequestResponse({ description: 'Invalid review payload' })
  @ApiNotFoundResponse({ description: 'Review not found' })
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return { data: this.reviewsService.update(id, dto) };
  }

  @Roles(Role.MANAGER)
  @Patch(':id/reply')
  @ApiOperation({ summary: 'Update manager reply on a review' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateReviewReplyDto })
  @ApiOkResponse({ schema: dataObjectSchema })
  @ApiNotFoundResponse({ description: 'Review not found' })
  updateReply(@Param('id') id: string, @Body() dto: UpdateReviewReplyDto) {
    return { data: this.reviewsService.updateReply(id, dto.reply ?? null) };
  }

  @Roles(Role.DINER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete review' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: deletedSchema })
  @ApiNotFoundResponse({ description: 'Review not found' })
  remove(@Param('id') id: string) {
    return { data: this.reviewsService.delete(id) };
  }
}
