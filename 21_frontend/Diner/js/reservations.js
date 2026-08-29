// reservations.js - connected to DinetimeStore

var activeFilters = {
  search: '',
  date: '',
  time: ''
};

function populateFilters() {
  // Purposefully left blank. We now use HTML5 input elements (date, time, text) 
  // instead of dynamically populating dropdown selects.
}

function convertDateStr(isoStr) {
    if (!isoStr) return "";
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateObj = new Date(isoStr);
    // JS dates from YYYY-MM-DD arrive at UTC 00:00, preventing timezone bugs:
    return new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000).toLocaleDateString('en-GB', options);
}

function convertTimeStr(time24) {
    if (!time24) return "";
    let [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; 
    return h + ':' + minutes + ' ' + ampm;
}

function getFiltered() {
  const reservations = DinetimeStore.getReservations() || [];
  return reservations.filter(function(r) {
    var matchSearch = !activeFilters.search ||
      r.restaurant.toLowerCase().includes(activeFilters.search.toLowerCase());
    
    // Compare dates conceptually
    var targetDate = convertDateStr(activeFilters.date);
    var matchDate = !activeFilters.date || r.date === targetDate;
    
    // Compare times conceptually 
    // e.g., "20:00" -> "8:00 PM"
    var targetTime = convertTimeStr(activeFilters.time);
    var matchTime = !activeFilters.time || r.time === targetTime;
    
    return matchSearch && matchDate && matchTime;
  });
}

function statusBadge(status) {
  var cls = '';
  if (status === 'Confirmed') cls = 'badge-confirmed';
  else if (status === 'Completed') cls = 'badge-completed';
  else if (status === 'Cancelled') cls = 'badge-cancelled';
  return '<span class="badge ' + cls + '">' + status + '</span>';
}

function buildCard(r) {
  var cancelBtn = '';
  var reviewBtn = '';
  if (r.status === 'Confirmed') {
    cancelBtn = '<button class="btn-cancel" data-id="' + r.id + '">Cancel</button>';
  } else if (r.status === 'Completed') {
    reviewBtn = '<button class="btn-rate" data-id="' + r.id + '">' +
      '<i class="fa-regular fa-star"></i> ' + (r.hasRated ? 'View Rating' : 'Rate Experience') +
      '</button>';
  }

  var tableRow = '';
  if (r.tableType) {
    tableRow = '<div class="res-info-item"><i class="fa-solid fa-location-dot"></i><span>' + r.tableType + '</span></div>';
  } else if (r.location) {
      tableRow = '<div class="res-info-item"><i class="fa-solid fa-location-dot"></i><span>' + r.location + '</span></div>';
  }

  // Fallback missing time
  var displayTime = r.time ? '<div class="res-info-item"><i class="fa-regular fa-clock"></i><span>' + r.time + '</span></div>' : '';

  return '<div class="res-card" data-id="' + r.id + '">' +
    '<img src="' + r.image + '" alt="' + r.restaurant + '" class="res-img" />' +
    '<div class="res-body">' +
      '<div class="res-header">' +
        '<span class="res-name">' + r.restaurant + '</span>' +
        statusBadge(r.status) +
      '</div>' +
      '<div class="res-info-grid">' +
        '<div class="res-info-item"><i class="fa-regular fa-calendar"></i><span>' + r.date + '</span></div>' +
        displayTime +
        '<div class="res-info-item"><i class="fa-solid fa-people-group"></i><span>' + r.guests + ' Guests</span></div>' +
        tableRow +
      '</div>' +
      '<div class="res-actions">' +
        '<button class="btn-view-details" data-id="' + r.id + '">' +
          '<i class="fa-regular fa-eye"></i> View Details' +
        '</button>' +
        reviewBtn +
        cancelBtn +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderList() {
  var filtered = getFiltered();
  var list = document.getElementById('reservationsList');
  var empty = document.getElementById('emptyState');
  
  if (!list || !empty) return;

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = filtered.map(buildCard).join('');

  list.querySelectorAll('.btn-cancel').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = btn.dataset.id;
      cancelReservation(id);
    });
  });

  list.querySelectorAll('.btn-view-details').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.dataset.id;
      window.location.href = 'details.html?id=' + id;
    });
  });

  list.querySelectorAll('.btn-rate').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = btn.dataset.id;
      window.location.href = 'profile.html?review=' + encodeURIComponent(id);
    });
  });
}

function showConfirmModal(title, message, onConfirm) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const msgEl = document.getElementById('modal-message');
  const btnCancel = document.getElementById('btnModalCancel');
  const btnConfirm = document.getElementById('btnModalConfirm');

  titleEl.innerText = title;
  msgEl.innerText = message;
  overlay.classList.add('show');

  const closeModal = () => {
      overlay.classList.remove('show');
      btnConfirm.onclick = null;
      btnCancel.onclick = null;
  };

  btnConfirm.onclick = () => {
      onConfirm();
      closeModal();
  };
  btnCancel.onclick = closeModal;
  overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };
}

function cancelReservation(id) {
  const reservations = DinetimeStore.getReservations() || [];
  var res = reservations.find(function(r) { return r.id === id; });
  if (res) {
    showConfirmModal(
      'Cancel Reservation',
      'Are you sure you want to cancel your reservation at ' + res.restaurant + '?',
      async () => {
        await DinetimeStore.cancelReservation(id);
        renderList();
        showToast('Reservation cancelled. You will receive an email confirmation.');
      }
    );
  }
}

function applyFilters() {
  activeFilters.date = document.getElementById('dateFilter').value;
  activeFilters.time = document.getElementById('timeFilter').value;
  renderList();
}

function clearFilters() {
  activeFilters = { search: '', date: '', time: '' };
  
  const si = document.getElementById('searchInput'); if(si) si.value = '';
  const df = document.getElementById('dateFilter'); if(df) df.value = '';
  const tf = document.getElementById('timeFilter'); if(tf) tf.value = '';
  
  renderList();
}

function init() {
  document.title = 'DineTime';

  populateFilters();
  renderList();

  const si = document.getElementById('searchInput');
  if(si) {
      si.addEventListener('input', function() {
        activeFilters.search = this.value;
        renderList();
      });
  }

  const df = document.getElementById('dateFilter');
  if (df) df.addEventListener('change', applyFilters);
  const tf = document.getElementById('timeFilter');
  if (tf) tf.addEventListener('change', applyFilters);

  const bc = document.getElementById('btnClear');
  if (bc) bc.addEventListener('click', clearFilters);
}

async function refreshFromBackendAndRender() {
  if (window.DinetimeStore && typeof DinetimeStore.syncFromBackend === 'function') {
    try {
      await DinetimeStore.syncFromBackend();
    } catch (_e) {
    }
  }
  renderList();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
  }
  init();
  await refreshFromBackendAndRender();
  setInterval(refreshFromBackendAndRender, 5000);
  window.addEventListener('focus', refreshFromBackendAndRender);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void refreshFromBackendAndRender();
    }
  });
});
