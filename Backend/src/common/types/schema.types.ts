import { Role } from 'src/common/enums/role.enum';

export type UserStatus = 'active' | 'inactive';
export type TableSlotStatus = 'available' | 'reserved' | 'occupied';
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
  total_tables: number;
  rating_avg: number;
  total_reviews: number;
  status: UserStatus;
  is_open: boolean;
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
}

export interface TimeSlot {
  id: string;
  restaurant_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
}

export interface TableSlot {
  id: string;
  table_id: string;
  slot_id: string;
  status: TableSlotStatus;
}

export interface Reservation {
  id: string;
  user_id: string;
  restaurant_id: string;
  slot_id: string;
  guest_count: number;
  reservation_status: ReservationStatus;
  created_at: string;
  table_id?: string;
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
  amount: number;
  deposit_amount: number;
  diner_platform_fee: number;
  restaurant_platform_fee: number;
  refunded_amount?: number;
  settled_at?: string;
  settled_by?: 'finance' | 'auto';
  payout_blocked?: boolean;
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
  | 'escalated_technical';

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
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}
