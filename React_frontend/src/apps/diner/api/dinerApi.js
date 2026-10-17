import { image } from "../utils/images.js";
import { distanceKm } from "../utils/distance.js";
import { bindSession, readBoundSession } from "../../../app/session.js";

const SESSION_KEY = "dinetime_react_diner_session";
const readSession = () => {
  try {
    return readBoundSession(SESSION_KEY);
  } catch {
    return null;
  }
};

// This singleton owns all backend communication and the current backend snapshot.
// Components consume snapshots through DinerContext.
class DinerApi {
  baseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  session = readSession();
  authVersion = 0;
  listeners = new Set();
  refreshVersion = 0;
  data = {
    restaurants: [],
    menu: [],
    tables: [],
    slots: [],
    reviews: [],
    reservations: [],
    notifications: [],
    reservationError: "",
    notificationError: "",
    sessionError: "",
    locations: [],
    loading: false,
    error: "",
  };
  snapshot = { ...this.data, user: this.session?.user || null };
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snapshot;

  publish(update = {}) {
    this.data = { ...this.data, ...update };
    this.snapshot = { ...this.data, user: this.session?.user || null };
    this.listeners.forEach((listener) => listener());
  }

  async request(path, { method = "GET", body, ...options } = {}) {
    const multipart = body instanceof FormData;
    // Credential checks are independent of an existing login. Other requests
    // must only invalidate the session whose token they actually sent.
    const requestToken = path === "/auth/login" ? null : this.session?.access_token;
    const authVersion = this.authVersion;
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      method,
      cache: method === "GET" ? "no-store" : options.cache,
      headers: {
        role: "diner",
        ...(multipart ? {} : { "Content-Type": "application/json" }),
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (
        response.status === 401 &&
        requestToken &&
        authVersion === this.authVersion &&
        this.session?.access_token === requestToken
      ) {
        this.logout("Your session is no longer valid. Please sign in again to continue.");
      }
      const message = payload?.message;
      throw new Error(
        Array.isArray(message)
          ? message.join(", ")
          : message || `Request failed (${response.status})`,
      );
    }
    return payload?.data ?? payload;
  }

  asset(url, fallback = "indian.jpg") {
    if (!url) return image(fallback);
    if (url.startsWith("/uploads/")) return `${this.baseUrl}${url}`;
    if (/^https?:\/\//.test(url)) return url;
    return image(url.split("/").pop());
  }

  saveSession(session) {
    this.session = session;
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(bindSession(session)));
    else sessionStorage.removeItem(SESSION_KEY);
    this.publish(session?.user ? { sessionError: "" } : {});
  }

