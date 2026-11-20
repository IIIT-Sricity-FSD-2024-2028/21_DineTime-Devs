import { queryRequest, API_BASE } from "./baseQuery.js";

export const managerMapping = {
  _assetUrl(url) {
    if (!url) return url;
    const value = String(url);
    if (value.startsWith("/uploads/")) {
      return `${API_BASE}${value}`;
    }
    if (value.startsWith("../images/") || value.startsWith("images/")) {
      return `/assets/${value.split("/").pop()}`;
    }
    return value;
  },
  _assetKey(url) {
    return String(url || "")
      .trim()
      .replace(API_BASE, "");
  },
  _assetPath(url) {
    const value = String(url || "").trim();
    if (value.startsWith(API_BASE)) return value.slice(API_BASE.length);
    if (value.startsWith("/assets/")) return `../images/${value.split("/").pop()}`;
    return value;
  },
  _uniqueAssetUrls(urls) {
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
  },
  _composeDescription(about, policies, details = {}) {
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
  },
  _extractStructuredBlock(description, marker, nextMarkers = []) {
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
  },
  _extractDetails(description) {
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
  },
  _extractPolicies(description) {
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
  },
  _extractAbout(description) {
    if (!description) {
      return "";
    }

    const raw = String(description);
    const indexes = ["Details:", "Policies:"]
      .map((marker) => raw.indexOf(marker))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    return raw.slice(0, indexes.length ? indexes[0] : raw.length).trim();
  },
};

