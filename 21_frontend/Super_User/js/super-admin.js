const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';
const API_ROLE = 'super_user';
const STORAGE_KEYS = {
  activeTab: 'dt_active_tab_v6',
};



const ROLE_LABELS = {
  diner: 'Diner',
  manager: 'Restaurant Manager',
  staff: 'Restaurant Staff',
  super_user: 'Super User',
};

const ROLE_VALUES = {
  Diner: 'diner',
  'Restaurant Manager': 'manager',
  'Restaurant Staff': 'staff',
};

const state = {
  restaurants: [],
  users: [],
  reservations: [],
  notifications: [],
  tables: [],
  timeslots: [],
  tableSlots: [],
  locations: {},
  auditLog: [],
  refreshTimer: null,
  subAdmins: [],
  tickets: [],
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function writeJson(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function getAuditLog() {
  return state.auditLog;
}

function addAuditLog(message) {
  state.auditLog.push({
    time: new Date().toLocaleTimeString('en-GB'),
    message,
  });
  renderAuditLogs();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      role: API_ROLE,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message || message);
    } catch (_error) {
    }
    throw new Error(message);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function mapRestaurantStatus(status) {
  return status === 'active' ? 'Verified' : 'Pending';
}

function mapUserStatus(status) {
  return status === 'active' ? 'Active' : 'Suspended';
}

function mapReservationStatus(status) {
  if (status === 'checked_in') return 'Customer Check-In';
  if (status === 'cancelled' || status === 'no_show') return 'No-Show';
  if (status === 'completed') return 'Completed';
  return 'Booking';
}

function toBackendReservationStatus(label) {
  if (label === 'Customer Check-In') return 'checked_in';
  if (label === 'No-Show') return 'no_show';
  if (label === 'Completed') return 'completed';
  return 'reserved';
}

function toBackendAccountStatus(label) {
  return label === 'Active' ? 'active' : 'inactive';
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function locationForRestaurant(restaurant) {
  return state.locations[restaurant.location_id] || null;
}

function restaurantsById() {
  return Object.fromEntries(state.restaurants.map((restaurant) => [restaurant.id, restaurant]));
}

function usersById() {
  return Object.fromEntries(state.users.map((user) => [user.id, user]));
}

function getRestaurantDisplay(restaurant) {
  const manager = state.users.find((user) => user.id === restaurant.manager_id);
  const location = locationForRestaurant(restaurant);
  const tables = state.tables.filter((table) => table.restaurant_id === restaurant.id);
  const reservations = state.reservations.filter((reservation) => reservation.restaurant_id === restaurant.id);
  const slots = state.timeslots
    .filter((slot) => slot.restaurant_id === restaurant.id)
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

  const timeSlots = Array.from(
    new Set(slots.map((slot) => `${String(slot.start_time).slice(0, 5)}-${String(slot.end_time).slice(0, 5)}`)),
  ).slice(0, 3).join(', ');

  return {
    id: restaurant.id,
    name: restaurant.name,
    cuisine: restaurant.cuisine_type,
    tables: tables.length || Number(restaurant.total_tables) || 0,
    address: location?.address || 'Address not set',
    city: location?.city || 'Unknown',
    pincode: location?.pincode || '',
    managerName: manager?.name || 'Unassigned',
    managerEmail: manager?.email || '',
    license: manager?.business_license_number || '',
    timeSlots: timeSlots || 'Not configured',
    status: mapRestaurantStatus(restaurant.status),
    activeReservations: reservations.filter((reservation) =>
      !['cancelled', 'completed', 'no_show'].includes(reservation.reservation_status)).length,
    manager_id: restaurant.manager_id,
    location_id: restaurant.location_id,
  };
}

function getUserDisplay(user) {
  const restaurant = user.role === 'manager'
    ? state.restaurants.find((item) => item.manager_id === user.id)
    : state.restaurants.find((item) => item.id === user.restaurant_id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleLabel(user.role),
    node: restaurant?.name || 'N/A',
    status: mapUserStatus(user.status),
    restaurant_id: restaurant?.id || user.restaurant_id || '',
    business_license_number: user.business_license_number || '',
    location_id: user.location_id || restaurant?.location_id || '',
  };
}

function getReservationDisplay(reservation) {
  const user = state.users.find((item) => item.id === reservation.user_id);
  const restaurant = state.restaurants.find((item) => item.id === reservation.restaurant_id);
  const slot = state.timeslots.find((item) => item.id === reservation.slot_id);
  return {
    id: reservation.id,
    dinerName: user?.name || 'Guest',
    dinerId: reservation.user_id,
    restaurantName: restaurant?.name || 'Restaurant',
    restaurantId: reservation.restaurant_id,
    date: slot?.slot_date || '',
    time: String(slot?.start_time || '').slice(0, 5),
    party: reservation.guest_count,
    status: mapReservationStatus(reservation.reservation_status),
    raw: reservation,
  };
}

async function syncAdminState() {
  const endpoints = [
    '/restaurants',
    '/users',
    '/reservations',
    '/tables',
    '/timeslots',
    '/tableslots',
    '/notifications',
    '/sub-admin',
    '/support/tickets',
  ];

  const settled = await Promise.allSettled(endpoints.map((path) => apiRequest(path)));
  const payloads = settled.map((result) => (result.status === 'fulfilled' ? result.value : null));
  const [
    restaurantsRes,
    usersRes,
    reservationsRes,
    tablesRes,
    timeslotsRes,
    tableSlotsRes,
    notificationsRes,
    subAdminsRes,
    ticketsRes,
  ] = payloads;

  state.restaurants = restaurantsRes?.data || state.restaurants;
  state.users = usersRes?.data || state.users;
  state.reservations = reservationsRes?.data || state.reservations;
  state.tables = tablesRes?.data || state.tables;
  state.timeslots = timeslotsRes?.data || state.timeslots;
  state.tableSlots = tableSlotsRes?.data || state.tableSlots;
  state.notifications = notificationsRes?.data || state.notifications;
  state.subAdmins = subAdminsRes?.data || state.subAdmins;
  state.tickets = ticketsRes?.data || state.tickets;

  const locationIds = Array.from(new Set(state.restaurants.map((restaurant) => restaurant.location_id).filter(Boolean)));
  const locationEntries = await Promise.all(locationIds.map(async (locationId) => {
    try {
      const response = await apiRequest(`/restaurants/locations/${locationId}`);
      return [locationId, response?.data || null];
    } catch (_error) {
      return [locationId, null];
    }
  }));

  state.locations = Object.fromEntries(locationEntries);

  renderAll();
}

function startAutoRefresh() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
  }

  state.refreshTimer = setInterval(() => {
    syncAdminState().catch(() => {});
  }, 15000);

  window.addEventListener('focus', () => {
    syncAdminState().catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncAdminState().catch(() => {});
    }
  });
}

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
  }, 3000);
}