  async login(email, password) {
    const session = await this.request("/auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
    });
    if (session?.user?.role !== "diner" || session.user.status !== "active")
      throw new Error("Please sign in with an active diner account.");
    // Persist only public profile fields, never the backend password hash.
    const { password_hash, ...user } = session.user;
    this.authVersion += 1;
    this.refreshVersion += 1;
    this.saveSession({ access_token: session.access_token, user });
    this.publish({ loading: false, error: "" });
    return user;
  }

  async register(account, location) {
    const locations = await this.request("/restaurants/locations");
    const match = locations.find(
      (item) => item.city?.toLowerCase() === location.city.trim().toLowerCase(),
    );
    await this.request("/users", {
      method: "POST",
      body: {
        name: account.name.trim(),
        email: account.email.trim().toLowerCase(),
        phone: account.phone,
        password_hash: account.password,
        role: "diner",
        status: "active",
        city: location.city,
        address: location.address,
        pincode: location.pincode,
        country: location.country || "India",
        ...(location.latitude !== undefined ? { latitude: location.latitude } : {}),
        ...(location.longitude !== undefined ? { longitude: location.longitude } : {}),
        ...(match ? { location_id: match.id } : {}),
      },
    });
    await this.login(account.email, account.password);
    this.saveSession({
      ...this.session,
      user: { ...this.session.user, ...location },
    });
  }

  logout(sessionError = "") {
    this.authVersion += 1;
    this.refreshVersion += 1;
    this.saveSession(null);
    this.publish({
      reservations: [],
      notifications: [],
      loading: false,
      error: "",
      sessionError,
    });
  }

  preferences() {
    return (
      this.session?.preferences || {
        notifications: true,
        promotions: true,
        restaurantUpdates: true,
        emailNotifications: true,
        smsNotifications: false,
        contact: false,
        history: false,
      }
    );
  }

  async cities() {
    try {
      return await this.request("/restaurants/cities");
    } catch {
      // Older backend processes may not have the cities route loaded yet.
      // Derive the options from the existing restaurants and locations APIs.
      const [restaurants, locations] = await Promise.all([
        this.request("/restaurants"),
        this.request("/restaurants/locations"),
      ]);
      const locationById = new Map(locations.map((location) => [location.id, location]));
      return [
        ...new Map(
          restaurants
            .map((restaurant) => locationById.get(restaurant.location_id)?.city?.trim())
            .filter(Boolean)
            .map((city) => [city.toLocaleLowerCase(), city]),
        ).values(),
      ].sort((a, b) => a.localeCompare(b));
    }
  }

  savePreferences(preferences) {
    this.saveSession({ ...this.session, preferences });
  }

  async refresh() {
    const userId = this.session?.user?.id;
    const version = ++this.refreshVersion;
    const isCurrent = () => version === this.refreshVersion && userId === this.session?.user?.id;
    this.publish({ loading: true, error: "" });
    try {
      const [restaurants, menu, tables, slots, reviews, locations] = await Promise.all(
        [
          "/restaurants",
          "/menu",
          "/tables",
          "/timeslots",
          "/reviews",
          "/restaurants/locations",
        ].map((path) => this.request(path)),
      );
      if (!isCurrent()) return;
      const currentUser = this.session?.user;
      if (currentUser?.location_id) {
        const location = locations.find((item) => item.id === currentUser.location_id);
        let safeProfile = {};
        try {
          const profile = await this.request(`/users/${encodeURIComponent(currentUser.id)}`);
          const { password_hash: _passwordHash, ...publicProfile } = profile;
          safeProfile = publicProfile;
        } catch {
          // Login already supplied a usable public profile; profile hydration is optional.
        }
        if (!isCurrent()) return;
        // Location records also carry an `id`; preserve the diner account ID.
        const { id: _locationId, ...locationDetails } = location || {};
        const hydratedUser = {
          ...currentUser,
          ...locationDetails,
          ...safeProfile,
        };
        this.session = { ...this.session, user: hydratedUser };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(bindSession(this.session)));
      }
      const normalized = restaurants.map((restaurant) => {
        const location = locations.find((item) => item.id === restaurant.location_id);
        const description = restaurant.description || "";
        const details = Object.fromEntries(
          (description.split("Details:")[1]?.split("Policies:")[0] || "")
            .split("\n")
            .filter((line) => line.includes(":"))
            .map((line) => {
              const [key, ...value] = line.replace(/^-\s*/, "").split(":");
              return [key.trim().toLowerCase().replace(/\s/g, ""), value.join(":").trim()];
            }),
        );
        const locationLabel = [location?.address, location?.city]
          .filter(Boolean)
          .flatMap((part) =>
            part
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          )
          .filter(
            (part, index, parts) =>
              parts.findIndex((value) => value.toLocaleLowerCase() === part.toLocaleLowerCase()) ===
              index,
          )
          .join(", ");
        return {
          ...restaurant,
          cuisine: restaurant.cuisine_type,
          rating: Number(restaurant.rating_avg || 0),
          image: this.asset(restaurant.image_urls?.[0]),
          images: (restaurant.image_urls || []).map((url) => this.asset(url)),
          location: locationLabel,
          city: location?.city || "",
          address: location?.address || "",
          state: location?.state || "",
          pincode: location?.pincode || "",
          distance: distanceKm(this.session?.user, location),
          details,
          about: description.split(/Details:|Policies:/)[0].trim(),
          availableSlots: [
            ...new Set(
              slots
                .filter((slot) => slot.restaurant_id === restaurant.id)
                .map((slot) => slot.start_time.slice(0, 5)),
            ),
          ],
        };
      });
      let reservations = [],
        notifications = [],
        reservationError = "",
        notificationError = "";
      if (this.session?.user) {
        const [reservationResult, notificationResult] = await Promise.allSettled([
          this.request(`/reservations?user_id=${encodeURIComponent(this.session.user.id)}`),
          this.request(`/notifications?user_id=${encodeURIComponent(this.session.user.id)}`),
        ]);
        if (reservationResult.status === "fulfilled") reservations = reservationResult.value;
        else reservationError = reservationResult.reason.message;
        if (notificationResult.status === "fulfilled") notifications = notificationResult.value;
        else notificationError = notificationResult.reason.message;
      }
      if (!isCurrent()) return;
      this.publish({
        restaurants: normalized,
        menu: menu.map((item) => ({
          ...item,
          image: this.asset(item.image_urls?.[0], "starter.png"),
        })),
        tables,
        slots,
        reviews,
        locations,
        reservations,
        notifications,
        reservationError,
        notificationError,
        loading: false,
      });
    } catch (error) {
      if (isCurrent()) this.publish({ loading: false, error: error.message });
    }
  }

  availability(restaurantId, slotId, signal) {
    return this.request(
      `/tableslots/availability?restaurant_id=${encodeURIComponent(restaurantId)}&slot_id=${encodeURIComponent(slotId)}`,
      { signal },
    );
  }

  createReservation(booking) {
    if (!this.session?.user) throw new Error("Please sign in before making a reservation.");
    return this.request("/reservations", {
      method: "POST",
      body: {
        user_id: this.session.user.id,
        restaurant_id: booking.restaurantId,
        table_id: booking.tableId,
        slot_id: booking.slotId,
        guest_count: Number(booking.guests),
      },
    });
  }

  pay(reservationId, method) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const rand = Math.floor(100000 + Math.random() * 900000);
    return this.request("/payments", {
      method: "POST",
      body: {
        reservation_id: reservationId,
        payment_method: method,
        transaction_ref: `DT-TXN-${dateStr}-${rand}`,
        payment_status: "paid",
      },
    });
  }

  payAdditional(reservationId, method) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const rand = Math.floor(100000 + Math.random() * 900000);
    return this.request("/payments/additional", {
      method: "POST",
      body: {
        reservation_id: reservationId,
        payment_method: method,
        transaction_ref: `DT-ADJ-${dateStr}-${rand}`,
      },
    });
  }

  async deleteReservation(id) {
    await this.request(`/reservations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await this.refresh();
  }

  async cancelReservation(id) {
    await this.request(`/reservations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { reservation_status: "cancelled" },
    });
    await this.refresh();
  }

  async completeDine(id) {
    const result = await this.request(`/reservations/${encodeURIComponent(id)}/dine-complete`, {
      method: "PATCH",
      body: {},
    });
    await this.refresh();
    return result;
  }

  async modifyReservation(id, values) {
    const reservation = await this.request(`/reservations/${encodeURIComponent(id)}/modify`, {
      method: "PATCH",
      body: values,
    });
    await this.refresh();
    return reservation;
  }

  async discardModification(id) {
    const reservation = await this.request(
      `/reservations/${encodeURIComponent(id)}/modify/pending`,
      {
        method: "DELETE",
      },
    );
    await this.refresh();
    return reservation;
  }

  async review(reservation, rating, comment) {
    await this.request("/reviews", {
      method: "POST",
      body: {
        user_id: this.session.user.id,
        restaurant_id: reservation.restaurant_id,
        reservation_id: reservation.id,
        rating: Number(rating),
        comment,
      },
    });
    await this.refresh();
  }

  order(reservationId, items) {
    return this.request("/orders", {
      method: "POST",
      body: { reservation_id: reservationId, items },
    });
  }

  async updateProfile(values) {
    const { name, email, phone, photo_url, city, ...localLocation } = values;
    const user = await this.request(`/users/${this.session.user.id}`, {
      method: "PATCH",
      body: { name, email, phone, photo_url, city },
    });
    const { password_hash, ...safeUser } = user;
    this.saveSession({
      ...this.session,
      user: { ...this.session.user, ...safeUser, ...localLocation, city },
    });
  }

  async uploadPhoto(file) {
    const body = new FormData();
    body.append("photo", file);
    const result = await this.request(`/users/${this.session.user.id}/upload-photo`, {
      method: "POST",
      body,
    });
    this.saveSession({
      ...this.session,
      user: { ...this.session.user, photo_url: result.photo_url },
    });
  }

  async changePassword(currentPassword, password) {
    await this.request("/auth/login", {
      method: "POST",
      body: { email: this.session.user.email, password: currentPassword },
    });
    await this.request(`/users/${this.session.user.id}`, {
      method: "PATCH",
      body: { password_hash: password },
    });
  }

  async settings() {
    const [definitions, values] = await Promise.all([
      this.request("/settings?role=diner"),
      this.request(`/settings/users/${this.session.user.id}`),
    ]);
    return definitions.map((definition) => ({
      ...definition,
      setting: values.find((value) => value.setting_id === definition.id),
    }));
  }

  updateSetting(id, value) {
    return this.request(`/settings/users/${id}`, {
      method: "PATCH",
      body: { value },
    });
  }

  tickets() {
    return this.request(
      `/support/tickets/mine?user_id=${encodeURIComponent(this.session.user.id)}`,
    );
  }

  createTicket(values, files) {
    const body = new FormData();
    Object.entries({
      ...values,
      raised_by_user_id: this.session.user.id,
      raised_by_role: "diner",
    }).forEach(([key, value]) => body.append(key, value));
    files.forEach((file) => body.append("attachments", file));
    return this.request("/support/tickets", { method: "POST", body });
  }
}

export const dinerApi = new DinerApi();
