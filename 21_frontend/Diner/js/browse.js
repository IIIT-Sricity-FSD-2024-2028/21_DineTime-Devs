// browse.js
// Data now fetched from DinetimeStore

let filtersState = {
  cuisine: [],
  searchQuery: "",
  minRating: 0,
  maxDistance: 10,
  timeSlot: ""
};

function initDropdownFilters() {
  const filterBtn = document.querySelector('#filterIconBtn');
  const filterDropdown = document.querySelector('#filterDropdown');
  const closeFilterBtn = document.querySelector('#closeFilterBtn');
  const applyFiltersBtn = document.querySelector('#applyFiltersBtn');
  const resetFiltersBtn = document.querySelector('#resetFiltersBtn');

  if(filterBtn) {
      filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterDropdown.classList.toggle('hidden');
      });
  }

  if(closeFilterBtn) {
      closeFilterBtn.addEventListener('click', () => {
        filterDropdown.classList.add('hidden');
      });
  }

  document.addEventListener('click', (e) => {
    if (filterDropdown && !filterDropdown.contains(e.target) && filterBtn && !filterBtn.contains(e.target)) {
       filterDropdown.classList.add('hidden');
    }
  });

  const distSlider = document.querySelector('#distanceSlider');
  const distVal = document.querySelector('#distanceVal');
  if(distSlider) {
      distSlider.addEventListener('input', (e) => {
        distVal.textContent = e.target.value + ' km';
      });
  }

  if(applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', () => {
        const checkedCuisines = Array.from(document.querySelectorAll('input[name="cuisineType"]:checked')).map(cb => cb.value);

        filtersState.cuisine = [...new Set([...filtersState.cuisine, ...checkedCuisines])];
        
        const checkedRating = document.querySelector('input[name="minRating"]:checked');
        filtersState.minRating = checkedRating ? parseFloat(checkedRating.value) : 0;
        
        filtersState.maxDistance = parseFloat(document.querySelector('#distanceSlider').value);
        filtersState.timeSlot = document.querySelector('#timeSelect').value;
        
        filterDropdown.classList.add('hidden');
        executeFiltering();
      });
  }

  if(resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        filtersState.cuisine = [];
        filtersState.minRating = 0;
        filtersState.maxDistance = 10;
        filtersState.timeSlot = "";
        document.querySelectorAll('input[name="cuisineType"]').forEach(cb => cb.checked = false);
        document.querySelector('input[name="minRating"][value="0"]').checked = true;
        document.querySelector('#distanceSlider').value = 10;
        document.querySelector('#distanceVal').textContent = '10 km';
        document.querySelector('#timeSelect').value = "";

        document.querySelectorAll('.cuisine-card.active-cuisine').forEach(c => c.classList.remove('active-cuisine'));
        
        executeFiltering();
      });
  }
}

function initializeData() {
  const cuisineScroll = document.querySelector('#cuisineScroll');
  if(!cuisineScroll) return;
  cuisineScroll.innerHTML = "";
  
  const categories = DinetimeStore.getCategories();
  categories.forEach(c => {
    const card = document.createElement("div");
    card.className = "cuisine-card";
    card.innerHTML = `<img src="${c.image}" alt="${c.name}" loading="lazy"><span>${c.name}</span>`;
    
    card.addEventListener('click', () => {
      card.classList.toggle('active-cuisine');
      if (filtersState.cuisine.includes(c.name)) {
        filtersState.cuisine = filtersState.cuisine.filter(name => name !== c.name);
      } else {
        filtersState.cuisine.push(c.name);
      }
      executeFiltering();
    });
    
    cuisineScroll.appendChild(card);
  });
}

function createCardElement(r, index) {
  const to12h = (time) => {
    if (!time) return '';
    const [hRaw, mRaw] = String(time).split(':');
    let h = Number(hRaw);
    const m = mRaw || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };
  const slotsHtml = r.availableSlots.map(time => `<span class="time-pill">${to12h(time)}</span>`).join('');
  
  const card = document.createElement('div');
  card.className = 'card';
  card.style.animationDelay = `${index * 0.05}s`;
  card.innerHTML = `
    <div class="card-img-wrapper">
      <img src="${r.image}" alt="${r.name}" loading="lazy" />
    </div>
    <div class="card-content">
      <h3 class="card-title">${r.name}</h3>
      <p class="card-cuisine">${r.cuisine}</p>
      
      <div class="card-meta-row">
        <div class="rating-badge">
          <img src="../images/icon-star.png" alt="Star" width="16" height="16" />
          <span>${r.reviewCount > 0 ? r.rating : 'New'}</span>
        </div>
        <div class="distance-badge">
          <img src="../images/icon-location.png" alt="Location" width="14" height="14" />
          <span>${r.distance} km away</span>
        </div>
      </div>
      
      <div class="slots-section">
        <p class="slots-label">Available Slots</p>
        <div class="time-slots-container">
          ${slotsHtml}
        </div>
      </div>
      
      <button class="btn-reserve" data-id="${r.id}">Reserve Table</button>
    </div>
  `;

  card.querySelector('.btn-reserve').addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `restaurant.html?id=${r.id}`;
  });

  card.addEventListener('click', () => {
    window.location.href = `restaurant.html?id=${r.id}`;
  });

  return card;
}

