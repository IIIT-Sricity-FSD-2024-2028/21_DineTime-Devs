import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateId } from 'src/common/utils/id.util';
import {
  CreateLocationDto,
  CreateRestaurantDto,
  UpdateRestaurantDto,
} from 'src/modules/restaurants/dto/restaurants.dto';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';

@Injectable()
export class RestaurantsService {
  constructor(private readonly restaurantRepository: RestaurantRepository) {}

  findAll(city?: string) {
    if (city) {
      return this.restaurantRepository.findRestaurantsByCity(city);
    }

    return this.restaurantRepository.findAll();
  }

  findOne(id: string) {
    const restaurant = this.restaurantRepository.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return restaurant;
  }

  create(dto: CreateRestaurantDto) {
    const duplicate = this.restaurantRepository.findAll().find((restaurant) =>
      restaurant.location_id === dto.location_id
      && String(restaurant.name || '').trim().toLowerCase() === String(dto.name || '').trim().toLowerCase(),
    );

    if (duplicate) {
      throw new BadRequestException('Restaurant with the same name already exists at this location');
    }

    return this.restaurantRepository.create({
      id: generateId('restaurant'),
      manager_id: dto.manager_id,
      location_id: dto.location_id,
      name: dto.name,
      cuisine_type: dto.cuisine_type,
      description: dto.description,
      total_tables: dto.total_tables ?? 0,
      rating_avg: dto.rating_avg ?? 0,
      total_reviews: dto.total_reviews ?? 0,
      status: dto.status ?? 'active',
      created_at: new Date().toISOString(),
      image_urls: dto.image_urls || [],
    });
  }

  createLocation(dto: CreateLocationDto) {
    return this.restaurantRepository.upsertLocation({
      id: dto.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      city: dto.city,
      pincode: dto.pincode,
      address: dto.address,
      country: dto.country,
    });
  }

  findLocation(id: string) {
    const location = this.restaurantRepository.findLocationById(id);
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  update(id: string, dto: UpdateRestaurantDto) {
    const updated = this.restaurantRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Restaurant not found');
    }

    return updated;
  }

  uploadImage(id: string, imageUrl: string) {
    const restaurant = this.findOne(id);
    const imageUrls = [...(restaurant.image_urls || []), imageUrl];
    const updated = this.restaurantRepository.update(id, { image_urls: imageUrls });

    if (!updated) {
      throw new NotFoundException('Restaurant not found');
    }

    return updated;
  }

  delete(id: string) {
    const deleted = this.restaurantRepository.remove(id);
    if (!deleted) {
      throw new NotFoundException('Restaurant not found');
    }

    return { deleted: true };
  }
}
