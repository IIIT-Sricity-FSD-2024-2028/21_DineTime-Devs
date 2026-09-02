// support.js - Customer Support ticket page for diners

let selectedFiles = [];

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast-notification ${type === 'error' ? 'error' : ''}`;
  const icon = type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

const STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  escalated_finance_team: 'Escalated to Finance Team',
  escalated_super_admin: 'Escalated to Platform Admin',
  resolved: 'Resolved',
  rejected: 'Closed',
};

const CATEGORY_LABELS = {
  refund: 'Refund Issue',
  technical: 'Technical Issue',
  other: 'Other',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFileChips() {
  const list = document.getElementById('fileChipList');
  list.innerHTML = selectedFiles.map((file, index) => `
    <span class="file-chip"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(file.name)} <button type="button" data-index="${index}">&times;</button></span>
  `).join('');

  list.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(Number(btn.dataset.index), 1);
      renderFileChips();
    });
  });
}

function renderTickets(tickets) {
  const container = document.getElementById('ticketList');
  if (!tickets.length) {
    container.innerHTML = '<p class="empty-state">You haven\'t raised any issues yet.</p>';
    return;
  }

  container.innerHTML = tickets
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((ticket) => `
      <div class="ticket-item">
        <div class="ticket-item-head">
          <div>
            <h4>${escapeHtml(ticket.subject)}</h4>
            <div class="ticket-meta">${escapeHtml(CATEGORY_LABELS[ticket.category] || ticket.category)} - ${new Date(ticket.created_at).toLocaleString()}</div>
          </div>
          <span class="status-pill status-${ticket.status}">${escapeHtml(STATUS_LABELS[ticket.status] || ticket.status)}</span>
        </div>
        <p class="ticket-desc">${escapeHtml(ticket.description)}</p>
        ${ticket.resolution_notes ? `<div class="ticket-resolution"><strong>Support Team:</strong> ${escapeHtml(ticket.resolution_notes)}</div>` : ''}
      </div>
    `).join('');
}

async function loadTickets(userId) {
  try {
    const res = await DinetimeStore._request(`/support/tickets/mine?user_id=${userId}`, {
      headers: DinetimeStore._headers('diner'),
    });
    renderTickets(res?.data || []);
  } catch (error) {
    document.getElementById('ticketList').innerHTML = '<p class="empty-state">Unable to load your tickets right now.</p>';
  }
}

async function submitTicket(event, userId) {
  event.preventDefault();

  const category = document.getElementById('iptCategory').value;
  const subject = document.getElementById('iptSubject').value.trim();
  const description = document.getElementById('iptDescription').value.trim();

  if (!subject || !description) {
    showToast('Please fill in the subject and description.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('raised_by_user_id', userId);
  formData.append('raised_by_role', 'diner');
  formData.append('category', category);
  formData.append('subject', subject);
  formData.append('description', description);
  selectedFiles.forEach((file) => formData.append('attachments', file));

  const submitBtn = document.getElementById('btnSubmitTicket');
  submitBtn.disabled = true;

  try {
    const response = await fetch(`${DinetimeStore.API_BASE}/support/tickets`, {
      method: 'POST',
      headers: DinetimeStore._authHeaders('diner'),
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(Array.isArray(body.message) ? body.message.join(', ') : (body.message || 'Could not submit your issue.'));
    }

    showToast('Your issue has been submitted. Our support team will review it.');
    document.getElementById('supportForm').reset();
    selectedFiles = [];
    renderFileChips();
    await loadTickets(userId);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function init() {
  const user = DinetimeStore.getUser();
  const userId = user?.backend_user_id;

  if (!userId) {
    document.getElementById('ticketList').innerHTML = '<p class="empty-state">Please log in again to view and raise support tickets.</p>';
    return;
  }

  loadTickets(userId);

  document.getElementById('iptAttachments').addEventListener('change', (event) => {
    const incoming = Array.from(event.target.files || []);
    selectedFiles = [...selectedFiles, ...incoming].slice(0, 5);
    renderFileChips();
    event.target.value = '';
  });

  document.getElementById('supportForm').addEventListener('submit', (event) => submitTicket(event, userId));

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('data-href');
      if (href && href !== '#') window.location.href = href;
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
  }
  init();
});
