const counters: Record<string, number> = {};

export const generateId = (prefix: string): string => {
  if (!counters[prefix]) {
    counters[prefix] = 0;
  }
  counters[prefix] += 1;

  const seq = String(counters[prefix]).padStart(4, '0');

  switch (prefix) {
    case 'reservation':
    case 'resv':
      return `resv-${seq}`;
    case 'user_setting':
      return `uset-${seq}`;
    case 'notification':
      return `noti-${seq}`;
    case 'checkin':
      return `chk-${seq}`;
    case 'payment':
      return `pay-${seq}`;
    case 'order':
      return `ord-${seq}`;
    case 'order_item':
      return `oit-${seq}`;
    case 'review':
      return `rev-${seq}`;
    case 'menu':
      return `mnu-${seq}`;
    case 'table':
      return `tbl-${seq}`;
    case 'timeslot':
      return `slt-${seq}`;
    case 'restaurant':
      return `res-${seq}`;
    case 'location':
      return `loc-${seq}`;
    case 'ticket':
      return `tkt-${seq}`;
    case 'support_admin':
      return `spt-${seq}`;
    case 'finance_admin':
      return `fin-${seq}`;
    case 'verification_admin':
      return `ver-${seq}`;
    default:
      return `${prefix}-${seq}`;
  }
};
