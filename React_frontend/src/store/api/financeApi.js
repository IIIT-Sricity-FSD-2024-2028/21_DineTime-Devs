import { queryRequest } from "./baseQuery.js";
import { withRefundAmounts } from "../../apps/sub-admin/utils/refundAmounts.js";
export const emptyFinance = {
  noShows: [],
  refunds: [],
  payouts: [],
  pendingPayments: [],
  revenue: null,
  audit: [],
  analytics: null,
  recentPayments: [],
  topRestaurants: [],
};
export async function loadFinanceData(api, scope) {
  const rawRequest = queryRequest(api, scope),
    request = async (path) => ({ data: await rawRequest(path) });
  const [
    refundsRes,
    payoutsRes,
    pendingRes,
    revenueRes,
    auditRes,
    analyticsRes,
    recentRes,
    topRes,
    noShowsRes,
  ] = await Promise.all([
    request("/finance/refunds", {}, "finance_admin"),
    request("/finance/payouts", {}, "finance_admin"),
    request("/finance/payouts/pending-payments", {}, "finance_admin"),
    request("/finance/revenue", {}, "finance_admin"),
    request("/finance/refund-audit", {}, "finance_admin"),
    request("/finance/analytics", {}, "finance_admin"),
    request("/finance/payments/recent?limit=10", {}, "finance_admin"),
    request("/finance/payments/top-restaurants?limit=5", {}, "finance_admin"),
    request("/finance/no-shows", {}, "finance_admin"),
  ]);
  return {
    refunds: (refundsRes?.data || []).map((ticket) =>
      withRefundAmounts(ticket, auditRes?.data || []),
    ),
    noShows: noShowsRes?.data || [],
    payouts: payoutsRes?.data || [],
    pendingPayments: pendingRes?.data || [],
    revenue: revenueRes?.data || null,
    audit: auditRes?.data || [],
    analytics: analyticsRes?.data || null,
    recentPayments: recentRes?.data || [],
    topRestaurants: topRes?.data || [],
  };
}
