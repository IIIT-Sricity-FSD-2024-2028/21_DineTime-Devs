import { fetchData, selectData } from "./dataActions.js";
import { createRequest } from "./request.js";
import { signOut } from "./authActions.js";
import { emptyManager, managerMapping } from "../api/managerApi.js";

export function createRestaurantActions(dispatch, getState) {
  const request = createRequest(dispatch, getState);
  return {
    ...managerMapping,
    getData() {
      return selectData(getState(), "manager")?.data || emptyManager;
    },
    _getIds() {
      return this.getData().ids || {};
    },
    _headers() {
      return {};
    },
    _authHeaders() {
      return {};
    },
    _request: async (path, options = {}) => ({
      data: await request(path, options),
    }),
    async _ensureLinkedRestaurant() {
      let ids = this._getIds();
      if (!ids.restaurantId) {
        await this.refreshFromBackend();
        ids = this._getIds();
      }
      if (!ids.restaurantId) throw new Error("Restaurant is not linked to this manager account.");
      return ids;
    },
    refreshFromBackend() {
      return dispatch(fetchData("manager", { scope: getState().auth.generation }));
    },
    logout() {
      dispatch(signOut());
    },
    async markAllNotificationsRead() {
      await Promise.all(
        this.getData().notifications.map((n) =>
          request(`/notifications/${n.id}`, {
            method: "PATCH",
            body: { is_read: true },
          }),
        ),
      );
    },
    async updateWeeklySchedule(weekly) {
      const data = structuredClone(this.getData());
      const ids = await this._ensureLinkedRestaurant();
      const response = await this._request(`/schedules/${ids.restaurantId}/weekly`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ weekly }),
      });
      data.schedule = response?.data || data.schedule;
      await this.refreshFromBackend();
      return data.schedule;
    },
    async updateDateSchedule(config) {
      const data = structuredClone(this.getData());
      const ids = await this._ensureLinkedRestaurant();
      const response = await this._request(`/schedules/${ids.restaurantId}/date`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify(config),
      });
      data.schedule = response?.data || data.schedule;
      await this.refreshFromBackend();
      return data.schedule;
    },
    async resetDateSchedule(date) {
      const ids = await this._ensureLinkedRestaurant();
      await this._request(`/schedules/${ids.restaurantId}/date/reset`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ start_date: date }),
      });
      await this.refreshFromBackend();
    },
    async updateDefaultTableLayout(layout) {
      const data = structuredClone(this.getData());
      const ids = await this._ensureLinkedRestaurant();
      const response = await this._request(`/schedules/${ids.restaurantId}/default-layout`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ layout }),
      });
      data.schedule = response?.data || data.schedule;
      await this.refreshFromBackend();
      return data.schedule;
    },
    async saveSlotLayout(slotId, revision, tables) {
      const response = await this._request(`/timeslots/${slotId}/layout`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ revision, tables }),
      });
      await this.refreshFromBackend();
      return response?.data;
    },
    async resetSlotLayout(slotId, revision) {
      const response = await this._request(`/timeslots/${slotId}/layout/reset`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ revision }),
      });
      await this.refreshFromBackend();
      return response?.data;
    },
    async setServingStatus(isOpen) {
      const ids = await this._ensureLinkedRestaurant();

      const response = await this._request(`/restaurants/${ids.restaurantId}/serving-status`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ manager_id: ids.managerId, is_open: isOpen }),
      });

      await this.refreshFromBackend();
      return response?.data ?? response;
    },
    async setClosureStatus(isClosed) {
      const ids = await this._ensureLinkedRestaurant();
      await this._request(`/restaurants/${ids.restaurantId}/closure-status`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({
          manager_id: ids.managerId,
          is_closed: isClosed,
        }),
      });
      await this.refreshFromBackend();
    },
    async updateProfile(profileUpdates) {
      const data = structuredClone(this.getData());
      data.profile = { ...data.profile, ...profileUpdates };
      const ids = this._getIds();
      if (ids.managerId) {
        const payload = {
          name: data.profile.name,
          email: data.profile.email,
          phone: data.profile.phone,
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
      await this.refreshFromBackend();
    },
    async uploadProfilePhoto(file) {
      const data = structuredClone(this.getData());
      const ids = this._getIds();
      if (!ids.managerId) {
        throw new Error("Manager account is not linked to the backend.");
      }

      const formData = new FormData();
      formData.append("photo", file);
      const response = await this._request(`/users/${ids.managerId}/upload-photo`, {
        method: "POST",
        headers: this._authHeaders(),
        body: formData,
      });

      const body = response;
      const photoUrl = this._assetUrl(body?.data?.photo_url);
      data.profile = { ...data.profile, avatar: photoUrl };
      return data.profile;
    },
    async removeProfilePhoto() {
      await this.updateProfile({ avatar: "" });
      await this.refreshFromBackend();
    },
    async updateRestaurantDetails(restUpdates) {
      const data = structuredClone(this.getData());
      data.restaurant = { ...data.restaurant, ...restUpdates };
      data.gallery = this._uniqueAssetUrls(data.gallery);
      const imageUrls = data.gallery.map((image) => this._assetPath(image));
      const ids = this._getIds();
      if (ids.restaurantId) {
        await this._request(`/restaurants/${ids.restaurantId}`, {
          method: "PATCH",
          headers: this._headers("manager"),
          body: JSON.stringify({
            name: data.restaurant.name,
            cuisine_type: data.restaurant.cuisine,
            contact_number: data.restaurant.contact,
            description: this._composeDescription(
              data.restaurant.about,
              data.policies,
              data.restaurant,
            ),
            image_urls: imageUrls,
            reservation_fee_per_guest: Number(data.restaurant.reservationFeePerGuest) || 0,
            cancellation_cutoff_minutes: Number(data.restaurant.cancellationCutoffMinutes) || 0,
            no_show_grace_minutes: Number(data.restaurant.noShowGraceMinutes) || 0,
          }),
        });
      }
      await this.refreshFromBackend();
    },
    async uploadRestaurantImage(file, makePrimary = false) {
      const data = structuredClone(this.getData());
      const ids = await this._ensureLinkedRestaurant();

      const formData = new FormData();
      formData.append("image", file);
      const response = await this._request(`/restaurants/${ids.restaurantId}/upload-image`, {
        method: "POST",
        headers: this._authHeaders(),
        body: formData,
      });

      const body = response;
      const rawImages = body?.data?.image_urls || [];
      const latestRaw = rawImages[rawImages.length - 1];
      const latest = this._assetUrl(latestRaw);
      const previousGallery = this._uniqueAssetUrls(data.gallery || []);
      const nextGallery = this._uniqueAssetUrls(
        makePrimary ? [latest, ...previousGallery] : [...previousGallery, latest],
      );

      data.gallery = nextGallery;
      data.restaurant = {
        ...data.restaurant,
        image: makePrimary ? latest : data.restaurant.image || latest,
      };

      if (makePrimary) {
        await this._request(`/restaurants/${ids.restaurantId}`, {
          method: "PATCH",
          headers: this._headers("manager"),
          body: JSON.stringify({
            image_urls: nextGallery.map((image) => this._assetPath(image)),
            description: this._composeDescription(
              data.restaurant.about,
              data.policies,
              data.restaurant,
            ),
          }),
        });
      }

      await this.refreshFromBackend();
      return data.restaurant.image;
    },
    async removeRestaurantImage(image) {
      const data = structuredClone(this.getData());
      const ids = await this._ensureLinkedRestaurant();
      const imageKey = this._assetKey(image);
      const remaining = this._uniqueAssetUrls(data.gallery || []).filter(
        (galleryImage) => this._assetKey(galleryImage) !== imageKey,
      );
      const imageWasPrimary = this._assetKey(data.restaurant.image) === imageKey;
      data.gallery = remaining;
      data.restaurant = {
        ...data.restaurant,
        image: imageWasPrimary ? remaining[0] || "" : data.restaurant.image,
      };

      await this._request(`/restaurants/${ids.restaurantId}`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({
          image_urls: remaining.map((galleryImage) => this._assetPath(galleryImage)),
          description: this._composeDescription(
            data.restaurant.about,
            data.policies,
            data.restaurant,
          ),
        }),
      });
      await this.refreshFromBackend();
    },
    async uploadMenuImage(file) {
      const formData = new FormData();
      formData.append("image", file);
      const response = await this._request(`/menu/upload-image`, {
        method: "POST",
        headers: this._authHeaders(),
        body: formData,
      });
      const body = response;
      return this._assetUrl(body?.data?.image_url);
    },
    async updatePolicies(newPolicies) {
      const data = structuredClone(this.getData());
      data.policies = Array.isArray(newPolicies) ? newPolicies : [];
      const ids = this._getIds();
      if (ids.restaurantId) {
        await this._request(`/restaurants/${ids.restaurantId}`, {
          method: "PATCH",
          headers: this._headers("manager"),
          body: JSON.stringify({
            description: this._composeDescription(
              data.restaurant.about,
              data.policies,
              data.restaurant,
            ),
          }),
        });
      }
      await this.refreshFromBackend();
    },
    async getReservationOrders(reservationId) {
      const response = await this._request(
        `/orders?reservation_id=${encodeURIComponent(reservationId)}`,
        {
          headers: this._headers("manager"),
        },
      );
      return response?.data || [];
    },
    updateReservationStatus(id, newStatus) {
      const data = structuredClone(this.getData());
      const statusMap = {
        Confirmed: "checked_in",
        Pending: "reserved",
        Complete: "completed",
        Cancelled: "cancelled",
      };
      return this._request(`/reservations/${id}`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({
          reservation_status: statusMap[newStatus] || "reserved",
        }),
      }).then(() => {
        const reservation = data.reservations.find((r) => r.id === id);
        if (reservation) {
          reservation.status = newStatus;
        }
        return this.refreshFromBackend();
      });
    },
    async addMenuItem(item) {
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
    },
    async updateMenuItem(id, updatedItem) {
      const data = structuredClone(this.getData());
      const ids = await this._ensureLinkedRestaurant();
      const index = data.menu.findIndex((m) => m.id === id);
      const previousItem = index !== -1 ? data.menu[index] : {};
      const nextItem = { ...previousItem, ...updatedItem };
      if (index !== -1) {
        data.menu[index] = nextItem;
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
    },
    async deleteMenuItem(id) {
      await this._request(`/menu/${id}`, {
        method: "DELETE",
        headers: this._headers("manager"),
      });
      await this.refreshFromBackend();
    },
    async toggleMenuAvailability(id) {
      const data = structuredClone(this.getData());
      const item = data.menu.find((m) => m.id === id);
      if (!item) return;
      const current = item.available !== false;
      await this.updateMenuItem(id, { ...item, available: !current });
    },
    async updateTableSlotStatus(tableId, slotId, status) {
      const response = await this._request("/tableslots/status", {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ table_id: tableId, slot_id: slotId, status }),
      });
      await this.refreshFromBackend();
      return response?.data;
    },
    async updateStaffStatus(id, newStatus) {
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
    },
    async saveReviewReply(reviewId, replyText) {
      await this._request(`/reviews/${reviewId}/reply`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ reply: replyText }),
      });
      await this.refreshFromBackend();
    },
    async deleteReviewReply(reviewId) {
      await this._request(`/reviews/${reviewId}/reply`, {
        method: "PATCH",
        headers: this._headers("manager"),
        body: JSON.stringify({ reply: "" }),
      });
      await this.refreshFromBackend();
    },
  };
}
