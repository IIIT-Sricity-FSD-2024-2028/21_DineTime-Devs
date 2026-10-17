// Staff API singleton — mirrors dinerApi.js structure exactly.
// All API calls go through this class; components never call fetch directly.

import { toIsoDate } from "../utils/format.js";
import { bindSession, readBoundSession } from "../../../app/session.js";

const SESSION_KEY = "dinetime_react_staff_session";

const readSession = () => {
  try {
    return readBoundSession(SESSION_KEY);
  } catch {
    return null;
  }
};

class StaffApi {
  baseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

  session = readSession();
  listeners = new Set();
  refreshVersion = 0;
  restaurantVerified = false;

  data = {
    tables: [],
    reservations: [],
    slots: [],
    allTables: [],
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
    this.listeners.forEach((fn) => fn());
  }

  // ─── HTTP helper ─────────────────────────────────────────────────────────────
  async request(path, { method = "GET", body, role = "staff", ...rest } = {}) {
    const sessionRole = this.session?.user?.role || "staff";
    const token = role === sessionRole ? this.session?.access_token : null;
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...rest,
      method,
      headers: {
        "Content-Type": "application/json",
        role,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && this.session) {
        this.logout();
      }
      const msg = payload?.message;
      throw new Error(
        Array.isArray(msg) ? msg.join(", ") : msg || `Request failed (${response.status})`,
      );
    }
    return payload?.data ?? payload;
  }

  // ─── Session ──────────────────────────────────────────────────────────────────
  saveSession(session) {
    this.session = session;
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(bindSession(session)));
    else sessionStorage.removeItem(SESSION_KEY);
    this.publish();
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  async login(email, password) {
    const auth = await this.request("/auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
    });

    const user = auth?.user;
    if (!user || user.role !== "staff") throw new Error("Invalid Staff ID or Password.");
    if (user.status !== "active") throw new Error("Your account is pending manager approval.");

    // Login returns the base user. Staff assignment is stored in staff details.
    const profile = await this.request(`/users/${encodeURIComponent(user.id)}`, {
      role: "staff",
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });
    const restaurantId = profile?.restaurant_id;
    if (!restaurantId) throw new Error("This staff account is not assigned to a restaurant.");
    const restaurants = await this.request("/restaurants", {
      role: "staff",
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });
    const restaurant = (restaurants || []).find((entry) => entry.id === restaurantId);
    if (!restaurant) throw new Error("The assigned restaurant could not be found.");

    const { password_hash, ...safeUser } = user;
    this.saveSession({
      access_token: auth.access_token,
      user: { ...safeUser, restaurantName: restaurant.name, restaurantId },
    });
    this.restaurantVerified = true;
    return safeUser;
  }

  async register({ name, email, phone, password, restaurantId, pincode }) {
    const [restaurants, users] = await Promise.all([
      this.request("/restaurants", { role: "staff" }),
      this.request("/users", { role: "staff" }).catch(() => []),
    ]);
    const normalize = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const restaurant = (restaurants || []).find(
      (entry) =>
        normalize(entry.id) === normalize(restaurantId) ||
        normalize(entry.name) === normalize(restaurantId),
    );
    if (!restaurant) {
      throw new Error(
        "Restaurant not found. Enter a valid restaurant ID or exact restaurant name.",
      );
    }
    if ((users || []).some((user) => user.email?.toLowerCase() === email.trim().toLowerCase())) {
      throw new Error("This email is already registered.");
    }

    await this.request("/users", {
      method: "POST",
      role: "staff",
      body: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone,
        password_hash: password,
        role: "staff",
        status: "inactive",
        restaurant_id: restaurant.id,
        location_id: restaurant.location_id || "loc_blr_1",
        employee_code: `EMP-${Date.now().toString().slice(-6)}`,
        role_type: "service",
      },
    });
  }

  logout() {
    this.refreshVersion += 1;
    this.restaurantVerified = false;
    this.saveSession(null);
    this.publish({
      tables: [],
      reservations: [],
      slots: [],
      allTables: [],
      loading: false,
      error: "",
    });
  }

  // ─── Data refresh ─────────────────────────────────────────────────────────────
  async refresh(date = toIsoDate(), selectedSlotId = "") {
    const version = ++this.refreshVersion;
    const isCurrent = () => version === this.refreshVersion;
    this.publish({ loading: true, error: "" });

    try {
      if (!this.session?.user?.id) throw new Error("Please sign in to view staff data.");
      if (!this.restaurantVerified) {
        const profile = await this.request(`/users/${encodeURIComponent(this.session.user.id)}`);
        const restaurantId = profile?.restaurant_id;
        if (!restaurantId) throw new Error("This staff account is not assigned to a restaurant.");
        const restaurants = await this.request("/restaurants");
        const restaurant = (restaurants || []).find((entry) => entry.id === restaurantId);
        if (!restaurant) throw new Error("The assigned restaurant could not be found.");
        if (!isCurrent()) return;
        this.saveSession({
          ...this.session,
          user: { ...this.session.user, restaurantId, restaurantName: restaurant.name },
        });
        this.restaurantVerified = true;
      }
      const restaurantId = this.session.user.restaurantId;
      const [tablesRes, slotsRes, tableSlotsRes, usersRes] = await Promise.all([
        this.request("/tables", { role: "staff" }),
        this.request("/timeslots", { role: "staff" }),
        this.request("/tableslots", { role: "staff" }),
        this.request("/users", { role: "staff" }).catch(() => []),
      ]);
      if (!isCurrent()) return;

      const allTables = tablesRes || [];
      const allSlots = slotsRes || [];
      const allTableSlots = tableSlotsRes || [];
      const allUsers = usersRes || [];

      // Tables for this restaurant
      const myTables = allTables.filter((t) => !restaurantId || t.restaurant_id === restaurantId);

      // Day slots for this restaurant
      const daySlots = allSlots.filter(
        (s) =>
          (!restaurantId || s.restaurant_id === restaurantId) && (s.slot_date || s.date) === date,
      );
      daySlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
      const activeSlot = daySlots.find((s) => s.id === selectedSlotId) || daySlots[0];
      const daySlotIds = new Set(activeSlot ? [activeSlot.id] : []);

      // Per-table status (highest rank wins)
      const statusRank = { blocked: 4, occupied: 3, reserved: 2, available: 1 };
      const statusByTable = {};
      allTableSlots.forEach((ts) => {
        if (!daySlotIds.has(ts.slot_id)) return;
        const cur = statusByTable[ts.table_id] || "available";
        const nxt = ts.status || "available";
        if ((statusRank[nxt] || 0) >= (statusRank[cur] || 0)) {
          statusByTable[ts.table_id] = nxt;
        }
      });

      const enrichedTables = myTables
        .filter(
          (t) =>
            activeSlot &&
            (!activeSlot.table_layout ||
              activeSlot.table_layout.some((entry) => entry.table_id === t.id)),
        )
        .map((t) => ({
          ...t,
          capacity:
            activeSlot.table_layout?.find((entry) => entry.table_id === t.id)?.capacity ??
            t.capacity,
          slotIds: [activeSlot.id],
          computedStatus: statusByTable[t.id] || "available",
          scheduleBlocked: allTableSlots.some(
            (entry) =>
              entry.table_id === t.id && entry.slot_id === activeSlot.id && entry.schedule_block,
          ),
        }));

      // Reservations
      const reservationPath = restaurantId
        ? `/reservations?restaurant_id=${restaurantId}`
        : "/reservations";
      const reservationsRes = await this.request(reservationPath, { role: "staff" });
      if (!isCurrent()) return;

      const slotMap = Object.fromEntries(allSlots.map((s) => [s.id, s]));
      const tableMap = Object.fromEntries(allTables.map((t) => [t.id, t]));
      const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

      const reservations = (reservationsRes || [])
        .filter((r) => !restaurantId || r.restaurant_id === restaurantId)
        .map((r) => {
          const slot = slotMap[r.slot_id];
          const table = tableMap[r.table_id];
          const user = userMap[r.user_id];
          const reservationStatus = r.reservation_status || r.status;
          const statusLabel =
            {
              reserved: "Upcoming",
              checked_in: "Checked-In",
              completed: "Completed",
              cancelled: "Cancelled",
              no_show: "No-Show",
            }[reservationStatus] || "Upcoming";
          return {
            ...r,
            statusLabel,
            userName: user?.name || `Guest ${(r.user_id || "").slice(-4)}`,
            userPhone: user?.phone || "—",
            userEmail: user?.email || "",
            date: slot?.slot_date || slot?.date || date,
            time: slot?.start_time || "19:00",
            tableLabel:
              (r.table_details || (r.table_ids || [r.table_id]).map((id) => tableMap[id]))
                .filter(Boolean)
                .map((item) => `Table ${item.table_number}`)
                .join(", ") || (table ? `Table ${table.table_number}` : "—"),
          };
        })
        .filter((reservation) => reservation.date === date);

      this.publish({
        tables: enrichedTables.map((table) => ({
          ...table,
          bookingManaged: (reservationsRes || []).some(
            (reservation) =>
              reservation.slot_id === activeSlot?.id &&
              ["reserved", "checked_in"].includes(
                reservation.reservation_status || reservation.status,
              ) &&
              (reservation.table_ids || [reservation.table_id]).includes(table.id),
          ),
        })),
        allTables,
        slots: allSlots,
        activeSlotId: activeSlot?.id || "",
        reservations,
        loading: false,
        error: "",
      });
    } catch (error) {
      if (isCurrent()) this.publish({ loading: false, error: error.message });
    }
  }

  // ─── Table status update ──────────────────────────────────────────────────────
  async updateTableStatus(tableId, slotIds, newStatus) {
    const apiStatus = {
      Available: "available",
      Blocked: "blocked",
    }[newStatus];
    if (!apiStatus) throw new Error("Staff can only set a table to Available or Blocked.");
    await Promise.all(
      slotIds.map((slotId) =>
        this.request("/tableslots/status", {
          method: "PATCH",
          body: { table_id: tableId, slot_id: slotId, status: apiStatus },
        }),
      ),
    );
  }

  // ─── Reservation status (check-in actions) ────────────────────────────────────
  async updateReservationStatus(reservationId, newStatus) {
    if (newStatus === "Checked-In") {
      return this.request("/checkin", {
        method: "POST",
        body: { reservation_id: reservationId, staff_id: this.session?.user?.id },
      });
    }
    if (newStatus === "No-Show") {
      return this.request(`/reservations/${encodeURIComponent(reservationId)}`, {
        method: "PATCH",
        body: { reservation_status: "no_show" },
      });
    }
    throw new Error("Unsupported reservation status.");
  }

  // ─── Walk-in creation ─────────────────────────────────────────────────────────
  async createWalkIn({ name, phone, guestCount, tableId, time }) {
    const restaurantId = this.session?.user?.restaurantId || "";
    const todayStr = toIsoDate();

    const [allUsers, allTables, slots, tableSlots] = await Promise.all([
      this.request("/users", { role: "staff" }).catch(() => []),
      this.request("/tables", { role: "staff" }),
      this.request("/timeslots", { role: "staff" }),
      this.request("/tableslots", { role: "staff" }),
    ]);
    const table = (allTables || []).find(
      (entry) => entry.id === tableId && (!restaurantId || entry.restaurant_id === restaurantId),
    );
    if (!table) throw new Error("Selected table is not available at this restaurant.");

    const [requestedHour, requestedMinute] = (time || "12:00").split(":").map(Number);
    const requestedMinutes = requestedHour * 60 + requestedMinute;
    const toMinutes = (value) => {
      const [hour = "0", minute = "0"] = String(value || "0:0").split(":");
      return Number(hour) * 60 + Number(minute);
    };
    const tableSlotMap = new Set(
      (tableSlots || [])
        .filter((slot) => slot.table_id === table.id && slot.status === "available")
        .map((slot) => slot.slot_id),
    );
    const bestSlot = (slots || [])
      .filter(
        (slot) =>
          (!restaurantId || slot.restaurant_id === restaurantId) &&
          (slot.slot_date || slot.date) === todayStr &&
          slot.published !== false &&
          (!slot.table_layout ||
            slot.table_layout.some(
              (t) => t.table_id === table.id && t.capacity >= Number(guestCount),
            )) &&
          tableSlotMap.has(slot.id),
      )
      .sort(
        (left, right) =>
          Math.abs(toMinutes(left.start_time) - requestedMinutes) -
          Math.abs(toMinutes(right.start_time) - requestedMinutes),
      )[0];
    if (!bestSlot) throw new Error("The selected table has no available slot today.");

    return this.request("/checkin/walk-in", {
      method: "POST",
      body: {
        name,
        phone,
        guest_count: Number(guestCount),
        table_id: table.id,
        slot_id: bestSlot.id,
      },
    });
  }

  // ─── Profile / password ───────────────────────────────────────────────────────
  async updateProfile({ name, email, phone }) {
    if (!this.session?.user?.id) throw new Error("Not authenticated.");
    const updated = await this.request(`/users/${this.session.user.id}`, {
      method: "PATCH",
      body: { name, email, phone },
    });
    const { password_hash, ...safeUser } = updated;
    this.saveSession({
      ...this.session,
      user: { ...this.session.user, ...safeUser },
    });
  }

  async changePassword(currentPassword, newPassword) {
    await this.request("/auth/login", {
      method: "POST",
      body: { email: this.session.user.email, password: currentPassword },
    });
    await this.request(`/users/${this.session.user.id}`, {
      method: "PATCH",
      body: { password_hash: newPassword },
    });
  }
}

export const staffApi = new StaffApi();