function showConfirmModal(title, message, onConfirm) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const messageEl = document.getElementById('modal-message');
  const confirmBtn = document.getElementById('btnModalConfirm');
  const cancelBtn = document.getElementById('btnModalCancel');
  if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
  overlay.style.display = 'flex';

  const close = () => {
    overlay.style.display = 'none';
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  cancelBtn.onclick = close;
  confirmBtn.onclick = async () => {
    close();
    await onConfirm();
  };
}

function updateAllKPIs() {
  const activeReservations = state.reservations.filter((reservation) =>
    !['cancelled', 'completed', 'no_show'].includes(reservation.reservation_status));
  const pendingRestaurants = state.restaurants.filter((restaurant) => restaurant.status !== 'active').length;
  const dinerCount = state.users.filter((user) => user.role === 'diner').length;

  const byId = (id) => document.getElementById(id);
  if (byId('dashTotalBookings')) byId('dashTotalBookings').textContent = String(activeReservations.length);
  if (byId('dashTotalUsers')) byId('dashTotalUsers').textContent = String(dinerCount);
  if (byId('dashTotalRes')) byId('dashTotalRes').textContent = String(state.restaurants.length);
  if (byId('dashPendingApps')) byId('dashPendingApps').textContent = String(pendingRestaurants);
  if (byId('resTabTotalRes')) byId('resTabTotalRes').textContent = String(state.restaurants.length);
  if (byId('resTabActiveBooks')) byId('resTabActiveBooks').textContent = String(activeReservations.length);
  if (byId('resTabTotalCapacity')) {
    byId('resTabTotalCapacity').textContent = String(
      state.tables.length || state.restaurants.reduce((sum, restaurant) => sum + Number(restaurant.total_tables || 0), 0),
    );
  }
}

