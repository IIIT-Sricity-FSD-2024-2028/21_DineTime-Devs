import { useContext, useEffect, useState } from "react";
import { createAction } from "../../../app/actions.js";
import { indiaToday, isPastSlot } from "../../../app/indiaTime.js";
import ManagerLayout from "./ManagerLayout.jsx";
import SessionModal from "./SessionModal.jsx";
import { ManagerContext } from "../context/ManagerContext.jsx";
import { ToastContext } from "../context/ToastContext.jsx";
import { arrangeLayout } from "../utils/sessions.js";
import "../styles/service-planner.css";

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00Z`));
}
function rollingDates(today) {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
}
function tableNumber(table) {
  return table.table_number || Number(String(table.number || "").replace(/\D/g, ""));
}
function makeDefaultLayout(data) {
  const catalog = (data.tables || []).filter((table) => table.active !== false);
  const saved =
    data.schedule?.default_table_layout ||
    catalog.map((table) => ({
      table_id: table.id,
      table_number: tableNumber(table),
      capacity: table.seats,
    }));
  return arrangeLayout(saved).map((entry) => ({ ...entry, included: true }));
}

function TableBoxes({
  draft,
  catalog,
  onAdd,
  onRemove,
  onCapacityChange,
  onBlock,
  getStatus,
  disabled,
  allowBlock,
  showCatalogCandidates = true,
  candidateLabel = "Available to add",
}) {
  const shown = draft.filter((table) => table.included);
  return (
    <div className="table-box-grid">
      {shown.map((table) => {
        const status = getStatus?.(table) || {};
        const unavailable = status.booked || status.blocked || status.scheduled;
        return (
          <article
            className={`table-box ${unavailable ? "is-unavailable" : ""}`}
            key={table.table_id}
          >
            <div className="table-box-top">
              <div>
                <strong>Table {tableNumber(table)}</strong>
                <label className="table-capacity-editor">
                  Seats
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={table.capacity}
                    disabled={disabled || unavailable}
                    onChange={(event) => onCapacityChange?.(table.table_id, event.target.value)}
                  />
                </label>
              </div>
              <span className={`planner-status ${unavailable ? "amber" : ""}`}>
                {status.booked
                  ? "Booked"
                  : status.scheduled
                    ? "Scheduled block"
                    : status.blocked
                      ? "Blocked"
                      : "Available"}
              </span>
            </div>
            <div className="table-box-actions">
              <button
                className="planner-button secondary"
                disabled={disabled || unavailable}
                onClick={() => onRemove(table)}
              >
                Remove
              </button>
              {allowBlock && (
                <button
                  className="planner-button secondary"
                  disabled={disabled || status.booked || status.scheduled}
                  onClick={() => onBlock(table)}
                >
                  {status.blocked ? "Unblock" : "Block"}
                </button>
              )}
            </div>
          </article>
        );
      })}
      {showCatalogCandidates &&
        catalog
          .filter((table) => !shown.some((item) => item.table_id === table.id))
          .map((table) => (
            <article className="table-box is-not-included" key={table.id}>
              <div className="table-box-top">
                <div>
                  <strong>Table {tableNumber(table)}</strong>
                  <span>{table.seats} seats</span>
                </div>
                <span className="planner-status amber">{candidateLabel}</span>
              </div>
              <div className="table-box-actions">
                <button
                  className="planner-button secondary"
                  disabled={disabled}
                  onClick={() => onAdd(table)}
                >
                  Add
                </button>
              </div>
            </article>
          ))}
    </div>
  );
}

export default function DiningRoom() {
  const { data, storage, refresh, ready, params } = useContext(ManagerContext);
  const { showToast } = useContext(ToastContext);
  const today = indiaToday();
  const dates = rollingDates(today);
  const catalog = (data.tables || []).filter((table) => table.active !== false);
  const [date, setDate] = useState(() =>
    params?.date && dates.includes(params.date) ? params.date : dates[0],
  );
  const [slotId, setSlotId] = useState(params?.slot || "");
  const [weeklyDraft, setWeeklyDraft] = useState([]);
  const [dateDraft, setDateDraft] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addTarget, setAddTarget] = useState("weekly");
  const [newTable, setNewTable] = useState({ number: "", capacity: "2" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  const slots = (data.slotRecords || [])
    .filter((slot) => slot.slot_date === date && slot.schedule_allowed !== false)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const slot = slots.find((item) => item.id === slotId) || slots[0];
  const past = Boolean(slot && isPastSlot(slot));

  useEffect(
    () => setWeeklyDraft(makeDefaultLayout(data)),
    [data.schedule?.default_table_layout, data.tables],
  );
  useEffect(() => {
    if (params?.date && dates.includes(params.date)) setDate(params.date);
    if (params?.slot) setSlotId(params.slot);
  }, [params?.date, params?.slot, dates.join(",")]);
  useEffect(() => {
    if (slot)
      setDateDraft(
        arrangeLayout(slot.table_layout || weeklyDraft).map((entry) => ({
          ...entry,
          included: true,
        })),
      );
    else setDateDraft(weeklyDraft.map((entry) => ({ ...entry })));
  }, [slot?.id, slot?.revision, weeklyDraft]);

  async function reload() {
    await storage.refreshFromBackend();
    refresh();
  }
  function payload(draft) {
    return arrangeLayout(draft.filter((table) => table.included)).map((table) => ({
      table_id: table.table_id,
      capacity: Number(table.capacity),
      x: table.x,
      y: table.y,
      shape: table.shape,
    }));
  }
  function updateCapacity(setter, tableId, capacity) {
    setter((draft) =>
      draft.map((table) =>
        table.table_id === tableId ? { ...table, capacity: Number(capacity) } : table,
      ),
    );
  }
  function saveWeekly(next = weeklyDraft) {
    run(async () => {
      await storage.updateDefaultTableLayout(payload(next));
      await reload();
      showToast("Weekly table default saved for the next seven days.");
    });
  }
  function saveDate() {
    if (!slot) return;
    run(async () => {
      await storage.saveSlotLayout(slot.id, slot.revision || 0, payload(dateDraft));
      await reload();
      showToast(`Table layout saved for ${dateLabel(date)}.`);
    });
  }
  function revertDate() {
    if (!slot) return;
    run(async () => {
      await storage.resetSlotLayout(slot.id, slot.revision || 0);
      await reload();
      showToast(`${dateLabel(date)} now uses the weekly table default.`);
    });
  }
  function addWeekly(table) {
    setWeeklyDraft([
      ...weeklyDraft,
      {
        table_id: table.id,
        table_number: tableNumber(table),
        capacity: table.seats,
        included: true,
      },
    ]);
  }
  function removeWeekly(table) {
    run(async () => {
      const next = weeklyDraft.filter((item) => item.table_id !== table.table_id);
      await storage.updateDefaultTableLayout(payload(next));
      await reload();
      showToast(`Table ${tableNumber(table)} removed from the weekly default.`);
    });
  }
  function openAddTable(target = "weekly") {
    const next = Math.max(0, ...catalog.map((table) => tableNumber(table))) + 1;
    setAddTarget(target);
    setNewTable({ number: String(next), capacity: "2" });
    setError("");
    setAdding(true);
  }
  function addNewTable(event) {
    event.preventDefault();
    run(async () => {
      const ids = await storage._ensureLinkedRestaurant();
      const requestedNumber = Number(newTable.number);
      const existing = catalog.find((table) => tableNumber(table) === requestedNumber);
      const targetDraft = addTarget === "date" ? dateDraft : weeklyDraft;
      const alreadyIncluded = targetDraft.some((table) => tableNumber(table) === requestedNumber);
      if (alreadyIncluded)
        throw new Error(`Table ${requestedNumber} is already included in this layout.`);
      const result = existing
        ? { data: { id: existing.id } }
        : await storage._request("/tables", {
            method: "POST",
            headers: storage._headers("manager"),
            body: JSON.stringify({
              restaurant_id: ids.restaurantId,
              table_number: requestedNumber,
              capacity: Number(newTable.capacity),
            }),
          });
      const added = {
        table_id: result.data.id,
        table_number: requestedNumber,
        capacity: Number(newTable.capacity),
        included: true,
      };
      if (addTarget === "date") {
        const next = [...dateDraft, added];
        await storage.saveSlotLayout(slot.id, slot.revision || 0, payload(next));
        await reload();
        setAdding(false);
        showToast(`Table ${newTable.number} added to ${dateLabel(date)}.`);
      } else {
        const next = [...weeklyDraft, added];
        await storage.updateDefaultTableLayout(payload(next));
        await reload();
        setAdding(false);
        showToast(`Table ${newTable.number} added to the weekly default.`);
      }
    });
  }
  function capacityFor(tableId) {
    return (
      weeklyDraft.find((item) => item.table_id === tableId)?.capacity ||
      catalog.find((table) => table.id === tableId)?.seats ||
      2
    );
  }
  function addDate(table) {
    setDateDraft([
      ...dateDraft,
      {
        table_id: table.id,
        table_number: tableNumber(table),
        capacity: capacityFor(table.id),
        included: true,
      },
    ]);
  }
  function removeDate(table) {
    setDateDraft(dateDraft.filter((item) => item.table_id !== table.table_id));
  }
  function statusFor(table) {
    const allocation = (data.tableSlotRecords || []).find(
      (item) => item.slot_id === slot?.id && item.table_id === table.table_id,
    );
    return {
      booked: ["reserved", "occupied"].includes(allocation?.status),
      blocked: allocation?.status === "blocked",
      scheduled: Boolean(allocation?.schedule_block),
    };
  }
  function blockTable(table) {
    const status = statusFor(table);
    run(async () => {
      await storage.updateTableSlotStatus(
        table.table_id,
        slot.id,
        status.blocked ? "available" : "blocked",
      );
      await reload();
      showToast(
        status.blocked
          ? `Table ${tableNumber(table)} is available again.`
          : `Table ${tableNumber(table)} blocked for this service.`,
      );
    });
  }

  return (
    <ManagerLayout
      title="Table Management"
      description="Weekly tables and date-specific layouts."
      pageClassName="service-planner"
    >
      <section className="weekly-default-card table-catalog">
        <div className="section-heading">
          <div>
            <span className="planner-eyebrow">WEEKLY DEFAULT</span>
            <h2>Tables and capacities</h2>
          </div>
          <button
            className="planner-button"
            disabled={busy || !ready}
            onClick={() => openAddTable("weekly")}
          >
            + Add new table
          </button>
        </div>
        <TableBoxes
          draft={weeklyDraft}
          catalog={catalog}
          onAdd={addWeekly}
          onRemove={removeWeekly}
          onCapacityChange={(id, value) => updateCapacity(setWeeklyDraft, id, value)}
          disabled={busy || !ready}
          allowBlock={false}
          showCatalogCandidates={false}
        />
        <div className="planner-savebar">
          <div>
            <strong>{weeklyDraft.filter((table) => table.included).length} tables</strong>
          </div>
          <button className="planner-button" disabled={busy || !ready} onClick={() => saveWeekly()}>
            {busy ? "Saving..." : "Save weekly layout"}
          </button>
        </div>
      </section>
      {error && (
        <p role="alert" className="planner-alert error">
          {error}
        </p>
      )}
      <section className="table-catalog weekly-default-card">
        <div className="section-heading">
          <div>
            <span className="planner-eyebrow">DATE / TIME SLOT</span>
            <h2>Custom layout</h2>
          </div>
          <div className="section-actions">
            <button
              className="planner-button secondary"
              disabled={busy || !ready || !slot || past}
              onClick={() => openAddTable("date")}
            >
              + Add new table
            </button>
            <button
              className="planner-button"
              disabled={busy || !ready || !slot || past}
              onClick={saveDate}
            >
              Save date layout
            </button>
            <button
              className="planner-button secondary"
              disabled={busy || !ready || !slot || past}
              onClick={revertDate}
            >
              Revert to weekly default
            </button>
          </div>
        </div>
        <div className="planner-dropdowns">
          <label>
            Calendar date
            <select
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSlotId("");
              }}
            >
              {dates.map((value) => (
                <option key={value} value={value}>
                  {dateLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time slot
            <select value={slot?.id || ""} onChange={(event) => setSlotId(event.target.value)}>
              <option value="">Select a service</option>
              {slots.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!ready ? (
          <p role="status">Loading tables...</p>
        ) : !slot ? (
          <p className="planner-empty-inline">No service for this date.</p>
        ) : (
          <>
            <TableBoxes
              draft={dateDraft}
              catalog={catalog}
              onAdd={addDate}
              onRemove={removeDate}
              onCapacityChange={(id, value) => updateCapacity(setDateDraft, id, value)}
              onBlock={blockTable}
              getStatus={statusFor}
              disabled={busy || past}
              allowBlock
              showCatalogCandidates
            />
            <p className="table-box-note">
              {slot.layout_override ? "Custom layout" : "Weekly layout"}
              {past && " · Past service"}
              {slot.locked && " · Booked tables are locked"}
            </p>
          </>
        )}
      </section>
      {adding && (
        <SessionModal
          title={
            addTarget === "date" ? `Add table to ${dateLabel(date)}` : "Add table to weekly default"
          }
          onClose={() => {
            if (!busy) setAdding(false);
          }}
        >
          <form className="phase1-form" onSubmit={addNewTable}>
            <label>
              Table number
              <input
                required
                type="number"
                min="1"
                value={newTable.number}
                onChange={(event) => setNewTable({ ...newTable, number: event.target.value })}
              />
            </label>
            <label>
              Seats
              <input
                required
                type="number"
                min="1"
                max="100"
                value={newTable.capacity}
                onChange={(event) => setNewTable({ ...newTable, capacity: event.target.value })}
              />
            </label>
            <div className="hours-buttons">
              <button
                type="button"
                className="planner-button secondary"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button className="planner-button" disabled={busy}>
                {busy ? "Adding..." : "Add table"}
              </button>
            </div>
          </form>
        </SessionModal>
      )}
    </ManagerLayout>
  );
}
