// Plain JavaScript array and global filters
let bookingList = [];
let expandedBookingIds = new Set();
let currentStaffRestaurant = 'Spice Garden';
let currentStaffRestaurantId = '';
let refreshTimer = null;
const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';
let filters = {
    search: '',
    date: new Date().toLocaleDateString('en-CA'), // Default to local current date (YYYY-MM-DD)
    time: 'All'         // Default to all times
};

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
    const sessionData = JSON.parse(session);
    if (sessionData && sessionData.restaurant) {
        currentStaffRestaurant = sessionData.restaurant;
        currentStaffRestaurantId = sessionData.restaurant_id || '';
        // Dynamically update the header text
        const brandTextEl = document.querySelector('.brand-text span');
        if (brandTextEl) {
            brandTextEl.textContent = currentStaffRestaurant;
        }
    }
    return true;
}

// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    loadProfileName();
    try {
        await loadBookingsFromStorage();
    } catch (_error) {
        bookingList = [];
        showToast('Unable to load reservations from backend.', 'error');
    }
    setupEventListeners();
    
    // Set initial UI states for filters
    const dateInput = document.getElementById('filter-date');
    if (dateInput) {
        dateInput.value = filters.date;
    }
    
    updateStats();
    renderBookings();
    startAutoRefresh();
});

function startAutoRefresh() {
    if (refreshTimer) return;
    refreshTimer = setInterval(async () => {
        try {
            await loadBookingsFromStorage();
            updateStats();
            renderBookings();
        } catch (_e) {
        }
    }, 15000);

    window.addEventListener('focus', async () => {
        try {
            await loadBookingsFromStorage();
            updateStats();
            renderBookings();
        } catch (_e) {
        }
    });
}

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

// Load booking items from backend APIs
async function loadBookingsFromStorage() {
    const reservationPath = currentStaffRestaurantId
        ? `/reservations?restaurant_id=${currentStaffRestaurantId}`
        : '/reservations';
    const [reservationsRes, slotsRes, tablesRes, usersRes] = await Promise.all([
        apiRequest(reservationPath, {}, 'staff'),
        apiRequest('/timeslots', {}, 'staff'),
        apiRequest('/tables', {}, 'staff'),
        apiRequest('/users', {}, 'manager'),
    ]);

    const slots = slotsRes?.data || [];
    const tables = tablesRes?.data || [];
    const users = usersRes?.data || [];

    const slotMap = {};
    slots.forEach((slot) => { slotMap[slot.id] = slot; });
    const tableMap = {};
    tables.forEach((table) => { tableMap[table.id] = table; });
    const userMap = {};
    users.forEach((user) => { userMap[user.id] = user; });

    const statusMap = {
        reserved: 'Upcoming',
        checked_in: 'Checked-In',
        completed: 'Checked-In',
        cancelled: 'No-Show',
        no_show: 'No-Show',
    };

    const rawReservations = (reservationsRes?.data || []).filter((reservation) =>
        !currentStaffRestaurantId || reservation.restaurant_id === currentStaffRestaurantId,
    );

    bookingList = rawReservations.map((reservation) => {
        const slot = slotMap[reservation.slot_id];
        const table = tableMap[reservation.table_id];
        const user = userMap[reservation.user_id];
        const statusValue = reservation.reservation_status || reservation.status;
        return {
            id: reservation.id,
            reservation_id: reservation.id,
            user_id: reservation.user_id,
            restaurant_id: reservation.restaurant_id,
            name: user?.name || `Guest ${reservation.user_id.slice(-4)}`,
            phone: user?.phone || '-',
            email: user?.email || 'guest@example.com',
            date: slot?.slot_date || slot?.date || new Date().toLocaleDateString('en-CA'),
            time: slot?.start_time || '19:00',
            guests: reservation.guest_count,
            table: table ? `Table ${table.table_number}` : 'Table',
            table_id: reservation.table_id,
            slot_id: reservation.slot_id,
            status: statusMap[statusValue] || 'Upcoming',
            no_show_eligible: Boolean(reservation.no_show_eligible),
            restaurant: currentStaffRestaurant,
        };
    });

    // Dynamically populate Walk-In Table dropdown
    const walkinTableSelect = document.getElementById('walkin-table');
    if (walkinTableSelect) {
        const currentVal = walkinTableSelect.value;
        walkinTableSelect.innerHTML = '<option value="">Select Table...</option>';
        const restaurantTables = tables
            .filter(t => !currentStaffRestaurantId || t.restaurant_id === currentStaffRestaurantId)
            .sort((a, b) => Number(a.table_number) - Number(b.table_number));
            
        restaurantTables.forEach(t => {
            const option = document.createElement('option');
            option.value = `Table ${t.table_number}`;
            option.textContent = `Table ${t.table_number} (${t.capacity} Seater)`;
            walkinTableSelect.appendChild(option);
        });
        if (currentVal) walkinTableSelect.value = currentVal;
    }
}

