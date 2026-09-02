// search.js

// Data fetched from DinetimeStore

function createResultBar(r) {
  const bar = document.createElement("div");
  bar.className = "result-bar";
  bar.innerHTML = `
    <img src="${r.image}" alt="${r.name}" class="result-img">
    <div class="result-info">
      <div class="result-name">${r.name}</div>
      <div class="result-cuisine">${r.cuisine}</div>
    </div>
    <div class="result-meta">
      <div class="result-rating"><i class="fa-solid fa-star"></i> ${r.reviewCount > 0 ? r.rating : 'New'}</div>
      <div class="result-distance">${r.distance} km</div>
    </div>
  `;

  bar.addEventListener("click", () => {
    window.location.href = `restaurant.html?id=${r.id}`;
  });

  return bar;
}

function handleSearch() {
  const inputEl = document.querySelector("#searchInput");
  if(!inputEl) return;

  const query = inputEl.value.toLowerCase();
  const listContainer = document.querySelector("#restaurant-list");
  const noResults = document.querySelector("#no-results");
  const resultsInfo = document.querySelector("#resultsInfo");

  const allRestaurants = DinetimeStore.getRestaurants();
  const filtered = allRestaurants.filter(r => 
    r.name.toLowerCase().includes(query) || 
    r.cuisine.toLowerCase().includes(query)
  );

  listContainer.innerHTML = "";

  if (filtered.length > 0) {
    noResults.classList.add("hidden");
    resultsInfo.textContent = query ? `Found ${filtered.length} matches` : "";
    filtered.forEach(r => listContainer.appendChild(createResultBar(r)));
  } else {
    noResults.classList.remove("hidden");
    resultsInfo.textContent = "";
  }
}

function init() {
  document.title = 'DineTime - Search';

  const searchInput = document.querySelector("#searchInput");
  const backBtn = document.querySelector("#backBtn");

  if(searchInput) searchInput.addEventListener("input", handleSearch);

  if(backBtn) {
      backBtn.addEventListener("click", () => {
        window.history.back();
      });
  }

  handleSearch();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
    await DinetimeStore.ready();
  }
  init();
});
