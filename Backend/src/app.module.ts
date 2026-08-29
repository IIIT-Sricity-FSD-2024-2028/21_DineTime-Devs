import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { winstonConfig } from 'src/common/logger/winston.config';
import { LoggerMiddleware } from 'src/common/middleware/logger.middleware';
import { RequestIdMiddleware } from 'src/common/middleware/request-id.middleware';
import { RoleCheckMiddleware } from 'src/common/middleware/role-check.middleware';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CheckinModule } from 'src/modules/checkin/checkin.module';
import { DinerModule } from 'src/modules/diner/diner.module';
import { MenuModule } from 'src/modules/menu/menu.module';
import { ManagerModule } from 'src/modules/manager/manager.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { OrdersModule } from 'src/modules/orders/orders.module';
import { PaymentsModule } from 'src/modules/payments/payments.module';
import { ReservationsModule } from 'src/modules/reservations/reservations.module';
import { RestaurantsModule } from 'src/modules/restaurants/restaurants.module';
import { ReviewsModule } from 'src/modules/reviews/reviews.module';
import { SettingsModule } from 'src/modules/settings/settings.module';
import { StaffModule } from 'src/modules/staff/staff.module';
import { SuperAdminModule } from 'src/modules/super-admin/super-admin.module';
import { TablesModule } from 'src/modules/tables/tables.module';
import { TableslotsModule } from 'src/modules/tableslots/tableslots.module';
import { TimeslotsModule } from 'src/modules/timeslots/timeslots.module';
import { UsersModule } from 'src/modules/users/users.module';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { DataSeederService } from 'src/seed/data-seeder.service';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dinetime-dev-secret-change-me',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as '1h' },
    }),
    RepositoriesModule,
    AuthModule,
    UsersModule,
    DinerModule,
    ManagerModule,
    StaffModule,
    SuperAdminModule,
    RestaurantsModule,
    TablesModule,
    TimeslotsModule,
    TableslotsModule,
    ReservationsModule,
    CheckinModule,
    PaymentsModule,
    MenuModule,
    OrdersModule,
    ReviewsModule,
    NotificationsModule,
    SettingsModule,
  ],
  providers: [
    DataSeederService,
    AllExceptionsFilter,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, LoggerMiddleware).forRoutes('*');
    consumer
      .apply(RoleCheckMiddleware)
      .forRoutes(
        'reservations',
        'reservations/(.*)',
        'payments',
        'payments/(.*)',
        'users',
        'users/(.*)',
      );
  }
}