// Save the current bookingList back to local storage
async function saveBookingsToStorage() {
    const statusMap = {
        'Upcoming': 'reserved',
        'Checked-In': 'checked_in',
        'No-Show': 'no_show',
    };

    await Promise.all(
        bookingList
            .filter((booking) => booking.reservation_id)
            .map((booking) =>
                apiRequest(`/reservations/${booking.reservation_id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ reservation_status: statusMap[booking.status] || 'reserved' }),
                }, 'staff'),
            ),
    );
}

// Logic to update a table status in the central dinetime_tables storage
function updateTableStatus(_tableId, _newStatus, _guestsCount = 0) {
}

function toMinutes(timeText) {
    const [hRaw, mRaw] = (timeText || '00:00').split(':');
    return (parseInt(hRaw, 10) * 60) + parseInt(mRaw, 10);
}

async function ensureWalkinDiner(name, phone) {
    const usersRes = await apiRequest('/users', {}, 'manager');
    const users = usersRes?.data || [];

    const existing = users.find((u) =>
        u.role === 'diner' &&
        (u.phone === phone || (u.email || '').toLowerCase() === `walkin.${phone}@dinetime.local`),
    );
    if (existing) {
        return existing;
    }

    const locationId = (users.find((u) => u.location_id) || {}).location_id || 'loc_blr_1';
    const created = await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
            name,
            email: `walkin.${phone}@dinetime.local`,
            phone,
            password_hash: `walkin_${phone}`,
            role: 'diner',
            status: 'active',
            location_id: locationId,
        }),
    }, 'manager');
    return created?.data;
}

async function createWalkinCheckin({ name, phone, guestsCount, tableNumber, time24 }) {
    const [tablesRes, slotsRes] = await Promise.all([
        apiRequest('/tables', {}, 'staff'),
        apiRequest('/timeslots', {}, 'staff'),
    ]);

    const table = (tablesRes?.data || []).find((t) =>
        Number(t.table_number) === Number(tableNumber) &&
        (!currentStaffRestaurantId || t.restaurant_id === currentStaffRestaurantId),
    );
    if (!table) {
        throw new Error('Selected table is not available in backend.');
    }

    const today = new Date().toLocaleDateString('en-CA');
    const slotsToday = (slotsRes?.data || []).filter((s) =>
        s.restaurant_id === table.restaurant_id && (s.slot_date || s.date) === today,
    );
    if (!slotsToday.length) {
        throw new Error('No active time slots available for today.');
    }

    const targetMinutes = toMinutes(time24);
    const sortedByDistance = [...slotsToday].sort((a, b) => {
        const da = Math.abs(toMinutes(a.start_time) - targetMinutes);
        const db = Math.abs(toMinutes(b.start_time) - targetMinutes);
        return da - db;
    });

    const tableSlotsRes = await apiRequest('/tableslots', {}, 'staff');
    const tableSlots = tableSlotsRes?.data || [];
    const chosenSlot = sortedByDistance.find((slot) =>
        tableSlots.some((ts) => ts.table_id === table.id && ts.slot_id === slot.id && ts.status === 'available'),
    );

    if (!chosenSlot) {
        throw new Error('The selected table has no available slot near this time.');
    }

    const diner = await ensureWalkinDiner(name, phone);
    const reservationRes = await apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify({
            user_id: diner.id,
            restaurant_id: table.restaurant_id,
            table_id: table.id,
            slot_id: chosenSlot.id,
            guest_count: Number(guestsCount),
        }),
    }, 'diner');

    const reservation = reservationRes?.data;
    const session = JSON.parse(sessionStorage.getItem('dinetime_session') || '{}');
    if (reservation?.id && session.id) {
        await apiRequest('/checkin', {
            method: 'POST',
            body: JSON.stringify({
                reservation_id: reservation.id,
                staff_id: session.id,
            }),
        }, 'staff');
    }

    return { reservation, chosenSlot, table, diner };
}

// Helper to convert 24h (14:30) to 12h (2:30 PM)
function convertTo12Hour(time24) {
    if (!time24) return 'All';
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const m = minutes;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${h}:${m} ${ampm}`;
}

// Bind top-level interaction logic
function setupEventListeners() {
    // 1. Search filter
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filters.search = e.target.value.toLowerCase();
            renderBookings();
        });
    }

    // 2. Date filter
    const dateInput = document.getElementById('filter-date');
    if (dateInput) {
        dateInput.addEventListener('change', (e) => {
            filters.date = e.target.value;
            renderBookings();
        });
    }

    // 3. Time slot input (Flexible Time)
    const timeSlotInput = document.getElementById('time-slot-input');
    if (timeSlotInput) {
        timeSlotInput.addEventListener('input', (e) => {
            const val = e.target.value;
            filters.time = convertTo12Hour(val);
            const timeDisplay = document.getElementById('selected-time-slot');
            if (timeDisplay) {
                timeDisplay.innerText = filters.time === 'All' ? 'All Times' : filters.time;
            }
            renderBookings();
        });
    }

    // 4. Notifications modal
    const bellBtn = document.getElementById('notification-bell');
    const notifyModal = document.getElementById('notifications-modal');
    const closeNotify = document.getElementById('close-notifications');

    if (bellBtn && notifyModal && closeNotify) {
        bellBtn.addEventListener('click', () => {
            notifyModal.classList.add('active');
        });

        closeNotify.addEventListener('click', () => {
            notifyModal.classList.remove('active');
        });

        // Close on clicking overlay
        notifyModal.addEventListener('click', (e) => {
            if (e.target === notifyModal) {
                notifyModal.classList.remove('active');
            }
        });
    }

    // 5. Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('dinetime_session');
            window.location.href = 'login.html';
        });
    }

    // 6. Add Walk-In modal logic
    const addTrigger = document.getElementById('add-walkin-trigger');
    const walkinModal = document.getElementById('add-walkin-modal');
    const closeWalkin = document.getElementById('close-walkin-modal');
    const cancelWalkin = document.getElementById('cancel-walkin');
    const walkinForm = document.getElementById('add-walkin-form');

    if (addTrigger && walkinModal) {
        addTrigger.addEventListener('click', () => {
            walkinModal.classList.add('active');
            // Default walk-in time to now
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            document.getElementById('walkin-time').value = `${h}:${m}`;
        });

        const closeModalFunc = () => {
            walkinModal.classList.remove('active');
            walkinForm.reset();
        };

        closeWalkin.addEventListener('click', closeModalFunc);
        cancelWalkin.addEventListener('click', closeModalFunc);
        
        walkinModal.addEventListener('click', (e) => {
            if (e.target === walkinModal) closeModalFunc();
        });

        walkinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tableNumStr = document.getElementById('walkin-table').value;
            const tableId = parseInt(tableNumStr.replace('Table ', ''), 10);
            const guestsCount = document.getElementById('walkin-guests').value;

            const name = document.getElementById('walkin-name').value;
            const phone = document.getElementById('walkin-phone').value;
            const attendees = document.getElementById('walkin-guests').value;
            const timeVal = document.getElementById('walkin-time').value;

            if (!/^\d{10}$/.test(phone)) {
                showToast('Phone number must be exactly 10 digits.', 'error');
                return;
            }

            try {
                const { reservation, chosenSlot, table, diner } = await createWalkinCheckin({
                    name,
                    phone,
                    guestsCount,
                    tableNumber: tableId,
                    time24: timeVal,
                });

                bookingList.unshift({
                    id: reservation.id,
                    reservation_id: reservation.id,
                    user_id: reservation.user_id,
                    restaurant_id: reservation.restaurant_id,
                    name: diner.name,
                    phone,
                    email: diner.email,
                    guests: attendees,
                    time: chosenSlot.start_time,
                    date: chosenSlot.slot_date || chosenSlot.date,
                    status: 'Checked-In',
                    table: `Table ${table.table_number}`,
                    table_id: table.id,
                    slot_id: chosenSlot.id,
                    restaurant: currentStaffRestaurant,
                });

                updateStats();
                renderBookings();
                closeModalFunc();
                showToast('Guest verified and added to today\'s list!');
            } catch (error) {
                showToast(error.message || 'Unable to add walk-in to backend.', 'error');
            }
        });
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type === 'error' ? 'error' : ''}`;
    const icon = type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showConfirmModal(title, message, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const btnCancel = document.getElementById('btnModalCancel');
    const btnConfirm = document.getElementById('btnModalConfirm');

    if (!overlay || !titleEl || !msgEl) return;

    titleEl.innerText = title;
    msgEl.innerText = message;
    overlay.classList.add('active');

    const closeModal = () => {
        overlay.classList.remove('active');
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
    };

    btnConfirm.onclick = () => {
        onConfirm();
        closeModal();
    };
    btnCancel.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
}

// Helper to extract table ID from "Table X" string
function parseTableId(tableStr) {
    if (!tableStr || typeof tableStr !== 'string') return null;
    const match = tableStr.match(/Table (\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Render out the dynamic list of reservations from our JS array
function renderBookings() {
    const container = document.getElementById('bookings-list');
    if (!container) return;
    
    container.innerHTML = ''; 

    // Apply combined filters (AND logic)
    const filteredList = bookingList.filter(booking => {
        // Enforce restaurant routing
        const bookingRest = booking.restaurant || 'Spice Garden';
        if (bookingRest !== currentStaffRestaurant) return false;

        const matchesSearch = !filters.search || 
                             booking.name.toLowerCase().includes(filters.search) || 
                             booking.id.toLowerCase().includes(filters.search);
        
        const matchesDate = !filters.date || booking.date === filters.date;
        const matchesTime = filters.time === 'All' || booking.time === filters.time;

        return matchesSearch && matchesDate && matchesTime;
    });

    // Toggle showing status logic
    const timeDisplay = document.getElementById('selected-time-slot');
    if (timeDisplay) {
        timeDisplay.innerText = filters.time === 'All' ? 'All Times' : filters.time;
    }

    // Check if list is empty
    if (filteredList.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color:var(--text-muted); background:white; border-radius:12px;">
                <i class="fa-regular fa-calendar-xmark" style="font-size:2rem; margin-bottom:12px; display:block;"></i>
                No reservations found for the selected filters.
            </div>
        `;
    }

    filteredList.forEach(booking => {
        const item = document.createElement('div');
        const isExpanded = expandedBookingIds.has(booking.id);
        
        item.className = `booking-item ${isExpanded ? 'expanded' : ''}`;
        item.dataset.id = booking.id;

        // Figure out status aesthetics
        let statusClass = 'upcoming';
        if (booking.status === 'Checked-In') statusClass = 'checked-in';
        if (booking.status === 'No-Show') statusClass = 'noshow';

        const initials = booking.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        item.innerHTML = `
            <div class="customer-info" style="grid-column: 1 / 2;">
                <div class="customer-avatar">${initials}</div>
                <div class="customer-details">
                    <h4>${booking.name} <span class="status-badge ${statusClass}">• ${booking.status === 'Checked-In' ? 'Verified' : booking.status}</span>${booking.status === 'Upcoming' && booking.no_show_eligible ? ' <span class="status-badge noshow" title="Past the no-show grace period">• Overdue</span>' : ''}</h4>
                    <span class="booking-id"># ${booking.id}</span>
                </div>
            </div>

            <div class="action-buttons" style="grid-column: 3 / 4; justify-self: end;">
                <button class="action-icon" title="Contact Customer"><i class="fa-solid fa-phone"></i></button>
                <button class="action-icon view-btn ${isExpanded ? 'active' : ''}" title="View Details">
                    <i class="fa-regular fa-eye"></i>
                </button>
                ${booking.status === 'Upcoming' ? `
                    <button class="action-icon delete delete-btn" title="Mark as No-Show"><i class="fa-solid fa-user-xmark"></i></button>
                    <button class="btn-green check-in-btn"><i class="fa-regular fa-circle-check"></i> Check In</button>
                ` : ''}
                ${booking.status === 'Checked-In' ? `
                    <button class="btn-secondary" style="border-color:#ecfdf5; background:#ecfdf5; color:var(--success-green); cursor:default;" disabled><i class="fa-solid fa-circle-check"></i> Verified</button>
                ` : ''}
                ${booking.status === 'No-Show' ? `
                    <button class="btn-secondary" style="border-color:#fee2e2; background:#fef2f2; color:var(--error-red); cursor:default;" disabled><i class="fa-solid fa-user-xmark"></i> No-Show</button>
                ` : ''}
            </div>
            
            <div class="reservation-details" style="grid-column: 1 / 4;">
                <div class="detail-col">
                    <span class="detail-label">Reservation ID</span>
                    <span class="detail-value" style="font-weight: 600; color: #1D1D1D;">${booking.id}</span>
                </div>
                <div class="detail-col">
                    <span class="detail-label">Time Slot</span>
                    <span class="detail-value" style="font-weight: 600; color: #1D1D1D;">${booking.time}</span>
                </div>
                <div class="detail-col">
                    <span class="detail-label">Party Size</span>
                    <span class="detail-value" style="font-weight: 600; color: #1D1D1D;">${booking.guests} Guests</span>
                </div>
                <div class="detail-col">
                    <span class="detail-label">Table Assigned</span>
                    <span class="detail-value" style="font-weight: 600; color: #1D1D1D;">${booking.table}</span>
                </div>
                <div class="detail-col">
                    <span class="detail-label">Contact</span>
                    <span class="detail-value" style="font-weight: 600; color: #1D1D1D;">${booking.phone}</span>
                </div>
                <div class="detail-col">
                    <span class="detail-label">Status</span>
                    <span class="detail-value" style="font-weight: 600; color: #1D1D1D; text-transform: capitalize;">${booking.status}</span>
                </div>
            </div>
        `;

        // Toggle Details click handler
        const viewBtn = item.querySelector('.view-btn');
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (expandedBookingIds.has(booking.id)) {
                expandedBookingIds.delete(booking.id);
            } else {
                expandedBookingIds.add(booking.id);
            }
            renderBookings();
        });

        // No-Show click handler
        const noShowBtn = item.querySelector('.delete-btn');
        if (noShowBtn) {
            noShowBtn.addEventListener('click', () => {
                showConfirmModal(
                    'Mark No-Show',
                    `Mark ${booking.name} as a No-Show for this reservation?`,
                    async () => {
                        booking.status = 'No-Show';
                        await saveBookingsToStorage();
                        
                        renderBookings();
                        updateStats();
                        showToast('Customer marked as No-Show.', 'error');
                    }
                );
            });
        }
        
        // Check-in click handler
        const checkInBtn = item.querySelector('.check-in-btn');
        if(checkInBtn) {
            checkInBtn.addEventListener('click', () => {
                showConfirmModal(
                    'Verify Check-In',
                    `Customer: ${booking.name}\nContact: ${booking.phone}\nGuests: ${booking.guests}\nAssigned: ${booking.table}\n\nProceed to check in this customer?`,
                    async () => {
                        booking.status = 'Checked-In';
                        const session = JSON.parse(sessionStorage.getItem('dinetime_session') || '{}');
                        if (booking.reservation_id && session.id) {
                            try {
                                await apiRequest('/checkin', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        reservation_id: booking.reservation_id,
                                        staff_id: session.id,
                                    }),
                                }, 'staff');
                            } catch (_e) {
                                await saveBookingsToStorage();
                            }
                        } else {
                            await saveBookingsToStorage();
                        }
                        
                        renderBookings();
                        updateStats();
                        showToast(`Check-In successful for ${booking.name}.`);
                    }
                );
            });
        }

        container.appendChild(item);
    });

    // Update list badge logic
    const totalBadge = document.getElementById('list-total-badge');
    if (totalBadge) totalBadge.innerText = `${filteredList.length} total`;

    // Update the Summary Cards based on the current filter
    updateStats(filteredList);
}

// Computes derived arrays and populates basic summary fields from a specific list (usually filtered)
function updateStats(list = null) {
    if (!list) {
        list = bookingList.filter(b => (b.restaurant || 'Spice Garden') === currentStaffRestaurant);
    }
    const total = list.length;
    const checked = list.filter(b => b.status === 'Checked-In').length;
    const noshow = list.filter(b => b.status === 'No-Show').length;
    const pending = total - checked - noshow;

    const elTotal = document.getElementById('total-count');
    const elChecked = document.getElementById('checked-count');
    const elPending = document.getElementById('pending-count');
    const elNoShow = document.getElementById('noshow-count');

    if (elTotal) elTotal.innerText = total;
    if (elChecked) elChecked.innerText = checked;
    if (elPending) elPending.innerText = pending;
    if (elNoShow) elNoShow.innerText = noshow;
}
