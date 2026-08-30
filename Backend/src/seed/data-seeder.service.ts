import { Injectable, OnModuleInit } from '@nestjs/common';
import { hashSync } from 'bcrypt';
import { Role } from 'src/common/enums/role.enum';
import { generateId } from 'src/common/utils/id.util';
import { MenuRepository } from 'src/repositories/menu.repository';
import { ReviewRepository } from 'src/repositories/review.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { UserStatus } from 'src/common/types/schema.types';

@Injectable()
export class DataSeederService implements OnModuleInit {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly tableRepository: TableRepository,
    private readonly timeslotRepository: TimeSlotRepository,
    private readonly tableslotRepository: TableSlotRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly menuRepository: MenuRepository,
    private readonly reviewRepository: ReviewRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  onModuleInit(): void {
    if (this.restaurantRepository.findAll().length > 0) {
      return;
    }

    const activeStatus: UserStatus = 'active';
    const defaultPasswordHash = hashSync(['password', '123'].join(''), 10);
    const adminPasswordHash = hashSync(['admin', '123'].join(''), 10);

    // --- Managers (one per restaurant) ---
    const manager1 = this.userRepository.create({
      id: 'rm-1234',
      name: 'Rahul Sharma',
      email: 'manager@dinetime.com',
      phone: '9123456789',
      password_hash: defaultPasswordHash,
      role: Role.MANAGER,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: 'loc_blr_1',
    });

    const manager2 = this.userRepository.create({
      id: 'rm-1235',
      name: 'Anita Verma',
      email: 'manager2@dinetime.com',
      phone: '9234567890',
      password_hash: defaultPasswordHash,
      role: Role.MANAGER,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: 'loc_blr_2',
    });

    const manager3 = this.userRepository.create({
      id: 'rm-1236',
      name: 'Karan Mehta',
      email: 'manager3@dinetime.com',
      phone: '9345678901',
      password_hash: defaultPasswordHash,
      role: Role.MANAGER,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: 'loc_blr_3',
    });

    const manager4 = this.userRepository.create({
      id: 'rm-1237',
      name: 'Sunita Rao',
      email: 'manager4@dinetime.com',
      phone: '9456789012',
      password_hash: defaultPasswordHash,
      role: Role.MANAGER,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: 'loc_blr_1',
    });

    const diner = this.userRepository.create({
      id: 'din-1234',
      name: 'John Doe',
      email: 'johndoe@gmail.com',
      phone: '9876543210',
      password_hash: defaultPasswordHash,
      role: Role.DINER,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: 'loc_blr_1',
    });

    const staff = this.userRepository.create({
      id: 'rst-1234',
      name: 'Priya Mehta',
      email: 'staff@dinetime.com',
      phone: '9988776655',
      password_hash: defaultPasswordHash,
      role: Role.STAFF,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: 'loc_blr_1',
    });

    this.userRepository.create({
      id: 'sup-1234',
      name: 'System Administrator',
      email: 'admin@dinetime.com',
      phone: '9000000001',
      password_hash: adminPasswordHash,
      role: Role.SUPER_USER,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: 'loc_blr_1',
    });

    this.userRepository.upsertManagerDetails({
      manager_id: manager1.id,
      business_license_number: '10020041234567',
      government_id: 'GOV-7788',
      verified_status: true,
    });

    this.userRepository.upsertManagerDetails({
      manager_id: manager2.id,
      business_license_number: '10020047755661',
      government_id: 'GOV-6611',
      verified_status: true,
    });

    this.userRepository.upsertManagerDetails({
      manager_id: manager3.id,
      business_license_number: '10020046644552',
      government_id: 'GOV-5522',
      verified_status: true,
    });

    this.userRepository.upsertManagerDetails({
      manager_id: manager4.id,
      business_license_number: '10020045533443',
      government_id: 'GOV-4411',
      verified_status: true,
    });

    this.userRepository.upsertDinerDetails({
      diner_id: diner.id,
      loyalty_points: 120,
    });

    const locations = [
      {
        id: 'loc_blr_1',
        latitude: 12.9716,
        longitude: 77.5946,
        city: 'Bangalore',
        pincode: '560001',
        address: 'MG Road, Bangalore',
        country: 'India',
      },
      {
        id: 'loc_blr_2',
        latitude: 12.9304,
        longitude: 77.5806,
        city: 'Bangalore',
        pincode: '560078',
        address: 'Jayanagar 4th Block, Bangalore',
        country: 'India',
      },
      {
        id: 'loc_blr_3',
        latitude: 12.9698,
        longitude: 77.7500,
        city: 'Bangalore',
        pincode: '560066',
        address: 'Whitefield Main Road, Bangalore',
        country: 'India',
      },
    ];

    locations.forEach((location) => {
      this.restaurantRepository.upsertLocation(location);
    });

    const restaurants = [
      {
        id: 'res-2001',
        manager_id: manager1.id,
        location_id: 'loc_blr_1',
        name: 'Spice Garden',
        cuisine_type: 'Indian',
        description: [
          'Authentic Indian dining experience with rich regional flavors.',
          '',
          'Details:',
          '- Price: INR 400 - 700',
          '- Hours: 11:00 AM - 11:00 PM',
          '- Parking: Street Parking',
          '- Dress Code: Smart Casual',
          '- Contact: 9123456789',
          '- Amenities: Family Friendly, Indoor Seating',
          '',
          'Policies:',
          '- Cancellation Policy: Cancellations must be made at least 2 hours in advance.',
          '- Late Arrival: Tables are held for 15 minutes after the reservation time.',
        ].join('\n'),
        total_tables: 8,
        rating_avg: 4.6,
        total_reviews: 128,
        status: activeStatus,
        created_at: new Date().toISOString(),
        image_urls: [
          '../images/indian.jpg',
          '../images/main.png',
          '../images/veg_spring_rolls.png',
          '../images/gulab_jamun.png',
        ],
      },
      {
        id: 'res-2002',
        manager_id: manager2.id,
        location_id: 'loc_blr_2',
        name: 'Bella Italia',
        cuisine_type: 'Italian',
        description: [
          'Fresh handmade pasta, wood-fired pizza, and classic Italian desserts.',
          '',
          'Details:',
          '- Price: INR 500 - 900',
          '- Hours: 12:00 PM - 11:00 PM',
          '- Parking: Valet Available',
          '- Dress Code: Smart Casual',
          '- Contact: 9234567890',
          '- Amenities: Outdoor Seating, Family Friendly',
          '',
          'Policies:',
          '- Cancellation Policy: Cancellations must be made at least 2 hours in advance.',
          '- Late Arrival: Tables are held for 15 minutes after the reservation time.',
        ].join('\n'),
        total_tables: 8,
        rating_avg: 4.4,
        total_reviews: 96,
        status: activeStatus,
        created_at: new Date().toISOString(),
        image_urls: [
          '../images/italian.jpg',
          '../images/menu1.png',
          '../images/menu2.png',
          '../images/dessert.png',
        ],
      },
      {
        id: 'res-2003',
        manager_id: manager3.id,
        location_id: 'loc_blr_3',
        name: 'Dragon Bowl',
        cuisine_type: 'Chinese',
        description: [
          'Modern Chinese kitchen serving wok-tossed classics and dim sum.',
          '',
          'Details:',
          '- Price: INR 350 - 800',
          '- Hours: 11:30 AM - 10:30 PM',
          '- Parking: Basement Parking',
          '- Dress Code: Casual',
          '- Contact: 9345678901',
          '- Amenities: Quick Service, Indoor Seating',
          '',
          'Policies:',
          '- Cancellation Policy: Cancellations must be made at least 2 hours in advance.',
          '- Late Arrival: Tables are held for 15 minutes after the reservation time.',
        ].join('\n'),
        total_tables: 8,
        rating_avg: 4.2,
        total_reviews: 88,
        status: activeStatus,
        created_at: new Date().toISOString(),
        image_urls: [
          '../images/chinese.jpg',
          '../images/starter.png',
          '../images/drink.png',
          '../images/dessert.png',
        ],
      },
      {
        id: 'res-2004',
        manager_id: manager4.id,
        location_id: 'loc_blr_1',
        name: 'Sakura House',
        cuisine_type: 'Japanese',
        description: [
          'Sushi bar and Japanese comfort food in a calm minimal setting.',
          '',
          'Details:',
          '- Price: INR 600 - 1200',
          '- Hours: 12:00 PM - 10:30 PM',
          '- Parking: Street Parking',
          '- Dress Code: Smart Casual',
          '- Contact: 9456789012',
          '- Amenities: Sushi Bar, Indoor Seating',
          '',
          'Policies:',
          '- Cancellation Policy: Cancellations must be made at least 2 hours in advance.',
          '- Late Arrival: Tables are held for 15 minutes after the reservation time.',
        ].join('\n'),
        total_tables: 8,
        rating_avg: 4.7,
        total_reviews: 112,
        status: activeStatus,
        created_at: new Date().toISOString(),
        image_urls: [
          '../images/japanese.jpg',
          '../images/edamame.png',
          '../images/drink.png',
          '../images/dessert.png',
        ],
      },
    ].map((restaurant) => this.restaurantRepository.create(restaurant));

    this.userRepository.upsertStaffDetails({
      staff_id: staff.id,
      restaurant_id: restaurants[0].id,
      employee_code: 'EMP-1001',
      role_type: 'service',
    });

    const today = new Date();

    const tableTemplates = [
      { table_number: 1, capacity: 2 },
      { table_number: 2, capacity: 2 },
      { table_number: 3, capacity: 4 },
      { table_number: 4, capacity: 4 },
      { table_number: 5, capacity: 4 },
      { table_number: 6, capacity: 6 },
      { table_number: 7, capacity: 6 },
      { table_number: 8, capacity: 8 },
    ];

    const slotTemplates = [
      { start: '18:00', end: '20:00' },
      { start: '20:00', end: '22:00' },
      { start: '22:00', end: '00:00' },
    ];

    const tablesByRestaurant: Record<string, { id: string; table_number: number; capacity: number }[]> = {};
    const slotsByRestaurant: Record<string, { id: string; start_time: string; end_time: string }[]> = {};

    restaurants.forEach((restaurant, restaurantIndex) => {
      const tables = tableTemplates.map((tableTemplate, tableIndex) =>
        this.tableRepository.create({
          id: `tbl-200${restaurantIndex + 1}-${String(tableIndex + 1).padStart(2, '0')}`,
          restaurant_id: restaurant.id,
          table_number: tableTemplate.table_number,
          capacity: tableTemplate.capacity,
        }),
      );

      const slots: { id: string; start_time: string; end_time: string }[] = [];
      for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() + dayOffset);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const slotDate = `${yyyy}-${mm}-${dd}`;

        slotTemplates.forEach((slotTemplate, slotIndex) => {
          slots.push(
            this.timeslotRepository.create({
              id: `slt-200${restaurantIndex + 1}-${dayOffset + 1}-${String(slotIndex + 1).padStart(2, '0')}`,
              restaurant_id: restaurant.id,
              slot_date: slotDate,
              start_time: slotTemplate.start,
              end_time: slotTemplate.end,
            }),
          );
        });
      }

      tables.forEach((table) => {
        slots.forEach((slot) => {
          this.tableslotRepository.create({
            id: generateId('table_slot'),
            table_id: table.id,
            slot_id: slot.id,
            status: 'available',
          });
        });
      });

      tablesByRestaurant[restaurant.id] = tables;
      slotsByRestaurant[restaurant.id] = slots;
    });

    const menuSeed = [
      // Spice Garden
      { id: 'mnu-2001-01', restaurant_id: restaurants[0].id, item_name: 'Paneer Tikka', category: 'Starters', price: 260, image_urls: ['../images/veg_spring_rolls.png'] },
      { id: 'mnu-2001-02', restaurant_id: restaurants[0].id, item_name: 'Veg Spring Rolls', category: 'Starters', price: 220, image_urls: ['../images/veg_spring_rolls.png'] },
      { id: 'mnu-2001-03', restaurant_id: restaurants[0].id, item_name: 'Tandoori Mushroom', category: 'Starters', price: 240, image_urls: ['../images/starter.png'] },
      { id: 'mnu-2001-04', restaurant_id: restaurants[0].id, item_name: 'Butter Chicken', category: 'Main Course', price: 300, image_urls: ['../images/main.png'] },
      { id: 'mnu-2001-05', restaurant_id: restaurants[0].id, item_name: 'Paneer Butter Masala', category: 'Main Course', price: 280, image_urls: ['../images/main.png'] },
      { id: 'mnu-2001-06', restaurant_id: restaurants[0].id, item_name: 'Dal Tadka', category: 'Main Course', price: 210, image_urls: ['../images/main.png'] },
      { id: 'mnu-2001-07', restaurant_id: restaurants[0].id, item_name: 'Veg Biryani', category: 'Main Course', price: 250, image_urls: ['../images/main.png'] },
      { id: 'mnu-2001-08', restaurant_id: restaurants[0].id, item_name: 'Masala Kulcha', category: 'Main Course', price: 90, image_urls: ['../images/main.png'] },
      { id: 'mnu-2001-09', restaurant_id: restaurants[0].id, item_name: 'Mango Lassi', category: 'Beverages', price: 140, image_urls: ['../images/drink.png'] },
      { id: 'mnu-2001-10', restaurant_id: restaurants[0].id, item_name: 'Masala Chaas', category: 'Beverages', price: 80, image_urls: ['../images/drink.png'] },
      { id: 'mnu-2001-11', restaurant_id: restaurants[0].id, item_name: 'Gulab Jamun', category: 'Desserts', price: 120, image_urls: ['../images/gulab_jamun.png'] },
      { id: 'mnu-2001-12', restaurant_id: restaurants[0].id, item_name: 'Kesar Kheer', category: 'Desserts', price: 130, image_urls: ['../images/dessert.png'] },

      // Bella Italia
      { id: 'mnu-2002-01', restaurant_id: restaurants[1].id, item_name: 'Bruschetta', category: 'Starters', price: 180, image_urls: ['../images/menu1.png'] },
      { id: 'mnu-2002-02', restaurant_id: restaurants[1].id, item_name: 'Minestrone Soup', category: 'Starters', price: 170, image_urls: ['../images/starter.png'] },
      { id: 'mnu-2002-03', restaurant_id: restaurants[1].id, item_name: 'Margherita Pizza', category: 'Main Course', price: 290, image_urls: ['../images/menu1.png'] },
      { id: 'mnu-2002-04', restaurant_id: restaurants[1].id, item_name: 'Penne Arrabbiata', category: 'Main Course', price: 260, image_urls: ['../images/menu2.png'] },
      { id: 'mnu-2002-05', restaurant_id: restaurants[1].id, item_name: 'Mushroom Risotto', category: 'Main Course', price: 300, image_urls: ['../images/menu2.png'] },
      { id: 'mnu-2002-06', restaurant_id: restaurants[1].id, item_name: 'Lemon Iced Tea', category: 'Beverages', price: 120, image_urls: ['../images/drink.png'] },
      { id: 'mnu-2002-07', restaurant_id: restaurants[1].id, item_name: 'Tiramisu', category: 'Desserts', price: 230, image_urls: ['../images/dessert.png'] },
      { id: 'mnu-2002-08', restaurant_id: restaurants[1].id, item_name: 'Panna Cotta', category: 'Desserts', price: 220, image_urls: ['../images/dessert.png'] },

      // Dragon Bowl
      { id: 'mnu-2003-01', restaurant_id: restaurants[2].id, item_name: 'Crispy Corn', category: 'Starters', price: 190, image_urls: ['../images/starter.png'] },
      { id: 'mnu-2003-02', restaurant_id: restaurants[2].id, item_name: 'Dumplings', category: 'Starters', price: 250, image_urls: ['../images/dessert.png'] },
      { id: 'mnu-2003-03', restaurant_id: restaurants[2].id, item_name: 'Veg Hakka Noodles', category: 'Main Course', price: 280, image_urls: ['../images/starter.png'] },
      { id: 'mnu-2003-04', restaurant_id: restaurants[2].id, item_name: 'Schezwan Fried Rice', category: 'Main Course', price: 270, image_urls: ['../images/main.png'] },
      { id: 'mnu-2003-05', restaurant_id: restaurants[2].id, item_name: 'Hot Garlic Tofu', category: 'Main Course', price: 300, image_urls: ['../images/main.png'] },
      { id: 'mnu-2003-06', restaurant_id: restaurants[2].id, item_name: 'Jasmine Tea', category: 'Beverages', price: 110, image_urls: ['../images/drink.png'] },
      { id: 'mnu-2003-07', restaurant_id: restaurants[2].id, item_name: 'Honey Noodles', category: 'Desserts', price: 180, image_urls: ['../images/dessert.png'] },
      { id: 'mnu-2003-08', restaurant_id: restaurants[2].id, item_name: 'Date Pancake', category: 'Desserts', price: 200, image_urls: ['../images/dessert.png'] },

      // Sakura House
      { id: 'mnu-2004-01', restaurant_id: restaurants[3].id, item_name: 'Edamame', category: 'Starters', price: 170, image_urls: ['../images/edamame.png'] },
      { id: 'mnu-2004-02', restaurant_id: restaurants[3].id, item_name: 'Miso Soup', category: 'Starters', price: 190, image_urls: ['../images/drink.png'] },
      { id: 'mnu-2004-03', restaurant_id: restaurants[3].id, item_name: 'Sushi Platter', category: 'Main Course', price: 300, image_urls: ['../images/edamame.png'] },
      { id: 'mnu-2004-04', restaurant_id: restaurants[3].id, item_name: 'Veg Ramen', category: 'Main Course', price: 280, image_urls: ['../images/main.png'] },
      { id: 'mnu-2004-05', restaurant_id: restaurants[3].id, item_name: 'Teriyaki Rice Bowl', category: 'Main Course', price: 290, image_urls: ['../images/main.png'] },
      { id: 'mnu-2004-06', restaurant_id: restaurants[3].id, item_name: 'Matcha Latte', category: 'Beverages', price: 180, image_urls: ['../images/drink.png'] },
      { id: 'mnu-2004-07', restaurant_id: restaurants[3].id, item_name: 'Mochi Ice Cream', category: 'Desserts', price: 220, image_urls: ['../images/dessert.png'] },
      { id: 'mnu-2004-08', restaurant_id: restaurants[3].id, item_name: 'Dorayaki', category: 'Desserts', price: 200, image_urls: ['../images/dessert.png'] },
    ];

    menuSeed.forEach((item) => {
      this.menuRepository.create({
        id: item.id,
        restaurant_id: item.restaurant_id,
        item_name: item.item_name,
        category: item.category,
        price: item.price,
        availability: true,
        image_urls: item.image_urls,
      });
    });

    const reservationRestaurant = restaurants[0];
    const reservationTables = tablesByRestaurant[reservationRestaurant.id];
    const reservationSlots = slotsByRestaurant[reservationRestaurant.id];
    const reservation = this.reservationRepository.create({
      id: 'resv-seed-upcoming',
      user_id: diner.id,
      restaurant_id: reservationRestaurant.id,
      table_id: reservationTables[1].id,
      slot_id: reservationSlots[1].id,
      guest_count: 2,
      reservation_status: 'reserved',
      created_at: new Date().toISOString(),
    });

    if (reservation.table_id && reservation.slot_id) {
      this.tableslotRepository.updateStatus(reservation.table_id, reservation.slot_id, 'reserved');
    }

    const completedSlotDate = new Date(today);
    completedSlotDate.setDate(today.getDate() - 1);
    const completedSlotIso = [
      completedSlotDate.getFullYear(),
      String(completedSlotDate.getMonth() + 1).padStart(2, '0'),
      String(completedSlotDate.getDate()).padStart(2, '0'),
    ].join('-');
    const completedSlot = this.timeslotRepository.create({
      id: 'slt-seed-completed',
      restaurant_id: reservationRestaurant.id,
      slot_date: completedSlotIso,
      start_time: '18:00',
      end_time: '20:00',
    });
    this.tableslotRepository.create({
      id: 'table-slot-seed-completed',
      table_id: reservationTables[0].id,
      slot_id: completedSlot.id,
      status: 'occupied',
    });

    const completedReservation = this.reservationRepository.create({
      id: 'resv-seed-completed',
      user_id: diner.id,
      restaurant_id: reservationRestaurant.id,
      table_id: reservationTables[0].id,
      slot_id: completedSlot.id,
      guest_count: 2,
      reservation_status: 'completed',
      created_at: new Date().toISOString(),
    });

    this.reviewRepository.create({
      id: generateId('review'),
      user_id: diner.id,
      restaurant_id: reservationRestaurant.id,
      reservation_id: completedReservation.id,
      rating: 5,
      comment: 'Great service and delicious food.',
      created_at: new Date().toISOString(),
    });

    this.settingsRepository.findSettingsByRole(Role.DINER).forEach((setting) => {
      this.settingsRepository.createUserSetting({
        id: generateId('user_setting'),
        user_id: diner.id,
        setting_id: setting.id,
        value: true,
      });
    });

    this.settingsRepository.findSettingsByRole(Role.MANAGER).forEach((setting) => {
      this.settingsRepository.createUserSetting({
        id: generateId('user_setting'),
        user_id: manager1.id,
        setting_id: setting.id,
        value: true,
      });
    });
  }
}
