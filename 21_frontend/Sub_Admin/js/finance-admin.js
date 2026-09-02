const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';

function getProfile() {
  try {
    return JSON.parse(sessionStorage.getItem('subadmin_profile') || '{}');
  } catch (_e) {
    return {};
  }
}

function getAdminId() {
  return getProfile().id || '';
}

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem('subadmin_access_token') || '';
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      role: 'finance_admin',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message || message);
    } catch (_e) {
    }
    throw new Error(message);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusBadge(status) {
  const labels = {
    escalated_finance_team: 'Awaiting Decision',
    resolved: 'Approved & Refunded',
    rejected: 'Denied',
    paid: 'Paid',
    refunded: 'Refunded',
    pending: 'Pending',
    failed: 'Failed',
  };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

const state = {
  refunds: [],
  payouts: [],
  pendingPayments: [],
  revenue: null,
  audit: [],
  analytics: null,
  recentPayments: [],
  topRestaurants: [],
};

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

window.switchTab = function switchTab(tabName) {
  document.querySelectorAll('.dashboard-view').forEach((view) => { view.style.display = 'none'; });
  document.querySelectorAll('.sidebar .nav-item').forEach((item) => item.classList.remove('active'));
  const view = document.getElementById(`view-${tabName}`);
  if (view) view.style.display = 'block';
  const nav = document.getElementById(`nav-${tabName}`);
  if (nav) nav.classList.add('active');
};

window.logoutFinanceAdmin = function logoutFinanceAdmin() {
  sessionStorage.clear();
  window.location.href = 'login.html';
};

async function loadAll() {
  const auditStatus = document.getElementById('auditStatusFilter')?.value || '';
  const auditQuery = auditStatus ? `?status=${encodeURIComponent(auditStatus)}` : '';

  const [
    refundsRes, payoutsRes, pendingRes, revenueRes, auditRes,
    analyticsRes, recentRes, topRes,
  ] = await Promise.all([
    apiRequest('/finance/refunds'),
    apiRequest('/finance/payouts'),
    apiRequest('/finance/payouts/pending-payments'),
    apiRequest('/finance/revenue'),
    apiRequest(`/finance/refund-audit${auditQuery}`),
    apiRequest('/finance/analytics'),
    apiRequest('/finance/payments/recent?limit=10'),
    apiRequest('/finance/payments/top-restaurants?limit=5'),
  ]);

  state.refunds = refundsRes?.data || [];
  state.payouts = payoutsRes?.data || [];
  state.pendingPayments = pendingRes?.data || [];
  state.revenue = revenueRes?.data || null;
  state.audit = auditRes?.data || [];
  state.analytics = analyticsRes?.data || null;
  state.recentPayments = recentRes?.data || [];
  state.topRestaurants = topRes?.data || [];

  renderDashboard();
  renderRefunds();
  renderPayouts();
  renderPendingPayments();
  renderAudit();
}

function renderDashboard() {
  const profile = getProfile();
  const greeting = document.getElementById('agentGreeting');
  if (greeting) greeting.textContent = `Welcome back, ${profile.name || 'agent'}.`;

  document.getElementById('kpiPaidByDiners').textContent = `₹${state.revenue?.total_paid_by_diners ?? 0}`;
  document.getElementById('kpiRevenue').textContent = `₹${state.revenue?.total_platform_revenue ?? 0}`;
  document.getElementById('kpiPayoutsPaid').textContent = `₹${state.revenue?.total_payouts_settled ?? 0}`;
  document.getElementById('kpiRefundsIssued').textContent = `₹${state.revenue?.refunded_deposits ?? 0}`;

  document.getElementById('anTotalRestaurants').textContent = String(state.analytics?.total_restaurants ?? 0);
  document.getElementById('anTotalBookings').textContent = String(state.analytics?.total_bookings ?? 0);

  document.getElementById('topRestaurantsContainer').innerHTML = state.topRestaurants.length
    ? state.topRestaurants.map((r) => `
      <div class="top-restaurant-row">
        <div>
          <div style="font-weight:700;">${escapeHtml(r.restaurant_name || '—')}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${r.payment_count} payment(s)</div>
        </div>
        <div style="color:#2E7D32; font-weight:800;">₹${r.total_paid}</div>
      </div>
    `).join('')
    : '<p style="color:var(--text-muted); font-size:0.85rem;">No payments yet.</p>';

  renderRecentPayments();
}

function renderRecentPayments() {
  const query = (document.getElementById('dashboardSearch')?.value || '').trim().toLowerCase();
  const rows = state.recentPayments.filter((p) => !query
    || (p.payment_id || '').toLowerCase().includes(query)
    || (p.restaurant_name || '').toLowerCase().includes(query)
    || (p.diner_name || '').toLowerCase().includes(query));

  document.getElementById('recentPaymentsBody').innerHTML = rows.length
    ? rows.map((p) => `
      <tr>
        <td>${escapeHtml(p.payment_id)}</td>
        <td>${escapeHtml(p.diner_name || '—')}</td>
        <td>${escapeHtml(p.restaurant_name || '—')}</td>
        <td>₹${p.amount}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${new Date(p.payment_time).toLocaleString()}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No payments found.</td></tr>';
}

function refundStatus(ticket) {
  return ticket.settled ? 'settled' : 'pending';
}

function renderRefunds() {
  const query = (document.getElementById('refundsSearch')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('refundsStatusFilter')?.value || '';

  const rows = state.refunds.filter((ticket) => {
    const matchesStatus = !statusFilter || refundStatus(ticket) === statusFilter;
    const matchesQuery = !query
      || (ticket.id || '').toLowerCase().includes(query)
      || (ticket.raised_by_user_id || '').toLowerCase().includes(query)
      || (ticket.subject || '').toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  document.getElementById('refundsBody').innerHTML = rows.length
    ? rows.map((ticket) => `
      <tr>
        <td>${escapeHtml(ticket.id)}</td>
        <td>${escapeHtml(ticket.raised_by_user_id)}</td>
        <td>${escapeHtml(ticket.reservation?.id || ticket.linked_reservation_id || '—')}</td>
        <td>${ticket.payment ? `₹${ticket.payment.deposit_amount}` : '—'}</td>
        <td>${escapeHtml(ticket.subject)}</td>
        <td>${statusBadge(ticket.status)}</td>
        <td style="text-align:right;"><button class="btn-sm" onclick="openRefundModal('${ticket.id}')">${ticket.settled ? 'View' : 'Review'}</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No refund requests found.</td></tr>';
}

function renderPayouts() {
  const query = (document.getElementById('payoutsSearch')?.value || '').trim().toLowerCase();
  const rows = state.payouts.filter((p) => !query || (p.restaurant_name || '').toLowerCase().includes(query));

  document.getElementById('payoutsBody').innerHTML = rows.length
    ? rows.map((p) => `
      <tr>
        <td>${escapeHtml(p.restaurant_name)}</td>
        <td>${p.pending_reservation_count}</td>
        <td>₹${p.pending_payout}</td>
        <td>₹${p.settled_payout}</td>
        <td><span class="badge badge-${p.payout_blocked ? 'blocked' : 'active'}">${p.payout_blocked ? 'Blocked' : 'Active'}</span></td>
        <td style="text-align:right;">
          <button class="btn-sm ${p.payout_blocked ? 'success' : 'danger'}" onclick="togglePayoutBlock('${p.restaurant_id}', ${p.payout_blocked ? 'false' : 'true'})">
            ${p.payout_blocked ? 'Unblock' : 'Block'}
          </button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No restaurants found.</td></tr>';
}

window.togglePayoutBlock = async function togglePayoutBlock(restaurantId, blocked) {
  try {
    await apiRequest(`/finance/payouts/${restaurantId}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked, admin_id: getAdminId() }),
    });
    showToast(blocked ? 'Payouts blocked for this restaurant.' : 'Payouts unblocked for this restaurant.');
    await loadAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function renderPendingPayments() {
  const query = (document.getElementById('pendingPaymentsSearch')?.value || '').trim().toLowerCase();
  const rows = state.pendingPayments.filter((p) => !query || (p.restaurant_name || '').toLowerCase().includes(query));

  document.getElementById('pendingPaymentsBody').innerHTML = rows.length
    ? rows.map((p) => {
      const effectivelyBlocked = p.blocked || p.restaurant_blocked;
      return `
      <tr ${effectivelyBlocked ? 'style="opacity:0.6;"' : ''}>
        <td>${escapeHtml(p.payment_id)}</td>
        <td>${escapeHtml(p.restaurant_name || '—')}${p.restaurant_blocked ? ' <span class="badge badge-blocked">Restaurant Blocked</span>' : ''}</td>
        <td>₹${p.net_amount}</td>
        <td>${new Date(p.payment_time).toLocaleDateString()}</td>
        <td>${effectivelyBlocked ? '—' : (p.days_remaining <= 0 ? 'Today' : `${p.days_remaining} day(s)`)}</td>
        <td><span class="badge badge-${p.blocked ? 'blocked' : 'active'}">${p.blocked ? 'Blocked' : 'Active'}</span></td>
        <td style="text-align:right;">
          <button class="btn-sm ${p.blocked ? 'success' : 'danger'}" onclick="togglePaymentBlock('${escapeHtml(p.payment_id)}', ${p.blocked ? 'false' : 'true'})">
            ${p.blocked ? 'Unblock' : 'Block'}
          </button>
        </td>
      </tr>
    `;
    }).join('')
    : '<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No pending payments.</td></tr>';
}

