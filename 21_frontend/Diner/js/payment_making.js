// payment_making.js

var DINER_PLATFORM_FEE = 20;

var reservationState = {
  restaurantId: 1,
  date: "Friday, 22 March",
  time: "7:00 PM",
  guests: 4,
  tableType: "Indoor Table",
  specialRequest: "Window seat if available",
  ratePerGuest: 30
};

// Data from DinetimeStore

function getUrlParam(key) {
  var params = new URLSearchParams(window.location.search);
  return params.get(key);
}

function getRestaurant(id) {
  var allRes = DinetimeStore.getRestaurants();
  return allRes.find(function(r) { return r.id === id; }) || allRes[0];
}

function loadReservationState() {
  var id = parseInt(getUrlParam('id')) || 1;
  var date = getUrlParam('date');
  var time = getUrlParam('time');
  var guests = parseInt(getUrlParam('guests')) || 4;
  var tableType = getUrlParam('table') || "Indoor Table";
  var special = getUrlParam('special') || "Window seat if available";

  if (date) {
    var dateObj = new Date(date + 'T12:00:00');
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    reservationState.date = days[dateObj.getDay()] + ', ' + dateObj.getDate() + ' ' + months[dateObj.getMonth()];
  }
  if (time) reservationState.time = time;
  if (guests) reservationState.guests = guests;
  if (tableType) reservationState.tableType = tableType;
  
  var tableName = getUrlParam('tableName');
  if (tableName) reservationState.tableName = tableName;
  if (special) reservationState.specialRequest = special;

  reservationState.restaurantId = id;
}

function calcCost() {
  var deposit = reservationState.guests * reservationState.ratePerGuest;
  var service = DINER_PLATFORM_FEE;
  var total = deposit + service;
  return { deposit: deposit, service: service, total: total };
}

function renderRestaurant(restaurant) {
  var row = document.getElementById('restaurantRow');
  if(!row) return;

  row.innerHTML =
    '<img src="' + restaurant.image + '" alt="' + restaurant.name + '" class="rest-img" onerror="this.src=\'../images/logo.png\'"/>' +
    '<div class="rest-info">' +
      '<span class="rest-name">' + restaurant.name + '</span>' +
      '<span class="rest-cuisine">' + restaurant.cuisine + '</span>' +
      '<div class="rest-meta">' +
        '<span class="rest-rating"><i class="fa-solid fa-star star-icon"></i> ' + restaurant.rating + '</span>' +
        '<span class="rest-distance"><i class="fa-solid fa-location-dot"></i> ' + restaurant.distance + '</span>' +
      '</div>' +
    '</div>';
}

function renderInfoGrid() {
  var grid = document.getElementById('infoGrid');
  if(!grid) return;

  var r = reservationState;
  grid.innerHTML =
    infoTile('fa-regular fa-calendar', 'Date', r.date) +
    infoTile('fa-regular fa-clock', 'Time', r.time) +
    infoTile('fa-solid fa-people-group', 'Guests', r.guests + ' People') +
    infoTile('fa-solid fa-chair', 'Table', (r.tableName ? r.tableName + ' (' + r.tableType + ')' : r.tableType));
}

function infoTile(iconClass, label, value) {
  return '<div class="info-tile">' +
    '<i class="' + iconClass + ' info-tile-icon"></i>' +
    '<div class="info-tile-content">' +
      '<span class="info-tile-label">' + label + '</span>' +
      '<span class="info-tile-value">' + value + '</span>' +
    '</div>' +
  '</div>';
}

function renderSpecialRequests() {
  var box = document.getElementById('specialRequestsBox');
  if(!box) return;

  var req = reservationState.specialRequest;
  if (!req || req.trim() === '') {
    box.style.display = 'none';
    return;
  }
  box.innerHTML =
    '<div class="special-req-label">Special Requests</div>' +
    '<div class="special-req-text">"' + req + '"</div>';
}

function renderCost() {
  var cost = calcCost();

  var lines = document.getElementById('costLines');
  if(lines) {
      lines.innerHTML =
        costLine('Reservation Deposit (\u20B9' + reservationState.ratePerGuest + ' \u00D7 ' + reservationState.guests + ' guests)', '\u20B9' + cost.deposit) +
        costLine('Platform Service Fee', '\u20B9' + cost.service) +
        '<div class="cost-line-note">Your deposit is adjustable against your final bill at the restaurant.</div>';
  }

  var totalRow = document.getElementById('costTotalRow');
  if(totalRow) {
      totalRow.innerHTML =
        '<span class="cost-total-label">Total Amount</span>' +
        '<span class="cost-total-value">\u20B9' + cost.total + '</span>';
  }
}

function costLine(label, value) {
  return '<div class="cost-line">' +
    '<span class="cost-line-label">' + label + '</span>' +
    '<span class="cost-line-value">' + value + '</span>' +
  '</div>';
}

function buildModifyLink(restaurantId) {
  var link = document.getElementById('modifyLink');
  if(link) link.href = 'book.html?id=' + restaurantId;
}

function init() {
  loadReservationState();

  var restaurant = getRestaurant(reservationState.restaurantId);
  reservationState.ratePerGuest = restaurant && restaurant.reservationFeePerGuest
    ? restaurant.reservationFeePerGuest
    : reservationState.ratePerGuest;

  document.title = 'DineTime - Review Payment';

  renderRestaurant(restaurant);
  renderInfoGrid();
  renderSpecialRequests();
  renderCost();
  buildModifyLink(reservationState.restaurantId);

  const btnProceed = document.getElementById('btnProceed');
  if(btnProceed) {
      btnProceed.addEventListener('click', function() {
        var cost = calcCost();
        var existingParams = new URLSearchParams(window.location.search);
        existingParams.set('total', cost.total);
        window.location.href = 'payment_method.html?' + existingParams.toString();
      });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
  }
  init();
});
