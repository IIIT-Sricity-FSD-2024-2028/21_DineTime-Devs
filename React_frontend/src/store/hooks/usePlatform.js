import { useData } from "./useData.js";
import { useMemo } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { emptyPlatform } from "../api/platformApi.js";

import { createPlatformActions } from "../actions/platformActions.js";

import {
  mapReservationStatus,
  mapRestaurantStatus,
  mapUserStatus,
  ROLE_LABELS,
} from "../../apps/super-admin/utils/mappers.js";
function platformDisplay(data) {
  function locationForRestaurant(restaurant) {
    return data.locations[restaurant.location_id] || null;
  }

  function getRestaurantDisplay(restaurant) {
    const manager = data.users.find((user) => user.id === restaurant.manager_id);
    const location = locationForRestaurant(restaurant);
    const tables = data.tables.filter((table) => table.restaurant_id === restaurant.id);
    const reservations = data.reservations.filter(
      (reservation) => reservation.restaurant_id === restaurant.id,
    );
    const slots = data.timeslots
      .filter((slot) => slot.restaurant_id === restaurant.id)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    const timeSlots = Array.from(
      new Set(
        slots.map(
          (slot) => `${String(slot.start_time).slice(0, 5)}-${String(slot.end_time).slice(0, 5)}`,
        ),
      ),
    )
      .slice(0, 3)
      .join(", ");
    return {
      id: restaurant.id,
      name: restaurant.name,
      cuisine: restaurant.cuisine_type,
      tables: tables.length || Number(restaurant.total_tables) || 0,
      city: location?.city || "Unknown",
      address: location?.address || "Address not set",
      pincode: location?.pincode || "",
      managerName: manager?.name || "Unassigned",
      managerEmail: manager?.email || "",
      license: manager?.business_license_number || "",
      timeSlots: timeSlots || "Not configured",
      status: mapRestaurantStatus(restaurant.status),
      activeReservations: reservations.filter(
        (reservation) =>
          !["cancelled", "completed", "no_show"].includes(reservation.reservation_status),
      ).length,
      manager_id: restaurant.manager_id,
      location_id: restaurant.location_id,
    };
  }

  function getUserDisplay(user) {
    const restaurant =
      user.role === "manager"
        ? data.restaurants.find((item) => item.manager_id === user.id)
        : data.restaurants.find((item) => item.id === user.restaurant_id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: ROLE_LABELS[user.role] || user.role,
      node: restaurant?.name || "N/A",
      status: mapUserStatus(user.status),
      restaurant_id: restaurant?.id || user.restaurant_id || "",
      business_license_number: user.business_license_number || "",
      location_id: user.location_id || restaurant?.location_id || "",
    };
  }

  function getReservationDisplay(reservation) {
    const user = data.users.find((item) => item.id === reservation.user_id);
    const restaurant = data.restaurants.find((item) => item.id === reservation.restaurant_id);
    const slot = data.timeslots.find((item) => item.id === reservation.slot_id);
    return {
      id: reservation.id,
      dinerName: user?.name || "Guest",
      dinerId: reservation.user_id,
      restaurantName: restaurant?.name || "Restaurant",
      restaurantId: reservation.restaurant_id,
      date: reservation.slot_date || reservation.slot?.slot_date || slot?.slot_date || "",
      time: String(
        reservation.start_time || reservation.slot?.start_time || slot?.start_time || "",
      ).slice(0, 5),
      party: reservation.guest_count,
      status: mapReservationStatus(reservation.reservation_status),
      raw: reservation,
    };
  }

  return { getRestaurantDisplay, getUserDisplay, getReservationDisplay };
}

export function usePlatform() {
  const dispatch = useDispatch(),
    store = useStore();
  const auth = useSelector((state) => state.auth);
  const auditLog = useSelector((state) => state.operations.auditLog);
  const query = useData(
    "platform",
    { scope: auth.generation },
    {
      skip: auth.session?.user.role !== "super_user",
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
    },
  );
  const data = useMemo(
    () => ({ ...(query.currentData || emptyPlatform), auditLog }),
    [query.currentData, auditLog],
  );
  const actions = useMemo(() => createPlatformActions(dispatch, store.getState), [dispatch, store]);
  return {
    data,
    ...actions,
    ...platformDisplay(data),
    error: query.error?.message || "",
  };
}
