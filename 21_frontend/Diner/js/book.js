// book.js

// Data fetched from DinetimeStore

let selectedTable = null;
let selectedSlot = null;
let displayTables = [];

function to12hFrom24(value) {
  const raw = String(value || '').slice(0, 5);
  const [hRaw, mRaw] = raw.split(':');
  if (!hRaw || !mRaw) return value || '';
  let hh = Number(hRaw);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${hh}:${mRaw} ${ampm}`;
}

function normalizeDateToIso(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return raw;
}

function normalizeTimeTo24(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return raw;
  let hh = Number(m[1]);
  const mm = m[2];
  const period = m[3].toUpperCase();
  if (period === 'PM' && hh !== 12) hh += 12;
  if (period === 'AM' && hh === 12) hh = 0;
  return `${String(hh).padStart(2, '0')}:${mm}`;
}

function getUrlId() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('id')) || 1;
}

function getRestaurant(id) {
  const allRestaurants = DinetimeStore.getRestaurants();
  return allRestaurants.find(r => r.id === id) || allRestaurants[0];
}

function resolveRestaurantBackendId(restaurant) {
  if (!restaurant) return '';
  if (restaurant.backend_id) return restaurant.backend_id;
  if (typeof restaurant.id === 'string' && restaurant.id.startsWith('res-')) return restaurant.id;

  const allRestaurants = DinetimeStore.getRestaurants();
  const byName = allRestaurants.find((r) => r.name === restaurant.name && r.backend_id);
  if (byName?.backend_id) return byName.backend_id;

  const slots = DinetimeStore.getTimeslots ? DinetimeStore.getTimeslots() : [];
  const tables = DinetimeStore.getTables ? DinetimeStore.getTables() : [];
  return slots[0]?.restaurant_id || tables[0]?.restaurant_id || '';
}

function renderBanner(restaurant) {
  const banner = document.querySelector('#restaurantBanner');
  banner.innerHTML = `
    <img src="${restaurant.image}" alt="${restaurant.name}" class="banner-img" id="bannerPhoto" style="cursor: pointer;" />
    <div class="banner-info">
      <h2>${restaurant.name}</h2>
      <p class="banner-subtitle">${restaurant.subtitle}</p>
      <div class="banner-meta">
        <span><i class="fa-solid fa-location-dot loc-icon"></i> ${restaurant.location}</span>
        <span><i class="fa-solid fa-star star-icon"></i> ${restaurant.rating}</span>
      </div>
    </div>
  `;

  document.querySelector('#bannerPhoto').addEventListener('click', () => {
    window.location.href = `restaurant.html?id=${restaurant.id}`;
  });
}

function populateTimeOptions(restaurant) {
  const timeInput = document.querySelector('#timeInput');
  const dateInput = document.querySelector('#dateInput');
  if (!timeInput || !dateInput) return;

  const selectedDate = normalizeDateToIso(dateInput.value);
  const selectedCurrent = timeInput.value;
  const restaurantBackendId = resolveRestaurantBackendId(restaurant);

  const slots = Array.from(new Set((DinetimeStore.getTimeslots ? DinetimeStore.getTimeslots() : [])
    .filter((slot) =>
      slot.restaurant_id === restaurantBackendId &&
      normalizeDateToIso(slot.slot_date || slot.date) === selectedDate,
    )
    .map((slot) => String(slot.start_time || '').slice(0, 5))
    .filter(Boolean)))
    .sort();

  timeInput.innerHTML = [
    `<option value="" disabled>${slots.length ? 'Select Time' : 'No time slots available'}</option>`,
    ...slots.map((slot) => `<option value="${to12hFrom24(slot)}">${to12hFrom24(slot)}</option>`),
  ].join('');

  if (selectedCurrent && [...timeInput.options].some((opt) => opt.value === selectedCurrent)) {
    timeInput.value = selectedCurrent;
  } else {
    timeInput.value = '';
  }
}

async function renderTables() {
  const grid = document.querySelector('#tableGrid');
  const section = document.querySelector('#availabilitySection');
  
  const dateInput = document.querySelector('#dateInput');
  const timeInput = document.querySelector('#timeInput');
  const guestsInput = document.querySelector('#guestsInput');

  // Show section only when Date and Time are selected
  if (section) {
    if (dateInput.value && timeInput.value) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  }

  const allTables = DinetimeStore.getTables();
  const restaurant = getRestaurant(getUrlId());
  const restaurantBackendId = resolveRestaurantBackendId(restaurant);

  const dateVal = normalizeDateToIso(dateInput.value);
  const timeVal = normalizeTimeTo24(timeInput.value);
  const slots = DinetimeStore.getTimeslots ? DinetimeStore.getTimeslots() : [];
  selectedSlot = slots.find((slot) =>
    slot.restaurant_id === restaurantBackendId &&
    (normalizeDateToIso(slot.slot_date) === dateVal || normalizeDateToIso(slot.date) === dateVal) &&
    normalizeTimeTo24(slot.start_time) === timeVal,
  );

  let availabilityMap = {};
  if (selectedSlot && restaurantBackendId) {
    try {
      const availabilityRes = await DinetimeStore._request(
        `/tableslots/availability?restaurant_id=${restaurantBackendId}&slot_id=${selectedSlot.id}`,
        { headers: DinetimeStore._headers('diner') },
      );
      (availabilityRes?.data || []).forEach((item) => {
        availabilityMap[item.table_id] = item;
      });
    } catch (_e) {
    }
  }

  const minSeats = parseInt(guestsInput.value) || 0;
  const filteredTables = allTables
    .filter((t) => !restaurantBackendId || t.restaurant_id === restaurantBackendId)
    .filter((t) => t.seats >= minSeats)
    .map((t) => {
      const slotStatus = availabilityMap[t.backend_table_id];
      if (slotStatus) {
        const normalizedStatus = slotStatus.status === 'occupied' ? 'unavailable' : slotStatus.status;
        return { ...t, status: normalizedStatus, slot_id: slotStatus.slot_id };
      }
      return { ...t, status: selectedSlot ? 'available' : (t.status || 'available') };
    });

  if (selectedTable) {
    displayTables = [selectedTable];
  } else if (dateInput && timeInput && dateInput.value && timeInput.value && !selectedSlot) {
    displayTables = [];
  } else if (dateInput && timeInput && dateInput.value && timeInput.value) {
    displayTables = filteredTables;
  } else {
    displayTables = filteredTables.length ? filteredTables : allTables;
  }

  if (grid) {
      if (!displayTables.length) {
        grid.innerHTML = '<div class="summary-empty" style="grid-column:1/-1;">No tables available for this date/time.</div>';
        return;
      }
      grid.innerHTML = displayTables.map(t => `
        <div class="table-tile ${t.status} ${selectedTable && t.backend_table_id === selectedTable.backend_table_id ? 'selected' : ''}" data-id="${t.backend_table_id}" data-status="${t.status}">
          <i class="fa-solid fa-people-group tile-icon"></i>
          <span class="tile-name">${t.name}</span>
          <span class="tile-seats">${t.seats} Seats</span>
        </div>
      `).join('');

      grid.querySelectorAll('.table-tile').forEach(tile => {
        tile.addEventListener('click', () => handleTileClick(tile));
      });
  }
}

function handleTileClick(tile) {
  const status = tile.dataset.status;
  const id = tile.dataset.id;

  if (status === 'reserved') {
    showToast('This table is currently reserved by another guest.', 'warn');
    return;
  }

  if (status === 'unavailable') {
    showToast('This table is unavailable at the selected time.', 'error');
    return;
  }

  const newSelection = displayTables.find(t => t.backend_table_id === id);

  if (!newSelection) return;

  if (selectedTable && selectedTable.backend_table_id === newSelection.backend_table_id) {
    selectedTable = null;
  } else {
    selectedTable = newSelection;
  }
  
  renderTables();
  renderSummary();
}

function renderSummary() {
  const body = document.querySelector('#summaryBody');
  const btn = document.querySelector('#confirmBtn');
  const hint = document.querySelector('#summaryHint');
  const restaurant = getRestaurant(getUrlId());

  const dateInput = document.querySelector('#dateInput');
  const timeInput = document.querySelector('#timeInput');
  const guestsInput = document.querySelector('#guestsInput');

  const isDetailsFilled = dateInput && timeInput && dateInput.value && timeInput.value;
  const noSlotForSelection = isDetailsFilled && !selectedSlot;

  if (!selectedTable) {
    if (noSlotForSelection) {
      if(body) body.innerHTML = '<p class="summary-empty">No slot exists for the selected date/time. Please choose another time.</p>';
    } else if (isDetailsFilled) {
      if(body) body.innerHTML = '<p class="summary-empty">Please pick an available table to complete your reservation.</p>';
    } else {
      if(body) body.innerHTML = '<p class="summary-empty">Set your date and time to see available tables.</p>';
    }
    if(btn) btn.disabled = true;
    if(hint) hint.textContent = 'Select a table to continue';
    return;
  }

  const dateVal = normalizeDateToIso(dateInput.value);
  let displayDate = 'Not selected';
  if (dateVal) {
    const d = new Date(dateVal + 'T12:00:00');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    displayDate = `${months[d.getMonth()]} ${d.getDate()}`;
  }

  if (body) {
      body.innerHTML = `
        <div class="summary-row">
          <i class="fa-solid fa-utensils"></i>
          <div>
            <span class="summary-label">Restaurant</span>
            <span class="summary-value">${restaurant.name}</span>
          </div>
        </div>
        <div class="summary-row">
          <i class="fa-regular fa-calendar"></i>
          <div>
            <span class="summary-label">Date</span>
            <span class="summary-value">${displayDate}</span>
          </div>
        </div>
        <div class="summary-row">
          <i class="fa-regular fa-clock"></i>
          <div>
            <span class="summary-label">Time</span>
            <span class="summary-value">${timeInput.value}</span>
          </div>
        </div>
        <div class="summary-row">
          <i class="fa-solid fa-people-group"></i>
          <div>
            <span class="summary-label">Guests</span>
            <span class="summary-value">${guestsInput.value || selectedTable.seats} People</span>
          </div>
        </div>
        <div class="summary-row">
          <i class="fa-solid fa-chair"></i>
          <div style="flex: 1;">
            <span class="summary-label">Table</span>
            <span class="summary-value">${selectedTable.name} (${selectedTable.seats} Seats)</span>
          </div>
          <button class="change-link" id="changeTableBtn">Change</button>
        </div>
      `;

      document.querySelector('#changeTableBtn').onclick = () => {
        selectedTable = null;
        renderTables();
        renderSummary();
      };
  }

  if(btn) btn.disabled = false;
  if(hint) hint.textContent = '';
  if (noSlotForSelection && btn) {
    btn.disabled = true;
  }
}

function showToast(message, type) {
  const toast = document.querySelector('#toast');
  const msg = document.querySelector('#toastMsg');

  if(toast && msg) {
      toast.className = 'toast show ' + type;
      msg.textContent = message;

      setTimeout(() => {
        toast.className = 'toast hidden';
      }, 2500);
  }
}

function setMinDate() {
  const dateInput = document.querySelector('#dateInput');
  if(dateInput) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      
      dateInput.min = todayStr;
      if (!dateInput.value) {
        dateInput.value = todayStr;
      }
  }
}

function init() {
  const id = getUrlId();
  const restaurant = getRestaurant(id);

  document.title = 'DineTime - Book A Table';

  renderBanner(restaurant);
  setMinDate();
  populateTimeOptions(restaurant);
  renderTables();
  renderSummary();

  const dateInput = document.querySelector('#dateInput');
  const timeInput = document.querySelector('#timeInput');
  const guestsInput = document.querySelector('#guestsInput');

  if(dateInput) {
      dateInput.addEventListener('change', () => { 
      const today = new Date();
      today.setHours(0,0,0,0);
      const selected = new Date(dateInput.value);
      if (selected < today) {
        showToast('Please select a current or future date.', 'error');
        setMinDate();
      }
      populateTimeOptions(restaurant);
      selectedTable = null; 
      renderTables(); 
      renderSummary(); 
    });
  }
  if(timeInput) timeInput.addEventListener('change', () => { selectedTable = null; renderTables(); renderSummary(); });
  if(guestsInput) guestsInput.addEventListener('change', () => { selectedTable = null; renderTables(); renderSummary(); });

  const confirmBtn = document.querySelector('#confirmBtn');
  if(confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const dateVal = normalizeDateToIso(dateInput.value);
        const timeVal = timeInput.value;
        const guestsVal = guestsInput.value || selectedTable.seats;
        const tableLabel = selectedTable
          ? (selectedTable.seats <= 3 ? 'Window Table' : selectedTable.seats <= 5 ? 'Indoor Table' : 'Large Table')
          : 'Indoor Table';
        const tableNameStr = selectedTable ? selectedTable.name : 'Table NO-5';
        const restaurantId = getUrlId();
        const restaurant = getRestaurant(restaurantId);
        const restaurantBackendId = resolveRestaurantBackendId(restaurant);

        const params = new URLSearchParams({
          id: restaurantId,
          date: dateVal,
          time: timeVal,
          guests: guestsVal,
          table: tableLabel,
          tableName: tableNameStr,
          table_id: selectedTable ? selectedTable.backend_table_id : '',
          slot_id: selectedTable ? selectedTable.slot_id : '',
          restaurant_backend_id: restaurantBackendId,
          special: 'Window seat if available'
        });

        window.location.href = `payment_making.html?${params.toString()}`;
      });
  }

  const searchInput = document.querySelector('#globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('click', () => { window.location.href = `search.html`; });
    searchInput.addEventListener('focus', () => { window.location.href = `search.html`;  });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
  }
  init();

  document.addEventListener('dinetime:sync-complete', () => {
    populateTimeOptions(getRestaurant(getUrlId()));
    // Only re-render if we haven't selected a table yet (to avoid interrupting the user)
    // or if the selected table is still valid.
    if (!selectedTable) {
        renderTables();
        renderSummary();
    }
  });
});