function renderRestaurants(list) {
  const container = document.querySelector('#restaurant-list');
  const topRatedContainer = document.querySelector('#top-rated-list');
  const popularContainer = document.querySelector('#popular-near-you-list');
  
  const searchSection = document.querySelector('#search-results-section');
  const topRatedSection = document.querySelector('#top-rated-section');
  const popularSection = document.querySelector('#popular-section');
  
  const noResults = document.querySelector('#no-results');
  const resultsCount = document.querySelector('#resultsCount');
  
  if(!container || !topRatedContainer || !popularContainer) return;

  container.innerHTML = "";
  topRatedContainer.innerHTML = "";
  popularContainer.innerHTML = "";

    if (!list.length) {
      searchSection.classList.add('hidden');
      topRatedSection.classList.add('hidden');
      popularSection.classList.add('hidden');
      noResults.classList.remove('hidden');
      const emptyTitle = noResults.querySelector('h3');
      const emptyText = noResults.querySelector('p');
      if (emptyTitle) emptyTitle.textContent = 'No restaurants available yet';
      if (emptyText) emptyText.textContent = 'Backend returned no restaurants. Start backend seeding or add restaurants from manager panel.';
      return;
    }

    if (filtersState.searchQuery || filtersState.cuisine.length > 0 || filtersState.minRating > 0 || filtersState.maxDistance < 10 || filtersState.timeSlot !== "") {
     topRatedSection.classList.add('hidden');
     popularSection.classList.add('hidden');
     
     if (list.length > 0) {
        resultsCount.textContent = `Found ${list.length} restaurants matching filters`;
        searchSection.classList.remove('hidden');
        noResults.classList.add('hidden');
        list.forEach((r, i) => container.appendChild(createCardElement(r, i)));
     } else {
        searchSection.classList.add('hidden');
        noResults.classList.remove('hidden');
     }
  } else {
     searchSection.classList.add('hidden');
     noResults.classList.add('hidden');
     topRatedSection.classList.remove('hidden');
     popularSection.classList.remove('hidden');

     const topRated = [...list].sort((a,b) => b.rating - a.rating).slice(0, 6);
     const popular = [...list].sort((a,b) => a.distance - b.distance).slice(0, 3);
     
     topRated.forEach((r, i) => topRatedContainer.appendChild(createCardElement(r, i)));
     popular.forEach((r, i) => popularContainer.appendChild(createCardElement(r, i)));
  }
}

function executeFiltering() {
  const to24h = (value) => {
    if (!value) return '';
    const m = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!m) return String(value).slice(0, 5);
    let hh = Number(m[1]);
    const mm = m[2];
    const period = m[3].toUpperCase();
    if (period === 'PM' && hh !== 12) hh += 12;
    if (period === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}`;
  };

  const allRestaurants = DinetimeStore.getRestaurants();
  const filtered = allRestaurants.filter(r => {
    const searchMatch = !filtersState.searchQuery || 
                        r.name.toLowerCase().includes(filtersState.searchQuery.toLowerCase()) || 
                        r.cuisine.toLowerCase().includes(filtersState.searchQuery.toLowerCase());
                        
    const cuisineMatch = !filtersState.cuisine.length || filtersState.cuisine.includes(r.cuisine);
    
    const ratingMatch = r.rating >= filtersState.minRating;
    const distanceMatch = r.distance <= filtersState.maxDistance;
    const desired24 = to24h(filtersState.timeSlot);
    const timeMatch = !filtersState.timeSlot || r.availableSlots.some(time => String(time).slice(0, 5) === desired24);
    
    return searchMatch && cuisineMatch && ratingMatch && distanceMatch && timeMatch;
  });
  renderRestaurants(filtered);
}

function init() {
  initializeData();
  initDropdownFilters();
  
  const searchInput = document.querySelector('#searchInput');
  if(searchInput) {
      searchInput.addEventListener('input', (e) => {
        filtersState.searchQuery = e.target.value;
        executeFiltering();
      });
  }

  executeFiltering();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
    if (typeof DinetimeStore.syncFromBackend === 'function') {
      try {
        await DinetimeStore.syncFromBackend();
      } catch (_e) {
      }
    }
  }
  init();
});
