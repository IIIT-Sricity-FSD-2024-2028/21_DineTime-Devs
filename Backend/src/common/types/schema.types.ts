import { Role } from 'src/common/enums/role.enum';

export type UserStatus = 'active' | 'inactive';
export type TableSlotStatus = 'available' | 'reserved' | 'occupied' | 'blocked';
export type ReservationStatus =
  | 'reserved'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type OrderStatus = 'placed' | 'preparing' | 'served' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password_hash: string;
  role: Role;
  status: UserStatus;
  created_at: string;
  location_id?: string;
  photo_url?: string;
  city?: string;
  country?: string;
  address?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface DinerDetails {
  diner_id: string;
  loyalty_points: number;
}

export type ManagerVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface ManagerDetails {
  manager_id: string;
  business_license_number: string;
  verification_document_url?: string;
  verification_status: ManagerVerificationStatus;
  verification_location_id?: string;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface StaffDetails {
  staff_id: string;
  restaurant_id: string;
  employee_code: string;
  role_type: string;
}

export interface Location {
  id: string;
  latitude: number;
  longitude: number;
  city: string;
  state?: string;
  pincode: string;
  address: string;
  country: string;
}

export interface Restaurant {
  id: string;
  manager_id: string;
  location_id: string;
  name: string;
  cuisine_type: string;
  description: string;
  contact_number?: string;
  total_tables: number;
  rating_avg: number;
  total_reviews: number;
  status: UserStatus;
  is_open: boolean;
  // is_open controls new bookings; physical closure is a separate operation.
  is_closed?: boolean;
  created_at: string;
  image_urls: string[];
  reservation_fee_per_guest: number;
  cancellation_cutoff_minutes: number;
  no_show_grace_minutes: number;
  opens_at: string;
  closes_at: string;
  payout_blocked?: boolean;
}

export interface Table {
  id: string;
  restaurant_id: string;
  table_number: number;
  capacity: number;
  status?: 'active' | 'inactive';
}

export interface TimeSlot {
  id: string;
  restaurant_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  table_layout?: TableLayoutEntry[];
  published?: boolean;
  revision?: number;
  layout_locked_at?: string;
  layout_override?: boolean;
  schedule_generated?: boolean;
}

export interface TableLayoutEntry {
  table_id: string;
  table_number: number;
  capacity: number;
  x?: number;
  y?: number;
  shape?: 'round' | 'square';
}

export interface TableSlot {
  id: string;
  table_id: string;
  slot_id: string;
  status: TableSlotStatus;
  manual_block?: boolean;
  manual_status?: TableSlotStatus;
  schedule_block?: boolean;
}

export type ScheduleScope = 'date';
export type ScheduleRuleType = 'hours' | 'closure' | 'table_block' | 'slot';
export type ScheduleSlotAction = 'add' | 'remove';

export interface WeeklyScheduleDay {
  weekday: number;
  is_closed: boolean;
  open_time: string;
  close_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  slots?: WeeklyTimeSlot[];
}

export interface WeeklyTimeSlot {
  start_time: string;
  end_time: string;
}

export interface ScheduleRule {
  id: string;
  restaurant_id: string;
  type: ScheduleRuleType;
  scope: ScheduleScope;
  start_date?: string;
  open_time?: string;
  close_time?: string;
  start_time?: string;
  end_time?: string;
  slot_action?: ScheduleSlotAction;
  table_ids?: string[];
  reason?: string;
  created_at: string;
}

export interface RestaurantSchedule {
  id: string;
  restaurant_id: string;
  weekly: WeeklyScheduleDay[];
  date_overrides?: Record<string, WeeklyScheduleDay>;
  default_table_layout?: TableLayoutEntry[];
  rules: ScheduleRule[];
  created_at: string;
  updated_at: string;
  managed?: boolean;
  configured?: boolean;
}

export interface BookingTerms {
  cancellation_cutoff_minutes: number;
  no_show_grace_minutes: number;
  no_show_policy: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  restaurant_id: string;
  slot_id: string;
  guest_count: number;
  initial_guest_count?: number;
  initial_table_capacity?: number;
  paid_seat_count?: number;
  reservation_status: ReservationStatus;
  created_at: string;
  booking_terms?: BookingTerms;
  cancellation_deadline?: string;
  hold_expires_at?: string;
  confirmed_at?: string;
  completed_at?: string;
  diner_completed_at?: string;
  expired_at?: string;
  no_show_at?: string;
  no_show_review?: {
    decision: 'release' | 'refund_deposit' | 'refund_full';
    notes: string;
    actor_id: string;
    at: string;
  };
  table_id?: string;
  table_ids?: string[];
  pending_modification?: {
    slot_id: string;
    table_id: string;
    guest_count: number;
    additional_payment_due: number;
  };
  modification_history?: {
    changed_at: string;
    restaurant_id: string;
    slot_id: string;
    table_ids: string[];
    guest_count: number;
    created_at?: string;
  }[];
}

export interface Checkin {
  checkin_id: string;
  reservation_id: string;
  staff_id: string;
  checkin_time: string;
}

export interface Payment {
  id: string;
  reservation_id: string;
  restaurant_id?: string;
  payout_restaurant_id?: string;
  amount: number;
  deposit_amount: number;
  table_seat_count?: number;
  diner_platform_fee: number;
  restaurant_platform_fee: number;
  refunded_amount?: number;
  refund_transactions?: {
    refund_id: string;
    ticket_id: string;
    amount: number;
    processed_at: string;
    processed_by: string;
  }[];
  settled_at?: string;
  settled_by?: 'finance' | 'auto' | 'diner';
  payout_blocked?: boolean;
  payout_adjustments?: {
    id: string;
    restaurant_id?: string;
    amount: number;
    created_at: string;
    settled_at?: string;
    settled_by?: 'finance' | 'auto' | 'diner';
  }[];
  release_status?: 'held' | 'review' | 'pending' | 'blocked' | 'failed' | 'released' | 'refunded';
  release_attempts?: {
    at: string;
    actor_id: string;
    status: 'blocked' | 'failed' | 'released';
    reason?: string;
  }[];
  payment_method: string;
  transaction_ref: string;
  payment_status: PaymentStatus;
  payment_time: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  item_name: string;
  category: string;
  price: number;
  availability: boolean;
  image_urls: string[];
}

export interface Order {
  id: string;
  reservation_id: string;
  order_status: OrderStatus;
  order_time: string;
}

export interface OrderItem {
  order_id: string;
  item_id: string;
  item_name?: string;
  quantity: number;
  price: number;
}

export interface Review {
  id: string;
  user_id: string;
  restaurant_id: string;
  reservation_id?: string;
  rating: number;
  comment: string;
  created_at: string;
  manager_reply?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  description: string;
  role: Role;
}

export interface UserSetting {
  id: string;
  user_id: string;
  setting_id: string;
  value: boolean;
}

export type TicketRaiserRole = 'diner' | 'manager';
export type TicketCategory = 'refund' | 'technical' | 'other';
export type TicketStatus =
  | 'open'
  | 'in_review'
  | 'escalated_finance_team'
  | 'escalated_super_admin'
  | 'resolved'
  | 'rejected';
export type TicketDecision =
  | 'refund_approved'
  | 'refund_denied'
  | 'escalated_technical'
  | 'finance_review'
  | 'payout_review';

export interface SupportTicket {
  id: string;
  raised_by_user_id: string;
  raised_by_role: TicketRaiserRole;
  category: TicketCategory;
  subject: string;
  description: string;
  attachments: string[];
  status: TicketStatus;
  decision?: TicketDecision;
  assigned_admin_id?: string;
  resolution_notes?: string;
  linked_reservation_id?: string;
  linked_restaurant_id?: string;
  linked_slot_id?: string;
  linked_payment_id?: string;
  refund?: {
    id: string;
    reservation_id: string;
    diner_id: string;
    amount: number;
    processed_at: string;
    processed_by: string;
    mode: 'demo';
    payments: { payment_id: string; amount: number }[];
  };
  issue_code?: string;
  issue_note?: string;
  affected_staff_scope?: 'all' | 'individual';
  affected_staff_id?: string;
  affected_staff_name?: string;
  history?: {
    at: string;
    status: TicketStatus;
    actor_id?: string;
    notes?: string;
  }[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}
