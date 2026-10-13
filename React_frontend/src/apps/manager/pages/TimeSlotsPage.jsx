import { useState } from "react";
import ManagerLayout from "../components/ManagerLayout";
import { useManager } from "../hooks/useManager";
import { useToast } from "../hooks/useToast";

function minutes(value) {
  const [hours, mins] = String(value).split(":").map(Number);
  return hours * 60 + mins;
}
function timeText(value) {
  const [hours, mins] = String(value).split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export default function TimeSlotsPage() {
  const { data, storage, refresh } = useManager();
  const { showToast } = useToast();
  const config = data?.timeSlotsConfig || {
    operatingHours: { open: "", close: "" },
    slots: [],
  };
  const [hours, setHours] = useState(
    config.operatingHours || { open: "", close: "" },
  );
  const [editingHours, setEditingHours] = useState(false);
  const [modal, setModal] = useState(null);
  const [slot, setSlot] = useState({
    start: "",
    end: "",
    maxTables: data?.tables?.length || "",
  });
  const slots = config.slots || [];

  const syncSchedule = async (nextSlots, deletedSlot = null) => {
    const ids = await storage._ensureLinkedRestaurant();
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    });

    const existingResponse = await storage._request(
      `/timeslots?restaurant_id=${ids.restaurantId}`,
      { headers: storage._headers("manager") },
    );
    const existing = existingResponse?.data || [];

    if (deletedSlot) {
      const toDelete = existing.filter(
        (item) =>
          item.start_time === deletedSlot.start &&
          dates.includes(item.slot_date || item.date),
      );
      await Promise.all(
        toDelete.map((item) =>
          storage
            ._request(`/timeslots/${item.id}`, {
              method: "DELETE",
              headers: storage._headers("manager"),
            })
            .catch(() => null),
        ),
      );
    }

    const creationCalls = [];
    dates.forEach((date) => {
      const dayExisting = existing.filter(
        (item) => (item.slot_date || item.date) === date,
      );
      nextSlots.forEach((slotItem) => {
        const alreadyExists = dayExisting.some(
          (item) => item.start_time === slotItem.start,
        );
        if (!alreadyExists) {
          creationCalls.push(
            storage._request("/timeslots", {
              method: "POST",
              headers: storage._headers("manager"),
              body: JSON.stringify({
                restaurant_id: ids.restaurantId,
                slot_date: date,
                start_time: slotItem.start,
                end_time: slotItem.end,
              }),
            }),
          );
        }
      });
    });

    if (creationCalls.length > 0) {
      const outcomes = await Promise.allSettled(creationCalls);
      const errors = outcomes
        .filter((o) => o.status === "rejected")
        .map((o) => o.reason?.message || "Error adding slot");
      if (errors.length === creationCalls.length && errors.length > 0) {
        throw new Error(errors[0]);
      }
    }

    await storage._request("/tableslots/seed", {
      method: "POST",
      headers: storage._headers("manager"),
      body: JSON.stringify({ restaurant_id: ids.restaurantId }),
    }).catch(() => null);

    await storage.refreshFromBackend();
  };

  const saveHours = async () => {
    try {
      await storage.updateOperatingHours(hours.open, hours.close);
      refresh();
      setEditingHours(false);
      showToast("Operating hours updated.");
    } catch (error) {
      showToast(error.message || "Unable to update hours.", "error");
    }
  };

  const rangeOf = (s, e) => {
    const startMin = minutes(s);
    let endMin = minutes(e);
    if (endMin <= startMin) endMin += 1440;
    return { start: startMin, end: endMin };
  };

  const saveSlot = async (event) => {
    event.preventDefault();
    if (!slot.start || !slot.end) {
      showToast("Choose a start and end time for this slot.", "error");
      return;
    }
    const candidate = rangeOf(slot.start, slot.end);
    if (candidate.end - candidate.start !== 120) {
      showToast("Each time slot must be exactly 2 hours.", "error");
      return;
    }

    const overlap = slots.find((item) => {
      if (modal && item.id === modal) return false;
      const ex = rangeOf(item.start, item.end);
      return candidate.start < ex.end && ex.start < candidate.end;
    });

    if (overlap) {
      showToast(`Time slot overlaps with existing slot (${timeText(overlap.start)} - ${timeText(overlap.end)}).`, "error");
      return;
    }

    const next = slots.map((item) =>
      item.id === modal
        ? {
            ...item,
            ...slot,
            text: `${timeText(slot.start)} - ${timeText(slot.end)}`,
          }
        : item,
    );
    if (!modal)
      next.push({
        id: `slot-${Date.now()}`,
        ...slot,
        text: `${timeText(slot.start)} - ${timeText(slot.end)}`,
      });
    const nextData = storage.getData();
    nextData.timeSlotsConfig = { ...nextData.timeSlotsConfig, slots: next };
    storage.saveData(nextData);
    try {
      await syncSchedule(next);
      refresh();
      setModal(null);
      showToast("Time slots synced to upcoming booking dates.");
    } catch (error) {
      refresh();
      setModal(null);
      showToast(
        error.message || "Failed to sync time slot with backend.",
        "error",
      );
    }
  };

  const removeSlot = async (id) => {
    if (!window.confirm("Are you sure you want to delete this time slot?"))
      return;
    const deletedSlot = slots.find((item) => item.id === id);
    const nextSlots = slots.filter((item) => item.id !== id);
    const nextData = storage.getData();
    nextData.timeSlotsConfig.slots = nextSlots;
    storage.saveData(nextData);
    try {
      await syncSchedule(nextSlots, deletedSlot);
      refresh();
      showToast("Time slot deleted.");
    } catch (error) {
      refresh();
      showToast(
        error.message || "Failed to remove slot from backend.",
        "error",
      );
    }
  };

  const openEdit = (item) => {
    setSlot({ start: item.start, end: item.end, maxTables: item.maxTables });
    setModal(item.id);
  };

  return (
    <ManagerLayout
      title="Time Slot Management"
      description="Manage restaurant operating hours and reservation time slots efficiently"
      headerIcon="ph-clock"
    >
      <section className="card hours-card">
        <div className="section-heading">
          <h4>Restaurant Operating Hours</h4>
          <button
            className="btn btn-primary-orange btn-small"
            type="button"
            onClick={() => (editingHours ? saveHours() : setEditingHours(true))}
          >
            <i
              className={`ph ${editingHours ? "ph-check" : "ph-pencil-simple"}`}
            />{" "}
            {editingHours ? "Save Changes" : "Edit Operating Hours"}
          </button>
        </div>
        <div className="hours-fields">
          <label>
            Opening Time
            <input
              type="time"
              disabled={!editingHours}
              value={hours.open}
              onChange={(event) =>
                setHours({ ...hours, open: event.target.value })
              }
            />
          </label>
          <label>
            Closing Time
            <input
              type="time"
              disabled={!editingHours}
              value={hours.close}
              onChange={(event) =>
                setHours({ ...hours, close: event.target.value })
              }
            />
          </label>
        </div>
      </section>
      <section className="card">
        <div className="section-heading">
          <div>
            <h4>Reservation Time Slots</h4>
            <p>Manage the daily reservation slot schedule.</p>
            <p className="slot-sync-note">
              These slots are synced to upcoming booking dates automatically.
            </p>
          </div>
          <button
            className="btn btn-primary-orange btn-small"
            type="button"
            onClick={() => {
              setSlot({
                start: "",
                end: "",
                maxTables: data?.tables?.length || "",
              });
              setModal("");
            }}
          >
            <i className="ph ph-plus" /> Add Time Slot
          </button>
        </div>
        <table className="slot-table">
          <thead>
            <tr>
              <th>Time Slot</th>
              <th>Maximum Table Reservations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.length ? (
              slots.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.text ||
                      `${timeText(item.start)} - ${timeText(item.end)}`}
                  </td>
                  <td>{item.maxTables}</td>
                  <td>
                    <button
                      className="btn btn-small btn-outline"
                      type="button"
                      onClick={() => openEdit(item)}
                    >
                      <i className="ph ph-pencil-simple" /> Edit
                    </button>
                    <button
                      className="btn btn-small btn-outline danger"
                      type="button"
                      onClick={() => removeSlot(item.id)}
                    >
                      <i className="ph ph-trash" /> Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="empty-state">
                  No time slots configured. Click Add Time Slot to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      {modal !== null && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{modal ? "Edit Time Slot" : "Add Time Slot"}</h3>
              <button
                className="modal-close"
                type="button"
                onClick={() => setModal(null)}
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <form onSubmit={saveSlot}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                  Quick Presets (2-Hour Intervals)
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { start: "11:00", end: "13:00", label: "11:00 AM - 1:00 PM" },
                    { start: "13:00", end: "15:00", label: "1:00 PM - 3:00 PM" },
                    { start: "15:00", end: "17:00", label: "3:00 PM - 5:00 PM" },
                    { start: "17:00", end: "19:00", label: "5:00 PM - 7:00 PM" },
                    { start: "19:00", end: "21:00", label: "7:00 PM - 9:00 PM" },
                    { start: "21:00", end: "23:00", label: "9:00 PM - 11:00 PM" },
                  ].map((preset) => {
                    const isSelected = slot.start === preset.start && slot.end === preset.end;
                    const isUsed = slots.some((s) => s.start === preset.start && s.id !== modal);
                    return (
                      <button
                        key={preset.start}
                        type="button"
                        className={`btn btn-small ${isSelected ? "btn-primary-green" : "btn-outline"}`}
                        style={{
                          fontSize: 12,
                          padding: "4px 8px",
                          opacity: isUsed ? 0.45 : 1,
                        }}
                        onClick={() =>
                          setSlot((prev) => ({
                            ...prev,
                            start: preset.start,
                            end: preset.end,
                          }))
                        }
                      >
                        {preset.label} {isUsed ? "(configured)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label>
                Start Time
                <input
                  type="time"
                  value={slot.start}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (!val) {
                      setSlot({ ...slot, start: "", end: "" });
                      return;
                    }
                    const [h, m] = val.split(":").map(Number);
                    const endH = (h + 2) % 24;
                    const endStr = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                    setSlot({ ...slot, start: val, end: endStr });
                  }}
                />
              </label>
              <label>
                End Time (Must be exactly 2 hours after start)
                <input
                  type="time"
                  value={slot.end}
                  onChange={(event) =>
                    setSlot({ ...slot, end: event.target.value })
                  }
                />
              </label>
              <label>
                Maximum Table Reservations
                <input
                  type="number"
                  min="1"
                  value={slot.maxTables}
                  onChange={(event) =>
                    setSlot({ ...slot, maxTables: event.target.value })
                  }
                />
              </label>
              <div className="form-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary-green" type="submit">
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

