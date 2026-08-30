// restaurant.js

// Data fetched from DinetimeStore

let currentSlide = 0;
let totalSlides = 0;

function getRestaurantById(id) {
  const allRestaurants = DinetimeStore.getRestaurants();
  return allRestaurants.find(r => r.id === id) || allRestaurants[0];
}

function getUrlId() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('id')) || 1;
}

function renderCarousel(images) {
  const track = document.querySelector('#carouselTrack');
  const safeImages = Array.isArray(images) && images.length
    ? images
    : ['../images/indian.jpg', '../images/main.png'];
  totalSlides = safeImages.length;
  track.innerHTML = safeImages.map(src =>
    `<div class="carousel-slide"><img src="${src}" alt="Restaurant" /></div>`
  ).join('');
  updateCarouselCounter();
}

function updateCarouselCounter() {
  document.querySelector('#carouselCounter').textContent = `${currentSlide + 1} / ${totalSlides}`;
  document.querySelector('#carouselTrack').style.transform = `translateX(-${currentSlide * 100}%)`;
}

function renderInfo(restaurant) {
  document.querySelector('#restaurantName').textContent = restaurant.name;
  document.querySelector('#restaurantSubtitle').textContent = restaurant.subtitle;
  document.querySelector('#restaurantRating').textContent = restaurant.rating;
  document.querySelector('#restaurantReviews').textContent = `(${restaurant.reviewCount} reviews)`;
  document.querySelector('#restaurantLocation').textContent = restaurant.location;
  document.querySelector('#restaurantPrice').textContent = restaurant.price;

  const amenitiesEl = document.querySelector('#amenitiesList');
  amenitiesEl.innerHTML = restaurant.amenities.map(a => `<span class="amenity-tag">${a}</span>`).join('');
}

function renderAbout(restaurant) {
  document.querySelector('#aboutText').textContent = restaurant.description;

  const items = [
    { icon: 'fa-solid fa-phone', label: 'Phone Number', value: restaurant.phone },
    { icon: 'fa-solid fa-clock', label: 'Opening Hours', value: restaurant.openingHours },
    { icon: 'fa-solid fa-square-parking', label: 'Parking', value: restaurant.parking },
    { icon: 'fa-solid fa-shirt', label: 'Dress Code', value: restaurant.dressCode }
  ];

  document.querySelector('#aboutGrid').innerHTML = items.map(item => `
    <div class="about-item">
      <i class="${item.icon} about-item-icon"></i>
      <div class="about-item-text">
        <strong>${item.label}</strong>
        <span>${item.value}</span>
      </div>
    </div>
  `).join('');
}

function renderPolicies(policies) {
  const grid = document.querySelector('#policiesGrid');
  if (!grid) return;

  const safePolicies = Array.isArray(policies) ? policies : [];

  if (!safePolicies.length) {
    grid.innerHTML = '<div class="empty-state">No reservation policies have been added yet.</div>';
    return;
  }

  grid.innerHTML = safePolicies.map(policy => `
    <div class="policy-item">
      <strong>${policy.title}</strong>
      <span>${policy.desc}</span>
    </div>
  `).join('');
}

function renderHours(operationalHours) {
  const safeHours = Array.isArray(operationalHours) && operationalHours.length
    ? operationalHours
    : [{ days: 'Everyday', hours: '11:00 AM - 10:30 PM', isOpen: true }];

  document.querySelector('#hoursList').innerHTML = safeHours.map(row => `
    <div class="hours-row">
      <span class="hours-label">
        ${row.days}
        ${row.isOpen ? '<span class="open-badge">Open</span>' : ''}
      </span>
      <span class="hours-time">${row.hours}</span>
    </div>
  `).join('');
}

function renderMenu(menuImages) {
  const safeMenuImages = Array.isArray(menuImages) ? menuImages : [];

  if (!safeMenuImages.length) {
    document.querySelector('#menuGrid').innerHTML = '<div class="empty-state">No menu photos have been added yet.</div>';
    return;
  }

  document.querySelector('#menuGrid').innerHTML = safeMenuImages.map(src => `
    <div class="menu-img-wrapper">
      <img src="${src}" alt="Menu" loading="lazy" />
    </div>
  `).join('');
}

function renderReviews(reviews) {
  const safeReviews = Array.isArray(reviews) ? reviews : [];

  if (!safeReviews.length) {
    document.querySelector('#reviewsGrid').innerHTML = '<div class="empty-state">No customer reviews yet.</div>';
    return;
  }

  document.querySelector('#reviewsGrid').innerHTML = safeReviews.map(r => `
    <div class="review-card">
      <div class="reviewer-row">
        <img src="${r.avatar}" alt="${r.name}" class="reviewer-avatar" />
        <div>
          <div class="reviewer-name">${r.name}</div>
          <div class="review-stars">${'<i class="fa-solid fa-star"></i>'.repeat(r.stars)}</div>
        </div>
      </div>
      <p class="review-text">${r.text}</p>
    </div>
  `).join('');
}

function initCarouselControls() {
  document.querySelector('#prevBtn').addEventListener('click', () => {
    currentSlide = currentSlide === 0 ? totalSlides - 1 : currentSlide - 1;
    updateCarouselCounter();
  });

  document.querySelector('#nextBtn').addEventListener('click', () => {
    currentSlide = currentSlide === totalSlides - 1 ? 0 : currentSlide + 1;
    updateCarouselCounter();
  });
}

function init() {
  const id = getUrlId();
  const restaurant = getRestaurantById(id);

  document.title = `${restaurant.name} – DineTime`;

  renderCarousel(restaurant.images);
  renderInfo(restaurant);
  renderAbout(restaurant);
  renderPolicies(restaurant.policies);
  renderHours(restaurant.operationalHours);
  renderMenu(restaurant.menuImages);
  renderReviews(restaurant.reviews);
  initCarouselControls();

  document.querySelector('#reserveBtn').addEventListener('click', () => {
    window.location.href = `book.html?id=${id}`;
  });

  const viewMenuBtn = document.querySelector('#viewMenuBtn');
  if (viewMenuBtn) {
    viewMenuBtn.addEventListener('click', () => {
      window.location.href = `menu.html?id=${id}`;
    });
  }

  const searchInput = document.querySelector('#globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('click', () => {
      window.location.href = `search.html`;
    });
    searchInput.addEventListener('focus', () => {
      window.location.href = `search.html`;
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
  }
  init();
});
