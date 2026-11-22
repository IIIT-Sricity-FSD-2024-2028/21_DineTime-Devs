import { queryRequest, API_BASE } from "./baseQuery.js";
import { authActions } from "../slices/authSlice.js";
import { image } from "../../apps/diner/utils/images.js";
import { distanceKm } from "../../apps/diner/utils/distance.js";
export const emptyDiner = {
  restaurants: [],
  menu: [],
  tables: [],
  slots: [],
  reviews: [],
  reservations: [],
  notifications: [],
  locations: [],
  reservationError: "",
  notificationError: "",
};
export function asset(url, fallback = "indian.jpg") {
  if (!url) return image(fallback);
  if (url.startsWith("/uploads/")) return `${API_BASE}${url}`;
  if (/^https?:\/\//.test(url)) return url;
  return image(url.split("/").pop());
}

export async function loadDinerData(api, scope) {
  const auth = api.getState().auth;
  const generation = auth.generation,
    version = auth.profileVersion;
  const client = {
    session: auth.session,
    request: queryRequest(api, scope),
    asset,
  };
  try {
    const [restaurants, menu, tables, slots, reviews, locations] = await Promise.all(
      ["/restaurants", "/menu", "/tables", "/timeslots", "/reviews", "/restaurants/locations"].map(
        (path) => client.request(path),
      ),
    );

    const currentUser = client.session?.user;
    if (currentUser?.location_id) {
      const location = locations.find((item) => item.id === currentUser.location_id);
      let safeProfile = {};
      try {
        const profile = await client.request(`/users/${encodeURIComponent(currentUser.id)}`);
        const { password_hash: _passwordHash, ...publicProfile } = profile;
        safeProfile = publicProfile;
      } catch {
        // Login already supplied a usable public profile; profile hydration is optional.
      }

      // Location records also carry an `id`; preserve the diner account ID.
      const { id: _locationId, ...locationDetails } = location || {};
      const hydratedUser = {
        ...currentUser,
        ...locationDetails,
        ...safeProfile,
      };
      api.dispatch(authActions.profileUpdated({ user: hydratedUser, generation, version }));
      client.session = api.getState().auth.session;
    }
    const normalizeRestaurant = (restaurant) => {
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
        image: client.asset(restaurant.image_urls?.[0]),
        images: (restaurant.image_urls || []).map((url) => client.asset(url)),
        location: locationLabel,
        city: location?.city || "",
        address: location?.address || "",
        state: location?.state || "",
        pincode: location?.pincode || "",
        distance: distanceKm(client.session?.user, location),
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
    };
    let reservations = [],
      notifications = [],
      reservationError = "",
      notificationError = "";
    if (client.session?.user) {
      const [reservationResult, notificationResult] = await Promise.allSettled([
        client.request(`/reservations?user_id=${encodeURIComponent(client.session.user.id)}`),
        client.request(`/notifications?user_id=${encodeURIComponent(client.session.user.id)}`),
      ]);
      if (reservationResult.status === "fulfilled") reservations = reservationResult.value;
      else reservationError = reservationResult.reason.message;
      if (notificationResult.status === "fulfilled") notifications = notificationResult.value;
      else notificationError = notificationResult.reason.message;
    }

    const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
    reservations.forEach((reservation) => {
      const restaurant = reservation.restaurant_summary;
      if (restaurant)
        restaurantById.set(restaurant.id, {
          ...restaurantById.get(restaurant.id),
          ...restaurant,
        });
    });
    const normalized = [...restaurantById.values()].map(normalizeRestaurant);
    return {
      restaurants: normalized,
      menu: menu.map((item) => ({
        ...item,
        image: client.asset(item.image_urls?.[0], "starter.png"),
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
    };
  } catch (error) {
    throw error;
  }
}
