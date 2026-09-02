let tableList = [];
let currentFilter = 'All';
let editingTableId = null;
let currentDate = '';
const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';

function toIsoDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function apiRequest(path, options = {}, role = 'staff') {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            role,
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Auth Guard
function checkAuth() {
    const session = sessionStorage.getItem('dinetime_session');
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    currentDate = toIsoDate(new Date());
    const dateInput = document.getElementById('staff-date-selector');
    if (dateInput) {
        dateInput.value = currentDate;
    }
    loadProfileName();
    await loadTablesFromStorage();
    setupEventListeners();
    updateStats();
    renderTables();
});

// Load saved profile name from storage
function loadProfileName() {
    const saved = sessionStorage.getItem('dinetime_profile');
    if (saved) {
        const data = JSON.parse(saved);
        if (data.name) {
            const userNameEl = document.querySelector('.user-name');
            if (userNameEl) userNameEl.textContent = data.name;
        }
    }
}

async function loadTablesFromStorage() {
    const [tablesRes, slotsRes, tableSlotsRes] = await Promise.all([
        apiRequest('/tables', {}, 'staff'),
        apiRequest('/timeslots', {}, 'staff'),
        apiRequest('/tableslots', {}, 'staff'),
    ]);

    const session = JSON.parse(sessionStorage.getItem('dinetime_session') || '{}');
    const restaurantId = session.restaurant_id || '';

    const statusRank = { occupied: 3, reserved: 2, available: 1 };
    const statusByTable = {};

    const filteredTables = (tablesRes?.data || []).filter((table) =>
        !restaurantId || table.restaurant_id === restaurantId,
    );
    const daySlots = (slotsRes?.data || []).filter((slot) =>
        (!restaurantId || slot.restaurant_id === restaurantId) &&
        (slot.slot_date || slot.date) === currentDate,
    );
    const daySlotIds = new Set(daySlots.map((slot) => slot.id));

    (tableSlotsRes?.data || []).forEach((slot) => {
        if (!daySlotIds.has(slot.slot_id)) return;
        const current = statusByTable[slot.table_id] || 'available';
        const next = slot.status || 'available';
        if ((statusRank[next] || 0) >= (statusRank[current] || 0)) {
            statusByTable[slot.table_id] = next;
        }
    });

    const statusMap = {
        occupied: 'Occupied',
        reserved: 'Reserved',
        available: 'Available',
    };

    tableList = filteredTables.map((table) => ({
        id: table.table_number,
        seats: table.capacity,
        table_id: table.id,
        slot_ids: daySlots.map((slot) => slot.id),
        status: statusMap[statusByTable[table.id] || 'available'] || 'Available',
    }));
}

function saveTablesToStorage() {
    return;
}

// Update the summary counts based on the current tableList
function updateStats() {
    const total = tableList.length;
    const available = tableList.filter(t => t.status === 'Available').length;
    const reserved = tableList.filter(t => t.status === 'Reserved').length;
    const occupied = tableList.filter(t => t.status === 'Occupied').length;

    document.getElementById('total-tables').innerText = total;
    document.getElementById('available-count').innerText = available;
    document.getElementById('reserved-count').innerText = reserved;
    document.getElementById('occupied-count').innerText = occupied;
}

// Bind event listeners for the filter chips and modal
function setupEventListeners() {
    const dateInput = document.getElementById('staff-date-selector');
    if (dateInput) {
        dateInput.addEventListener('change', async () => {
            currentDate = dateInput.value || toIsoDate(new Date());
            await loadTablesFromStorage();
            updateStats();
            renderTables();
        });
    }

    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            currentFilter = chip.getAttribute('data-status');
            renderTables();
        });
    });

    const modal = document.getElementById('status-modal');
    const closeBtn = document.getElementById('close-status-modal');
    const cancelBtn = document.getElementById('cancel-status-btn');
    const saveBtn = document.getElementById('save-status-btn');

    const closeModal = () => modal.classList.remove('active');

    if (closeBtn && cancelBtn && modal) {
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (editingTableId === null) return;
            
            const newStatus = document.getElementById('new-status-select').value;
            const tableIndex = tableList.findIndex(t => t.id === editingTableId);
            
            if (tableIndex !== -1) {
                tableList[tableIndex].status = newStatus;

                const slotStatusMap = {
                    Occupied: 'occupied',
                    Reserved: 'reserved',
                    Available: 'available',
                };
                try {
                    const targetSlots = tableList[tableIndex].slot_ids || [];
                    if (targetSlots.length === 0) {
                        throw new Error('No time slots configured for selected date');
                    }
                    await Promise.all(targetSlots.map((slotId) =>
                        apiRequest('/tableslots/status', {
                            method: 'PATCH',
                            body: JSON.stringify({
                                table_id: tableList[tableIndex].table_id,
                                slot_id: slotId,
                                status: slotStatusMap[newStatus] || 'available',
                            }),
                        }, 'staff'),
                    ));
                    await loadTablesFromStorage();
                } catch (_e) {
                }
                
                saveTablesToStorage();
                updateStats();
                renderTables();
                closeModal();
            }
        });
    }
}

// Render the 20 table cards into the floor-map grid
function renderTables() {
    const container = document.getElementById('floor-map');
    if (!container) return;

    container.innerHTML = '';
    const label = document.getElementById('floor-date-label');
    if (label) {
        const dateObj = new Date(currentDate);
        label.textContent = Number.isNaN(dateObj.getTime())
            ? currentDate
            : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const filteredTables = tableList.filter(t => 
        currentFilter === 'All' || t.status === currentFilter
    );

    filteredTables.forEach(table => {
        const card = document.createElement('div');
        const statusClass = table.status.toLowerCase();
        card.className = `table-card ${statusClass}`;

        // Details hidden for all statuses as requested
        let detailHtml = '';

        card.innerHTML = `
            <div class="table-header">
                <span class="table-number">Table ${table.id}</span>
                <span class="table-seats"><i class="fa-solid fa-users"></i> ${table.seats} Seats</span>
            </div>
            <div class="table-body">
                <span class="table-status-label">${table.status}</span>
                ${detailHtml}
            </div>
        `;

        card.addEventListener('click', () => {
            editingTableId = table.id;
            document.getElementById('modal-table-num').innerText = `Table ${table.id}`;
            document.getElementById('modal-table-seats').innerText = `${table.seats} Seats`;
            document.getElementById('modal-table-status').innerText = table.status;
            document.getElementById('new-status-select').value = table.status;
            
            document.getElementById('status-modal').classList.add('active');
        });

        container.appendChild(card);
    });
}
