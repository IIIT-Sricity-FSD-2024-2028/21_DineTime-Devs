import { SUPPORT_STATUS_LABELS } from '../utils/format.js';

const verificationLabels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
const financeLabels = {
  escalated_finance_team: 'Awaiting Decision',
  resolved: 'Approved & Refunded',
  rejected: 'Denied',
  paid: 'Paid',
  refunded: 'Refunded',
  pending: 'Pending',
  failed: 'Failed',
};

export function StatusBadge({ status, labels }) {
  const text = labels?.[status] || financeLabels[status] || verificationLabels[status] || SUPPORT_STATUS_LABELS[status] || status;
  return <span className={`badge badge-${status}`}>{text}</span>;
}
