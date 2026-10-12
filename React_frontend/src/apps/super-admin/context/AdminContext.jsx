import { createContext, useContext, useMemo, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { mapReservationStatus, mapRestaurantStatus, mapUserStatus, ROLE_LABELS } from '../utils/mappers.js';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [data, setData] = useState({
    restaurants: [],
    users: [],
    reservations: [],
    notifications: [],
    tables: [],
    timeslots: [],
    tableSlots: [],
    locations: {},
    auditLog: [],
    subAdmins: [],
    tickets: [],
  });

  function addAuditLog(message) {
    setData((current) => ({
      ...current,
      auditLog: [...current.auditLog, { time: new Date().toLocaleTimeString('en-GB'), message }],
    }));
  }

  async function syncAdminState() {
    const endpoints = ['/restaurants', '/users', '/reservations', '/tables', '/timeslots', '/tableslots', '/notifications', '/sub-admin', '/support/tickets'];
    const settled = await Promise.allSettled(endpoints.map((path) => apiRequest(path)));
    const payloads = settled.map((result) => (result.status === 'fulfilled' ? result.value : null));
    const [restaurantsRes, usersRes, reservationsRes, tablesRes, timeslotsRes, tableSlotsRes, notificationsRes, subAdminsRes, ticketsRes] = payloads;
    const restaurants = restaurantsRes?.data || [];
    const locationIds = Array.from(new Set(restaurants.map((restaurant) => restaurant.location_id).filter(Boolean)));
    const locationEntries = await Promise.all(locationIds.map(async (locationId) => {
      try {
        const response = await apiRequest(`/restaurants/locations/${locationId}`);
        return [locationId, response?.data || null];
      } catch (_error) {
        return [locationId, null];
      }
    }));
    setData((current) => ({
      ...current,
      restaurants,
      users: usersRes?.data || [],
      reservations: reservationsRes?.data || [],
      tables: tablesRes?.data || [],
      timeslots: timeslotsRes?.data || [],
      tableSlots: tableSlotsRes?.data || [],
      notifications: notificationsRes?.data || [],
      subAdmins: subAdminsRes?.data || [],
      tickets: ticketsRes?.data || [],
      locations: Object.fromEntries(locationEntries),
    }));
  }

  function locationForRestaurant(restaurant) {
    return data.locations[restaurant.location_id] || null;
  }

  function getRestaurantDisplay(restaurant) {
    const manager = data.users.find((user) => user.id === restaurant.manager_id);
    const location = locationForRestaurant(restaurant);
    const tables = data.tables.filter((table) => table.restaurant_id === restaurant.id);
    const reservations = data.reservations.filter((reservation) => reservation.restaurant_id === restaurant.id);
    const slots = data.timeslots.filter((slot) => slot.restaurant_id === restaurant.id).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    const timeSlots = Array.from(new Set(slots.map((slot) => `${String(slot.start_time).slice(0, 5)}-${String(slot.end_time).slice(0, 5)}`))).slice(0, 3).join(', ');
    return {
      id: restaurant.id,
      name: restaurant.name,
      cuisine: restaurant.cuisine_type,
      tables: tables.length || Number(restaurant.total_tables) || 0,
      city: location?.city || 'Unknown',
      address: location?.address || 'Address not set',
      pincode: location?.pincode || '',
      managerName: manager?.name || 'Unassigned',
      managerEmail: manager?.email || '',
      license: manager?.business_license_number || '',
      timeSlots: timeSlots || 'Not configured',
      status: mapRestaurantStatus(restaurant.status),
      activeReservations: reservations.filter((reservation) => !['cancelled', 'completed', 'no_show'].includes(reservation.reservation_status)).length,
      manager_id: restaurant.manager_id,
      location_id: restaurant.location_id,
    };
  }

  function getUserDisplay(user) {
    const restaurant = user.role === 'manager'
      ? data.restaurants.find((item) => item.manager_id === user.id)
      : data.restaurants.find((item) => item.id === user.restaurant_id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: ROLE_LABELS[user.role] || user.role,
      node: restaurant?.name || 'N/A',
      status: mapUserStatus(user.status),
      restaurant_id: restaurant?.id || user.restaurant_id || '',
      business_license_number: user.business_license_number || '',
      location_id: user.location_id || restaurant?.location_id || '',
    };
  }

  function getReservationDisplay(reservation) {
    const user = data.users.find((item) => item.id === reservation.user_id);
    const restaurant = data.restaurants.find((item) => item.id === reservation.restaurant_id);
    const slot = data.timeslots.find((item) => item.id === reservation.slot_id);
    return {
      id: reservation.id,
      dinerName: user?.name || 'Guest',
      dinerId: reservation.user_id,
      restaurantName: restaurant?.name || 'Restaurant',
      restaurantId: reservation.restaurant_id,
      date: slot?.slot_date || '',
      time: String(slot?.start_time || '').slice(0, 5),
      party: reservation.guest_count,
      status: mapReservationStatus(reservation.reservation_status),
      raw: reservation,
    };
  }

  const value = useMemo(() => ({ data, setData, syncAdminState, addAuditLog, getRestaurantDisplay, getUserDisplay, getReservationDisplay }), [data]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
