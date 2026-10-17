import { API_BASE, requireApiBase } from "./config";
import { bindSession, readBoundSession } from "../../../app/session";

class ManagerApi {
  static API_BASE = API_BASE;
  static SESSION_KEY = "manager_session_v1";
  static IDS_KEY = "manager_backend_ids_v1";
  static _readyPromise = null;
  static _cache = {
    profile: {
      name: "Manager",
      email: "manager@dinetime.com",
      avatar: null,
      phone: "9000000000",
      city: "Bangalore",
      restaurantName: "Spice Garden",
      memberSince: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    },
    restaurant: {
      name: "",
      about: "",
      cuisine: "",
      capacity: "0 tables",
      location: "",
      hours: "Not set yet",
      parking: "Not specified",
      rating: 0,
      dressCode: "Not specified",
      price: "Not set",
      contact: "",
      amenities: "Not specified",
      image: "",
      reservationFeePerGuest: 30,
      cancellationCutoffMinutes: 120,
      noShowGraceMinutes: 15,
    },
    policies: [],
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
      operatingHours: { open: "", close: "" },
      dates: {},
    },
    schedule: { weekly: [], rules: [] },
  };

  static async ready() {
    if (!this._readyPromise) {
      this._readyPromise = this.init().catch((err) => {
        // Allow retry next time ready() is called
        this._readyPromise = null;
        console.warn("[ManagerApi] init failed, will retry:", err.message);
      });
    }
    return this._readyPromise;
  }

  static async init() {
    await this._ensureManagerEntities();
    const session = this._session();
    const ids = this._getIds();
    if (session.email && (!ids.managerId || !ids.restaurantId)) {
      // Manager is logged in but restaurant not found yet — still load what we can
      console.warn(
        "[ManagerApi] Restaurant not linked to manager account yet, skipping data refresh.",
      );
      return;
    }
    await this.refreshFromBackend();
  }

  static _session() {
    const saved = readBoundSession(this.SESSION_KEY) || {};
    return {
      email: saved.email || "",
      access_token: saved.access_token || "",
      role: "manager",
    };
  }

  static _setSession(email, accessToken = "") {
    sessionStorage.setItem(
      this.SESSION_KEY,
      JSON.stringify(bindSession({ email, access_token: accessToken })),
    );
  }

  static _getIds() {
    return JSON.parse(sessionStorage.getItem(this.IDS_KEY) || "{}");
  }

  static _setIds(data) {
    sessionStorage.setItem(this.IDS_KEY, JSON.stringify(data));
  }

  static async _ensureLinkedRestaurant() {
    let ids = this._getIds();
    if (!ids.managerId || !ids.restaurantId) {
      await this._ensureManagerEntities();
      ids = this._getIds();
    }
    if (!ids.managerId || !ids.restaurantId) {
      throw new Error("Restaurant is not linked to this Manager account. Please sign in again.");
    }
    return ids;
  }

  static _assetUrl(url) {
    if (!url) return url;
    const value = String(url);
    if (value.startsWith("/uploads/")) {
      return `${this.API_BASE}${value}`;
    }
    if (value.startsWith("../images/") || value.startsWith("images/")) {
      return `/assets/${value.split("/").pop()}`;
    }
    return value;
  }

  static _assetKey(url) {
    return String(url || "")
      .trim()
      .replace(this.API_BASE, "");
  }

  static _assetPath(url) {
    const value = String(url || "").trim();
    if (value.startsWith(this.API_BASE)) return value.slice(this.API_BASE.length);
    if (value.startsWith("/assets/")) return `../images/${value.split("/").pop()}`;
    return value;
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
    const res = await fetch(`${requireApiBase()}${path}`, {
      cache: "no-store",
      ...options,
    });
    if (!res.ok) {
      if (res.status === 401 && this._session().email) {
        this.logout();
      }
      let message = `Request failed: ${res.status}`;
      try {
        const body = await res.json();
        message = Array.isArray(body.message) ? body.message.join(", ") : body.message || message;
      } catch (_e) {}
      throw new Error(message);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  static _headers(role = "manager") {
    const token = this._session().access_token;
    return {
      "Content-Type": "application/json",
      ...(role ? { role } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  static _authHeaders(role = "manager") {
    const token = this._session().access_token;
    return {
      ...(role ? { role } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  static async _ensureManagerEntities() {
    const session = this._session();
    if (!session.email) {
      return;
    }

    const existingIds = this._getIds();

    let managerId = null;
    try {
      const users = await this._request("/users", { headers: this._headers("manager") });
      const match = (users?.data || []).find(
        (u) =>
          u.role === "manager" &&
          String(u.email || "").toLowerCase() === session.email.toLowerCase(),
      );
      managerId = match?.id || null;
    } catch (_e) {}

    if (!managerId) {
      return;
    }

    let restaurantId = existingIds.restaurantId;
    let locationId = existingIds.locationId;
    try {
      const restaurants = await this._request("/restaurants", {
        headers: this._headers("manager"),
      });
      const ownedList = (restaurants?.data || []).filter((r) => r.manager_id === managerId);

      const validRestaurant = ownedList.find((r) => r.id === restaurantId);
      if (!validRestaurant) {
        restaurantId = ownedList[0]?.id || null;
        locationId = ownedList[0]?.location_id || null;
      } else {
        locationId = validRestaurant.location_id;
      }
    } catch (_e) {}

    this._setIds({ managerId, restaurantId, locationId });
  }

  static async refreshFromBackend() {
    const ids = this._getIds();
    if (!ids.managerId || !ids.restaurantId) {
      return;
    }

    const [
      usersRes,
      restaurantsRes,
      tablesRes,
      slotsRes,
      tableSlotsRes,
      menuRes,
      reservationRes,
      reviewRes,
      notifRes,
      managerDetailsRes,
      scheduleRes,
    ] = await Promise.all([
      this._request("/users", { headers: this._headers("manager") }),
      this._request("/restaurants", { headers: this._headers("manager") }),
      this._request(`/tables?restaurant_id=${ids.restaurantId}`, {
        headers: this._headers("manager"),
      }),
      this._request(`/timeslots?restaurant_id=${ids.restaurantId}`, {
        headers: this._headers("manager"),
      }),
      this._request(`/tableslots?restaurant_id=${ids.restaurantId}`, {
        headers: this._headers("manager"),
      }),
      this._request(`/menu?restaurant_id=${ids.restaurantId}`, {
        headers: this._headers("manager"),
      }),
      this._request(`/reservations?restaurant_id=${ids.restaurantId}`, {
        headers: this._headers("manager"),
      }),
      this._request(`/reviews?restaurant_id=${ids.restaurantId}`, {
        headers: this._headers("manager"),
      }),
      this._request("/notifications", { headers: this._headers("manager") }),
      this._request(`/managers/${ids.managerId}`, { headers: this._headers("manager") }),
      this._request(`/schedules?restaurant_id=${ids.restaurantId}`, {
        headers: this._headers("manager"),
      }),
    ]);

    this._cache.slotRecords = slotsRes?.data || [];
    this._cache.tableSlotRecords = tableSlotsRes?.data || [];
    this._cache.schedule = scheduleRes?.data || { weekly: [], rules: [] };
    const users = usersRes?.data || [];
    const restaurants = restaurantsRes?.data || [];
    const tables = tablesRes?.data || [];
    const slots = slotsRes?.data || [];
    const tableSlots = tableSlotsRes?.data || [];
    const menu = menuRes?.data || [];
    const reservations = reservationRes?.data || [];
    const reviews = reviewRes?.data || [];
    const notifications = notifRes?.data || [];

    const manager = users.find((u) => u.id === ids.managerId) || this._cache.profile;
    const managerDetails = managerDetailsRes?.data || {};
    const managerRestaurants = restaurants.filter((r) => r.manager_id === ids.managerId);
    const restaurant =
      managerRestaurants.find((r) => r.id === ids.restaurantId) || managerRestaurants[0] || {};

    if (restaurant?.id && restaurant.id !== ids.restaurantId) {
      this._setIds({ ...ids, restaurantId: restaurant.id });
    }

    const userById = {};
    users.forEach((u) => {
      userById[u.id] = u;
    });

    let location = null;
    if (restaurant.location_id) {
      try {
        const locationRes = await this._request(
          `/restaurants/locations/${restaurant.location_id}`,
          {
            headers: this._headers("manager"),
          },
        );
        location = locationRes?.data || null;
      } catch (_e) {}
    }
    const city = location?.city || "";

    this._cache.profile = {
      ...this._cache.profile,
      name: manager.name || this._cache.profile.name,
      email: manager.email || this._cache.profile.email,
      phone: manager.phone || this._cache.profile.phone,
      city,
      restaurantName: restaurant.name || this._cache.profile.restaurantName,
      avatar: this._assetUrl(manager.photo_url || this._cache.profile.avatar),
    };

    const parsedDetails = this._extractDetails(restaurant.description);
    const gallery = this._uniqueAssetUrls(restaurant.image_urls || []);

    this._cache.restaurant = {
      ...this._cache.restaurant,
      id: restaurant.id,
      is_open: Boolean(restaurant.is_open),
      verificationStatus: managerDetails.verification_status || "pending",
      tableCount: tables.length,
      timeSlotCount: slots.length,
      name: restaurant.name,
      about: this._extractAbout(restaurant.description),
      cuisine: restaurant.cuisine_type,
      capacity: `${tables.length} tables`,
      location: city,
      address: location?.address || "",
      state: location?.state || "",
      pincode: location?.pincode || "",
      hours: `${restaurant.opens_at || "11:00"} – ${restaurant.closes_at || "23:00"}${restaurant.opens_at === restaurant.closes_at && restaurant.opens_at ? " (24 hours)" : (restaurant.closes_at || "23:00") < (restaurant.opens_at || "11:00") ? " (next day)" : ""}`,
      parking: parsedDetails.parking || this._cache.restaurant.parking,
      rating: restaurant.rating_avg ?? this._cache.restaurant.rating,
      dressCode: parsedDetails.dresscode || this._cache.restaurant.dressCode,
      price: parsedDetails.price || this._cache.restaurant.price,
      contact:
        restaurant.contact_number ||
        parsedDetails.contact ||
        restaurant.phone ||
        this._cache.profile.phone,
      amenities: parsedDetails.amenities || this._cache.restaurant.amenities,
      image: gallery[0] || "",
      reservationFeePerGuest:
        restaurant.reservation_fee_per_guest ?? this._cache.restaurant.reservationFeePerGuest,
      cancellationCutoffMinutes:
        restaurant.cancellation_cutoff_minutes ?? this._cache.restaurant.cancellationCutoffMinutes,
      noShowGraceMinutes:
        restaurant.no_show_grace_minutes ?? this._cache.restaurant.noShowGraceMinutes,
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
      active: t.status !== "inactive",
      status: t.status || "active",
    }));

    this._cache.menu = menu.map((m) => ({
      id: m.id,
      restaurant_id: m.restaurant_id,
      name: m.item_name || m.name,
      category: m.category,
      price: m.price,
      available: m.is_available ?? m.availability,
      image: this._assetUrl((m.image_urls && m.image_urls[0]) || "images/dish-1.jpg"),
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
          name: user.name || "Guest",
          email: user.email || "guest@example.com",
          phone: user.phone || "-",
          date: slot?.slot_date || slot?.date || new Date().toISOString().split("T")[0],
          time: slot?.start_time || "19:00",
          guests: r.guest_count,
          reservation_status: statusValue,
          payment_state:
            r.payment_summary?.release_status ||
            (r.hold_expires_at && !r.confirmed_at ? "awaiting payment" : "unpaid"),
          diner_paid_excluding_platform_fee: ["paid", "refunded"].includes(
            r.payment_summary?.payment_status,
          )
            ? Number(r.payment_summary.deposit_amount || 0)
            : null,
          table: r.table_details?.length
            ? r.table_details.map((t) => `Table ${t.table_number}`).join(", ")
            : (r.table_ids || [r.table_id])
                .map((id) => this._cache.tables.find((item) => item.id === id)?.number || id)
                .filter(Boolean)
                .join(", ") || (table ? table.number : "Table"),
          status:
            statusValue === "reserved"
              ? "Pending"
              : statusValue === "checked_in"
                ? "Confirmed"
                : statusValue === "completed"
                  ? "Complete"
                  : statusValue === "no_show"
                    ? "No-show"
                    : statusValue === "cancelled"
                      ? "Cancelled"
                      : "Pending",
        };
      });

    this._cache.reviews = reviews.map((r) => ({
      id: r.id,
      reservationId: r.reservation_id,
      author: userById[r.user_id]?.name || "Guest",
      initials: (userById[r.user_id]?.name || "G")
        .split(" ")
        .map((x) => x[0])
        .join("")
        .slice(0, 2),
      date: r.created_at,
      rating: r.rating,
      comment: r.comment,
      verified: true,
      status: r.manager_reply ? "Responded" : "Pending",
      reply: r.manager_reply || "",
    }));

    this._cache.staff = users
      .filter((u) => u.role === "staff" && (!restaurant?.id || u.restaurant_id === restaurant.id))
      .map((u) => ({
        id: u.id,
        name: u.name,
        initials: u.name
          .split(" ")
          .map((x) => x[0])
          .join("")
          .slice(0, 2),
        role: "Restaurant Staff",
        email: u.email,
        phone: u.phone || "-",
        requestedOn: u.created_at
          ? new Date(u.created_at).toLocaleDateString("en-IN")
          : new Date().toLocaleDateString("en-IN"),
        status: u.status === "active" ? "Approved" : "Pending",
      }));

    this._cache.notifications = notifications
      .filter((n) => n.user_id === ids.managerId)
      .map((n) => ({
        id: n.id,
        type: n.type,
        text: n.message,
        time: n.created_at,
        read: n.is_read,
        icon: "ph-bell",
        iconColor: "text-orange",
        bgClass: "bg-orange-light",
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
    const slotMap = new Map();
    slots.forEach((slot) => {
      const key = `${slot.start_time}-${slot.end_time}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, {
          id: slot.id,
          start: slot.start_time,
          end: slot.end_time,
          text: `${slot.start_time} - ${slot.end_time}`,
          maxTables: this._cache.tables.length,
        });
      }
    });
    const templateSlots = Array.from(slotMap.values()).sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    this._cache.timeSlotsConfig = {
      operatingHours: {
        open: restaurant.opens_at || "11:00",
        close: restaurant.closes_at || "23:00",
      },
      dates,
      slots: templateSlots,
    };

    const slotById = Object.fromEntries(slots.map((slot) => [slot.id, slot]));
    const tableById = Object.fromEntries(this._cache.tables.map((table) => [table.id, table]));
    this._cache.blockedTables = tableSlots
      .filter((tableSlot) => tableSlot.status === "occupied")
      .map((tableSlot) => {
        const slot = slotById[tableSlot.slot_id];
        const table = tableById[tableSlot.table_id];
        return {
          tableId: tableSlot.table_id,
          date: slot?.slot_date || slot?.date || "",
          slot: tableSlot.slot_id,
          slotLabel: slot ? `${slot.start_time} - ${slot.end_time}` : tableSlot.slot_id,
          tableLabel: table?.number || tableSlot.table_id,
        };
      })
      .filter((blocked) => blocked.date);
    this._cache.activity = {
      reservations: this._cache.reservations.length,
      availableTables: this._cache.tables.length,
      avgRating: this._cache.reviews.length
        ? Number(
            (
              this._cache.reviews.reduce((a, b) => a + Number(b.rating || 0), 0) /
              this._cache.reviews.length
            ).toFixed(1),
          )
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

  static async login(email, accessToken = "") {
    const nextEmail = email.toLowerCase();
    this._cache = {
      ...this._cache,
      profile: {
        ...this._cache.profile,
        name: "Manager",
        email: nextEmail,
        phone: "",
        city: "",
        restaurantName: "",
        avatar: null,
      },
      restaurant: {
        ...this._cache.restaurant,
        id: undefined,
        name: "",
        about: "",
        cuisine: "",
        capacity: "0 tables",
        location: "",
        hours: "Not set yet",
        image: "",
        rating: 0,
      },
      policies: [],
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
        operatingHours: { open: "", close: "" },
        dates: {},
      },
      schedule: { weekly: [], rules: [] },
    };
    this._setSession(nextEmail, accessToken);
    sessionStorage.removeItem(this.IDS_KEY);
    this._readyPromise = this.init();
    await this._readyPromise;
  }

  static logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.IDS_KEY);
    this._cache.menu = [];
    this._cache.tables = [];
    this._cache.blockedTables = [];
    this._cache.reservations = [];
    this._cache.staff = [];
    this._cache.notifications = [];
    this._cache.reviews = [];
    this._cache.timeSlotsConfig = {
      operatingHours: { open: "", close: "" },
      dates: {},
    };
    this._readyPromise = null;
  }

  static getCurrentUser() {
    return this._session().email;
  }

  static async updateOperatingHours(open, close, slotDuration = 120) {
    const ids = await this._ensureLinkedRestaurant();
    const schedule = await this.getSchedule();
    const weekly = (schedule.weekly || []).map((day) => ({
      ...day,
      open_time: open,
      close_time: close,
      is_closed: false,
      slot_duration_minutes: Number(slotDuration),
      buffer_minutes: 0,
    }));
    await this._request(`/schedules/${ids.restaurantId}/weekly`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ weekly }),
    });
    await this.refreshFromBackend();
  }

  static async getSchedule() {
    const ids = await this._ensureLinkedRestaurant();
    const response = await this._request(`/schedules?restaurant_id=${ids.restaurantId}`, {
      headers: this._headers("manager"),
    });
    this._cache.schedule = response?.data || { weekly: [], rules: [] };
    return this._cache.schedule;
  }

  static async updateWeeklySchedule(weekly) {
    const ids = await this._ensureLinkedRestaurant();
    const response = await this._request(`/schedules/${ids.restaurantId}/weekly`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ weekly }),
    });
    this._cache.schedule = response?.data || this._cache.schedule;
    await this.refreshFromBackend();
    return this._cache.schedule;
  }

  static async updateDateSchedule(config) {
    const ids = await this._ensureLinkedRestaurant();
    const response = await this._request(`/schedules/${ids.restaurantId}/date`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify(config),
    });
    this._cache.schedule = response?.data || this._cache.schedule;
    await this.refreshFromBackend();
    return this._cache.schedule;
  }

  static async resetDateSchedule(date) {
    const ids = await this._ensureLinkedRestaurant();
    await this._request(`/schedules/${ids.restaurantId}/date/reset`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ start_date: date }),
    });
    await this.refreshFromBackend();
  }

  static async updateDefaultTableLayout(layout) {
    const ids = await this._ensureLinkedRestaurant();
    const response = await this._request(`/schedules/${ids.restaurantId}/default-layout`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ layout }),
    });
    this._cache.schedule = response?.data || this._cache.schedule;
    await this.refreshFromBackend();
    return this._cache.schedule;
  }

  static async saveSlotLayout(slotId, revision, tables) {
    const response = await this._request(`/timeslots/${slotId}/layout`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ revision, tables }),
    });
    await this.refreshFromBackend();
    return response?.data;
  }

  static async resetSlotLayout(slotId, revision) {
    const response = await this._request(`/timeslots/${slotId}/layout/reset`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ revision }),
    });
    await this.refreshFromBackend();
    return response?.data;
  }

  static async addScheduleRule(rule) {
    const ids = await this._ensureLinkedRestaurant();
    const response = await this._request("/schedules/rules", {
      method: "POST",
      headers: this._headers("manager"),
      body: JSON.stringify({ ...rule, restaurant_id: ids.restaurantId }),
    });
    await this.refreshFromBackend();
    return response?.data;
  }

  static async removeScheduleRule(ruleId) {
    const ids = await this._ensureLinkedRestaurant();
    await this._request(`/schedules/${ids.restaurantId}/rules/${ruleId}`, {
      method: "DELETE",
      headers: this._headers("manager"),
    });
    await this.refreshFromBackend();
  }

  static async removeScheduleRules(ruleIds) {
    const ids = await this._ensureLinkedRestaurant();
    await this._request(`/schedules/${ids.restaurantId}/rules`, {
      method: "DELETE",
      headers: this._headers("manager"),
      body: JSON.stringify({ rule_ids: ruleIds }),
    });
    await this.refreshFromBackend();
  }

  static async setServingStatus(isOpen) {
    const ids = await this._ensureLinkedRestaurant();

    await this._request(`/restaurants/${ids.restaurantId}/serving-status`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ manager_id: ids.managerId, is_open: isOpen }),
    });

    this._cache.restaurant = { ...this._cache.restaurant, is_open: isOpen };
    await this.refreshFromBackend();
  }

  static async updateProfile(profileUpdates) {
    this._cache.profile = { ...this._cache.profile, ...profileUpdates };
    const ids = this._getIds();
    if (ids.managerId) {
      const payload = {
        name: this._cache.profile.name,
        email: this._cache.profile.email,
        phone: this._cache.profile.phone,
      };
      if (Object.prototype.hasOwnProperty.call(profileUpdates, "avatar")) {
        payload.photo_url = profileUpdates.avatar || "";
      }
      await this._request(`/users/${ids.managerId}`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify(payload),
      });
    }
  }

  static async uploadProfilePhoto(file) {
    const ids = this._getIds();
    if (!ids.managerId) {
      throw new Error("Manager account is not linked to the backend.");
    }

    const formData = new FormData();
    formData.append("photo", file);
    const response = await fetch(`${requireApiBase()}/users/${ids.managerId}/upload-photo`, {
      method: "POST",
      headers: this._authHeaders(),
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

  static async removeProfilePhoto() {
    await this.updateProfile({ avatar: "" });
    await this.refreshFromBackend();
  }

  static _composeDescription(about, policies, details = this._cache.restaurant) {
    const detailRows = [
      ["Price", details.price],
      ["Parking", details.parking],
      ["Dress Code", details.dressCode],
      ["Contact", details.contact],
      ["Amenities", details.amenities],
    ].filter(([, value]) => String(value || "").trim());

    const blocks = [String(about || "").trim()].filter(Boolean);
    if (detailRows.length) {
      blocks.push(
        `Details:\n${detailRows.map(([label, value]) => `- ${label}: ${value}`).join("\n")}`,
      );
    }

    if (!Array.isArray(policies) || policies.length === 0) {
      return blocks.join("\n\n").trim();
    }
    const lines = policies
      .filter((p) => p && (p.title || p.desc))
      .map((p) => `- ${p.title || "Policy"}: ${p.desc || ""}`.trim());
    if (lines.length) {
      blocks.push(`Policies:\n${lines.join("\n")}`);
    }
    return blocks.join("\n\n").trim();
  }

  static _extractStructuredBlock(description, marker, nextMarkers = []) {
    const raw = String(description || "");
    const start = raw.indexOf(marker);
    if (start < 0) return "";
    const blockStart = start + marker.length;
    const blockEnd =
      nextMarkers
        .map((nextMarker) => raw.indexOf(nextMarker, blockStart))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0] || raw.length;
    return raw.slice(blockStart, blockEnd);
  }

  static _extractDetails(description) {
    const block = this._extractStructuredBlock(description, "Details:", ["Policies:"]);
    const details = {};
    block
      .split("\n")
      .map((line) => line.trim().replace(/^-\s*/, ""))
      .filter(Boolean)
      .forEach((line) => {
        const [label, ...rest] = line.split(":");
        const key = String(label || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const value = rest.join(":").trim();
        if (key && value) {
          details[key] = value;
        }
      });
    return details;
  }

  static _extractPolicies(description) {
    if (!description || !description.includes("Policies:")) {
      return null;
    }
    const policyLines = this._extractStructuredBlock(description, "Policies:")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return policyLines.map((line) => {
      const cleaned = line.replace(/^-\s*/, "");
      const [title, ...rest] = cleaned.split(":");
      return {
        title: (title || "Policy").trim(),
        desc: rest.join(":").trim(),
      };
    });
  }

  static _extractAbout(description) {
    if (!description) {
      return "";
    }

    const raw = String(description);
    const indexes = ["Details:", "Policies:"]
      .map((marker) => raw.indexOf(marker))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    return raw.slice(0, indexes.length ? indexes[0] : raw.length).trim();
  }

  static async updateRestaurantDetails(restUpdates) {
    this._cache.restaurant = { ...this._cache.restaurant, ...restUpdates };
    this._cache.gallery = this._uniqueAssetUrls(this._cache.gallery);
    const imageUrls = this._cache.gallery.map((image) => this._assetPath(image));
    const ids = this._getIds();
    if (ids.restaurantId) {
      await this._request(`/restaurants/${ids.restaurantId}`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({
          name: this._cache.restaurant.name,
          cuisine_type: this._cache.restaurant.cuisine,
          contact_number: this._cache.restaurant.contact,
          description: this._composeDescription(
            this._cache.restaurant.about,
            this._cache.policies,
            this._cache.restaurant,
          ),
          image_urls: imageUrls,
          reservation_fee_per_guest: Number(this._cache.restaurant.reservationFeePerGuest) || 0,
          cancellation_cutoff_minutes:
            Number(this._cache.restaurant.cancellationCutoffMinutes) || 0,
          no_show_grace_minutes: Number(this._cache.restaurant.noShowGraceMinutes) || 0,
        }),
      });
    }
  }

  static async uploadRestaurantImage(file, makePrimary = false) {
    const ids = await this._ensureLinkedRestaurant();

    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch(
      `${requireApiBase()}/restaurants/${ids.restaurantId}/upload-image`,
      {
        method: "POST",
        headers: this._authHeaders(),
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`Restaurant image upload failed (${response.status})`);
    }

    const body = await response.json();
    const rawImages = body?.data?.image_urls || [];
    const latestRaw = rawImages[rawImages.length - 1];
    const latest = this._assetUrl(latestRaw);
    const previousGallery = this._uniqueAssetUrls(this._cache.gallery || []);
    const nextGallery = this._uniqueAssetUrls(
      makePrimary ? [latest, ...previousGallery] : [...previousGallery, latest],
    );

    this._cache.gallery = nextGallery;
    this._cache.restaurant = {
      ...this._cache.restaurant,
      image: makePrimary ? latest : this._cache.restaurant.image || latest,
    };

    if (makePrimary) {
      await this._request(`/restaurants/${ids.restaurantId}`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({
          image_urls: nextGallery.map((image) => this._assetPath(image)),
          description: this._composeDescription(
            this._cache.restaurant.about,
            this._cache.policies,
            this._cache.restaurant,
          ),
        }),
      });
    }

    await this.refreshFromBackend();
    return this._cache.restaurant.image;
  }

  static async removeRestaurantImage(image) {
    const ids = await this._ensureLinkedRestaurant();
    const imageKey = this._assetKey(image);
    const remaining = this._uniqueAssetUrls(this._cache.gallery || []).filter(
      (galleryImage) => this._assetKey(galleryImage) !== imageKey,
    );
    const imageWasPrimary = this._assetKey(this._cache.restaurant.image) === imageKey;
    this._cache.gallery = remaining;
    this._cache.restaurant = {
      ...this._cache.restaurant,
      image: imageWasPrimary ? remaining[0] || "" : this._cache.restaurant.image,
    };

    await this._request(`/restaurants/${ids.restaurantId}`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({
        image_urls: remaining.map((galleryImage) => this._assetPath(galleryImage)),
        description: this._composeDescription(
          this._cache.restaurant.about,
          this._cache.policies,
          this._cache.restaurant,
        ),
      }),
    });
    await this.refreshFromBackend();
  }

  static async uploadMenuImage(file) {
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch(`${requireApiBase()}/menu/upload-image`, {
      method: "POST",
      headers: this._authHeaders(),
      body: formData,
    });
    if (!response.ok) {
      let message = `Menu image upload failed (${response.status})`;
      try {
        const body = await response.json();
        message = Array.isArray(body.message) ? body.message.join(", ") : body.message || message;
      } catch (_error) {}
      throw new Error(message);
    }
    const body = await response.json();
    return this._assetUrl(body?.data?.image_url);
  }

  static async updatePolicies(newPolicies) {
    this._cache.policies = Array.isArray(newPolicies) ? newPolicies : [];
    const ids = this._getIds();
    if (ids.restaurantId) {
      await this._request(`/restaurants/${ids.restaurantId}`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({
          description: this._composeDescription(
            this._cache.restaurant.about,
            this._cache.policies,
            this._cache.restaurant,
          ),
        }),
      });
    }
  }

  static getReservations() {
    return this._cache.reservations || [];
  }

  static async getReservationOrders(reservationId) {
    const response = await this._request(
      `/orders?reservation_id=${encodeURIComponent(reservationId)}`,
      {
        headers: this._headers("manager"),
      },
    );
    return response?.data || [];
  }

  static updateReservationStatus(id, newStatus) {
    const statusMap = {
      Confirmed: "checked_in",
      Pending: "reserved",
      Complete: "completed",
      Cancelled: "cancelled",
    };
    return this._request(`/reservations/${id}`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ reservation_status: statusMap[newStatus] || "reserved" }),
    }).then(() => {
      const reservation = this._cache.reservations.find((r) => r.id === id);
      if (reservation) {
        reservation.status = newStatus;
      }
      return this.refreshFromBackend();
    });
  }

  static getMenu() {
    return this._cache.menu || [];
  }

  static async addMenuItem(item) {
    const ids = await this._ensureLinkedRestaurant();
    await this._request("/menu", {
      method: "POST",
      headers: this._headers("manager"),
      body: JSON.stringify({
        restaurant_id: ids.restaurantId,
        item_name: item.name,
        category: item.category,
        price: Number(item.price),
        availability: item.available !== false,
        // The API accepts hosted paths, not a browser data URL. Keeping a
        // local preview out of this request prevents a 500 on menu create.
        image_urls:
          item.image && !String(item.image).startsWith("data:")
            ? [this._assetPath(item.image)]
            : [],
      }),
    });
    await this.refreshFromBackend();
  }

  static async updateMenuItem(id, updatedItem) {
    const ids = await this._ensureLinkedRestaurant();
    const index = this._cache.menu.findIndex((m) => m.id === id);
    const previousItem = index !== -1 ? this._cache.menu[index] : {};
    const nextItem = { ...previousItem, ...updatedItem };
    if (index !== -1) {
      this._cache.menu[index] = nextItem;
    }
    await this._request(`/menu/${id}`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({
        restaurant_id: nextItem.restaurant_id || ids.restaurantId,
        item_name: nextItem.name,
        category: nextItem.category,
        price: Number(nextItem.price),
        availability: nextItem.available !== false,
        image_urls:
          nextItem.image && !String(nextItem.image).startsWith("data:")
            ? [this._assetPath(nextItem.image)]
            : [],
      }),
    });
    await this.refreshFromBackend();
  }

  static async deleteMenuItem(id) {
    await this._request(`/menu/${id}`, {
      method: "DELETE",
      headers: this._headers("manager"),
    });
    await this.refreshFromBackend();
  }

  static async toggleMenuAvailability(id) {
    const item = this._cache.menu.find((m) => m.id === id);
    if (!item) return;
    const current = item.available !== false;
    await this.updateMenuItem(id, { ...item, available: !current });
  }

  static getTables() {
    return this._cache.tables || [];
  }

  static async saveTableLayout(tablesArray) {
    const ids = await this._ensureLinkedRestaurant();
    const previousTables = this._cache.tables || [];
    // Immediately update cache for snappy UI, but we'll refresh properly after sync
    this._cache.tables = Array.isArray(tablesArray) ? JSON.parse(JSON.stringify(tablesArray)) : [];

    const nextIds = new Set((tablesArray || []).map((t) => t.id));
    const existingIds = new Set((previousTables || []).map((t) => t.id));

    // 1. Deletions - Free up table numbers first
    const tablesToDelete = previousTables.filter((t) => !nextIds.has(t.id));
    for (const table of tablesToDelete) {
      try {
        await this._request(`/tables/${table.id}`, {
          method: "DELETE",
          headers: this._headers("manager"),
        });
      } catch (e) {
        console.error(`Failed to delete table ${table.id}:`, e);
      }
    }

    // 2. Creations and Updates
    const promises = (tablesArray || []).map(async (table) => {
      const tableNumber = Math.floor(Number(String(table.number).replace(/\D/g, ""))) || 1;
      const capacity = Math.floor(Number(table.seats));
      if (!Number.isFinite(capacity) || capacity < 1) {
        throw new Error(`Choose a seating capacity for ${table.number || "every table"}.`);
      }

      if (String(table.id).startsWith("temp-tbl-")) {
        // Creation
        try {
          await this._request("/tables", {
            method: "POST",
            headers: this._headers("manager"),
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
            method: "PATCH",
            headers: this._headers("manager"),
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
      console.error("Some table updates failed:", e);
      throw e;
    }

    try {
      await this._request("/tableslots/seed", {
        method: "POST",
        headers: this._headers("manager"),
        body: JSON.stringify({ restaurant_id: ids.restaurantId }),
      });
    } catch (e) {
      console.error("Failed to seed table-slot availability:", e);
    }

    // 3. Final Refresh to get real backend IDs and table-slot availability
    await this.refreshFromBackend();
  }

  static getBlockedTables() {
    return this._cache.blockedTables || [];
  }

  static async updateTableSlotStatus(tableId, slotId, status) {
    const response = await this._request("/tableslots/status", {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ table_id: tableId, slot_id: slotId, status }),
    });
    // PATCH succeeded — apply optimistic update to local cache immediately
    // so the UI reflects the change without waiting for the full backend refresh.
    if (status === "available") {
      this._cache.blockedTables = this._cache.blockedTables.filter(
        (blocked) => !(blocked.tableId === tableId && blocked.slot === slotId),
      );
    } else if (
      status === "blocked" &&
      !this._cache.blockedTables.some(
        (blocked) => blocked.tableId === tableId && blocked.slot === slotId,
      )
    ) {
      const dates = this._cache.timeSlotsConfig?.dates || {};
      const slotEntry = Object.entries(dates)
        .flatMap(([date, dateConfig]) => (dateConfig.slots || []).map((slot) => ({ date, slot })))
        .find(({ slot }) => slot.id === slotId);
      const table = this._cache.tables.find((item) => item.id === tableId);
      if (slotEntry) {
        this._cache.blockedTables.push({
          tableId,
          date: slotEntry.date,
          slot: slotId,
          slotLabel: slotEntry.slot.text || `${slotEntry.slot.start} - ${slotEntry.slot.end}`,
          tableLabel: table?.number || tableId,
        });
      }
    }
    // Re-fetch from backend so the cache always matches the server.  This
    // ensures that a subsequent page refresh() reads the correct state and
    // that stale duplicate records from earlier seeds are not surfaced.
    await this.refreshFromBackend();
    return response?.data;
  }

  static async removeTable(tableId) {
    const response = await this._request(`/tables/${tableId}`, {
      method: "DELETE",
      headers: this._headers("manager"),
    });
    await this.refreshFromBackend();
    return response?.data;
  }

  static async restoreTable(tableId) {
    const response = await this._request(`/tables/${tableId}`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ status: "active" }),
    });
    await this.refreshFromBackend();
    return response?.data;
  }

  static async updateTableCapacity(tableId, capacity) {
    const response = await this._request(`/tables/${tableId}`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ capacity: Number(capacity) }),
    });
    await this.refreshFromBackend();
    return response?.data;
  }

  static getStaff() {
    return this._cache.staff || [];
  }

  static async updateStaffStatus(id, newStatus) {
    const member = this._cache.staff.find((s) => s.id === id);
    if (member) {
      member.status = newStatus;
    }

    const statusMap = {
      Approved: "active",
      Pending: "inactive",
      Rejected: "inactive",
    };

    await this._request(`/users/${id}`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ status: statusMap[newStatus] || "inactive" }),
    });
    await this.refreshFromBackend();
  }

  static getNotifications() {
    return this._cache.notifications || [];
  }

  static markAllNotificationsRead() {
    (this._cache.notifications || []).forEach((n) => {
      n.read = true;
    });
  }

  static getReviews() {
    return this._cache.reviews || [];
  }

  static async saveReviewReply(reviewId, replyText) {
    await this._request(`/reviews/${reviewId}/reply`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ reply: replyText }),
    });
    const review = this._cache.reviews.find((r) => r.id === reviewId);
    if (review) {
      review.reply = replyText;
      review.status = "Responded";
    }
  }

  static async deleteReviewReply(reviewId) {
    await this._request(`/reviews/${reviewId}/reply`, {
      method: "PATCH",
      headers: this._headers("manager"),
      body: JSON.stringify({ reply: "" }),
    });
    const review = this._cache.reviews.find((r) => r.id === reviewId);
    if (review) {
      review.reply = null;
      review.status = "Pending";
    }
  }
}

window.showConfirm = function (
  message,
  onConfirm,
  title = "Confirm Deletion",
  confirmText = "Delete",
) {
  const existing = document.querySelector(".custom-confirm-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay custom-confirm-overlay";
  overlay.style.cssText =
    "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);";
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
  overlay.querySelector(".confirm-cancel-btn").addEventListener("click", () => overlay.remove());
  overlay.querySelector(".confirm-ok-btn").addEventListener("click", () => {
    if (onConfirm) onConfirm();
    overlay.remove();
  });
};

export default ManagerApi;
