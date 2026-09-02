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
      role: 'support_admin',
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

function assetUrl(url) {
  if (!url) return url;
  return url.startsWith('/uploads/') ? `${API_BASE}${url}` : url;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  escalated_finance_team: 'Escalated to Finance',
  escalated_super_admin: 'Escalated to Super Admin',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

function statusBadge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABELS[status] || status}</span>`;
}

const state = { tickets: [] };

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

window.logoutSupportAdmin = function logoutSupportAdmin() {
  sessionStorage.clear();
  window.location.href = 'login.html';
};

async function loadTickets() {
  const res = await apiRequest('/support/tickets');
  state.tickets = res?.data || [];
  renderDashboard();
  renderTicketTables();
}

function renderDashboard() {
  const profile = getProfile();
  const greeting = document.getElementById('agentGreeting');
  if (greeting) greeting.textContent = `Welcome back, ${profile.name || 'agent'}.`;

  const byId = (id) => document.getElementById(id);
  byId('kpiOpen').textContent = String(state.tickets.filter((t) => t.status === 'open').length);
  byId('kpiInReview').textContent = String(state.tickets.filter((t) => t.status === 'in_review').length);
  byId('kpiFinance').textContent = String(state.tickets.filter((t) => t.status === 'escalated_finance_team').length);
  byId('kpiResolved').textContent = String(state.tickets.filter((t) => t.status === 'resolved').length);

  const recent = [...state.tickets]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  document.getElementById('recentTicketsBody').innerHTML = recent.length
    ? recent.map(ticketRow).join('')
    : '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No tickets yet.</td></tr>';
}

function ticketRow(ticket) {
  return `
    <tr>
      <td>${escapeHtml(ticket.id)}</td>
      <td>${ticket.raised_by_role === 'diner' ? 'Diner' : 'Manager'}<br><span style="color:var(--text-muted); font-size:0.75rem;">${escapeHtml(ticket.raised_by_user_id)}</span></td>
      <td style="text-transform: capitalize;">${escapeHtml(ticket.category)}</td>
      <td>${escapeHtml(ticket.subject)}</td>
      <td>${statusBadge(ticket.status)}</td>
      <td style="text-align:right;"><button class="btn-sm" onclick="openTicketModal('${ticket.id}')">Open</button></td>
    </tr>
  `;
}

function renderTicketTables() {
  const dinerStatus = document.getElementById('dinerStatusFilter')?.value || '';
  const managerStatus = document.getElementById('managerStatusFilter')?.value || '';

  const dinerTickets = state.tickets
    .filter((t) => t.raised_by_role === 'diner')
    .filter((t) => !dinerStatus || t.status === dinerStatus)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const managerTickets = state.tickets
    .filter((t) => t.raised_by_role === 'manager')
    .filter((t) => !managerStatus || t.status === managerStatus)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  document.getElementById('dinerTicketsBody').innerHTML = dinerTickets.length
    ? dinerTickets.map((t) => `
      <tr>
        <td>${escapeHtml(t.id)}</td>
        <td>${escapeHtml(t.raised_by_user_id)}</td>
        <td style="text-transform: capitalize;">${escapeHtml(t.category)}</td>
        <td>${escapeHtml(t.subject)}</td>
        <td>${statusBadge(t.status)}</td>
        <td style="text-align:right;"><button class="btn-sm" onclick="openTicketModal('${t.id}')">Open</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No diner tickets.</td></tr>';

  document.getElementById('managerTicketsBody').innerHTML = managerTickets.length
    ? managerTickets.map((t) => `
      <tr>
        <td>${escapeHtml(t.id)}</td>
        <td>${escapeHtml(t.raised_by_user_id)}</td>
        <td style="text-transform: capitalize;">${escapeHtml(t.category)}</td>
        <td>${escapeHtml(t.subject)}</td>
        <td>${statusBadge(t.status)}</td>
        <td style="text-align:right;"><button class="btn-sm" onclick="openTicketModal('${t.id}')">Open</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No manager tickets.</td></tr>';
}

function attachmentsHtml(attachments) {
  if (!attachments || !attachments.length) {
    return '<p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">No attachments.</p>';
  }
  return attachments.map((url) => {
    const full = assetUrl(url);
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(url);
    return isImage
      ? `<a class="attachment-chip" href="${full}" target="_blank" rel="noopener"><img src="${full}" alt="attachment"> View</a>`
      : `<a class="attachment-chip" href="${full}" target="_blank" rel="noopener"><i class="fa-solid fa-file-pdf"></i> Document</a>`;
  }).join('');
}

function reservationLookupHtml(data) {
  if (!data) return '';
  const { reservation, restaurant, diner, checkin, payments } = data;
  return `
    <div class="detail-section">
      <h4><i class="fa-solid fa-calendar-check"></i> Reservation ${escapeHtml(reservation.id)}</h4>
      <div class="detail-row"><span>Status</span><strong style="text-transform:capitalize;">${escapeHtml(reservation.reservation_status)}</strong></div>
      <div class="detail-row"><span>Restaurant</span><span>${escapeHtml(restaurant?.name || reservation.restaurant_id)}</span></div>
      <div class="detail-row"><span>Diner</span><span>${escapeHtml(diner?.name || reservation.user_id)} (${escapeHtml(diner?.email || '')})</span></div>
      <div class="detail-row"><span>Guests</span><span>${escapeHtml(reservation.guest_count)}</span></div>
      <div class="detail-row"><span>Booked At</span><span>${new Date(reservation.created_at).toLocaleString()}</span></div>
      <div class="detail-row"><span>Checked In</span><span>${checkin ? new Date(checkin.checkin_time).toLocaleString() : 'Not checked in'}</span></div>
      <div class="detail-row"><span>Payments</span><span>${(payments || []).map((p) => `${p.payment_status} - Rs.${p.amount}`).join(', ') || 'None recorded'}</span></div>
      <div style="margin-top:0.6rem;"><button class="btn-sm" onclick="linkTicket('${reservation.id}', '')">Link this reservation to the ticket</button></div>
    </div>
  `;
}

function dinerHistoryHtml(data) {
  if (!data) return '';
  const { diner, dinerDetails, reservations } = data;
  const rows = reservations.slice(0, 8).map((r) => `
    <div class="detail-row"><span>${escapeHtml(r.id)} - ${escapeHtml(r.restaurant_id)}</span><span style="text-transform:capitalize;">${escapeHtml(r.reservation_status)}</span></div>
  `).join('') || '<p style="color:var(--text-muted); font-size:0.8rem;">No reservations found.</p>';

  return `
    <div class="detail-section">
      <h4><i class="fa-solid fa-user"></i> Diner: ${escapeHtml(diner.name)}</h4>
      <div class="detail-row"><span>Email</span><span>${escapeHtml(diner.email)}</span></div>
      <div class="detail-row"><span>Phone</span><span>${escapeHtml(diner.phone || '-')}</span></div>
      <div class="detail-row"><span>Loyalty Points</span><span>${escapeHtml(dinerDetails?.loyalty_points ?? '-')}</span></div>
      <h4 style="margin-top:0.8rem;">Reservation History (${reservations.length})</h4>
      ${rows}
    </div>
  `;
}

function managerRestaurantHtml(data) {
  if (!data) return '';
  const { manager, restaurants, stats } = data;
  const restaurantList = restaurants.map((r) => `<div class="detail-row"><span>${escapeHtml(r.name)} (${escapeHtml(r.id)})</span><span>${escapeHtml(r.status)}</span></div>`).join('') || '<p style="color:var(--text-muted); font-size:0.8rem;">No restaurants found.</p>';

  return `
    <div class="detail-section">
      <h4><i class="fa-solid fa-store"></i> Manager: ${escapeHtml(manager.name)}</h4>
      <div class="detail-row"><span>Email</span><span>${escapeHtml(manager.email)}</span></div>
      <div class="detail-row"><span>Phone</span><span>${escapeHtml(manager.phone || '-')}</span></div>
      <h4 style="margin-top:0.8rem;">Restaurant(s)</h4>
      ${restaurantList}
      <div class="detail-row"><span>Total / Completed / Cancelled / No-Show</span><span>${stats.total} / ${stats.completed} / ${stats.cancelled} / ${stats.no_show}</span></div>
      <div style="margin-top:0.6rem;">${restaurants[0] ? `<button class="btn-sm" onclick="linkTicket('', '${restaurants[0].id}')">Link this restaurant to the ticket</button>` : ''}</div>
    </div>
  `;
}

let currentTicket = null;

window.openTicketModal = async function openTicketModal(id) {
  try {
    const res = await apiRequest(`/support/tickets/${id}`);
    currentTicket = res.data;
    renderTicketModal();
    document.getElementById('ticketModal').style.display = 'flex';

    if (currentTicket.raised_by_role === 'diner') {
      const lookup = await apiRequest(`/support/lookup/diner/${currentTicket.raised_by_user_id}`).catch(() => null);
      renderTicketModal(lookup?.data ? { raiser: dinerHistoryHtml(lookup.data) } : {});
    } else {
      const lookup = await apiRequest(`/support/lookup/manager/${currentTicket.raised_by_user_id}`).catch(() => null);
      renderTicketModal(lookup?.data ? { raiser: managerRestaurantHtml(lookup.data) } : {});
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.closeTicketModal = function closeTicketModal() {
  document.getElementById('ticketModal').style.display = 'none';
  currentTicket = null;
};

window.searchReservation = async function searchReservation() {
  const id = document.getElementById('reservationSearchInput').value.trim();
  if (!id) return;
  try {
    const res = await apiRequest(`/support/lookup/reservation/${id}`);
    document.getElementById('reservationLookupResult').innerHTML = reservationLookupHtml(res.data);
  } catch (error) {
    document.getElementById('reservationLookupResult').innerHTML = `<p style="color:#C1121F; font-size:0.82rem;">${escapeHtml(error.message)}</p>`;
  }
};

window.linkTicket = async function linkTicket(reservationId, restaurantId) {
  if (!currentTicket) return;
  try {
    await apiRequest(`/support/tickets/${currentTicket.id}/link`, {
      method: 'PATCH',
      body: JSON.stringify({ reservation_id: reservationId || undefined, restaurant_id: restaurantId || undefined }),
    });
    showToast('Linked to ticket.');
    await loadTickets();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.claimTicket = async function claimTicket() {
  if (!currentTicket) return;
  try {
    await apiRequest(`/support/tickets/${currentTicket.id}/claim`, {
      method: 'PATCH',
      body: JSON.stringify({ admin_id: getAdminId() }),
    });
    showToast('Ticket claimed for review.');
    await loadTickets();
    await openTicketModal(currentTicket.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.submitDecision = async function submitDecision(decision) {
  if (!currentTicket) return;
  const notes = document.getElementById('decisionNotes').value.trim();
  if (!notes) {
    showToast('Please add a note explaining your decision.', 'error');
    return;
  }
  try {
    await apiRequest(`/support/tickets/${currentTicket.id}/decision`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, notes, admin_id: getAdminId() }),
    });
    showToast('Decision recorded.');
    closeTicketModal();
    await loadTickets();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.resolveDirectly = async function resolveDirectly() {
  if (!currentTicket) return;
  const notes = document.getElementById('decisionNotes').value.trim();
  if (!notes) {
    showToast('Please add resolution notes.', 'error');
    return;
  }
  try {
    await apiRequest(`/support/tickets/${currentTicket.id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_notes: notes, admin_id: getAdminId() }),
    });
    showToast('Ticket resolved.');
    closeTicketModal();
    await loadTickets();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.rejectTicket = async function rejectTicket() {
  if (!currentTicket) return;
  const notes = document.getElementById('decisionNotes').value.trim();
  if (!notes) {
    showToast('Please add a note explaining the rejection.', 'error');
    return;
  }
  try {
    await apiRequest(`/support/tickets/${currentTicket.id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_notes: notes, admin_id: getAdminId() }),
    });
    showToast('Ticket rejected.');
    closeTicketModal();
    await loadTickets();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function actionAreaHtml(ticket) {
  if (ticket.status === 'resolved' || ticket.status === 'rejected') {
    return `<div class="detail-section"><h4>Outcome</h4><p style="margin:0; font-size:0.85rem;">${escapeHtml(ticket.resolution_notes || '')}</p></div>`;
  }

  if (ticket.status === 'escalated_finance_team') {
    return `<div class="detail-section"><h4>Escalated to Finance Team</h4><p style="margin:0; font-size:0.85rem;">Refund approved and awaiting the finance team. No further action needed from Customer Support.</p></div>`;
  }

  if (ticket.status === 'escalated_super_admin') {
    return `<div class="detail-section"><h4>Escalated to Super Admin</h4><p style="margin:0; font-size:0.85rem;">This ticket is locked while the Super Admin reviews it.</p></div>`;
  }

  const claimButton = ticket.status === 'open'
    ? `<button class="btn-sm" onclick="claimTicket()" style="margin-bottom: 0.75rem;">Start Review</button>`
    : '';

  return `
    <div class="detail-section">
      <h4>Decision</h4>
      ${claimButton}
      <div class="form-group">
        <label>Notes (required for any action)</label>
        <textarea id="decisionNotes" rows="3" placeholder="Explain your finding..."></textarea>
      </div>
      <div class="modal-actions" style="justify-content: flex-start;">
        <button class="btn-decision btn-approve" onclick="submitDecision('refund_approved')">Approve Refund &rarr; Finance</button>
        <button class="btn-decision btn-deny" onclick="submitDecision('refund_denied')">Deny Refund</button>
        <button class="btn-decision btn-escalate" onclick="submitDecision('escalated_technical')">Escalate Technical Issue</button>
        <button class="btn-decision btn-resolve" onclick="resolveDirectly()">Resolve Directly</button>
        <button class="btn-sm" onclick="rejectTicket()">Reject</button>
      </div>
    </div>
  `;
}

function renderTicketModal(extra = {}) {
  if (!currentTicket) return;
  const t = currentTicket;
  document.getElementById('ticketModalContent').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-light); padding-bottom:1rem; margin-bottom:1rem;">
      <div>
        <h2 style="margin:0 0 0.3rem; font-size:1.2rem;">${escapeHtml(t.subject)}</h2>
        <span style="font-size:0.78rem; color: var(--text-muted);">${escapeHtml(t.id)} - ${t.raised_by_role === 'diner' ? 'Diner' : 'Manager'} ${escapeHtml(t.raised_by_user_id)} - ${new Date(t.created_at).toLocaleString()}</span>
      </div>
      ${statusBadge(t.status)}
    </div>

    <div class="detail-section">
      <h4>Description</h4>
      <p style="margin:0 0 0.75rem; font-size:0.87rem; white-space: pre-wrap;">${escapeHtml(t.description)}</p>
      ${attachmentsHtml(t.attachments)}
    </div>

    <div class="detail-section">
      <h4><i class="fa-solid fa-magnifying-glass"></i> Look Up a Reservation ID Mentioned in the Description</h4>
      <div style="display:flex; gap:0.5rem;">
        <input type="text" id="reservationSearchInput" placeholder="e.g. resv-0004" style="flex:1; padding:0.5rem 0.7rem; border:1px solid #ccc; border-radius:6px;">
        <button class="btn-sm" onclick="searchReservation()">Search</button>
      </div>
      <div id="reservationLookupResult" style="margin-top:0.75rem;"></div>
    </div>

    ${extra.raiser || '<div class="detail-section"><p style="margin:0; color:var(--text-muted); font-size:0.82rem;">Loading raiser history...</p></div>'}

    ${actionAreaHtml(t)}

    <div class="modal-actions">
      <button class="btn-sm" onclick="closeTicketModal()">Close</button>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  loadTickets().catch((error) => showToast(error.message, 'error'));
  setInterval(() => loadTickets().catch(() => {}), 20000);
});
