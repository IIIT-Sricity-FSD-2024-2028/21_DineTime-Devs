const DinetimeStore = {
  API_BASE: (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000',
  USER_KEY: 'dinetime_v3_user',
  SETTINGS_KEY: 'dinetime_v3_settings',
  CACHE_KEY: 'dinetime_v3_backend_cache',
  _cache: {
    restaurants: [],
    categories: [],
    menu: [],
    tables: [],
    reservations: [],
    notifications: [],
    timeslots: [],
    reviews: [],
  },
  _readyPromise: null,
  _autoSyncTimer: null,

  init() {
    const saved = this._readJson(this.CACHE_KEY, null);
    if (saved && typeof saved === 'object') {
      this._cache = { ...this._cache, ...saved };
    }

    if (!this._readJson(this.SETTINGS_KEY, null)) {
      this._writeJson(this.SETTINGS_KEY, {
        notifications: true,
        smsAlerts: false,
        promotions: true,
        language: 'English',
        currency: 'INR (Rs)',
        dietary: 'None',
      });
    }

    this._readyPromise = this._bootstrap();
  },

  ready() {
    if (!this._readyPromise) {
      this._readyPromise = this._bootstrap();
    }
    return this._readyPromise;
  },

  async _bootstrap() {
    try {
      await this._ensureUserSynced();
      await this.syncFromBackend();
      this._startAutoSync();
    } catch (error) {
      console.error('DinetimeStore bootstrap failed:', error);
    }
    document.dispatchEvent(new CustomEvent('dinetime:store-ready'));
  },

  _startAutoSync() {
    if (this._autoSyncTimer) return;
    this._autoSyncTimer = setInterval(() => {
      this.syncFromBackend().catch(() => {});
    }, 15000);

    window.addEventListener('focus', () => {
      this.syncFromBackend().catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncFromBackend().catch(() => {});
      }
    });
  },

  _readJson(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_e) {
      return fallback;
    }
  },

  _writeJson(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  },

  _persistCache() {
    this._writeJson(this.CACHE_KEY, this._cache);
  },

  _assetUrl(url) {
    if (!url) return url;
    const value = String(url);
    if (value.startsWith('/uploads/')) {
      return `${this.API_BASE}${value}`;
    }
    return value;
  },

  _assetKey(url) {
    const value = String(url || '').trim();
    return value.replace(this.API_BASE, '');
  },

  _uniqueAssetUrls(urls) {
    const seen = new Set();
    return (Array.isArray(urls) ? urls : [])
      .map((url) => this._assetUrl(url))
      .filter(Boolean)
      .filter((url) => {
        const key = this._assetKey(url);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  },

  _headers(role = 'diner') {
    return {
      'Content-Type': 'application/json',
      role,
    };
  },

  _authHeaders(role = 'diner') {
    return {
      role,
    };
  },

  _splitDescriptionSections(description) {
    const raw = String(description || '').trim();
    const detailsMarker = 'Details:';
    const policiesMarker = 'Policies:';
    const detailsIndex = raw.indexOf(detailsMarker);
    const policiesIndex = raw.indexOf(policiesMarker);
    const firstStructuredIndex = [detailsIndex, policiesIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    const about = firstStructuredIndex >= 0 ? raw.slice(0, firstStructuredIndex).trim() : raw;
    const detailsBlock = detailsIndex >= 0
      ? raw.slice(detailsIndex + detailsMarker.length, policiesIndex > detailsIndex ? policiesIndex : raw.length)
      : '';
    const policiesBlock = policiesIndex >= 0
      ? raw.slice(policiesIndex + policiesMarker.length)
      : '';

    const details = {};
    String(detailsBlock || '')
      .split('\n')
      .map((line) => line.trim().replace(/^-\s*/, ''))
      .filter(Boolean)
      .forEach((line) => {
        const [label, ...rest] = line.split(':');
        const key = String(label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const value = rest.join(':').trim();
        if (key && value) {
          details[key] = value;
        }
      });

    const policies = String(policiesBlock || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const cleaned = line.replace(/^-\s*/, '');
        const [title, ...rest] = cleaned.split(':');
        return {
          title: (title || 'Policy').trim(),
          desc: rest.join(':').trim(),
        };
      })
      .filter((policy) => policy.title || policy.desc);

    return {
      about,
      details,
      policies,
    };
  },

  async _request(path, options = {}) {
    const response = await fetch(`${this.API_BASE}${path}`, options);
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        message = body.message || message;
      } catch (_e) {
      }
      throw new Error(message);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  },

  _normalizeRestaurant(raw, index, locationMap, menuByRestaurant, reviewsByRestaurant) {
    const location = locationMap[raw.location_id];
    const city = location?.city || 'Bangalore';
    const address = location?.address || 'City Center';
    const images = this._uniqueAssetUrls(raw.image_urls || []);

    const menuImages = this._uniqueAssetUrls((menuByRestaurant[raw.id] || []).map((item) => item.image));

    const reviews = reviewsByRestaurant[raw.id] || [];
    const ratingFallback = raw.rating_avg || 4.5;
    const reviewCountFallback = raw.total_reviews || reviews.length;

    const restaurantSlots = this._cache.timeslots
      .filter((slot) => slot.restaurant_id === raw.id)
      .sort((a, b) => {
        const da = String(a.slot_date || a.date || '');
        const db = String(b.slot_date || b.date || '');
        if (da !== db) return da.localeCompare(db);
        return String(a.start_time || '').localeCompare(String(b.start_time || ''));
      });
    const availableSlots = Array.from(new Set(
      restaurantSlots
        .map((slot) => String(slot.start_time || '').slice(0, 5))
        .filter(Boolean),
    ));
    const sections = this._splitDescriptionSections(raw.description);
    const amenities = String(sections.details.amenities || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const openingHours = sections.details.hours || sections.details.openinghours || 'Hours not provided';

    return {
      id: index + 1,
      backend_id: raw.id,
      name: raw.name,
      cuisine: raw.cuisine_type,
      subtitle: `${raw.cuisine_type} - ${city}`,
      rating: ratingFallback,
      reviewCount: reviewCountFallback,
      distance: Number((1.2 + index * 0.6).toFixed(1)),
      location: `${address}, ${city}`,
      price: sections.details.price || 'Price not provided',
      availableSlots,
      amenities: amenities.length ? amenities : ['Amenities not provided'],
      image: images[0] || '../images/indian.jpg',
      images,
      description: sections.about || raw.description,
      policies: sections.policies,
      phone: sections.details.contact || sections.details.phone || 'Contact not provided',
      openingHours,
      parking: sections.details.parking || 'Parking not provided',
      dressCode: sections.details.dresscode || 'Dress code not provided',
      operationalHours: [
        { days: 'Everyday', hours: openingHours, isOpen: openingHours !== 'Hours not provided' },
      ],
      menuImages: menuImages.slice(0, 4),
      reviews,
    };
  },

  _normalizeTable(table, slotStatus) {
    const statusMap = {
      available: 'available',
      reserved: 'reserved',
      occupied: 'unavailable',
    };

    return {
      id: Number(String(table.table_number).replace(/\D/g, '')) || table.table_number,
      backend_table_id: table.id,
      restaurant_id: table.restaurant_id,
      slot_id: slotStatus?.slot_id || '',
      name: `Table ${table.table_number}`,
      seats: table.capacity,
      status: statusMap[slotStatus?.status] || 'available',
    };
  },

  _normalizeReservation(raw, restaurantMap, review) {
    const restaurant = restaurantMap[raw.restaurant_id];
    const statusValue = raw.reservation_status || raw.status || 'reserved';
    return {
      id: raw.id,
      backend_id: raw.id,
      restaurant: restaurant?.name || 'Restaurant',
      image: this._assetUrl(restaurant?.image) || '../images/indian.jpg',
      date: raw.slot_date || new Date().toISOString().split('T')[0],
      time: raw.slot_time || '7:00 PM',
      guests: raw.guest_count,
      status:
        statusValue === 'reserved'
          ? 'Confirmed'
          : statusValue === 'checked_in'
            ? 'Confirmed'
          : statusValue === 'completed'
            ? 'Completed'
            : statusValue === 'cancelled'
              ? 'Cancelled'
              : statusValue === 'no_show'
                ? 'Cancelled'
              : 'Confirmed',
      tableType: 'Indoor Seating',
      location: restaurant?.location || 'City',
      table_id: raw.table_id,
      slot_id: raw.slot_id,
      restaurant_id: raw.restaurant_id,
      user_id: raw.user_id,
      hasRated: Boolean(review),
      rating: review?.rating,
      reviewText: review?.comment,
    };
  },

  _normalizeDateToIso(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  _normalizeTimeTo24(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{2}:\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!match) return raw;
    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  },

  async _resolveReservationSelection(payload, restaurantBackendId) {
    const dateIso = this._normalizeDateToIso(payload.date);
    const time24 = this._normalizeTimeTo24(payload.time);
    const guests = Number(payload.guests || 2);
    const slots = this.getTimeslots();
    const tables = this.getTables();
    const slot = slots.find((item) =>
      item.restaurant_id === restaurantBackendId &&
      (!dateIso || this._normalizeDateToIso(item.slot_date || item.date) === dateIso) &&
      (!time24 || this._normalizeTimeTo24(item.start_time) === time24),
    ) || slots.find((item) => item.restaurant_id === restaurantBackendId);

    if (!slot) {
      return null;
    }

    const availability = await this._request(
      `/tableslots/availability?restaurant_id=${restaurantBackendId}&slot_id=${slot.id}`,
      { headers: this._headers('diner') },
    );

    const available = (availability?.data || []).find((item) => {
      const table = tables.find((candidate) => candidate.backend_table_id === item.table_id);
      return item.status === 'available' && table && Number(table.seats || 0) >= guests;
    });

    if (!available) {
      return null;
    }

    return {
      slot_id: slot.id,
      table_id: available.table_id,
    };
  },

  async _ensureUserSynced() {
    const user = this.getUser();
    if (!user || user.backend_user_id) {
      return;
    }

    const email = (user.email || '').toLowerCase();
    if (email) {
      try {
        const usersRes = await this._request('/users', {
          headers: this._headers('manager'),
        });
        const users = usersRes?.data || [];
        const existing = users.find((u) => (u.email || '').toLowerCase() === email);
        if (existing?.id) {
          this.setUser({ ...user, backend_user_id: existing.id });
          return;
        }
      } catch (_e) {
      }
    }

    try {
      const created = await this._request('/users', {
        method: 'POST',
        headers: this._headers('diner'),
        body: JSON.stringify({
          name: user.name || 'Diner User',
          email: user.email || `guest_${Date.now()}@example.com`,
          phone: user.phone || '',
          password_hash: user.password || `local_${Date.now()}`,
          role: 'diner',
          status: 'active',
          location_id: user.location_id || 'loc_blr_1',
        }),
      });

      if (created?.data?.id) {
        this.setUser({ ...user, backend_user_id: created.data.id });
      }
    } catch (_e) {
      if (email) {
        try {
          const usersRes = await this._request('/users', {
            headers: this._headers('manager'),
          });
          const users = usersRes?.data || [];
          const existing = users.find((u) => (u.email || '').toLowerCase() === email);
          if (existing?.id) {
            this.setUser({ ...user, backend_user_id: existing.id });
          }
        } catch (_ignored) {
        }
      }
    }
  },

  async syncFromBackend() {
    const [restaurantsRes, menuRes, tablesRes, slotsRes, reviewsRes, usersRes] = await Promise.all([
      this._request('/restaurants', { headers: this._headers('diner') }),
      this._request('/menu', { headers: this._headers('diner') }),
      this._request('/tables', { headers: this._headers('diner') }),
      this._request('/timeslots', { headers: this._headers('diner') }),
      this._request('/reviews', { headers: this._headers('diner') }),
      this._request('/users', { headers: this._headers('manager') }),
    ]);

    const rawRestaurants = restaurantsRes?.data || [];
    const uniqueRestaurants = [];
    const seenRestaurantKeys = new Set();

    rawRestaurants.forEach((restaurant) => {
      const key = `${String(restaurant.name || '').trim().toLowerCase()}::${String(restaurant.location_id || '').trim().toLowerCase()}`;
      if (seenRestaurantKeys.has(key)) {
        return;
      }
      seenRestaurantKeys.add(key);
      uniqueRestaurants.push(restaurant);
    });
    const rawTables = tablesRes?.data || [];
    const rawSlots = slotsRes?.data || [];
    this._cache.timeslots = rawSlots;

    const rawReviews = reviewsRes?.data || [];
    const rawUsers = usersRes?.data || [];
    const userById = {};
    rawUsers.forEach((user) => {
      userById[user.id] = user;
    });

    this._cache.reviews = rawReviews.map((review) => {
      const reviewer = userById[review.user_id];
      return {
        id: review.id,
        restaurant_id: review.restaurant_id,
        user_id: review.user_id,
        reservation_id: review.reservation_id,
        name: reviewer?.name || 'Guest',
        stars: review.rating,
        text: review.comment,
        avatar: '../images/logo.png',
      };
    });

    const reviewsByRestaurant = {};
    this._cache.reviews.forEach((review) => {
      if (!reviewsByRestaurant[review.restaurant_id]) {
        reviewsByRestaurant[review.restaurant_id] = [];
      }
      reviewsByRestaurant[review.restaurant_id].push(review);
    });

    const locationMap = {};
    await Promise.all(
      uniqueRestaurants.map(async (restaurant) => {
        try {
          const loc = await this._request(`/restaurants/locations/${restaurant.location_id}`, {
            headers: this._headers('diner'),
          });
          if (loc?.data) {
            locationMap[restaurant.location_id] = loc.data;
          }
        } catch (_e) {
        }
      }),
    );

    const menuItems = (menuRes?.data || []).map((item, index) => ({
      id: index + 1,
      backend_id: item.id,
      restaurant_id: item.restaurant_id,
      name: item.item_name || item.name,
      cat: item.category,
      price: item.price,
      image: this._assetUrl((item.image_urls && item.image_urls[0]) || '../images/starter.png'),
      isChefSpecial: index % 4 === 0,
      is_available: item.is_available ?? item.availability,
    }));

    this._cache.menu = menuItems;

    const menuByRestaurant = {};
    menuItems.forEach((item) => {
      if (!menuByRestaurant[item.restaurant_id]) {
        menuByRestaurant[item.restaurant_id] = [];
      }
      menuByRestaurant[item.restaurant_id].push(item);
    });

    this._cache.restaurants = uniqueRestaurants.map((restaurant, index) =>
      this._normalizeRestaurant(restaurant, index, locationMap, menuByRestaurant, reviewsByRestaurant),
    );

    this._cache.categories = Array.from(new Set(this._cache.restaurants.map((restaurant) => restaurant.cuisine))).map((name) => ({
      name,
      image: '../images/indian.jpg',
    }));

    this._cache.tables = rawTables.map((table) => this._normalizeTable(table));

    const user = this.getUser();
    if (user?.backend_user_id) {
      try {
        const userRes = await this._request(`/users/${user.backend_user_id}`, {
          headers: this._headers('diner'),
        });
        if (userRes?.data) {
          this.setUser({
            ...user,
            name: userRes.data.name,
            email: userRes.data.email,
            phone: userRes.data.phone,
            location_id: userRes.data.location_id,
            role: userRes.data.role || user.role || 'diner',
            photo_url: userRes.data.photo_url || user.photo_url,
            photo: this._assetUrl(userRes.data.photo_url || user.photo),
          });
        }
      } catch (_e) {
      }

      const [reservationsRes, notificationsRes] = await Promise.all([
        this._request(`/reservations?user_id=${user.backend_user_id}`, { headers: this._headers('diner') }),
        this._request(`/notifications?user_id=${user.backend_user_id}`, { headers: this._headers('diner') }),
      ]);

      const restaurantMap = {};
      this._cache.restaurants.forEach((restaurant) => {
        restaurantMap[restaurant.backend_id] = restaurant;
      });

      this._cache.reservations = (reservationsRes?.data || []).map((reservation) => {
        const slot = rawSlots.find((candidate) => candidate.id === reservation.slot_id);
        const review = this._cache.reviews.find((item) => item.reservation_id === reservation.id);
        return this._normalizeReservation({
          ...reservation,
          slot_date: slot?.slot_date || slot?.date,
          slot_time: slot?.start_time,
        }, restaurantMap, review ? { rating: review.stars, comment: review.text } : null);
      });

      this._cache.notifications = (notificationsRes?.data || []).map((notification) => ({
        id: notification.id,
        title: notification.type,
        desc: notification.message,
      }));
    }

    this._persistCache();
    document.dispatchEvent(new CustomEvent('dinetime:sync-complete', { detail: this._cache }));
  },

  getUser() { return this._readJson(this.USER_KEY, null); },
  setUser(data) { this._writeJson(this.USER_KEY, data); void this._ensureUserSynced(); },
  getSettings() { return this._readJson(this.SETTINGS_KEY, {}); },
  setSettings(data) { this._writeJson(this.SETTINGS_KEY, data); },
  getReservations() { return [...this._cache.reservations]; },
  setReservations(data) { this._cache.reservations = Array.isArray(data) ? [...data] : []; this._persistCache(); },
  getCategories() { return [...this._cache.categories]; },
  setCategories(data) { this._cache.categories = Array.isArray(data) ? [...data] : []; this._persistCache(); },
  getRestaurants() { return [...this._cache.restaurants]; },
  setRestaurants(data) { this._cache.restaurants = Array.isArray(data) ? [...data] : []; this._persistCache(); },
  getMenu() { return [...this._cache.menu]; },
  setMenu(data) { this._cache.menu = Array.isArray(data) ? [...data] : []; this._persistCache(); },
  getTables() { return [...this._cache.tables]; },
  setTables(data) { this._cache.tables = Array.isArray(data) ? [...data] : []; this._persistCache(); },
  getTimeslots() { return [...this._cache.timeslots]; },
  getNotifications() { return [...this._cache.notifications]; },
  getReviews() { return [...this._cache.reviews]; },

  getQR() {
    const qr = {};
    this._cache.reservations.forEach((reservation) => {
      qr[reservation.id] = Array.from({ length: 36 }, (_value, index) => (reservation.id.charCodeAt(index % reservation.id.length) + index) % 2);
    });
    return qr;
  },

  setQR(_data) {},

  async addReservation(reservationPayload) {
    let user = this.getUser();
    if (!user?.backend_user_id) {
      await this._ensureUserSynced();
      user = this.getUser();
    }
    if (!user?.backend_user_id) {
      throw new Error('User account is not synced. Please log in again and retry.');
    }

    const restaurants = this.getRestaurants();
    const restaurant = restaurants.find((item) => item.id === Number(reservationPayload.restaurantId)) || restaurants[0];
    const restaurantBackendId = reservationPayload.restaurant_backend_id || restaurant?.backend_id;
    let slotId = reservationPayload.slot_id || '';
    let tableId = reservationPayload.table_id || reservationPayload.backend_table_id || '';

    if ((!slotId || !tableId) && restaurantBackendId) {
      const resolved = await this._resolveReservationSelection(reservationPayload, restaurantBackendId);
      slotId = slotId || resolved?.slot_id || '';
      tableId = tableId || resolved?.table_id || '';
    }

    if (!restaurantBackendId || !slotId || !tableId) {
      throw new Error('Selected date/time slot is unavailable. Please pick another slot.');
    }

    const created = await this._request('/reservations', {
      method: 'POST',
      headers: this._headers('diner'),
      body: JSON.stringify({
        user_id: user.backend_user_id,
        restaurant_id: restaurantBackendId,
        table_id: tableId,
        slot_id: slotId,
        guest_count: Number(reservationPayload.guests || 2),
      }),
    });

    if (created?.data) {
      await this.syncFromBackend();
      return created.data;
    }

    throw new Error('Reservation could not be created.');
  },

  async cancelReservation(id) {
    await this._request(`/reservations/${id}`, {
      method: 'PATCH',
      headers: this._headers('diner'),
      body: JSON.stringify({ reservation_status: 'cancelled' }),
    });
    await this.syncFromBackend();
  },

  async addPayment(payload) {
    const created = await this._request('/payments', {
      method: 'POST',
      headers: this._headers('diner'),
      body: JSON.stringify(payload),
    });
    return created?.data || null;
  },

  async addReview(payload) {
    const created = await this._request('/reviews', {
      method: 'POST',
      headers: this._headers('diner'),
      body: JSON.stringify(payload),
    });
    await this.syncFromBackend();
    return created?.data || null;
  },

  async addOrder(payload) {
    const created = await this._request('/orders', {
      method: 'POST',
      headers: this._headers('diner'),
      body: JSON.stringify(payload),
    });
    return created?.data || null;
  },

  async uploadProfilePhoto(file) {
    const user = this.getUser();
    if (!user?.backend_user_id) {
      throw new Error('Please log in before uploading a profile photo.');
    }

    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetch(`${this.API_BASE}/users/${user.backend_user_id}/upload-photo`, {
      method: 'POST',
      headers: this._authHeaders('diner'),
      body: formData,
    });

    if (!response.ok) {
      let message = `Photo upload failed (${response.status})`;
      try {
        const body = await response.json();
        message = Array.isArray(body.message) ? body.message.join(', ') : (body.message || message);
      } catch (_e) {
      }
      throw new Error(message);
    }

    const payload = await response.json();
    const photoUrl = payload?.data?.photo_url;
    const nextUser = {
      ...user,
      photo: this._assetUrl(photoUrl || user.photo),
      photo_url: photoUrl || user.photo_url,
    };
    this.setUser(nextUser);
    return nextUser;
  },

  initNewUser() {
    this._cache.reservations = [];
    this._cache.notifications = [];
    this._writeJson(this.SETTINGS_KEY, {
      notifications: true,
      smsAlerts: false,
      promotions: true,
      language: 'English',
      currency: 'INR (Rs)',
      dietary: 'None',
    });
    this._persistCache();
    sessionStorage.removeItem('dinetime_booking_state');
    sessionStorage.removeItem('dinetime_payment_method');
    sessionStorage.removeItem('dinetime_cart');
  },
};

DinetimeStore.init();
