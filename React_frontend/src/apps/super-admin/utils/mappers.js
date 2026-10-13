export const ROLE_LABELS = { diner: 'Diner', manager: 'Restaurant Manager', staff: 'Restaurant Staff', super_user: 'Super User' };
export const ROLE_VALUES = { Diner: 'diner', 'Restaurant Manager': 'manager', 'Restaurant Staff': 'staff' };
export const TEAM_LABELS = { support: 'Customer Support', finance: 'Finance Team', verification: 'Verification Team' };
export const TICKET_STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  escalated_finance_team: 'Escalated to Finance',
  escalated_super_admin: 'Escalated to Super Admin',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

export function mapRestaurantStatus(status) {
  return status === 'active' ? 'Verified' : 'Pending';
}

export function mapUserStatus(status) {
  return status === 'active' ? 'Active' : 'Suspended';
}

export function mapReservationStatus(status) {
  if (status === 'checked_in') return 'Customer Check-In';
  if (status === 'cancelled' || status === 'no_show') return 'No-Show';
  if (status === 'completed') return 'Completed';
  return 'Booking';
}

export function toBackendAccountStatus(label) {
  return label === 'Active' ? 'active' : 'inactive';
}

export function toBackendReservationStatus(label) {
  if (label === 'Customer Check-In') return 'checked_in';
  if (label === 'No-Show') return 'no_show';
  if (label === 'Completed') return 'completed';
  return 'reserved';
}
