// issues.js - Raise an Issue page for restaurant managers

let selectedFiles = [];

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    const icon = type === 'error' ? 'ph-warning' : 'ph-check-circle';
    const iconColor = type === 'error' ? '#DC2626' : '#527A59';
    toast.innerHTML = `<i class="ph ${icon}" style="font-size:18px;color:${iconColor};flex-shrink:0;"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
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
    refund: 'Payment Not Received',
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
        <span class="file-chip"><i class="ph ph-paperclip"></i> ${escapeHtml(file.name)} <button type="button" data-index="${index}">&times;</button></span>
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

async function loadTickets(managerId) {
    try {
        const res = await StorageManager._request(`/support/tickets/mine?user_id=${managerId}`, {
            headers: StorageManager._headers('manager'),
        });
        renderTickets(res?.data || []);
    } catch (error) {
        document.getElementById('ticketList').innerHTML = '<p class="empty-state">Unable to load your issues right now.</p>';
    }
}

async function submitIssue(event, managerId) {
    event.preventDefault();

    const category = document.getElementById('iptCategory').value;
    const subject = document.getElementById('iptSubject').value.trim();
    const description = document.getElementById('iptDescription').value.trim();

    if (!subject || !description) {
        showToast('Please fill in the subject and description.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('raised_by_user_id', managerId);
    formData.append('raised_by_role', 'manager');
    formData.append('category', category);
    formData.append('subject', subject);
    formData.append('description', description);
    selectedFiles.forEach((file) => formData.append('attachments', file));

    const submitBtn = document.getElementById('btnSubmitIssue');
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${StorageManager.API_BASE}/support/tickets`, {
            method: 'POST',
            headers: { role: 'manager' },
            body: formData,
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(Array.isArray(body.message) ? body.message.join(', ') : (body.message || 'Could not submit your issue.'));
        }

        showToast('Your issue has been submitted. Our support team will review it.');
        document.getElementById('issueForm').reset();
        selectedFiles = [];
        renderFileChips();
        await loadTickets(managerId);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

async function init() {
    await StorageManager.ready();
    const ids = StorageManager._getIds();
    const managerId = ids.managerId;

    if (!managerId) {
        document.getElementById('ticketList').innerHTML = '<p class="empty-state">Please log in again to view and raise issues.</p>';
        return;
    }

    loadTickets(managerId);

    document.getElementById('iptAttachments').addEventListener('change', (event) => {
        const incoming = Array.from(event.target.files || []);
        selectedFiles = [...selectedFiles, ...incoming].slice(0, 5);
        renderFileChips();
        event.target.value = '';
    });

    document.getElementById('issueForm').addEventListener('submit', (event) => submitIssue(event, managerId));
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => showToast(error.message || 'Failed to load page.', 'error'));
});
