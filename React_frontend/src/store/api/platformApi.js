import { queryRequest } from "./baseQuery.js";
export const emptyPlatform = {
  restaurants: [],
  users: [],
  reservations: [],
  reservationsError: "",
  notifications: [],
  tables: [],
  timeslots: [],
  tableSlots: [],
  locations: {},
  subAdmins: [],
  tickets: [],
};
export async function loadPlatformData(api, scope) {
  const rawRequest = queryRequest(api, scope),
    request = async (path) => ({ data: await rawRequest(path) });
  const endpoints = [
    "/restaurants",
    "/users",
    "/reservations",
    "/tables",
    "/timeslots",
    "/tableslots",
    "/notifications",
    "/sub-admin",
    "/support/tickets",
  ];
  const settled = await Promise.allSettled(endpoints.map((path) => request(path)));
  if (settled.some((result) => result.status === "rejected"))
    throw new Error("Unable to refresh platform data. Please try again.");
  const payloads = settled.map((result) => (result.status === "fulfilled" ? result.value : null));
  const [
    restaurantsRes,
    usersRes,
    reservationsRes,
    tablesRes,
    timeslotsRes,
    tableSlotsRes,
    notificationsRes,
    subAdminsRes,
    ticketsRes,
  ] = payloads;
  const restaurants = restaurantsRes?.data || [];
  const locationIds = Array.from(
    new Set(restaurants.map((restaurant) => restaurant.location_id).filter(Boolean)),
  );
  const locationEntries = await Promise.all(
    locationIds.map(async (locationId) => {
      try {
        const response = await request(`/restaurants/locations/${locationId}`);
        return [locationId, response?.data || null];
      } catch (_error) {
        return [locationId, null];
      }
    }),
  );
  return {
    restaurants,
    users: usersRes?.data || [],
    reservations: reservationsRes?.data || [],
    reservationsError:
      settled[2].status === "rejected"
        ? "Unable to load reservations. Please refresh and try again."
        : "",
    tables: tablesRes?.data || [],
    timeslots: timeslotsRes?.data || [],
    tableSlots: tableSlotsRes?.data || [],
    notifications: notificationsRes?.data || [],
    subAdmins: subAdminsRes?.data || [],
    tickets: ticketsRes?.data || [],
    locations: Object.fromEntries(locationEntries),
  };
}
