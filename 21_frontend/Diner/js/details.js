// details.js

var qrPatterns = DinetimeStore.getQR();

function statusBadge(status) {
  var cls = '';
  if (status === 'Confirmed') cls = 'badge-confirmed';
  else if (status === 'Completed') cls = 'badge-completed';
  else if (status === 'Cancelled') cls = 'badge-cancelled';
  return '<span class="badge ' + cls + '">' + status + '</span>';
}

function renderOverview(r) {
  const heroTitle = document.querySelector('.hero-title');
  const heroSub = document.querySelector('.hero-sub');
  if (heroTitle) heroTitle.textContent = r.status === 'Completed' ? 'Reservation Completed' : r.status === 'Cancelled' ? 'Reservation Cancelled' : 'Reservation Check-In';
  if (heroSub) heroSub.textContent = r.status === 'Completed' ? 'Share your experience with the restaurant' : r.status === 'Cancelled' ? 'This booking is no longer active' : 'Confirm your arrival and get seated quickly';

  document.getElementById('resThumb').src = r.image;
  document.getElementById('resThumb').alt = r.restaurant;
  document.getElementById('resName').textContent = r.restaurant;
  document.getElementById('resCuisine').textContent = r.cuisine || "Restaurant";
  document.getElementById('resBadge').innerHTML = statusBadge(r.status);

  var grid = document.getElementById('resInfoGrid');
  grid.innerHTML = `
    <div class="detail-item">
      <span class="detail-label"><i class="fa-regular fa-calendar"></i> Date</span>
      <span class="detail-value">${r.date}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label"><i class="fa-regular fa-clock"></i> Time</span>
      <span class="detail-value">${r.time || "N/A"}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label"><i class="fa-solid fa-people-group"></i> Guests</span>
      <span class="detail-value">${r.guests} People</span>
    </div>
    <div class="detail-item">
      <span class="detail-label"><i class="fa-solid fa-utensils"></i> Table Reference</span>
      <span class="detail-value">${r.tableNo || r.tableType || "Standard"}</span>
    </div>
  `;

  document.getElementById('resLocation').textContent = r.location || "Location not provided";

  const qrSection = document.getElementById('qrSection');
  const cancelledSection = document.getElementById('cancelledSection');
  const resIdDisplay = document.getElementById('resIdDisplay');
  
  if (r.status === 'Cancelled') {
      qrSection.classList.add('hidden');
      cancelledSection.classList.remove('hidden');
  } else if (r.status === 'Completed') {
      qrSection.classList.add('hidden');
      cancelledSection.classList.add('hidden');
  } else {
      qrSection.classList.remove('hidden');
      cancelledSection.classList.add('hidden');
      if (resIdDisplay) resIdDisplay.textContent = r.id;
  }
}

function renderActionSection(r) {
  const actionContainer = document.getElementById('menuButtonContainer');
  if (!actionContainer) return;

  if (r.status === 'Confirmed') {
    actionContainer.innerHTML = `
      <button class="btn-menu" id="btnViewMenu">
        <i class="fa-solid fa-utensils"></i> View Restaurant Menu
      </button>
    `;
    actionContainer.classList.remove('hidden');
    const btnViewMenu = document.getElementById('btnViewMenu');
    if (btnViewMenu) {
      btnViewMenu.addEventListener('click', function() {
        window.location.href = 'menu.html?id=' + encodeURIComponent(r.id);
      });
    }
    return;
  }

  if (r.status === 'Completed') {
    actionContainer.innerHTML = `
      <button class="btn-menu btn-review" id="btnRateExperience">
        <i class="fa-regular fa-star"></i> ${r.hasRated ? 'View Rating' : 'Rate Experience'}
      </button>
    `;
    actionContainer.classList.remove('hidden');
    const btnRateExperience = document.getElementById('btnRateExperience');
    if (btnRateExperience) {
      btnRateExperience.addEventListener('click', function() {
        window.location.href = 'profile.html?review=' + encodeURIComponent(r.id);
      });
    }
    return;
  }

  actionContainer.classList.add('hidden');
  actionContainer.innerHTML = '';
}

function updateHero(r) {
  const banner = document.querySelector('.hero-banner');
  if (banner) {
     banner.style.backgroundImage = "url('" + r.image + "')";
  }
}

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

function init() {
  document.title = 'DineTime - Check In';

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');

  const reservations = DinetimeStore.getReservations() || [];
  var res = reservations.find(function(r) { return r.id === id; });

  if (!res && reservations.length > 0) {
      res = reservations[0];
  }

  if (res) {
      updateHero(res);
      renderOverview(res);
      renderActionSection(res);
  } else {
      showToast("Reservation not found!", "error");
      setTimeout(() => {
          window.location.href = 'reservations.html';
      }, 1500);
  }

  const btnBack = document.getElementById('btnBack');
  if(btnBack) {
      btnBack.addEventListener('click', function() {
        window.location.href = 'reservations.html';
      });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
  }
  init();
});