export const emptyManager = {
  profile: {
    name: "Manager",
    email: "manager@dinetime.com",
    avatar: null,
    phone: "9000000000",
    city: "Bangalore",
    restaurantName: "Spice Garden",
    memberSince: new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
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
export async function loadManagerData(api, scope) {
  const request = queryRequest(api, scope),
    session = api.getState().auth.session;
  const [initialUsers, initialRestaurants] = await Promise.all([
    request("/users"),
    request("/restaurants"),
  ]);
  const user =
    initialUsers.find((u) => u.id === session?.user.id) ||
    initialUsers.find((u) => u.email === session?.user.email);
  const restaurant = initialRestaurants.find((r) => r.manager_id === user?.id);
  const client = {
    ...managerMapping,
    ids: {
      managerId: user?.id,
      restaurantId: restaurant?.id,
      locationId: restaurant?.location_id,
    },
    _request: async (path, options = {}) => ({
      data: await request(path, options),
    }),
    _headers: () => ({}),
    async load() {
      const ids = this.ids;
      const cache = structuredClone(emptyManager);
      if (!ids.managerId || !ids.restaurantId) {
        return { ...cache, ids };
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
        Promise.resolve({ data: initialUsers }),
        Promise.resolve({ data: initialRestaurants }),
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
        this._request(`/managers/${ids.managerId}`, {
          headers: this._headers("manager"),
        }),
        this._request(`/schedules?restaurant_id=${ids.restaurantId}`, {
          headers: this._headers("manager"),
        }),
      ]);

      cache.slotRecords = slotsRes?.data || [];
      cache.tableSlotRecords = tableSlotsRes?.data || [];
      cache.schedule = scheduleRes?.data || { weekly: [], rules: [] };
      const users = usersRes?.data || [];
      const restaurants = restaurantsRes?.data || [];
      const tables = tablesRes?.data || [];
      const slots = slotsRes?.data || [];
      const tableSlots = tableSlotsRes?.data || [];
      const menu = menuRes?.data || [];
      const reservations = reservationRes?.data || [];
      const reviews = reviewRes?.data || [];
      const notifications = notifRes?.data || [];

      const manager = users.find((u) => u.id === ids.managerId) || cache.profile;
      const managerDetails = managerDetailsRes?.data || {};
      const managerRestaurants = restaurants.filter((r) => r.manager_id === ids.managerId);
      const restaurant =
        managerRestaurants.find((r) => r.id === ids.restaurantId) || managerRestaurants[0] || {};

      if (restaurant?.id && restaurant.id !== ids.restaurantId) {
        ids.restaurantId = restaurant.id;
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

      cache.profile = {
        ...cache.profile,
        name: manager.name || cache.profile.name,
        email: manager.email || cache.profile.email,
        phone: manager.phone || cache.profile.phone,
        city,
        restaurantName: restaurant.name || cache.profile.restaurantName,
        avatar: this._assetUrl(manager.photo_url || cache.profile.avatar),
      };

      const parsedDetails = this._extractDetails(restaurant.description);
      const gallery = this._uniqueAssetUrls(restaurant.image_urls || []);

      cache.restaurant = {
        ...cache.restaurant,
        id: restaurant.id,
        is_open: Boolean(restaurant.is_open),
        is_closed: Boolean(restaurant.is_closed),
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
        parking: parsedDetails.parking || cache.restaurant.parking,
        rating: restaurant.rating_avg ?? cache.restaurant.rating,
        dressCode: parsedDetails.dresscode || cache.restaurant.dressCode,
        price: parsedDetails.price || cache.restaurant.price,
        contact:
          restaurant.contact_number ||
          parsedDetails.contact ||
          restaurant.phone ||
          cache.profile.phone,
        amenities: parsedDetails.amenities || cache.restaurant.amenities,
        image: gallery[0] || "",
        reservationFeePerGuest:
          restaurant.reservation_fee_per_guest ?? cache.restaurant.reservationFeePerGuest,
        cancellationCutoffMinutes:
          restaurant.cancellation_cutoff_minutes ?? cache.restaurant.cancellationCutoffMinutes,
        noShowGraceMinutes: restaurant.no_show_grace_minutes ?? cache.restaurant.noShowGraceMinutes,
      };

      const parsedPolicies = this._extractPolicies(restaurant.description);
      if (parsedPolicies) {
        cache.policies = parsedPolicies;
      }

      cache.gallery = gallery;

      cache.tables = tables.map((t) => ({
        id: t.id,
        number: `Table ${t.table_number}`,
        seats: t.capacity,
        active: t.status !== "inactive",
        status: t.status || "active",
      }));

      cache.menu = menu.map((m) => ({
        id: m.id,
        restaurant_id: m.restaurant_id,
        name: m.item_name || m.name,
        category: m.category,
        price: m.price,
        available: m.is_available ?? m.availability,
        image: this._assetUrl((m.image_urls && m.image_urls[0]) || "images/dish-1.jpg"),
      }));

      cache.reservations = reservations
        .filter((r) => r.restaurant_id === ids.restaurantId)
        .map((r) => {
          const user = userById[r.user_id] || {};
          const table = cache.tables.find((t) => t.id === r.table_id);
          const slot = slots.find((s) => s.id === r.slot_id);
          const statusValue = r.reservation_status || r.status;
          const isWalkIn = /^walkin\.[^@]+@dinetime\.local$/i.test(user.email || "");
          return {
            id: r.id,
            name: user.name || "Guest",
            email: isWalkIn ? "" : user.email || "guest@example.com",
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
                  .map((id) => cache.tables.find((item) => item.id === id)?.number || id)
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

      cache.reviews = reviews.map((r) => ({
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

      cache.staff = users
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

      cache.notifications = notifications
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
          maxTables: cache.tables.length,
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
            maxTables: cache.tables.length,
          });
        }
      });
      const templateSlots = Array.from(slotMap.values()).sort((a, b) =>
        a.start.localeCompare(b.start),
      );
      cache.timeSlotsConfig = {
        operatingHours: {
          open: restaurant.opens_at || "11:00",
          close: restaurant.closes_at || "23:00",
        },
        dates,
        slots: templateSlots,
      };

      const slotById = Object.fromEntries(slots.map((slot) => [slot.id, slot]));
      const tableById = Object.fromEntries(cache.tables.map((table) => [table.id, table]));
      cache.blockedTables = tableSlots
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
      cache.activity = {
        reservations: cache.reservations.length,
        availableTables: cache.tables.length,
        avgRating: cache.reviews.length
          ? Number(
              (
                cache.reviews.reduce((a, b) => a + Number(b.rating || 0), 0) / cache.reviews.length
              ).toFixed(1),
            )
          : 0,
      };
      return { ...cache, ids };
    },
  };
  return client.load();
}
