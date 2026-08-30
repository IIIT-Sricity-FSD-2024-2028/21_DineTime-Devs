class StorageManager {
    static API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';
    static SESSION_KEY = 'manager_session_v1';
    static IDS_KEY = 'manager_backend_ids_v1';
    static LOCAL_BLOCKS_KEY = 'manager_blocked_tables_v1';
    static _readyPromise = null;
    static _cache = {
        profile: {
            name: 'Manager',
            email: 'manager@dinetime.com',
            avatar: null,
            phone: '9000000000',
            city: 'Bangalore',
            restaurantName: 'Spice Garden',
            memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        },
        restaurant: {
            name: 'Spice Garden',
            about: 'Restaurant profile',
            cuisine: 'Indian',
            capacity: '0 seats',
            location: 'Bangalore',
            hours: '11:00 AM - 11:00 PM',
            parking: 'Street Parking',
            rating: '4.5',
            dressCode: 'Smart Casual',
            price: '500',
            contact: '9000000000',
            amenities: 'Family Friendly, Indoor Seating',
            image: 'images/restaurant.jpg',
        },
        policies: [
            { title: 'Cancellation Policy', desc: 'Cancellations must be made at least 2 hours in advance.' },
            { title: 'Late Arrival', desc: 'We hold tables for 15 minutes past reservation time.' },
        ],
        gallery: [],
        menu: [],
        reservations: [],
        staff: [],
        notifications: [],
        activity: { reservations: 0, availableTables: 0, avgRating: 0 },
        tables: [],
        blockedTables: [],
        reviews: [],
        timeSlotsConfig: {
            operatingHours: { open: '11:00', close: '23:00' },
            dates: {},
        },
    };

    static async ready() {
        if (!this._readyPromise) {
            this._readyPromise = this.init();
        }
        return this._readyPromise;
    }

    static async init() {
        await this._ensureManagerEntities();
        try {
            await this.refreshFromBackend();
        } catch (_e) {
        }
    }

    static _session() {
        const saved = JSON.parse(sessionStorage.getItem(this.SESSION_KEY) || '{}');
        return {
            email: saved.email || 'manager@dinetime.com',
            access_token: saved.access_token || '',
            role: 'manager',
        };
    }

    static _setSession(email, accessToken = '') {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({ email, access_token: accessToken }));
    }

    static _getIds() {
        return JSON.parse(sessionStorage.getItem(this.IDS_KEY) || '{}');
    }

    static _setIds(data) {
        sessionStorage.setItem(this.IDS_KEY, JSON.stringify(data));
    }

    static _assetUrl(url) {
        if (!url) return url;
        const value = String(url);
        if (value.startsWith('/uploads/')) {
            return `${this.API_BASE}${value}`;
        }
        return value;
    }

    static _assetKey(url) {
        return String(url || '').trim().replace(this.API_BASE, '');
    }

    static _assetPath(url) {
        const value = String(url || '').trim();
        return value.startsWith(this.API_BASE) ? value.slice(this.API_BASE.length) : value;
    }

    static _uniqueAssetUrls(urls) {
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
    }

    static async _request(path, options = {}) {
        const res = await fetch(`${this.API_BASE}${path}`, options);
        if (!res.ok) {
            throw new Error(`Request failed: ${res.status}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    }

    static _headers(role = 'manager') {
        return {
            'Content-Type': 'application/json',
            role,
        };
    }

    static async _ensureManagerEntities() {
        const session = this._session();
        const locationId = 'loc_blr_1';

        let managerId = null;
        try {
            const users = await this._request('/users', { headers: this._headers('manager') });
            const match = (users?.data || []).find((u) =>
                u.role === 'manager' &&
                String(u.email || '').toLowerCase() === session.email.toLowerCase(),
            );
            managerId = match?.id || null;
        } catch (_e) {}

        if (!managerId) {
            try {
            const createdUser = await this._request('/users', {
                method: 'POST',
                headers: this._headers('manager'),
                body: JSON.stringify({
                    name: 'Rahul Sharma',
                    email: session.email,
                    phone: this._cache.profile.phone,
                    password_hash: 'password123',
                    role: 'manager',
                    status: 'active',
                    location_id: locationId,
                    business_license_number: 'BLN-9988',
                    government_id: 'GOV-7788',
                    verified_status: true,
                }),
            });
            managerId = createdUser?.data?.id;
            } catch (_e) {
                const users = await this._request('/users', { headers: this._headers('manager') });
                const match = (users?.data || []).find((u) =>
                    u.role === 'manager' &&
                    String(u.email || '').toLowerCase() === session.email.toLowerCase(),
                );
                managerId = match?.id;
            }
        }

        try {
            await this._request('/restaurants/locations', {
                method: 'POST',
                headers: this._headers('manager'),
                body: JSON.stringify({
                    id: locationId,
                    latitude: 12.9716,
                    longitude: 77.5946,
                    city: 'Bangalore',
                    pincode: '560001',
                    address: 'MG Road, Bangalore',
                    country: 'India',
                }),
            });
        } catch (_e) {}

        let restaurantId = null;
        const restaurants = await this._request('/restaurants', { headers: this._headers('manager') });
        const all = restaurants?.data || [];
        const normalizedName = 'spice garden';
        const existingOwned = all.find((r) => r.manager_id === managerId && String(r.name || '').toLowerCase() === normalizedName)
            || all.find((r) => r.manager_id === managerId);
        const seededMatch = all.find((r) =>
            String(r.name || '').toLowerCase() === normalizedName
            && r.location_id === locationId,
        );

        if (existingOwned) {
            restaurantId = existingOwned.id;
        } else if (seededMatch) {
            restaurantId = seededMatch.id;
            try {
                await this._request(`/restaurants/${restaurantId}`, {
                    method: 'PATCH',
                    headers: this._headers('manager'),
                    body: JSON.stringify({
                        manager_id: managerId,
                    }),
                });
            } catch (_e) {}
        } else {
            const createdRestaurant = await this._request('/restaurants', {
                method: 'POST',
                headers: this._headers('manager'),
                body: JSON.stringify({
                    manager_id: managerId,
                    location_id: locationId,
                    name: 'Spice Garden',
                    cuisine_type: 'Indian',
                    description: 'Authentic Indian dining.',
                }),
            });
            restaurantId = createdRestaurant?.data?.id;
        }

        this._setIds({ managerId, restaurantId, locationId });
    }

    static async refreshFromBackend() {
        const ids = this._getIds();
        if (!ids.managerId || !ids.restaurantId) {
            return;
        }

        const [usersRes, restaurantsRes, tablesRes, slotsRes, menuRes, reservationRes, reviewRes, notifRes] = await Promise.all([
            this._request('/users', { headers: this._headers('manager') }),
            this._request('/restaurants', { headers: this._headers('manager') }),
            this._request(`/tables?restaurant_id=${ids.restaurantId}`, { headers: this._headers('manager') }),
            this._request(`/timeslots?restaurant_id=${ids.restaurantId}`, { headers: this._headers('manager') }),
            this._request(`/menu?restaurant_id=${ids.restaurantId}`, { headers: this._headers('manager') }),
            this._request(`/reservations?restaurant_id=${ids.restaurantId}`, { headers: this._headers('manager') }),
            this._request(`/reviews?restaurant_id=${ids.restaurantId}`, { headers: this._headers('manager') }),
            this._request('/notifications', { headers: this._headers('manager') }),
        ]);

        const users = usersRes?.data || [];
        const restaurants = restaurantsRes?.data || [];
        const tables = tablesRes?.data || [];
        const slots = slotsRes?.data || [];
        const menu = menuRes?.data || [];
        const reservations = reservationRes?.data || [];
        const reviews = reviewRes?.data || [];
        const notifications = notifRes?.data || [];

        const manager = users.find((u) => u.id === ids.managerId) || users.find((u) => u.role === 'manager') || this._cache.profile;
        const managerRestaurants = restaurants.filter((r) => r.manager_id === ids.managerId);
        const restaurant = managerRestaurants.find((r) => String(r.name || '').toLowerCase() === 'spice garden')
            || managerRestaurants.find((r) => r.id === ids.restaurantId)
            || managerRestaurants[0]
            || restaurants.find((r) => String(r.name || '').toLowerCase() === 'spice garden')
            || restaurants[0]
            || this._cache.restaurant;

        if (restaurant?.id && restaurant.id !== ids.restaurantId) {
            this._setIds({ ...ids, restaurantId: restaurant.id });
        }

        const userById = {};
        users.forEach((u) => { userById[u.id] = u; });

        this._cache.profile = {
            ...this._cache.profile,
            name: manager.name || this._cache.profile.name,
            email: manager.email || this._cache.profile.email,
            phone: manager.phone || this._cache.profile.phone,
            city: 'Bangalore',
            restaurantName: restaurant.name || this._cache.profile.restaurantName,
            avatar: this._assetUrl(manager.photo_url || this._cache.profile.avatar),
        };

        const parsedDetails = this._extractDetails(restaurant.description);
        const gallery = this._uniqueAssetUrls(restaurant.image_urls || []);

        this._cache.restaurant = {
            ...this._cache.restaurant,
            name: restaurant.name,
            about: this._extractAbout(restaurant.description),
            cuisine: restaurant.cuisine_type,
            capacity: `${tables.length} tables`,
            location: 'Bangalore',
            hours: parsedDetails.hours || this._cache.restaurant.hours,
            parking: parsedDetails.parking || this._cache.restaurant.parking,
            rating: restaurant.rating_avg || this._cache.restaurant.rating,
            dressCode: parsedDetails.dresscode || this._cache.restaurant.dressCode,
            price: parsedDetails.price || this._cache.restaurant.price,
            contact: parsedDetails.contact || restaurant.phone || this._cache.profile.phone,
            amenities: parsedDetails.amenities || this._cache.restaurant.amenities || 'Family Friendly, Indoor Seating',
            image: gallery[0] || this._assetUrl(this._cache.restaurant.image),
        };

        const parsedPolicies = this._extractPolicies(restaurant.description);
        if (parsedPolicies) {
            this._cache.policies = parsedPolicies;
        }

        this._cache.gallery = gallery;

        this._cache.tables = tables.map((t) => ({
            id: t.id,
            number: `Table ${t.table_number}`,
            seats: t.capacity,
        }));

        this._cache.menu = menu.map((m) => ({
            id: m.id,
            name: m.item_name || m.name,
            category: m.category,
            price: m.price,
            available: m.is_available ?? m.availability,
            image: this._assetUrl((m.image_urls && m.image_urls[0]) || 'images/dish-1.jpg'),
        }));

        this._cache.reservations = reservations
            .filter((r) => r.restaurant_id === ids.restaurantId)
            .map((r) => {
                const user = userById[r.user_id] || {};
                const table = this._cache.tables.find((t) => t.id === r.table_id);
                const slot = slots.find((s) => s.id === r.slot_id);
                const statusValue = r.reservation_status || r.status;
                return {
                    id: r.id,
                    name: user.name || 'Guest',
                    email: user.email || 'guest@example.com',
                    phone: user.phone || '-',
                    date: slot?.slot_date || slot?.date || new Date().toISOString().split('T')[0],
                    time: slot?.start_time || '19:00',
                    guests: r.guest_count,
                    table: table ? table.number : 'Table',
                    status: statusValue === 'reserved'
                        ? 'Pending'
                        : statusValue === 'checked_in'
                            ? 'Confirmed'
                            : statusValue === 'completed'
                                ? 'Complete'
                                : statusValue === 'cancelled' || statusValue === 'no_show'
                                    ? 'Cancelled'
                                    : 'Pending',
                    request: 'Online Booking',
                };
            });

        this._cache.reviews = reviews.map((r) => ({
            id: r.id,
            reservationId: r.reservation_id,
            author: userById[r.user_id]?.name || 'Guest',
            initials: (userById[r.user_id]?.name || 'G').split(' ').map((x) => x[0]).join('').slice(0, 2),
            date: r.created_at,
            rating: r.rating,
            comment: r.comment,
            verified: true,
            status: 'Pending',
            reply: '',
        }));

        this._cache.staff = users
            .filter((u) => u.role === 'staff' && (!restaurant?.id || u.restaurant_id === restaurant.id))
            .map((u) => ({
                id: u.id,
                name: u.name,
                initials: u.name.split(' ').map((x) => x[0]).join('').slice(0, 2),
                role: 'Restaurant Staff',
                email: u.email,
                phone: u.phone || '-',
                requestedOn: new Date().toLocaleDateString('en-IN'),
                status: u.status === 'active' ? 'Approved' : 'Pending',
            }));

        this._cache.notifications = notifications
            .filter((n) => n.user_id === ids.managerId)
            .map((n) => ({
                id: n.id,
                type: n.type,
                text: n.message,
                time: n.created_at,
                read: n.is_read,
                icon: 'ph-bell',
                iconColor: 'text-orange',
                bgClass: 'bg-orange-light',
            }));

        const dates = {};
        slots.forEach((slot) => {
            const slotDate = slot.slot_date || slot.date;
            if (!dates[slotDate]) {
                dates[slotDate] = { isClosed: false, slots: [] };
            }
            dates[slotDate].slots.push({
                id: slot.id,
                start: slot.start_time,
                end: slot.end_time,
                text: `${slot.start_time} - ${slot.end_time}`,
                maxTables: this._cache.tables.length,
            });
        });
        this._cache.timeSlotsConfig = {
            operatingHours: { open: '11:00', close: '23:00' },
            dates,
        };

        this._cache.blockedTables = JSON.parse(sessionStorage.getItem(this.LOCAL_BLOCKS_KEY) || '[]');
        this._cache.activity = {
            reservations: this._cache.reservations.length,
            availableTables: this._cache.tables.length,
            avgRating: this._cache.reviews.length
                ? Number((this._cache.reviews.reduce((a, b) => a + Number(b.rating || 0), 0) / this._cache.reviews.length).toFixed(1))
                : 0,
        };
    }

    static getRawData() {
        return { currentUser: this._session().email, users: {} };
    }

    static saveRawData(_fullData) {}

    static getData() {
        return this._cache;
    }

    static saveData(activeUserData) {
        this._cache = { ...this._cache, ...activeUserData };
    }

    static createEmptyDataSet(email, restaurantName = 'My Restaurant') {
        return {
            ...this._cache,
            profile: { ...this._cache.profile, email, restaurantName },
        };
    }

    static login(email, accessToken = '') {
        const nextEmail = email.toLowerCase();
        const current = this._session();
        this._setSession(nextEmail, accessToken);
        if (current.email !== nextEmail) {
            sessionStorage.removeItem(this.IDS_KEY);
        }
        void this.ready();
    }

    static register(email, accountData, restaurantData) {
        this._setSession(email.toLowerCase());
        this._cache.profile = {
            ...this._cache.profile,
            name: accountData.name || this._cache.profile.name,
            email: email.toLowerCase(),
            phone: accountData.phone || this._cache.profile.phone,
            restaurantName: restaurantData.name || this._cache.profile.restaurantName,
        };
        void this._ensureManagerEntities().then(() => this.refreshFromBackend());
    }

    static logout() {}

    static getCurrentUser() {
        return this._session().email;
    }

    static updateProfile(profileUpdates) {
        this._cache.profile = { ...this._cache.profile, ...profileUpdates };
        const ids = this._getIds();
        if (ids.managerId) {
            const payload = {
                name: this._cache.profile.name,
                email: this._cache.profile.email,
                phone: this._cache.profile.phone,
            };
            if (Object.prototype.hasOwnProperty.call(profileUpdates, 'avatar')) {
                payload.photo_url = profileUpdates.avatar || '';
            }
            void this._request(`/users/${ids.managerId}`, {
                method: 'PATCH',
                headers: this._headers('manager'),
                body: JSON.stringify(payload),
            });
        }
    }

    static async uploadProfilePhoto(file) {
        const ids = this._getIds();
        if (!ids.managerId) {
            throw new Error('Manager account is not linked to the backend.');
        }

        const formData = new FormData();
        formData.append('photo', file);
        const response = await fetch(`${this.API_BASE}/users/${ids.managerId}/upload-photo`, {
            method: 'POST',
            headers: { role: 'manager' },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Photo upload failed (${response.status})`);
        }

        const body = await response.json();
        const photoUrl = this._assetUrl(body?.data?.photo_url);
        this._cache.profile = { ...this._cache.profile, avatar: photoUrl };
        return this._cache.profile;
    }

    static _composeDescription(about, policies, details = this._cache.restaurant) {
        const detailRows = [
            ['Price', details.price],
            ['Hours', details.hours],
            ['Parking', details.parking],
            ['Dress Code', details.dressCode],
            ['Contact', details.contact],
            ['Amenities', details.amenities],
        ].filter(([, value]) => String(value || '').trim());

        const blocks = [String(about || '').trim()].filter(Boolean);
        if (detailRows.length) {
            blocks.push(`Details:\n${detailRows.map(([label, value]) => `- ${label}: ${value}`).join('\n')}`);
        }

        if (!Array.isArray(policies) || policies.length === 0) {
            return blocks.join('\n\n').trim();
        }
        const lines = policies
            .filter((p) => p && (p.title || p.desc))
            .map((p) => `- ${p.title || 'Policy'}: ${p.desc || ''}`.trim());
        if (lines.length) {
            blocks.push(`Policies:\n${lines.join('\n')}`);
        }
        return blocks.join('\n\n').trim();
    }

    static _extractStructuredBlock(description, marker, nextMarkers = []) {
        const raw = String(description || '');
        const start = raw.indexOf(marker);
        if (start < 0) return '';
        const blockStart = start + marker.length;
        const blockEnd = nextMarkers
            .map((nextMarker) => raw.indexOf(nextMarker, blockStart))
            .filter((index) => index >= 0)
            .sort((a, b) => a - b)[0] || raw.length;
        return raw.slice(blockStart, blockEnd);
    }

    static _extractDetails(description) {
        const block = this._extractStructuredBlock(description, 'Details:', ['Policies:']);
        const details = {};
        block
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
        return details;
    }

    static _extractPolicies(description) {
        if (!description || !description.includes('Policies:')) {
            return null;
        }
        const policyLines = this._extractStructuredBlock(description, 'Policies:')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        return policyLines.map((line) => {
            const cleaned = line.replace(/^-\s*/, '');
            const [title, ...rest] = cleaned.split(':');
            return {
                title: (title || 'Policy').trim(),
                desc: rest.join(':').trim(),
            };
        });
    }

    static _extractAbout(description) {
        if (!description) {
            return '';
        }

        const raw = String(description);
        const indexes = ['Details:', 'Policies:']
            .map((marker) => raw.indexOf(marker))
            .filter((index) => index >= 0)
            .sort((a, b) => a - b);
        return raw.slice(0, indexes.length ? indexes[0] : raw.length).trim();
    }

    static updateRestaurantDetails(restUpdates) {
        this._cache.restaurant = { ...this._cache.restaurant, ...restUpdates };
        this._cache.gallery = this._uniqueAssetUrls(this._cache.gallery);
        const imageUrls = this._cache.gallery.map((image) => this._assetPath(image));
        const ids = this._getIds();
        if (ids.restaurantId) {
            void this._request(`/restaurants/${ids.restaurantId}`, {
                method: 'PATCH',
                headers: this._headers('manager'),
                body: JSON.stringify({
                    name: this._cache.restaurant.name,
                    cuisine_type: this._cache.restaurant.cuisine,
                    description: this._composeDescription(this._cache.restaurant.about, this._cache.policies, this._cache.restaurant),
                    image_urls: imageUrls,
                }),
            });
        }
    }

    static async uploadRestaurantImage(file, makePrimary = false) {
        const ids = this._getIds();
        if (!ids.restaurantId) {
            throw new Error('Restaurant is not linked to the backend.');
        }

        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch(`${this.API_BASE}/restaurants/${ids.restaurantId}/upload-image`, {
            method: 'POST',
            headers: { role: 'manager' },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Restaurant image upload failed (${response.status})`);
        }

        const body = await response.json();
        const rawImages = body?.data?.image_urls || [];
        const latestRaw = rawImages[rawImages.length - 1];
        const latest = this._assetUrl(latestRaw);
        const previousGallery = this._uniqueAssetUrls(this._cache.gallery || []);
        const nextGallery = this._uniqueAssetUrls(makePrimary
            ? [latest, ...previousGallery]
            : [...previousGallery, latest]);

        this._cache.gallery = nextGallery;
        this._cache.restaurant = {
            ...this._cache.restaurant,
            image: makePrimary ? latest : (this._cache.restaurant.image || latest),
        };

        if (makePrimary) {
            await this._request(`/restaurants/${ids.restaurantId}`, {
                method: 'PATCH',
                headers: this._headers('manager'),
                body: JSON.stringify({
                    image_urls: nextGallery.map((image) => this._assetPath(image)),
                    description: this._composeDescription(this._cache.restaurant.about, this._cache.policies, this._cache.restaurant),
                }),
            });
        }

        await this.refreshFromBackend();
        return this._cache.restaurant.image;
    }

    static updatePolicies(newPolicies) {
        this._cache.policies = Array.isArray(newPolicies) ? newPolicies : [];
        const ids = this._getIds();
        if (ids.restaurantId) {
            void this._request(`/restaurants/${ids.restaurantId}`, {
                method: 'PATCH',
                headers: this._headers('manager'),
                body: JSON.stringify({
                    description: this._composeDescription(this._cache.restaurant.about, this._cache.policies, this._cache.restaurant),
                }),
            });
        }
    }

    static getReservations() { return this._cache.reservations || []; }

    static updateReservationStatus(id, newStatus) {
        const reservation = this._cache.reservations.find((r) => r.id === id);
        if (reservation) {
            reservation.status = newStatus;
        }
        const statusMap = {
            Confirmed: 'checked_in',
            Pending: 'reserved',
            Complete: 'completed',
            Cancelled: 'cancelled',
        };
        void this._request(`/reservations/${id}`, {
            method: 'PATCH',
            headers: this._headers('manager'),
            body: JSON.stringify({ reservation_status: statusMap[newStatus] || 'reserved' }),
        }).then(() => this.refreshFromBackend());
    }

    static getMenu() { return this._cache.menu || []; }

    static addMenuItem(item) {
        const ids = this._getIds();
        const optimistic = {
            id: item.id || `menu_${Date.now()}`,
            ...item,
        };
        this._cache.menu.push(optimistic);
        if (ids.restaurantId) {
            void this._request('/menu', {
                method: 'POST',
                headers: this._headers('manager'),
                body: JSON.stringify({
                    restaurant_id: ids.restaurantId,
                    item_name: item.name,
                    category: item.category,
                    price: Number(item.price),
                    availability: item.available !== false,
                    image_urls: item.image ? [item.image] : [],
                }),
            }).then(() => this.refreshFromBackend());
        }
    }

    static updateMenuItem(id, updatedItem) {
        const index = this._cache.menu.findIndex((m) => m.id === id);
        if (index !== -1) {
            this._cache.menu[index] = { ...this._cache.menu[index], ...updatedItem };
        }
        void this._request(`/menu/${id}`, {
            method: 'PATCH',
            headers: this._headers('manager'),
            body: JSON.stringify({
                item_name: updatedItem.name,
                category: updatedItem.category,
                price: Number(updatedItem.price),
                availability: updatedItem.available,
                image_urls: updatedItem.image ? [updatedItem.image] : undefined,
            }),
        }).then(() => this.refreshFromBackend());
    }

    static deleteMenuItem(id) {
        this._cache.menu = this._cache.menu.filter((m) => m.id !== id);
        void this._request(`/menu/${id}`, {
            method: 'DELETE',
            headers: this._headers('manager'),
        });
    }

    static toggleMenuAvailability(id, date) {
        const item = this._cache.menu.find((m) => m.id === id);
        if (!item) return;
        const current = item.available !== false;
        item.available = !current;
        void this.updateMenuItem(id, { available: !current });
    }

    static getTables() {
        return this._cache.tables || [];
    }

    static async saveTableLayout(tablesArray) {
        const ids = this._getIds();
        const previousTables = this._cache.tables || [];
        // Immediately update cache for snappy UI, but we'll refresh properly after sync
        this._cache.tables = Array.isArray(tablesArray) ? (JSON.parse(JSON.stringify(tablesArray))) : [];
        
        if (!ids.restaurantId) return;

        const nextIds = new Set((tablesArray || []).map((t) => t.id));
        const existingIds = new Set((previousTables || []).map((t) => t.id));

        // 1. Deletions - Free up table numbers first
        const tablesToDelete = previousTables.filter((t) => !nextIds.has(t.id));
        for (const table of tablesToDelete) {
            try {
                await this._request(`/tables/${table.id}`, {
                    method: 'DELETE',
                    headers: this._headers('manager'),
                });
            } catch (e) {
                console.error(`Failed to delete table ${table.id}:`, e);
            }
        }

        // 2. Creations and Updates
        const promises = (tablesArray || []).map(async (table) => {
            const tableNumber = Math.floor(Number(String(table.number).replace(/\D/g, ''))) || 1;
            const capacity = Math.floor(Number(table.seats)) || 2;

            if (String(table.id).startsWith('temp-tbl-')) {
                // Creation
                try {
                    await this._request('/tables', {
                        method: 'POST',
                        headers: this._headers('manager'),
                        body: JSON.stringify({
                            restaurant_id: ids.restaurantId,
                            table_number: tableNumber,
                            capacity: capacity,
                        }),
                    });
                } catch (e) {
                    console.error(`Failed to create table:`, e);
                    throw e;
                }
            } else if (existingIds.has(table.id)) {
                // Update
                try {
                    await this._request(`/tables/${table.id}`, {
                        method: 'PATCH',
                        headers: this._headers('manager'),
                        body: JSON.stringify({
                            table_number: tableNumber,
                            capacity: capacity,
                        }),
                    });
                } catch (e) {
                    console.error(`Failed to update table ${table.id}:`, e);
                }
            }
        });

        try {
            await Promise.all(promises);
        } catch (e) {
            console.error('Some table updates failed:', e);
            throw e;
        }

        try {
            await this._request('/tableslots/seed', {
                method: 'POST',
                headers: this._headers('manager'),
                body: JSON.stringify({ restaurant_id: ids.restaurantId }),
            });
        } catch (e) {
            console.error('Failed to seed table-slot availability:', e);
        }

        // 3. Final Refresh to get real backend IDs and table-slot availability
        await this.refreshFromBackend();
    }

    static getBlockedTables() { return this._cache.blockedTables || []; }

    static blockTable(blockObject) {
        this._cache.blockedTables.push(blockObject);
        sessionStorage.setItem(this.LOCAL_BLOCKS_KEY, JSON.stringify(this._cache.blockedTables));
    }

    static unblockTable(index) {
        this._cache.blockedTables.splice(index, 1);
        sessionStorage.setItem(this.LOCAL_BLOCKS_KEY, JSON.stringify(this._cache.blockedTables));
    }

    static getStaff() { return this._cache.staff || []; }

    static updateStaffStatus(id, newStatus) {
        const member = this._cache.staff.find((s) => s.id === id);
        if (member) {
            member.status = newStatus;
        }

        const statusMap = {
            Approved: 'active',
            Pending: 'inactive',
            Rejected: 'inactive',
        };

        void this._request(`/users/${id}`, {
            method: 'PATCH',
            headers: this._headers('manager'),
            body: JSON.stringify({ status: statusMap[newStatus] || 'inactive' }),
        }).then(() => this.refreshFromBackend());
    }

    static getNotifications() { return this._cache.notifications || []; }

    static markAllNotificationsRead() {
        (this._cache.notifications || []).forEach((n) => { n.read = true; });
    }

    static getReviews() {
        return this._cache.reviews || [];
    }

    static saveReviewReply(reviewId, replyText) {
        const review = this._cache.reviews.find((r) => r.id === reviewId);
        if (review) {
            review.reply = replyText;
            review.status = 'Responded';
        }
    }

    static deleteReviewReply(reviewId) {
        const review = this._cache.reviews.find((r) => r.id === reviewId);
        if (review) {
            review.reply = null;
            review.status = 'Pending';
        }
    }
}

window.showConfirm = function(message, onConfirm, title = 'Confirm Deletion', confirmText = 'Delete') {
    const existing = document.querySelector('.custom-confirm-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay custom-confirm-overlay';
    overlay.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    overlay.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 12px; width: 400px; max-width: 90%; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 16px 0; font-size: 18px;">${title}</h3>
            <p style="color: #64748B; font-size: 14px; margin-bottom: 24px;">${message}</p>
            <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button class="btn btn-small confirm-cancel-btn" style="background: #F1F5F9; color: #475569; border: none;">Cancel</button>
                <button class="btn btn-small confirm-ok-btn" style="background: #527A59; color: white; border: none;">${confirmText}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.confirm-cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.confirm-ok-btn').addEventListener('click', () => { if (onConfirm) onConfirm(); overlay.remove(); });
};

document.addEventListener('DOMContentLoaded', async () => {
    await StorageManager.ready();
    const data = StorageManager.getData();
    if (data && data.profile) {
        document.querySelectorAll('.user-profile-widget').forEach(widget => {
            const nameEl = widget.querySelector('.user-info h4');
            if (nameEl) nameEl.textContent = data.profile.name;
            const avatarEl = widget.querySelector('.avatar-circle-small');
            if (avatarEl && data.profile.avatar) {
                avatarEl.innerHTML = `<img src="${data.profile.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            }
        });
    }
});
