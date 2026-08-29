import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { Role } from 'src/common/enums/role.enum';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { UserRepository } from 'src/repositories/user.repository';
import {
  ChangeSuperAdminPasswordDto,
  SuperAdminLoginDto,
} from 'src/modules/super-admin/dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: SuperAdminLoginDto) {
    const user = this.userRepository.findByEmail(dto.email.toLowerCase());
    if (!user || user.role !== Role.SUPER_USER) {
      throw new UnauthorizedException('Invalid super admin credentials');
    }

    if (!(await compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Invalid super admin credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Super admin account is inactive');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      access_token: await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      last_login_at: new Date().toISOString(),
    };
  }

  getProfile(id: string) {
    const user = this.userRepository.findById(id);
    if (!user || user.role !== Role.SUPER_USER) {
      throw new NotFoundException('Super admin not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
    };
  }

  getSummary() {
    const users = this.userRepository.findAll();
    const restaurants = this.restaurantRepository.findAll();
    const reservations = this.reservationRepository.findAll();
    const payments = this.paymentRepository.findAll();

    const successfulRevenue = payments
      .filter((payment) => payment.payment_status === 'paid')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      total_users: users.length,
      total_diners: users.filter((user) => user.role === Role.DINER).length,
      total_managers: users.filter((user) => user.role === Role.MANAGER).length,
      total_staff: users.filter((user) => user.role === Role.STAFF).length,
      total_restaurants: restaurants.length,
      pending_restaurants: restaurants.filter((restaurant) => restaurant.status !== 'active').length,
      total_reservations: reservations.length,
      active_reservations: reservations.filter((reservation) =>
        !['cancelled', 'completed', 'no_show'].includes(reservation.reservation_status)).length,
      total_payments: payments.length,
      successful_revenue: successfulRevenue,
    };
  }

  async changePassword(dto: ChangeSuperAdminPasswordDto) {
    const user = this.userRepository.findById(dto.user_id);
    if (!user || user.role !== Role.SUPER_USER) {
      throw new NotFoundException('Super admin not found');
    }

    if (!(await compare(dto.current_password, user.password_hash))) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.current_password === dto.new_password) {
      throw new BadRequestException('New password must be different');
    }

    this.userRepository.update(user.id, {
      password_hash: await hash(dto.new_password, 10),
    });

    return {
      id: user.id,
      password_updated: true,
    };
  }
}
