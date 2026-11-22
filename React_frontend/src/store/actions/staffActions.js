import { fetchData } from "./dataActions.js";
import { createRequest } from "./request.js";
import { authActions } from "../slices/authSlice.js";
import { operationsActions } from "../slices/operationsSlice.js";

import { signIn, signOut } from "./authActions.js";
import { toIsoDate } from "../../apps/restaurant-staff/utils/format.js";
export function createStaffActions(dispatch, getState) {
  return {
    request: createRequest(dispatch, getState),
    get session() {
      return getState().auth.session;
    },
    saveSession(session) {
      dispatch(
        authActions.profileUpdated({
          user: session.user,
          generation: getState().auth.generation,
        }),
      );
    },
    login(email, password) {
      return dispatch(signIn({ email, password }, "staff"));
    },
    logout() {
      dispatch(signOut());
    },
    refresh(date = toIsoDate(), slotId = "") {
      dispatch(operationsActions.serviceSelected({ date, slotId }));
      return dispatch(fetchData("staff", { scope: getState().auth.generation, date, slotId }));
    },
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
    },
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
    },

    // ─── Reservation status (check-in actions) ────────────────────────────────────
    async updateReservationStatus(reservationId, newStatus) {
      if (newStatus === "Checked-In") {
        return this.request("/checkin", {
          method: "POST",
          body: {
            reservation_id: reservationId,
            staff_id: this.session?.user?.id,
          },
        });
      }
      if (newStatus === "No-Show") {
        return this.request(`/reservations/${encodeURIComponent(reservationId)}`, {
          method: "PATCH",
          body: { reservation_status: "no_show" },
        });
      }
      throw new Error("Unsupported reservation status.");
    },

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
    },

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
    },

    async changePassword(currentPassword, newPassword) {
      await this.request("/auth/login", {
        method: "POST",
        body: { email: this.session.user.email, password: currentPassword },
      });
      await this.request(`/users/${this.session.user.id}`, {
        method: "PATCH",
        body: { password_hash: newPassword },
      });
    },
  };
}