function renderGlobalTable() {
  const tbody = document.getElementById('globalRestaurantsBody');
  if (!tbody) return;

  const query = (document.getElementById('resDirectorySearch')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('resStatusFilter')?.value || '';

  const rows = state.restaurants
    .map(getRestaurantDisplay)
    .filter((restaurant) => {
      const matchesQuery = !query
        || restaurant.name.toLowerCase().includes(query)
        || restaurant.city.toLowerCase().includes(query)
        || restaurant.id.toLowerCase().includes(query)
        || restaurant.managerName.toLowerCase().includes(query);
      const matchesStatus = !statusFilter || restaurant.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

  tbody.innerHTML = '';
  rows.forEach((restaurant) => {
    const statusColor = restaurant.status === 'Verified' ? '#2E7D32' : '#F57F17';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <code style="color:var(--text-muted)">${escapeHtml(restaurant.id)}</code><br>
        <b style="display:inline-block; margin-top:4px;">${escapeHtml(restaurant.name)}</b><br>
        <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(restaurant.cuisine)} • ${escapeHtml(restaurant.city)}</span>
      </td>
      <td>${escapeHtml(String(restaurant.tables))} tables<br><span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(String(restaurant.activeReservations))} active bookings</span></td>
      <td>${escapeHtml(restaurant.managerName)}</td>
      <td style="color:${statusColor}; font-weight:700;">${escapeHtml(restaurant.status)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUsersTable() {
  const tbody = document.getElementById('globalUsersBody');
  if (!tbody) return;

  const query = (document.getElementById('userDirectorySearch')?.value || '').trim().toLowerCase();
  const roleFilter = document.getElementById('userRoleFilter')?.value || '';
  const statusFilter = document.getElementById('userStatusFilter')?.value || '';

  const subAdminRoles = ['super_user', 'support_admin', 'finance_admin', 'verification_admin'];
  const rows = state.users
    .filter((user) => !subAdminRoles.includes(user.role))
    .map(getUserDisplay)
    .filter((user) => {
      const matchesQuery = !query
        || user.id.toLowerCase().includes(query)
        || user.name.toLowerCase().includes(query)
        || user.email.toLowerCase().includes(query)
        || user.role.toLowerCase().includes(query);
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesStatus = !statusFilter || user.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });

  tbody.innerHTML = '';
  rows.forEach((user) => {
    const statusColor = user.status === 'Active' ? '#2E7D32' : '#C62828';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <code style="color:var(--text-muted)">${escapeHtml(user.id)}</code><br>
        <b style="display:inline-block; margin-top:4px;">${escapeHtml(user.name)}</b><br>
        <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(user.email)}</span>
      </td>
      <td>${escapeHtml(user.role)}</td>
      <td>${escapeHtml(user.node)}</td>
      <td style="color:${statusColor}; font-weight:700;">${escapeHtml(user.status)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderReservationsTable() {
  const tbody = document.getElementById('globalReservationsBody');
  if (!tbody) return;

  const filterType = document.getElementById('resFilterType')?.value || 'restaurantName';
  const query = (document.getElementById('resSearchQuery')?.value || '').trim().toLowerCase();
  const dateFilter = document.getElementById('resSearchDate')?.value || '';
  const statusFilter = document.getElementById('resBookingStatusFilter')?.value || '';

  const rows = state.reservations
    .map(getReservationDisplay)
    .filter((reservation) => {
      if (dateFilter && reservation.date !== dateFilter) return false;
      if (statusFilter && reservation.status !== statusFilter) return false;
      if (!query) return true;
      const haystacks = {
        restaurantName: reservation.restaurantName.toLowerCase(),
        restaurantId: reservation.restaurantId.toLowerCase(),
        dinerName: reservation.dinerName.toLowerCase(),
        dinerId: reservation.dinerId.toLowerCase(),
      };
      return (haystacks[filterType] || '').includes(query);
    });

  tbody.innerHTML = '';
  rows.forEach((reservation) => {
    let badge = '<span class="badge badge-blue"><i class="fa-solid fa-calendar"></i> Booking</span>';
    if (reservation.status === 'Customer Check-In') {
      badge = '<span class="badge badge-green"><i class="fa-solid fa-check"></i> Check-In</span>';
    } else if (reservation.status === 'No-Show') {
      badge = '<span class="badge badge-red"><i class="fa-solid fa-triangle-exclamation"></i> No-Show</span>';
    } else if (reservation.status === 'Completed') {
      badge = '<span class="badge badge-green"><i class="fa-solid fa-flag-checkered"></i> Completed</span>';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code style="color:var(--text-muted)">${escapeHtml(reservation.id)}</code><br><span style="font-size:0.75rem;">${escapeHtml(reservation.date)} ${escapeHtml(reservation.time)}</span></td>
      <td><code style="background:#f0f0f0; padding:2px 4px; border-radius:4px; color:var(--text-muted); font-size:0.7rem;">${escapeHtml(reservation.dinerId)}</code><br><b style="display:inline-block; margin-top:4px;">${escapeHtml(reservation.dinerName)}</b></td>
      <td><code style="background:#f0f0f0; padding:2px 4px; border-radius:4px; color:var(--text-muted); font-size:0.7rem;">${escapeHtml(reservation.restaurantId)}</code><br><b style="display:inline-block; margin-top:4px;">${escapeHtml(reservation.restaurantName)}</b></td>
      <td>${escapeHtml(String(reservation.party))}</td>
      <td>${badge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAuditLogs() {
  const container = document.getElementById('auditLogsContainer');
  if (!container) return;

  const logData = getAuditLog();
  container.innerHTML = '';
  for (let index = logData.length - 1; index >= 0; index -= 1) {
    const log = logData[index];
    const div = document.createElement('div');
    div.style = 'display:flex; align-items:flex-start; gap:1rem; padding:1rem 1.25rem; border-bottom:1px solid var(--border-light);';
    div.innerHTML = `
      <div style="font-family:monospace; color:var(--text-muted); width:80px; flex-shrink:0; font-size:0.8rem;">${escapeHtml(log.time)}</div>
      <div style="color:var(--text-dark); font-size:0.9rem;">${escapeHtml(log.message)}</div>
    `;
    container.appendChild(div);
  }
}

function renderRecentActivity() {
  const container = document.getElementById('recentActivityContainer');
  if (!container) return;

  const items = [];

  // Pull most recent 3 reservations
  const sortedReservations = [...state.reservations]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 3);

  sortedReservations.forEach((reservation) => {
    const user = state.users.find((u) => u.id === reservation.user_id);
    const restaurant = state.restaurants.find((r) => r.id === reservation.restaurant_id);
    const status = reservation.reservation_status;
    let icon = 'fa-calendar-check';
    let color = '#1976D2';
    let label = 'New reservation';
    if (status === 'cancelled' || status === 'no_show') { icon = 'fa-triangle-exclamation'; color = '#C62828'; label = 'Reservation cancelled'; }
    else if (status === 'completed') { icon = 'fa-flag-checkered'; color = '#2E7D32'; label = 'Reservation completed'; }
    else if (status === 'checked_in') { icon = 'fa-circle-check'; color = '#2E7D32'; label = 'Customer checked in'; }
    const name = user?.name || 'A diner';
    const rest = restaurant?.name || 'a restaurant';
    items.push({ icon, color, text: `${escapeHtml(label)}: ${escapeHtml(name)} at ${escapeHtml(rest)}`, id: reservation.id });
  });

  if (items.length === 0) {
    container.innerHTML = '<div style="padding: 1.25rem; color: var(--text-muted); font-size: 0.875rem;">No recent activity yet.</div>';
    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div style="display: flex; gap: 1rem; padding: 1rem 1.25rem; ${index < items.length - 1 ? 'border-bottom: 1px solid var(--border-light);' : ''} align-items: center;">
      <i class="fa-solid ${escapeHtml(item.icon)}" style="color: ${item.color}; font-size: 1.1rem; width: 20px; text-align: center;"></i>
      <div style="font-weight: 500; font-size: 0.85rem; color: var(--text-dark);">${item.text}</div>
    </div>
  `).join('');
}

function renderAll() {
  updateAllKPIs();
  renderGlobalTable();
  renderUsersTable();
  renderReservationsTable();
  renderAuditLogs();
  renderRecentActivity();
  renderSubAdminsTable();
  renderTicketsTables();
}

function ensureRestaurantSelects() {
  const options = state.restaurants.map((restaurant) =>
    `<option value="${escapeHtml(restaurant.id)}">${escapeHtml(restaurant.name)}</option>`);
  const nodeSelect = document.getElementById('userNode');
  const reservationSelect = document.getElementById('bkgRestaurant');
  if (nodeSelect) {
    nodeSelect.innerHTML = '<option value="">Select Restaurant...</option>' + options.join('');
  }
  if (reservationSelect) {
    reservationSelect.innerHTML = '<option value="">Select Restaurant...</option>' + options.join('');
  }
}

function generatedLocationId() {
  return `loc_admin_${Date.now()}`;
}

function parseTimeTo24Hour(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = match[3].toUpperCase();
  if (suffix === 'AM' && hour === 12) hour = 0;
  if (suffix === 'PM' && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function parseOperatingHours(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 2) {
    return null;
  }

  const start = parseTimeTo24Hour(parts[0]);
  const end = parseTimeTo24Hour(parts[1]);
  if (!start || !end) {
    return null;
  }

  return { start, end };
}

async function ensureRestaurantInfrastructure(restaurantId, tableCount, hoursLabel) {
  const currentTables = state.tables.filter((table) => table.restaurant_id === restaurantId).length;
  if (currentTables === 0) {
    const capacityPattern = [2, 2, 4, 4, 4, 6, 6, 8];
    for (let index = 0; index < tableCount; index += 1) {
      await apiRequest('/tables', {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: restaurantId,
          table_number: index + 1,
          capacity: capacityPattern[index % capacityPattern.length],
        }),
      });
    }
  }

  const currentSlots = state.timeslots.filter((slot) => slot.restaurant_id === restaurantId).length;
  const parsedHours = parseOperatingHours(hoursLabel);
  if (currentSlots === 0 && parsedHours) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      const slotDate = date.toISOString().split('T')[0];
      await apiRequest('/timeslots', {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: restaurantId,
          slot_date: slotDate,
          start_time: parsedHours.start,
          end_time: parsedHours.end,
        }),
      });
    }
  }

  await apiRequest('/tableslots/seed', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: restaurantId }),
  });
}

async function saveRestaurant(event) {
  event.preventDefault();

  const formData = {
    id: document.getElementById('resId').value,
    name: document.getElementById('resName').value.trim(),
    cuisine: document.getElementById('resCuisine').value.trim(),
    tables: Number(document.getElementById('resTables').value || 0),
    address: document.getElementById('resAddress').value.trim(),
    city: document.getElementById('resCity').value.trim(),
    pincode: document.getElementById('resPincode').value.trim(),
    managerName: document.getElementById('resManagerName').value.trim(),
    managerEmail: document.getElementById('resManagerEmail').value.trim().toLowerCase(),
    license: document.getElementById('resLicense').value.trim(),
    timeSlots: document.getElementById('resTimeSlots').value.trim(),
    status: document.getElementById('resStatus').value,
  };

  const restaurantStatus = formData.status === 'Verified' ? 'active' : 'inactive';
  const verified = formData.status === 'Verified';

  let manager = state.users.find((user) => user.email.toLowerCase() === formData.managerEmail);
  if (manager && manager.role !== 'manager') {
    throw new Error('That email already belongs to a non-manager account');
  }

  if (!manager) {
    const createdManager = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.managerName,
        email: formData.managerEmail,
        password_hash: 'password123',
        role: 'manager',
        status: restaurantStatus,
        location_id: generatedLocationId(),
        business_license_number: formData.license,
        government_id: '',
        verified_status: verified,
      }),
    });
    manager = createdManager?.data;
  } else {
    await apiRequest(`/users/${manager.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: formData.managerName,
        email: formData.managerEmail,
        status: restaurantStatus,
        business_license_number: formData.license,
        verified_status: verified,
      }),
    });
  }

  const existingRestaurant = state.restaurants.find((restaurant) => restaurant.id === formData.id);
  const locationId = existingRestaurant?.location_id || manager.location_id || generatedLocationId();
  await apiRequest('/restaurants/locations', {
    method: 'POST',
    body: JSON.stringify({
      id: locationId,
      latitude: 12.9716,
      longitude: 77.5946,
      city: formData.city,
      pincode: formData.pincode,
      address: formData.address,
      country: 'India',
    }),
  });

  let restaurantId = formData.id;
  const payload = {
    manager_id: manager.id,
    location_id: locationId,
    name: formData.name,
    cuisine_type: formData.cuisine,
    description: `${formData.name} restaurant`,
    total_tables: formData.tables,
    status: restaurantStatus,
    image_urls: existingRestaurant?.image_urls || [],
  };

  if (existingRestaurant) {
    await apiRequest(`/restaurants/${existingRestaurant.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  } else {
    const created = await apiRequest('/restaurants', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    restaurantId = created?.data?.id;
  }

  if (restaurantId) {
    await syncAdminState();
    await ensureRestaurantInfrastructure(restaurantId, formData.tables, formData.timeSlots);
  }

  await syncAdminState();
  closeRestaurantModal();
  showToast(existingRestaurant ? 'Restaurant updated.' : 'Restaurant created.');
  addAuditLog(`${existingRestaurant ? 'Updated' : 'Created'} restaurant ${formData.name}`);
}

async function saveUser(event) {
  event.preventDefault();

  const id = document.getElementById('userId').value;
  const roleLabelValue = document.getElementById('userRole').value;
  const role = ROLE_VALUES[roleLabelValue];
  const restaurantId = document.getElementById('userNode').value;
  const payload = {
    name: document.getElementById('userName').value.trim(),
    email: document.getElementById('userEmail').value.trim().toLowerCase(),
    role,
    status: toBackendAccountStatus(document.getElementById('userStatus').value),
    password_hash: 'password123',
  };

  let result;
  if (id) {
    result = await apiRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...payload,
        restaurant_id: role === 'staff' ? restaurantId : undefined,
        employee_code: role === 'staff' ? `EMP-${Date.now().toString().slice(-4)}` : undefined,
      }),
    });
  } else {
    result = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        restaurant_id: role === 'staff' ? restaurantId : undefined,
        employee_code: role === 'staff' ? `EMP-${Date.now().toString().slice(-4)}` : undefined,
        role_type: role === 'staff' ? 'service' : undefined,
      }),
    });
  }

  const savedUser = result?.data;
  if (role === 'manager' && restaurantId && savedUser?.id) {
    const restaurant = state.restaurants.find((item) => item.id === restaurantId);
    if (restaurant) {
      await apiRequest(`/restaurants/${restaurant.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ manager_id: savedUser.id }),
      });
    }
  }

  await syncAdminState();
  closeUserModal();
  showToast(id ? 'User updated.' : 'User created.');
  addAuditLog(`${id ? 'Updated' : 'Created'} user ${payload.email}`);
}

async function createReservationFromForm(baseForm, desiredStatus) {
  const party = Number(baseForm.party);
  const restaurantId = baseForm.restaurantId;
  const dinerId = baseForm.dinerId;
  const slot = state.timeslots.find((item) =>
    item.restaurant_id === restaurantId
    && item.slot_date === baseForm.date
    && String(item.start_time).slice(0, 5) === baseForm.time);

  if (!slot) {
    throw new Error('No matching time slot exists for that restaurant/date/time');
  }

  const availableTableSlot = state.tableSlots.find((tableSlot) => {
    if (tableSlot.slot_id !== slot.id || tableSlot.status !== 'available') {
      return false;
    }

    const table = state.tables.find((item) => item.id === tableSlot.table_id);
    return table && table.restaurant_id === restaurantId && Number(table.capacity) >= party;
  });

  if (!availableTableSlot) {
    throw new Error('No available table matches that reservation');
  }

  const created = await apiRequest('/reservations', {
    method: 'POST',
    body: JSON.stringify({
      user_id: dinerId,
      restaurant_id: restaurantId,
      table_id: availableTableSlot.table_id,
      slot_id: slot.id,
      guest_count: party,
    }),
  });

  const reservation = created?.data;
  if (reservation?.id && desiredStatus && desiredStatus !== 'Booking') {
    await apiRequest(`/reservations/${reservation.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ reservation_status: toBackendReservationStatus(desiredStatus) }),
    });
  }

  return reservation;
}

async function saveReservation(event) {
  event.preventDefault();

  const existingId = document.getElementById('bkgId').value;
  const dinerName = document.getElementById('bkgDinerName').value.trim();
  const enteredDinerId = document.getElementById('bkgDinerId').value.trim();
  const restaurantId = document.getElementById('bkgRestaurant').value;
  const date = document.getElementById('bkgDate').value;
  const time = document.getElementById('bkgTime').value;
  const party = document.getElementById('bkgParty').value;
  const status = document.getElementById('bkgStatus').value;

  const diner = enteredDinerId
    ? state.users.find((user) => user.id === enteredDinerId)
    : state.users.find((user) => user.role === 'diner' && user.name.toLowerCase() === dinerName.toLowerCase());

  if (!diner) {
    throw new Error('Use an existing diner ID or exact diner name');
  }

  const formValues = {
    dinerId: diner.id,
    restaurantId,
    date,
    time,
    party,
  };

  if (!existingId) {
    await createReservationFromForm(formValues, status);
    await syncAdminState();
    closeReservationModal();
    showToast('Reservation created.');
    addAuditLog(`Created reservation for ${diner.name}`);
    return;
  }

  const existing = state.reservations.find((reservation) => reservation.id === existingId);
  const currentDisplay = getReservationDisplay(existing);
  const sameCoreDetails = currentDisplay.dinerId === diner.id
    && currentDisplay.restaurantId === restaurantId
    && currentDisplay.date === date
    && currentDisplay.time === time
    && Number(currentDisplay.party) === Number(party);

  if (sameCoreDetails) {
    await apiRequest(`/reservations/${existingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ reservation_status: toBackendReservationStatus(status) }),
    });
  } else {
    await createReservationFromForm(formValues, status);
    await apiRequest(`/reservations/${existingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ reservation_status: 'cancelled' }),
    });
  }

  await syncAdminState();
  closeReservationModal();
  showToast('Reservation updated.');
  addAuditLog(`Updated reservation ${existingId}`);
}

window.openRestaurantModal = function openRestaurantModal() {
  document.getElementById('superForm').reset();
  document.getElementById('resId').value = '';
  document.getElementById('superModalTitle').textContent = 'Add Restaurant';
  document.getElementById('superModal').style.display = 'flex';
};

window.closeRestaurantModal = function closeRestaurantModal() {
  document.getElementById('superModal').style.display = 'none';
};

window.editRestaurant = function editRestaurant(id) {
  const restaurant = state.restaurants.find((item) => item.id === id);
  if (!restaurant) return;
  const manager = state.users.find((item) => item.id === restaurant.manager_id);
  const location = locationForRestaurant(restaurant);
  const display = getRestaurantDisplay(restaurant);

  document.getElementById('resId').value = restaurant.id;
  document.getElementById('resName').value = restaurant.name || '';
  document.getElementById('resCuisine').value = restaurant.cuisine_type || '';
  document.getElementById('resTables').value = String(display.tables || restaurant.total_tables || 0);
  document.getElementById('resAddress').value = location?.address || '';
  document.getElementById('resCity').value = location?.city || '';
  document.getElementById('resPincode').value = location?.pincode || '';
  document.getElementById('resManagerName').value = manager?.name || '';
  document.getElementById('resManagerEmail').value = manager?.email || '';
  document.getElementById('resLicense').value = manager?.business_license_number || '';
  document.getElementById('resTimeSlots').value = display.timeSlots === 'Not configured' ? '' : display.timeSlots.split(',')[0].replace('-', ' - ');
  document.getElementById('resStatus').value = display.status;
  document.getElementById('superModalTitle').textContent = 'View / Edit Restaurant';
  document.getElementById('superModal').style.display = 'flex';
};

window.deleteRestaurant = function deleteRestaurant(id, name) {
  showConfirmModal(
    'Delete Restaurant',
    `Delete ${name}? This removes it from the shared platform data.`,
    async () => {
      await apiRequest(`/restaurants/${id}`, { method: 'DELETE' });
      await syncAdminState();
      showToast('Restaurant deleted.', 'error');
      addAuditLog(`Deleted restaurant ${name}`);
    },
  );
};

window.openUserModal = function openUserModal() {
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('userModalTitle').textContent = 'Add User';
  ensureRestaurantSelects();
  toggleRestaurantField();
  document.getElementById('userModal').style.display = 'flex';
};

window.closeUserModal = function closeUserModal() {
  document.getElementById('userModal').style.display = 'none';
};

window.toggleRestaurantField = function toggleRestaurantField() {
  const role = document.getElementById('userRole').value;
  const group = document.getElementById('userRestaurantGroup');
  ensureRestaurantSelects();
  group.style.display = role === 'Diner' ? 'none' : 'block';
};

window.editUser = function editUser(id) {
  const user = state.users.find((item) => item.id === id);
  if (!user) return;
  const display = getUserDisplay(user);
  ensureRestaurantSelects();
  document.getElementById('userId').value = user.id;
  document.getElementById('userName').value = user.name || '';
  document.getElementById('userEmail').value = user.email || '';
  document.getElementById('userRole').value = display.role;
  toggleRestaurantField();
  document.getElementById('userNode').value = display.restaurant_id || '';
  document.getElementById('userStatus').value = display.status;
  document.getElementById('userModalTitle').textContent = 'View / Edit User';
  document.getElementById('userModal').style.display = 'flex';
};

window.deleteUser = function deleteUser(id, email) {
  showConfirmModal(
    'Delete Account',
    `Delete the account for ${email}? This action is permanent.`,
    async () => {
      await apiRequest(`/users/${id}`, { method: 'DELETE' });
      await syncAdminState();
      showToast('User deleted.', 'error');
      addAuditLog(`Deleted user ${email}`);
    },
  );
};

window.openReservationModal = function openReservationModal() {
  document.getElementById('reservationForm').reset();
  document.getElementById('bkgId').value = '';
  document.getElementById('reservationModalTitle').textContent = 'Add Reservation';
  ensureRestaurantSelects();
  document.getElementById('bkgDate').min = new Date().toISOString().split('T')[0];
  document.getElementById('reservationModal').style.display = 'flex';
};

window.closeReservationModal = function closeReservationModal() {
  document.getElementById('reservationModal').style.display = 'none';
};

window.editReservation = function editReservation(id) {
  const reservation = state.reservations.find((item) => item.id === id);
  if (!reservation) return;
  const display = getReservationDisplay(reservation);
  ensureRestaurantSelects();
  document.getElementById('bkgId').value = reservation.id;
  document.getElementById('bkgDinerName').value = display.dinerName;
  document.getElementById('bkgDinerId').value = display.dinerId;
  document.getElementById('bkgRestaurant').value = display.restaurantId;
  document.getElementById('bkgDate').value = display.date;
  document.getElementById('bkgTime').value = display.time;
  document.getElementById('bkgParty').value = String(display.party);
  document.getElementById('bkgStatus').value = display.status === 'Completed' ? 'Customer Check-In' : display.status;
  document.getElementById('reservationModalTitle').textContent = 'View / Edit Reservation';
  document.getElementById('reservationModal').style.display = 'flex';
};

window.deleteReservation = function deleteReservation(id, dinerName) {
  showConfirmModal(
    'Delete Reservation',
    `Permanently delete the reservation for ${dinerName}? This cannot be undone.`,
    async () => {
      await apiRequest(`/reservations/${id}`, {
        method: 'DELETE',
      });
      await syncAdminState();
      showToast('Reservation deleted.', 'error');
      addAuditLog(`Deleted reservation ${id}`);
    },
  );
};

window.changeSuperPassword = function changeSuperPassword(event) {
  event.preventDefault();
  const current = document.getElementById('currentMasterPass').value;
  const next = document.getElementById('newMasterPass').value;
  const confirm = document.getElementById('confirmNewMasterPass').value;
  const msg = document.getElementById('passChangeMsg');
  const profile = readJson('super_admin_profile', null);

  if (next.length < 6) {
    msg.textContent = 'New password must be at least 6 characters.';
    msg.style.color = '#C62828';
    msg.style.display = 'inline';
    return;
  }

  if (next !== confirm) {
    msg.textContent = 'Password confirmation does not match.';
    msg.style.color = '#C62828';
    msg.style.display = 'inline';
    return;
  }

  apiRequest('/super-admin/password', {
    method: 'PATCH',
    body: JSON.stringify({
      user_id: profile?.id || '',
      current_password: current,
      new_password: next,
    }),
  })
    .then(() => {
      msg.textContent = 'Security key updated.';
      msg.style.color = '#2E7D32';
      msg.style.display = 'inline';
      document.getElementById('changePasswordForm').reset();
      addAuditLog('Updated super user security key');
    })
    .catch((error) => {
      msg.textContent = error.message || 'Unable to update password.';
      msg.style.color = '#C62828';
      msg.style.display = 'inline';
    });
};

window.sendBroadcast = async function sendBroadcast(event) {
  event.preventDefault();
  const form = event.target;
  const audience = form.querySelector('select').value;
  const message = form.querySelector('textarea').value.trim();
  const roleMap = {
    diners: 'diner',
    managers: 'manager',
    staff: 'staff',
  };

  await apiRequest('/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      role: roleMap[audience],
      message,
      type: 'broadcast',
    }),
  });

  await syncAdminState();
  form.reset();
  showToast('Broadcast message sent successfully.');
  addAuditLog(`Sent broadcast to ${audience}`);
};

window.logoutSuperAdmin = function logoutSuperAdmin() {
  sessionStorage.clear();
  window.location.href = 'login.html';
};

window.switchTab = function switchTab(tabName) {
  document.querySelectorAll('.dashboard-view').forEach((view) => {
    view.style.display = 'none';
  });
  document.querySelectorAll('.sidebar .nav-item').forEach((item) => {
    item.classList.remove('active');
  });

  const view = document.getElementById(`view-${tabName}`);
  if (view) {
    view.style.display = 'block';
  }

  const nav = document.getElementById(`nav-${tabName}`);
  if (nav) {
    nav.classList.add('active');
  }

  writeJson(STORAGE_KEYS.activeTab, tabName);
};

const TEAM_LABELS = {
  support: 'Customer Support',
  finance: 'Finance Team',
  verification: 'Verification Team',
};

const TICKET_STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  escalated_finance_team: 'Escalated to Finance',
  escalated_super_admin: 'Escalated to Super Admin',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

function currentSuperAdminId() {
  try {
    const profile = JSON.parse(sessionStorage.getItem('super_admin_profile') || '{}');
    return profile.id || '';
  } catch (_error) {
    return '';
  }
}

function renderSubAdminsTable() {
  const body = document.getElementById('subAdminsBody');
  if (!body) return;

  const counts = { support: 0, finance: 0, verification: 0 };
  state.subAdmins.forEach((admin) => {
    if (counts[admin.team] !== undefined) counts[admin.team] += 1;
  });
  if (document.getElementById('kpiSupportCount')) document.getElementById('kpiSupportCount').textContent = String(counts.support);
  if (document.getElementById('kpiFinanceCount')) document.getElementById('kpiFinanceCount').textContent = String(counts.finance);
  if (document.getElementById('kpiVerificationCount')) document.getElementById('kpiVerificationCount').textContent = String(counts.verification);

  if (!state.subAdmins.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No sub-admin accounts yet.</td></tr>';
    return;
  }

  body.innerHTML = state.subAdmins.map((admin) => `
    <tr>
      <td><strong>${escapeHtml(admin.name)}</strong><br><span style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(admin.email)}</span></td>
      <td>${escapeHtml(TEAM_LABELS[admin.team] || admin.team)}${admin.team === 'verification' && admin.location_id ? `<br><span style="color: var(--text-muted); font-size: 0.75rem;">${escapeHtml(admin.location_id)}</span>` : ''}</td>
      <td>${mapUserStatus(admin.status)}</td>
      <td>${new Date(admin.created_at).toLocaleDateString('en-GB')}</td>
      <td style="text-align: right;">
        <button class="btn-sm btn-outline" onclick="toggleSubAdminStatus('${admin.id}', '${admin.status}')">${admin.status === 'active' ? 'Suspend' : 'Activate'}</button>
        <button class="btn-sm btn-outline" style="color:#C1121F;" onclick="deleteSubAdmin('${admin.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

let allLocationsCache = null;

async function loadAllLocations(forceRefresh = false) {
  if (allLocationsCache && !forceRefresh) return allLocationsCache;
  const res = await apiRequest('/restaurants/locations');
  allLocationsCache = res?.data || [];
  return allLocationsCache;
}

async function populateLocationSelect(selectedId) {
  const select = document.getElementById('subAdminLocation');
  const locations = await loadAllLocations(true);
  select.innerHTML = '<option value="">Select a location</option>' +
    locations.map((loc) => `<option value="${loc.id}">${escapeHtml(loc.city)} - ${escapeHtml(loc.address)}</option>`).join('');
  if (selectedId) select.value = selectedId;
}

window.toggleSubAdminLocationField = async function toggleSubAdminLocationField() {
  const team = document.getElementById('subAdminTeam').value;
  const group = document.getElementById('subAdminLocationGroup');
  const select = document.getElementById('subAdminLocation');
  if (team !== 'verification') {
    group.style.display = 'none';
    select.required = false;
    return;
  }

  group.style.display = 'block';
  select.required = true;
  await populateLocationSelect();
};

window.toggleNewLocationForm = function toggleNewLocationForm() {
  const form = document.getElementById('newLocationForm');
  const label = document.getElementById('newLocationToggleLabel');
  const isHidden = form.style.display === 'none';
  form.style.display = isHidden ? 'block' : 'none';
  label.textContent = isHidden ? 'Cancel' : 'Add a new location';
};

window.createNewLocation = async function createNewLocation() {
  const city = document.getElementById('newLocCity').value.trim();
  const address = document.getElementById('newLocAddress').value.trim();
  const pincode = document.getElementById('newLocPincode').value.trim();
  const country = document.getElementById('newLocCountry').value.trim() || 'India';

  if (!city || !address || !pincode) {
    showToast('Please fill in city, address, and pincode for the new location.', 'error');
    return;
  }

  try {
    const created = await apiRequest('/restaurants/locations', {
      method: 'POST',
      body: JSON.stringify({ city, address, pincode, country }),
    });

    await populateLocationSelect(created?.data?.id);
    document.getElementById('newLocCity').value = '';
    document.getElementById('newLocAddress').value = '';
    document.getElementById('newLocPincode').value = '';
    toggleNewLocationForm();
    showToast(`Location "${city}" added.`);
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.openSubAdminModal = function openSubAdminModal() {
  document.getElementById('subAdminForm').reset();
  document.getElementById('subAdminId').value = '';
  document.getElementById('subAdminModalTitle').textContent = 'Add Sub-Admin';
  document.getElementById('subAdminPassword').required = true;
  document.getElementById('subAdminLocationGroup').style.display = 'none';
  document.getElementById('newLocationForm').style.display = 'none';
  document.getElementById('newLocationToggleLabel').textContent = 'Add a new location';
  document.getElementById('subAdminModal').style.display = 'flex';
};

window.closeSubAdminModal = function closeSubAdminModal() {
  document.getElementById('subAdminModal').style.display = 'none';
};

async function saveSubAdmin(event) {
  event.preventDefault();

  const name = document.getElementById('subAdminName').value.trim();
  const email = document.getElementById('subAdminEmail').value.trim();
  const password = document.getElementById('subAdminPassword').value;
  const team = document.getElementById('subAdminTeam').value;
  const locationId = document.getElementById('subAdminLocation').value;

  if (!password) {
    throw new Error('Please set a login password for this sub-admin.');
  }

  if (team === 'verification' && !locationId) {
    throw new Error('Please select a location for this Verification Team account.');
  }

  await apiRequest('/sub-admin', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, team, location_id: locationId || undefined }),
  });

  closeSubAdminModal();
  showToast(`${TEAM_LABELS[team]} account created for ${name}.`);
  addAuditLog(`Created ${TEAM_LABELS[team]} sub-admin: ${email}`);
  await syncAdminState();
}

window.toggleSubAdminStatus = async function toggleSubAdminStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
  try {
    await apiRequest(`/sub-admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    showToast(`Sub-admin account ${nextStatus === 'active' ? 'activated' : 'suspended'}.`);
    addAuditLog(`Set sub-admin ${id} to ${nextStatus}`);
    await syncAdminState();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.deleteSubAdmin = function deleteSubAdmin(id) {
  showConfirmModal('Delete Sub-Admin', 'This will permanently remove this sub-admin account. Continue?', async () => {
    try {
      await apiRequest(`/sub-admin/${id}`, { method: 'DELETE' });
      showToast('Sub-admin account deleted.');
      addAuditLog(`Deleted sub-admin ${id}`);
      await syncAdminState();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
};

function renderTicketsTables() {
  const escalatedBody = document.getElementById('escalatedTicketsBody');
  const allBody = document.getElementById('allTicketsBody');
  if (!escalatedBody || !allBody) return;

  const escalated = state.tickets.filter((ticket) => ticket.status === 'escalated_super_admin');

  escalatedBody.innerHTML = escalated.length
    ? escalated.map((ticket) => `
      <tr>
        <td>${escapeHtml(ticket.id)}</td>
        <td>${ticket.raised_by_role === 'diner' ? 'Diner' : 'Restaurant Manager'} (${escapeHtml(ticket.raised_by_user_id)})</td>
        <td>${escapeHtml(ticket.subject)}<br><span style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(ticket.description)}</span></td>
        <td>${escapeHtml(ticket.resolution_notes || '-')}</td>
        <td style="text-align: right;"><button class="btn-sm btn-outline" onclick="openResolveEscalatedModal('${ticket.id}')">Resolve</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No issues currently escalated to you.</td></tr>';

  allBody.innerHTML = state.tickets.length
    ? state.tickets.map((ticket) => `
      <tr>
        <td>${escapeHtml(ticket.id)}</td>
        <td>${ticket.raised_by_role === 'diner' ? 'Diner' : 'Restaurant Manager'}</td>
        <td style="text-transform: capitalize;">${escapeHtml(ticket.category)}</td>
        <td>${escapeHtml(ticket.subject)}</td>
        <td>${escapeHtml(TICKET_STATUS_LABELS[ticket.status] || ticket.status)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No support tickets yet.</td></tr>';
}

window.openResolveEscalatedModal = function openResolveEscalatedModal(ticketId) {
  document.getElementById('resolveTicketId').value = ticketId;
  document.getElementById('resolveTicketNotes').value = '';
  document.getElementById('resolveEscalatedModal').style.display = 'flex';
};

window.closeResolveEscalatedModal = function closeResolveEscalatedModal() {
  document.getElementById('resolveEscalatedModal').style.display = 'none';
};

async function resolveEscalatedTicket(event) {
  event.preventDefault();

  const id = document.getElementById('resolveTicketId').value;
  const resolution_notes = document.getElementById('resolveTicketNotes').value.trim();

  await apiRequest(`/support/tickets/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolution_notes, admin_id: currentSuperAdminId() }),
  });

  closeResolveEscalatedModal();
  showToast('Ticket marked as resolved.');
  addAuditLog(`Resolved escalated ticket ${id}`);
  await syncAdminState();
}

function setupForms() {
  document.getElementById('superForm')?.addEventListener('submit', (event) => {
    saveRestaurant(event).catch((error) => showToast(error.message, 'error'));
  });
  document.getElementById('userForm')?.addEventListener('submit', (event) => {
    saveUser(event).catch((error) => showToast(error.message, 'error'));
  });
  document.getElementById('reservationForm')?.addEventListener('submit', (event) => {
    saveReservation(event).catch((error) => showToast(error.message, 'error'));
  });
  document.getElementById('subAdminForm')?.addEventListener('submit', (event) => {
    saveSubAdmin(event).catch((error) => showToast(error.message, 'error'));
  });
  document.getElementById('resolveEscalatedForm')?.addEventListener('submit', (event) => {
    resolveEscalatedTicket(event).catch((error) => showToast(error.message, 'error'));
  });
}

window.onload = async function onLoad() {
  setupForms();
  getAuditLog();
  renderAuditLogs();
  ensureRestaurantSelects();

  const resSearchDate = document.getElementById('resSearchDate');
  if (resSearchDate) {
    resSearchDate.value = new Date().toLocaleDateString('en-CA');
  }

  try {
    await syncAdminState();
  } catch (error) {
    showToast(error.message || 'Unable to sync admin dashboard.', 'error');
  }

  const savedTab = readJson(STORAGE_KEYS.activeTab, 'dashboard');
  switchTab(savedTab);
  startAutoRefresh();
};
