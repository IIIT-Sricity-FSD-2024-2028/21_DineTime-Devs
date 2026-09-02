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
      role: 'verification_admin',
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

function statusBadge(status) {
  const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

const state = { applications: [] };

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

window.logoutVerificationAdmin = function logoutVerificationAdmin() {
  sessionStorage.clear();
  window.location.href = 'login.html';
};

async function loadApplications() {
  const res = await apiRequest('/verification/applications');
  state.applications = res?.data || [];
  renderDashboard();
  renderPendingTable();
}

function renderDashboard() {
  const profile = getProfile();
  const greeting = document.getElementById('agentGreeting');
  if (greeting) greeting.textContent = `Welcome back, ${profile.name || 'agent'}.`;
  const locationEl = document.getElementById('sidebarLocation');
  if (locationEl) locationEl.textContent = `Location: ${profile.location_id || '—'}`;

  const byId = (id) => document.getElementById(id);
  byId('kpiPending').textContent = String(state.applications.filter((a) => a.details.verification_status === 'pending').length);
  byId('kpiApproved').textContent = String(state.applications.filter((a) => a.details.verification_status === 'approved').length);
  byId('kpiRejected').textContent = String(state.applications.filter((a) => a.details.verification_status === 'rejected').length);

  const recent = [...state.applications]
    .sort((a, b) => b.manager.created_at.localeCompare(a.manager.created_at))
    .slice(0, 8);

  document.getElementById('recentApplicationsBody').innerHTML = recent.length
    ? recent.map(applicationRow).join('')
    : '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No applications yet.</td></tr>';
}

function applicationRow(item) {
  return `
    <tr>
      <td>${escapeHtml(item.manager.name)}<br><span style="color:var(--text-muted); font-size:0.75rem;">${escapeHtml(item.manager.email)}</span></td>
      <td>${escapeHtml(item.restaurant?.name || '-')}</td>
      <td>${escapeHtml(item.details.business_license_number)}</td>
      <td>${statusBadge(item.details.verification_status)}</td>
      <td style="text-align:right;"><button class="btn-sm" onclick="openApplicationModal('${item.manager.id}')">Open</button></td>
    </tr>
  `;
}

function renderPendingTable() {
  const pending = state.applications
    .filter((a) => a.details.verification_status === 'pending')
    .sort((a, b) => a.manager.created_at.localeCompare(b.manager.created_at));

  document.getElementById('pendingApplicationsBody').innerHTML = pending.length
    ? pending.map((item) => `
      <tr>
        <td>${escapeHtml(item.manager.name)}<br><span style="color:var(--text-muted); font-size:0.75rem;">${escapeHtml(item.manager.email)}</span></td>
        <td>${escapeHtml(item.restaurant?.name || '-')}</td>
        <td>${escapeHtml(item.details.business_license_number)}</td>
        <td>${new Date(item.manager.created_at).toLocaleString()}</td>
        <td style="text-align:right;"><button class="btn-sm" onclick="openApplicationModal('${item.manager.id}')">Review</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No pending applications for your location.</td></tr>';
}

let currentApplication = null;

window.openApplicationModal = async function openApplicationModal(managerId) {
  try {
    const res = await apiRequest(`/verification/applications/${managerId}`);
    currentApplication = res.data;
    renderApplicationModal();
    document.getElementById('applicationModal').style.display = 'flex';
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.closeApplicationModal = function closeApplicationModal() {
  document.getElementById('applicationModal').style.display = 'none';
  currentApplication = null;
};

window.submitReview = async function submitReview(decision) {
  if (!currentApplication) return;

  let reason;
  if (decision === 'rejected') {
    reason = document.getElementById('reviewReason').value.trim();
    if (!reason) {
      showToast('Please provide a reason for rejecting this application.', 'error');
      return;
    }
  }

  try {
    await apiRequest(`/verification/applications/${currentApplication.manager.id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, reason, reviewer_id: getAdminId() }),
    });
    showToast(decision === 'approved' ? 'Application approved.' : 'Application rejected.');
    closeApplicationModal();
    await loadApplications();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function renderApplicationModal() {
  if (!currentApplication) return;
  const { manager, details, restaurant } = currentApplication;
  const isPending = details.verification_status === 'pending';

  document.getElementById('applicationModalContent').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-light); padding-bottom:1rem; margin-bottom:1rem;">
      <div>
        <h2 style="margin:0 0 0.3rem; font-size:1.2rem;">${escapeHtml(manager.name)}</h2>
        <span style="font-size:0.78rem; color: var(--text-muted);">${escapeHtml(manager.id)} - Applied ${new Date(manager.created_at).toLocaleString()}</span>
      </div>
      ${statusBadge(details.verification_status)}
    </div>

    <div class="detail-section">
      <h4>Manager Details</h4>
      <div class="detail-row"><span>Email</span><span>${escapeHtml(manager.email)}</span></div>
      <div class="detail-row"><span>Phone</span><span>${escapeHtml(manager.phone || '-')}</span></div>
      <div class="detail-row"><span>Business License</span><span>${escapeHtml(details.business_license_number)}</span></div>
    </div>

    <div class="detail-section">
      <h4>Restaurant</h4>
      <div class="detail-row"><span>Name</span><span>${escapeHtml(restaurant?.name || '-')}</span></div>
      <div class="detail-row"><span>Cuisine</span><span>${escapeHtml(restaurant?.cuisine_type || '-')}</span></div>
      <div class="detail-row"><span>Description</span><span style="text-align:right; max-width: 60%;">${escapeHtml(restaurant?.description || '-')}</span></div>
    </div>

    <div class="detail-section">
      <h4>Verification Document</h4>
      ${details.verification_document_url
        ? `<a class="doc-link" href="${assetUrl(details.verification_document_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-file"></i> View Document</a>`
        : '<p style="margin:0; color:var(--text-muted); font-size:0.82rem;">No document on file.</p>'}
    </div>

    ${isPending ? `
      <div class="detail-section">
        <h4>Decision</h4>
        <div class="form-group">
          <label>Rejection Reason (required only if rejecting)</label>
          <textarea id="reviewReason" rows="3" placeholder="Explain what needs to be fixed..."></textarea>
        </div>
        <div class="modal-actions" style="justify-content: flex-start;">
          <button class="btn-decision btn-approve" onclick="submitReview('approved')">Approve</button>
          <button class="btn-decision btn-reject" onclick="submitReview('rejected')">Reject</button>
        </div>
      </div>
    ` : `
      <div class="detail-section">
        <h4>Outcome</h4>
        <p style="margin:0; font-size:0.85rem;">${escapeHtml(details.rejection_reason || 'No additional notes.')}</p>
      </div>
    `}

    <div class="modal-actions">
      <button class="btn-sm" onclick="closeApplicationModal()">Close</button>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  loadApplications().catch((error) => showToast(error.message, 'error'));
  setInterval(() => loadApplications().catch(() => {}), 20000);
});
