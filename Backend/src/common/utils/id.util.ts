const counters: Record<string, number> = {};
export const exportIdCounters = () => ({ ...counters });
export const restoreIdCounters = (saved: Record<string, number>) => {
  Object.keys(counters).forEach((key) => delete counters[key]);
  Object.assign(counters, saved);
};
export function warmIdCounters(records: Record<string, unknown[]>) {
  const aliases: Record<string,string> = { reservation:'resv', resv:'resv', user_setting:'uset', notification:'noti', checkin:'chk', payment:'pay', order:'ord', order_item:'oit', review:'rev', menu:'mnu', table:'tbl', timeslot:'slt', restaurant:'res', location:'loc', ticket:'tkt', support_admin:'spt', finance_admin:'fin', verification_admin:'ver', guest:'guest', slot:'slot', table_slot:'table_slot', credit:'credit' };
  const ids = Object.values(records).flat().flatMap((row) => {
    const value = row as {id?:string;checkin_id?:string;payout_adjustments?:{id:string}[]};
    return [value.id, value.checkin_id, ...(value.payout_adjustments || []).map((entry) => entry.id)].filter((id): id is string => Boolean(id));
  });
  for (const [prefix, alias] of Object.entries(aliases)) {
    const pattern = new RegExp('^' + alias + '-([0-9]+)$');
    counters[prefix] = Math.max(counters[prefix] || 0, ...ids.map((id) => Number(id.match(pattern)?.[1] || 0)));
  }
}

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
