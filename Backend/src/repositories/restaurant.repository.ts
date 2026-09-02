import { Injectable } from '@nestjs/common';
import { Location, Restaurant } from 'src/common/types/schema.types';

@Injectable()
export class RestaurantRepository {
  private readonly restaurants: Restaurant[] = [];
  private readonly locations: Location[] = [];

  findAll(): Restaurant[] {
    return [...this.restaurants];
  }

  findById(id: string): Restaurant | undefined {
    return this.restaurants.find((item) => item.id === id);
  }

  findByManagerId(managerId: string): Restaurant[] {
    return this.restaurants.filter((item) => item.manager_id === managerId);
  }

  create(restaurant: Restaurant): Restaurant {
    this.restaurants.push(restaurant);
    return restaurant;
  }

  update(id: string, payload: Partial<Restaurant>): Restaurant | undefined {
    const restaurant = this.findById(id);
    if (!restaurant) {
      return undefined;
    }

    Object.assign(restaurant, payload);
    return restaurant;
  }

  remove(id: string): boolean {
    const index = this.restaurants.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.restaurants.splice(index, 1);
    return true;
  }

  upsertLocation(location: Location): Location {
    const index = this.locations.findIndex((item) => item.id === location.id);
    if (index >= 0) {
      this.locations[index] = location;
      return location;
    }

    this.locations.push(location);
    return location;
  }

  findLocationById(id: string): Location | undefined {
    return this.locations.find((item) => item.id === id);
  }

  findAllLocations(): Location[] {
    return [...this.locations];
  }

  findRestaurantsByCity(city: string): Restaurant[] {
    const locationIds = this.locations
      .filter((location) => location.city.toLowerCase() === city.toLowerCase())
      .map((location) => location.id);

    return this.restaurants.filter((restaurant) =>
      locationIds.includes(restaurant.location_id),
    );
  }
}
