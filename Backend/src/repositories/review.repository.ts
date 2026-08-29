import { Injectable } from '@nestjs/common';
import { Review } from 'src/common/types/schema.types';

@Injectable()
export class ReviewRepository {
  private readonly reviews: Review[] = [];

  findAll(): Review[] {
    return [...this.reviews];
  }

  findById(id: string): Review | undefined {
    return this.reviews.find((item) => item.id === id);
  }

  findByRestaurantId(restaurantId: string): Review[] {
    return this.reviews.filter((item) => item.restaurant_id === restaurantId);
  }

  findByUserId(userId: string): Review[] {
    return this.reviews.filter((item) => item.user_id === userId);
  }

  findByReservationId(reservationId: string): Review | undefined {
    return this.reviews.find((item) => item.reservation_id === reservationId);
  }

  create(review: Review): Review {
    this.reviews.push(review);
    return review;
  }

  update(id: string, payload: Partial<Review>): Review | undefined {
    const review = this.findById(id);
    if (!review) {
      return undefined;
    }

    Object.assign(review, payload);
    return review;
  }

  remove(id: string): boolean {
    const index = this.reviews.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.reviews.splice(index, 1);
    return true;
  }
}
