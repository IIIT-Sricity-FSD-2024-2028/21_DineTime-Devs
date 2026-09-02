// confirmation.js

// Data fetched from DinetimeStore

var methodLabels = {
  card: 'Credit / Debit Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  wallet: 'Wallet'
};

var methodIcons = {
  card: 'fa-regular fa-credit-card',
  upi: 'fa-solid fa-mobile-screen',
  netbanking: 'fa-solid fa-building-columns',
  wallet: 'fa-solid fa-wallet'
};

function getUrlParam(key) {
  var params = new URLSearchParams(window.location.search);
  return params.get(key);
}

function getRestaurant(id) {
  var allRes = DinetimeStore.getRestaurants();
  return allRes.find(function(r) { return r.id === id; }) || allRes[0];
}

function generateReservationId() {
  var num = Math.floor(10000 + Math.random() * 89999);
  return 'DT-' + num;
}

function formatDate(raw) {
  if (!raw) return 'Friday, 22 March 2026';
  var d = new Date(raw + 'T12:00:00');
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function renderRestaurant(restaurant) {
  var row = document.getElementById('restaurantRow');
  if(!row) return;

  row.innerHTML =
    '<img src="' + restaurant.image + '" alt="' + restaurant.name + '" class="rest-img" onerror="this.src=\'../images/logo.png\'"/>' +
    '<div class="rest-info">' +
      '<span class="rest-name">' + restaurant.name + '</span>' +
      '<span class="rest-cuisine">' + restaurant.cuisine + '</span>' +
      '<div class="rest-meta-row">' +
        '<span class="rest-rating"><i class="fa-solid fa-star star-icon"></i> ' + restaurant.rating + '</span>' +
        '<span class="rest-location"><i class="fa-solid fa-location-dot"></i> ' + restaurant.location + '</span>' +
      '</div>' +
    '</div>';
}

function renderBookingGrid(reservationId, date, time, guests, tableType) {
  var grid = document.getElementById('bookingGrid');
  if(!grid) return;

  grid.innerHTML =
    bookingItem('fa-solid fa-hashtag', 'Reservation ID', reservationId, false) +
    bookingItem('fa-solid fa-people-group', 'Guests', guests + ' People', false) +
    bookingItem('fa-regular fa-calendar', 'Date', date, false) +
    bookingItem('fa-solid fa-chair', 'Table Type', tableType, false) +
    bookingItem('fa-regular fa-clock', 'Time', time, false);
}

function bookingItem(iconClass, label, value, fullWidth) {
  return '<div class="booking-item' + (fullWidth ? ' full-width' : '') + '">' +
    '<div class="booking-item-header">' +
      '<i class="' + iconClass + '"></i>' +
      '<span class="booking-label">' + label + '</span>' +
    '</div>' +
    '<span class="booking-value">' + value + '</span>' +
  '</div>';
}

function renderPaymentBox(total, method, billing) {
  var iconClass = methodIcons[method] || 'fa-regular fa-credit-card';
  var methodLabel = methodLabels[method] || 'Card';

  var box = document.getElementById('paymentConfirmBox');
  if(!box) return;

  var breakdown = '';
  if (billing) {
    breakdown =
      '<div class="payment-breakdown">' +
        '<div class="payment-breakdown-line"><span>Reservation Deposit</span><span>\u20B9' + billing.deposit_amount + '</span></div>' +
        '<div class="payment-breakdown-line"><span>Platform Service Fee</span><span>\u20B9' + billing.diner_platform_fee + '</span></div>' +
        '<div class="payment-breakdown-note">Your deposit is adjustable against your final bill at the restaurant.</div>' +
      '</div>' +
      '<div class="payment-divider"></div>';
  }

  box.innerHTML =
    '<div class="payment-status-row">' +
      '<div class="payment-col">' +
        '<span class="payment-col-label">Payment Status</span>' +
        '<span class="payment-col-value paid"><i class="fa-solid fa-check"></i> Paid</span>' +
      '</div>' +
      '<div class="payment-col">' +
        '<span class="payment-col-label">Amount Paid</span>' +
        '<span class="payment-col-value">\u20B9' + total + '</span>' +
      '</div>' +
      '<div class="payment-col">' +
        '<span class="payment-col-label">Payment Method</span>' +
        '<span class="payment-col-value method"><i class="' + iconClass + '"></i>' + methodLabel + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="payment-divider"></div>' +
    breakdown +
    '<div class="secure-line">' +
      '<i class="fa-solid fa-lock"></i>' +
      '<span>Secure payment processed</span>' +
    '</div>';
}

async function init() {
  var restaurantId = parseInt(getUrlParam('id')) || 1;
  var rawDate     = getUrlParam('date');
  var time        = getUrlParam('time')   || '7:00 PM';
  var guests      = getUrlParam('guests') || '4';
  var tableType   = getUrlParam('table')  || 'Indoor';
  var tableName   = getUrlParam('tableName');
  var total       = getUrlParam('total')  || '236';
  var method      = getUrlParam('method') || 'upi';

  var restaurant   = getRestaurant(restaurantId);
  var reservationId = generateReservationId();
  var formattedDate = formatDate(rawDate);
  var tableNo = tableName || (tableType === 'Window Table' ? 'Table NO-2' : (tableType === 'Large Table' ? 'Table NO-8' : 'Table NO-5'));
  var displayTable = tableName ? tableName + ' (' + tableType + ')' : tableType;

  let createdReservation = null;
  let reservationError = '';
  try {
    createdReservation = await DinetimeStore.addReservation({
      restaurantId: restaurantId,
      restaurant_backend_id: getUrlParam('restaurant_backend_id') || (restaurant && restaurant.backend_id),
      table_id: getUrlParam('table_id'),
      slot_id: getUrlParam('slot_id'),
      date: rawDate,
      time: time,
      guests: guests
    });
  } catch (e) {
    reservationError = (e && e.message) ? e.message : 'Unable to create reservation.';
  }

  var billing = createdReservation && createdReservation.billing;
  if (billing) {
    total = billing.total_due;
  }

  if (createdReservation && createdReservation.id) {
    reservationId = createdReservation.id;
    try {
      await DinetimeStore.addPayment({
        reservation_id: createdReservation.id,
        payment_method: method,
        transaction_ref: `txn_${Date.now()}`,
        payment_status: 'paid',
      });
    } catch (_e) {
    }
  }

  const reservationCreated = Boolean(createdReservation && createdReservation.id);
  document.title = reservationCreated ? 'DineTime - Reservation Confirmed' : 'DineTime - Reservation Failed';

  renderRestaurant(restaurant || {
    image: '../images/logo.png',
    name: 'DineTime Restaurant',
    cuisine: 'Cuisine',
    rating: '4.5',
    location: 'Bangalore'
  });
  renderBookingGrid(reservationCreated ? reservationId : 'N/A', formattedDate, time, guests, displayTable);
  renderPaymentBox(total, method, billing);

  if (!reservationCreated) {
    const titleEl = document.querySelector('.confirmed-title');
    const subEl = document.querySelector('.confirmed-sub');
    if (titleEl) titleEl.textContent = 'Reservation Not Confirmed';
    if (subEl) subEl.textContent = reservationError || 'Unable to reserve this table. Please retry with another slot.';

    const hero = document.querySelector('.success-hero');
    if (hero) {
      const msg = document.createElement('div');
      msg.style.cssText = 'margin-top:12px;padding:10px 12px;border:1px solid #FECACA;background:#FEF2F2;color:#B91C1C;border-radius:8px;font-weight:600;';
      msg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + (reservationError || 'Reservation failed.');
      hero.appendChild(msg);
    }
  }

  var btnExplore = document.getElementById('btnExplore');
  if(btnExplore) {
      btnExplore.addEventListener('click', function() {
        window.location.href = 'browse.html';
      });
  }

  var btnReservations = document.getElementById('btnReservations');
  if(btnReservations) {
      btnReservations.addEventListener('click', function() {
        window.location.href = 'reservations.html';
      });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
  }
  await init();
});
