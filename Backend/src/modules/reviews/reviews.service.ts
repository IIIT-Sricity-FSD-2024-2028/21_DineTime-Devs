import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateId } from 'src/common/utils/id.util';
import { CreateReviewDto, UpdateReviewDto } from 'src/modules/reviews/dto/reviews.dto';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { ReviewRepository } from 'src/repositories/review.repository';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly reservationRepository: ReservationRepository,
  ) {}

  findAll(restaurantId?: string) {
    if (restaurantId) {
      return this.reviewRepository.findByRestaurantId(restaurantId);
    }

    return this.reviewRepository.findAll();
  }

  findOne(id: string) {
    const review = this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  create(dto: CreateReviewDto) {
    const completedReservation = dto.reservation_id
      ? this.reservationRepository.findById(dto.reservation_id)
      : this.reservationRepository
          .findByUserId(dto.user_id)
          .find(
            (reservation) =>
              reservation.restaurant_id === dto.restaurant_id &&
              reservation.reservation_status === 'completed',
          );

    if (
      !completedReservation ||
      completedReservation.user_id !== dto.user_id ||
      completedReservation.restaurant_id !== dto.restaurant_id ||
      completedReservation.reservation_status !== 'completed'
    ) {
      throw new BadRequestException(
        'Review allowed only after reservation is completed',
      );
    }

    if (this.reviewRepository.findByReservationId(completedReservation.id)) {
      throw new BadRequestException('Reservation has already been reviewed');
    }

    return this.reviewRepository.create({
      id: generateId('review'),
      user_id: dto.user_id,
      restaurant_id: dto.restaurant_id,
      reservation_id: completedReservation.id,
      rating: dto.rating,
      comment: dto.comment,
      created_at: new Date().toISOString(),
    });
  }

  update(id: string, _dto: UpdateReviewDto) {
    const existing = this.reviewRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    throw new BadRequestException('Reviews are read-only after submission');
  }

  delete(id: string) {
    const existing = this.reviewRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    throw new BadRequestException('Reviews are read-only after submission');
  }
}
