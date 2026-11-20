import { queryRequest } from "./baseQuery.js";
import { authActions } from "../slices/authSlice.js";
export const emptyStaff = {
  tables: [],
  reservations: [],
  slots: [],
  allTables: [],
  activeSlotId: "",
};
export async function loadStaffData(api, { scope, date, slotId: selectedSlotId }) {
  const generation = api.getState().auth.generation;
  const client = {
    session: api.getState().auth.session,
    request: queryRequest(api, scope),
  };
  try {
    if (!client.session?.user?.id) throw new Error("Please sign in to view staff data.");
    if (!client.session.user.restaurantId) {
      const profile = await client.request(`/users/${encodeURIComponent(client.session.user.id)}`);
      const restaurantId = profile?.restaurant_id;
      if (!restaurantId) throw new Error("This staff account is not assigned to a restaurant.");
      const restaurants = await client.request("/restaurants");
      const restaurant = (restaurants || []).find((entry) => entry.id === restaurantId);
      if (!restaurant) throw new Error("The assigned restaurant could not be found.");
      const session = {
        ...client.session,
        user: {
          ...client.session.user,
          restaurantId,
          restaurantName: restaurant.name,
        },
      };
      api.dispatch(authActions.profileUpdated({ user: session.user, generation }));
      client.session = session;
    }
    const restaurantId = client.session.user.restaurantId;
    const [tablesRes, slotsRes, tableSlotsRes, usersRes] = await Promise.all([
      client.request("/tables", { role: "staff" }),
      client.request("/timeslots", { role: "staff" }),
      client.request("/tableslots", { role: "staff" }),
      client.request("/users", { role: "staff" }).catch(() => []),
    ]);

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
          activeSlot.table_layout?.find((entry) => entry.table_id === t.id)?.capacity ?? t.capacity,
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
    const reservationsRes = await client.request(reservationPath, {
      role: "staff",
    });

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

    return {
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
    };
  } catch (error) {
    throw error;
  }
}
