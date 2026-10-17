import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SupportTicketRepository } from 'src/repositories/support-ticket.repository';
import { Role } from 'src/common/enums/role.enum';
import { UserRepository } from 'src/repositories/user.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { MenuRepository } from 'src/repositories/menu.repository';
import { ReviewRepository } from 'src/repositories/review.repository';
import { NotificationRepository } from 'src/repositories/notification.repository';
import { OrderRepository } from 'src/repositories/order.repository';
import { CheckinRepository } from 'src/repositories/checkin.repository';
import { SettingsRepository } from 'src/repositories/settings.repository';

@Injectable()
export class AccessPolicyGuard implements CanActivate {
  constructor(private readonly users: UserRepository, private readonly restaurants: RestaurantRepository,
    private readonly reservations: ReservationRepository, private readonly tables: TableRepository,
    private readonly slots: TimeSlotRepository, private readonly payments: PaymentRepository,
    private readonly menu: MenuRepository, private readonly reviews: ReviewRepository,
    private readonly notifications: NotificationRepository, private readonly orders: OrderRepository,
    private readonly checkins: CheckinRepository, private readonly settings: SettingsRepository, private readonly tickets:SupportTicketRepository) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const role: Role = req.user?.role, userId: string = req.user?.sub;
    const [resource,id,action] = req.path.split('/').filter(Boolean);
    const write = !['GET','HEAD','OPTIONS'].includes(req.method);
    const body = req.body || {};
    const deny = (message='You do not have access to this record.') => { throw new ForbiddenException(message); };
    const query = (key: string, value: string) => {
      if (req.query[key] && req.query[key] !== value) deny();
      Object.defineProperty(req,'query',{ value:{...req.query,[key]:value},configurable:true });
    };
    if (resource === 'auth' || (resource === 'sub-admin' && id === 'login') || (resource === 'super-admin' && id === 'login') || (resource === 'managers' && id === 'register') || (resource === 'verification' && id === 'teams' && !write)) return true;
    if (role === Role.SUPER_USER) return true;
    const ownRestaurants = role === Role.MANAGER ? this.restaurants.findByManagerId(userId).map((r) => r.id)
      : role === Role.STAFF ? [this.users.getStaffDetails(userId)?.restaurant_id].filter((v):v is string=>Boolean(v)) : [];
    const owned = (restaurantId?: string) => Boolean(restaurantId && ownRestaurants.includes(restaurantId));
    const reservation = (reservationId?: string) => {
      const row = reservationId ? this.reservations.findById(reservationId) : undefined;
      if (row && (role === Role.DINER ? row.user_id !== userId : [Role.MANAGER,Role.STAFF].includes(role) ? !owned(row.restaurant_id) : false)) deny();
      return row;
    };
    if (resource === 'users') {
      if (req.method === 'GET' && !id && [Role.MANAGER,Role.STAFF].includes(role)) {
        req.allowedUserIds = this.users.findAll().filter((account) => account.id === userId ||
          (account.role === Role.STAFF && owned(this.users.getStaffDetails(account.id)?.restaurant_id)) ||
          (account.role === Role.DINER && this.reservations.findByUserId(account.id).some((r)=>owned(r.restaurant_id)))).map((account)=>account.id);
      }
      if (req.method === 'POST' && !id) {
        if (req.user?.anonymous) {
          if (!['diner','staff'].includes(body.role)) deny('Use manager registration for a restaurant application.');
          body.status = body.role === 'staff' ? 'inactive' : 'active';
        } else if (role !== Role.MANAGER || body.role !== Role.STAFF || !owned(body.restaurant_id)) deny('Managers may create staff only for their own restaurant.');
      } else if (id && id !== userId) {
        const target = this.users.findById(id);
        const allowedStaff = target?.role === Role.STAFF && owned(this.users.getStaffDetails(id)?.restaurant_id);
        const allowedDiner = !write && target?.role === Role.DINER && this.reservations.findByUserId(id).some((r) => owned(r.restaurant_id));
        if (!allowedStaff && !allowedDiner) deny();
        if (write && (role !== Role.MANAGER || !allowedStaff)) deny();
        if (body.restaurant_id && !owned(body.restaurant_id)) deny();
        if (body.role !== undefined) deny('Account roles cannot be changed here.');
      } else if (id && write && ['role','status','restaurant_id','employee_code','role_type'].some((key) => body[key] !== undefined)) deny('Your assignment and account permissions cannot be changed here.');
      return true;
    }
    if (['managers','staff','diners'].includes(resource)) {
      const target = id || body.manager_id || body.staff_id || body.diner_id;
      if (target !== userId) deny();
      if (write && resource === 'staff' && body.restaurant_id && !owned(body.restaurant_id)) deny();
      if (write && resource === 'diners') deny('Loyalty balances are managed by the platform.');
    }
    if (resource === 'reservations') {
      if (id) reservation(id);
      else if (req.method === 'POST') { if(body.user_id !== userId) deny(); }
      else if (role === Role.DINER) query('user_id', userId);
      else if ([Role.MANAGER,Role.STAFF].includes(role)) { if(!ownRestaurants.length) deny(); query('restaurant_id',ownRestaurants[0]); }
      if (write && req.method === 'PATCH' && !action) {
        if (body.guest_count !== undefined) deny('Use Modify Reservation to change guests.');
        if (role === Role.DINER && body.reservation_status !== 'cancelled') deny();
        if (role === Role.MANAGER && body.reservation_status !== 'completed') deny();
        if (role === Role.STAFF && body.reservation_status!=='no_show') deny('Use staff check-in for arrivals; only managers mark completion.');
      }
      if (req.method === 'DELETE' && id && this.payments.findByReservationId(id).some((p)=>['paid','refunded'].includes(p.payment_status))) deny('Paid reservations must be cancelled so the receipt and history are preserved.');
    }
    if (resource === 'payments') {
      const payment = id ? this.payments.findById(id) : undefined;
      if (payment) reservation(payment.reservation_id);
      if (body.reservation_id) reservation(body.reservation_id);
      if (req.query.reservation_id) reservation(req.query.reservation_id);
      if (write && req.method !== 'POST') deny('Payment state cannot be changed directly.');
      // Phase 1 preserves the existing simulated payment creation flow.
      // Provider-verified payment confirmation is part of Phase 2.
    }
    if (resource === 'checkin') {
      if (body.table_id && !owned(this.tables.findById(body.table_id)?.restaurant_id)) deny();
      if (body.slot_id && !owned(this.slots.findById(body.slot_id)?.restaurant_id)) deny();
      if (body.reservation_id) reservation(body.reservation_id);
      if (write && id!=='walk-in') body.staff_id = userId;
    }
    if (resource === 'orders') {
      const order = id ? this.orders.findOrderById(id) : undefined;
      if (order) reservation(order.reservation_id);
      if (req.query.reservation_id) reservation(req.query.reservation_id);
    }
    if (resource === 'notifications') {
      if (!id && !write) query('user_id',userId);
      const row = id ? this.notifications.findById(id) : undefined;
      if (row && row.user_id !== userId) deny();
      if (write && body.user_id !== undefined && body.user_id !== userId) deny();
    }
    if (resource === 'settings') {
      if (id === 'users') {
        if (!write && action !== userId) deny();
        if (write && this.settings.findUserSettingById(action)?.user_id !== userId) deny();
      } else if (write) deny('Setting definitions are managed by the platform.');
    }
    if (resource === 'support') {
      if(write && id==='tickets' && action && ['claim','link','decision','resolve','reject'].includes(req.path.split('/')[4])) {
        const ticket=this.tickets.findById(action);
        if(ticket?.assigned_admin_id && ticket.assigned_admin_id!==userId) deny('Another support agent is reviewing this ticket.');
      }
      if (id === 'tickets' && action === 'mine') query('user_id',userId);
      if (write && body.admin_id !== undefined) body.admin_id = userId;
      return true;
    }
    if(resource==='verification' && role===Role.VERIFICATION_ADMIN) {
      const locationId=this.users.findById(userId)?.location_id;
      if(!locationId)deny('A verification location must be assigned.');
      if(id==='applications' && action) {
        const manager = this.users.findById(action);
        const assignedLocationId = this.users.getManagerDetails(action)?.verification_location_id || manager?.location_id;
        if(!manager || assignedLocationId!==locationId)deny();
      }
      if(write)body.reviewer_id=userId;
    }
    if (resource === 'finance' && body.admin_id !== undefined) body.admin_id = userId;
    if (['restaurants','tables','timeslots','tableslots','menu','reviews','schedules'].includes(resource) && [Role.MANAGER,Role.STAFF].includes(role)) {
      let restaurantId = body.restaurant_id || req.query.restaurant_id;
      if (resource === 'restaurants' && id && id !== 'locations') restaurantId = id;
      if (resource === 'tables' && id) restaurantId = this.tables.findById(id)?.restaurant_id;
      if (resource === 'timeslots' && id) restaurantId = this.slots.findById(id)?.restaurant_id;
      if (resource === 'tableslots' && (body.slot_id || req.query.slot_id)) restaurantId = this.slots.findById(body.slot_id || req.query.slot_id)?.restaurant_id;
      if (resource === 'menu' && id) restaurantId = this.menu.findById(id)?.restaurant_id;
      if (resource === 'reviews' && id) restaurantId = this.reviews.findById(id)?.restaurant_id;
      if (resource === 'schedules' && id && id !== 'rules') restaurantId = id;
      if (restaurantId && !owned(restaurantId)) deny();
      if (!write && !id && resource !== 'restaurants' && ownRestaurants.length) query('restaurant_id',ownRestaurants[0]);
      if (write && body.manager_id !== undefined && body.manager_id !== userId) deny();
      if (req.query.manager_id && req.query.manager_id !== userId) deny();
      if(resource==='restaurants' && id==='locations' && write && body.id && this.restaurants.findLocationById(body.id)) {
        const usersOfLocation=this.restaurants.findAll().filter((r)=>r.location_id===body.id);
        if(!usersOfLocation.length || usersOfLocation.some((r)=>r.manager_id!==userId))deny('This shared location cannot be overwritten.');
      }
      if (resource === 'restaurants' && id === 'locations' && action && write) {
        if(!this.restaurants.findByManagerId(userId).some((r)=>r.location_id===action)) deny();
        // Shared city locations are not personal address records.
        if(this.restaurants.findAll().some((r)=>r.location_id===action && r.manager_id!==userId)) deny('This shared location cannot be edited.');
      }
    }
    if (resource === 'reviews' && role === Role.DINER && write) {
      if (body.user_id && body.user_id !== userId) deny();
      if (body.reservation_id) reservation(body.reservation_id);
      if (id && this.reviews.findById(id)?.user_id !== userId) deny();
    }
    if (!write && role === Role.DINER && ['tables','timeslots','tableslots','menu','reviews'].includes(resource)) {
      const bookedRestaurantIds = new Set(this.reservations.findByUserId(userId).map((booking) => booking.restaurant_id));
      req.allowedRestaurantIds = this.restaurants.findAll().filter((restaurant)=>
        ((restaurant.is_open && !restaurant.is_closed) || bookedRestaurantIds.has(restaurant.id)) &&
        this.users.getManagerDetails(restaurant.manager_id)?.verification_status==='approved').map((r)=>r.id);
      let restaurantId = req.query.restaurant_id;
      if (resource==='tables' && id) restaurantId=this.tables.findById(id)?.restaurant_id;
      if (resource==='timeslots' && id) restaurantId=this.slots.findById(id)?.restaurant_id;
      if (resource==='menu' && id) restaurantId=this.menu.findById(id)?.restaurant_id;
      if (resource==='reviews' && id) restaurantId=this.reviews.findById(id)?.restaurant_id;
      if (restaurantId && !req.allowedRestaurantIds.includes(restaurantId)) deny('This restaurant is not available for discovery.');
    }
    req.restaurantScope = ownRestaurants;
    return true;
  }
}
