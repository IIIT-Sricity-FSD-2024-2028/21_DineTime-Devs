import { fetchData } from "./dataActions.js";
import { createRequest } from "./request.js";
import { authActions } from "../slices/authSlice.js";
import { signIn, signOut } from "./authActions.js";
import { asset } from "../api/dinerApi.js";
export function createDinerActions(dispatch, getState) {
  return {
    request: createRequest(dispatch, getState),
    asset,
    get session() {
      return getState().auth.session;
    },
    saveSession(session) {
      if (session)
        dispatch(
          authActions.profileUpdated({
            user: session.user,
            generation: getState().auth.generation,
          }),
        );
    },
    login(email, password) {
      return dispatch(signIn({ email, password }, "diner"));
    },
    logout(message = "") {
      dispatch(signOut(message));
    },
    refresh() {
      return dispatch(fetchData("diner", { scope: getState().auth.generation }));
    },
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
    },

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
    },

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
    },

    savePreferences(preferences) {
      dispatch(authActions.preferencesUpdated(preferences));
    },
    availability(restaurantId, slotId, signal) {
      return this.request(
        `/tableslots/availability?restaurant_id=${encodeURIComponent(restaurantId)}&slot_id=${encodeURIComponent(slotId)}`,
        { signal },
      );
    },

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
    },

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
    },

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
    },

    async deleteReservation(id) {
      await this.request(`/reservations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await this.refresh().catch(() => {});
    },

    async cancelReservation(id) {
      await this.request(`/reservations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { reservation_status: "cancelled" },
      });
      await this.refresh().catch(() => {});
    },

    async completeDine(id) {
      const result = await this.request(`/reservations/${encodeURIComponent(id)}/dine-complete`, {
        method: "PATCH",
        body: {},
      });
      await this.refresh().catch(() => {});
      return result;
    },

    async modifyReservation(id, values) {
      const reservation = await this.request(`/reservations/${encodeURIComponent(id)}/modify`, {
        method: "PATCH",
        body: values,
      });
      await this.refresh().catch(() => {});
      return reservation;
    },

    async discardModification(id) {
      const reservation = await this.request(
        `/reservations/${encodeURIComponent(id)}/modify/pending`,
        {
          method: "DELETE",
        },
      );
      await this.refresh().catch(() => {});
      return reservation;
    },

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
      await this.refresh().catch(() => {});
    },

    order(reservationId, items) {
      return this.request("/orders", {
        method: "POST",
        body: { reservation_id: reservationId, items },
      });
    },

    async updateProfile(values) {
      const auth = getState().auth;
      if (!auth.session) throw new Error("Please sign in.");
      const allowed = [
        "name",
        "email",
        "phone",
        "photo_url",
        "city",
        "country",
        "address",
        "pincode",
        "latitude",
        "longitude",
      ];
      const body = Object.fromEntries(
        allowed.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]),
      );
      const user = await this.request(`/users/${auth.session.user.id}`, {
        method: "PATCH",
        body,
      });
      dispatch(authActions.profileUpdated({ user, generation: auth.generation }));
    },
    async uploadPhoto(file) {
      const auth = getState().auth;
      const body = new FormData();
      body.append("photo", file);
      const user = await this.request(`/users/${auth.session.user.id}/upload-photo`, {
        method: "POST",
        body,
      });
      dispatch(authActions.profileUpdated({ user, generation: auth.generation }));
    },

    async changePassword(currentPassword, password) {
      await this.request("/auth/login", {
        method: "POST",
        body: { email: this.session.user.email, password: currentPassword },
      });
      await this.request(`/users/${this.session.user.id}`, {
        method: "PATCH",
        body: { password_hash: password },
      });
    },

    async settings() {
      const [definitions, values] = await Promise.all([
        this.request("/settings?role=diner"),
        this.request(`/settings/users/${this.session.user.id}`),
      ]);
      return definitions.map((definition) => ({
        ...definition,
        setting: values.find((value) => value.setting_id === definition.id),
      }));
    },

    updateSetting(id, value) {
      return this.request(`/settings/users/${id}`, {
        method: "PATCH",
        body: { value },
      });
    },

    tickets() {
      return this.request(
        `/support/tickets/mine?user_id=${encodeURIComponent(this.session.user.id)}`,
      );
    },

    createTicket(values, files) {
      const body = new FormData();
      Object.entries({
        ...values,
        raised_by_user_id: this.session.user.id,
        raised_by_role: "diner",
      }).forEach(([key, value]) => body.append(key, value));
      files.forEach((file) => body.append("attachments", file));
      return this.request("/support/tickets", { method: "POST", body });
    },
  };
}
