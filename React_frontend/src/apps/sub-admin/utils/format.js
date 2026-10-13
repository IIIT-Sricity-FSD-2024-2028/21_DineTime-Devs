export const SUPPORT_STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  escalated_finance_team: 'Escalated to Finance',
  escalated_super_admin: 'Escalated to Super Admin',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

export function formatDate(value, dateOnly = false) {
  if (!value) return '-';
  const date = new Date(value);
  return dateOnly ? date.toLocaleDateString() : date.toLocaleString();
}

export function money(value) {
  return `Rs.${value ?? 0}`;
}