window.togglePaymentBlock = async function togglePaymentBlock(paymentId, blocked) {
  try {
    await apiRequest(`/finance/payouts/payments/${paymentId}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked, admin_id: getAdminId() }),
    });
    showToast(blocked ? 'Payment blocked from settlement.' : 'Payment unblocked.');
    await loadAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.settleAll = async function settleAll() {
  try {
    const res = await apiRequest('/finance/payouts/settle-all', {
      method: 'POST',
      body: JSON.stringify({ admin_id: getAdminId() }),
    });
    const summary = res?.data;
    showToast(summary
      ? `Settled ${summary.settled_count} payment(s) — ₹${summary.settled_amount}${summary.blocked_count ? `, ${summary.blocked_count} blocked (skipped)` : ''}.`
      : 'Settlement complete.');
    await loadAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function renderAudit() {
  const query = (document.getElementById('auditSearch')?.value || '').trim().toLowerCase();
  const rows = state.audit.filter((a) => !query
    || (a.payment_id || '').toLowerCase().includes(query)
    || (a.restaurant_name || '').toLowerCase().includes(query)
    || (a.diner_name || '').toLowerCase().includes(query));

  document.getElementById('auditBody').innerHTML = rows.length
    ? rows.map((a) => `
      <tr>
        <td>${escapeHtml(a.payment_id)}</td>
        <td>${escapeHtml(a.reservation_id)}</td>
        <td>${escapeHtml(a.diner_name || '—')}</td>
        <td>${escapeHtml(a.restaurant_name || '—')}</td>
        <td>${statusBadge(a.status)}</td>
        <td>₹${a.amount}</td>
        <td>${a.refunded_amount ? `₹${a.refunded_amount}` : '—'}</td>
        <td>${a.settled_at ? new Date(a.settled_at).toLocaleDateString() : '—'}</td>
        <td>${a.settled_by === 'auto' ? 'Auto (7-day)' : a.settled_by === 'finance' ? 'Finance' : '—'}</td>
        <td>${new Date(a.payment_time).toLocaleString()}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="10" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No transactions yet.</td></tr>';
}

let currentTicket = null;

window.openRefundModal = async function openRefundModal(id) {
  try {
    const res = await apiRequest(`/finance/refunds/${id}`);
    currentTicket = res.data;
    renderRefundModal();
    document.getElementById('refundModal').style.display = 'flex';
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.closeRefundModal = function closeRefundModal() {
  document.getElementById('refundModal').style.display = 'none';
  currentTicket = null;
};

window.submitRefundDecision = async function submitRefundDecision(approve) {
  if (!currentTicket) return;
  const notes = document.getElementById('financeDecisionNotes').value.trim();
  if (!notes) {
    showToast('Please add a note explaining your decision.', 'error');
    return;
  }
  try {
    const res = await apiRequest(`/finance/refunds/${currentTicket.id}/decision`, {
      method: 'PATCH',
      body: JSON.stringify({ approve, notes, admin_id: getAdminId() }),
    });
    showToast(approve
      ? `Refund approved${res?.data?.refunded_amount ? ` — ₹${res.data.refunded_amount} refunded` : ''}.`
      : 'Refund denied.');
    closeRefundModal();
    await loadAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function renderRefundModal() {
  if (!currentTicket) return;
  const t = currentTicket;
  const reservation = t.reservation;
  const restaurant = t.restaurant;
  const payment = t.payment;

  document.getElementById('refundModalContent').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-light); padding-bottom:1rem; margin-bottom:1rem;">
      <div>
        <h2 style="margin:0 0 0.3rem; font-size:1.2rem;">${escapeHtml(t.subject)}</h2>
        <span style="font-size:0.78rem; color: var(--text-muted);">${escapeHtml(t.id)} — Diner ${escapeHtml(t.raised_by_user_id)} — ${new Date(t.created_at).toLocaleString()}</span>
      </div>
      ${statusBadge(t.status)}
    </div>

    <div class="detail-section">
      <h4>Support Team's Notes</h4>
      <p style="margin:0; font-size:0.87rem; white-space: pre-wrap;">${escapeHtml(t.resolution_notes || '—')}</p>
    </div>

    ${reservation ? `
      <div class="detail-section">
        <h4><i class="fa-solid fa-calendar-check"></i> Linked Reservation ${escapeHtml(reservation.id)}</h4>
        <div class="detail-row"><span>Restaurant</span><span>${escapeHtml(restaurant?.name || reservation.restaurant_id)}</span></div>
        <div class="detail-row"><span>Guests</span><span>${escapeHtml(reservation.guest_count)}</span></div>
        <div class="detail-row"><span>Status</span><span style="text-transform:capitalize;">${escapeHtml(reservation.reservation_status)}</span></div>
        ${payment ? `
          <div class="detail-row"><span>Deposit Paid</span><span>₹${payment.deposit_amount}</span></div>
          <div class="detail-row"><span>Diner Platform Fee</span><span>₹${payment.diner_platform_fee} (non-refundable)</span></div>
        ` : '<div class="detail-row"><span colspan="2">No paid payment found for this reservation.</span></div>'}
      </div>
    ` : '<div class="detail-section"><p style="margin:0; color:var(--text-muted); font-size:0.82rem;">No reservation was linked to this ticket by Customer Support.</p></div>'}

    ${t.status === 'escalated_finance_team' ? `
      <div class="detail-section">
        <h4>Decision</h4>
        <div class="form-group">
          <label>Notes (required)</label>
          <textarea id="financeDecisionNotes" rows="3" placeholder="Explain your decision..."></textarea>
        </div>
        <div class="modal-actions" style="justify-content: flex-start;">
          <button class="btn-decision btn-approve" onclick="submitRefundDecision(true)">Approve &amp; Refund Deposit</button>
          <button class="btn-decision btn-deny" onclick="submitRefundDecision(false)">Deny Refund</button>
        </div>
      </div>
    ` : `
      <div class="detail-section"><h4>Outcome</h4><p style="margin:0; font-size:0.85rem;">${escapeHtml(t.resolution_notes || '')}</p></div>
    `}

    <div class="modal-actions">
      <button class="btn-sm" onclick="closeRefundModal()">Close</button>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  loadAll().catch((error) => showToast(error.message, 'error'));
  setInterval(() => loadAll().catch(() => {}), 20000);
});
