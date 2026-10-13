import { useState } from "react";
import ManagerLayout from "../components/ManagerLayout";
import { useManager } from "../hooks/useManager";
import { useToast } from "../hooks/useToast";

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function TablesPage() {
  const { data, storage, refresh } = useManager();
  const { showToast } = useToast();
  const [selected, setSelected] = useState(null);
  const [number, setNumber] = useState("");
  const [seats, setSeats] = useState("");
  const [blockTable, setBlockTable] = useState("");
  const [blockDate, setBlockDate] = useState(todayIso());
  const [blockSlot, setBlockSlot] = useState("");
  const tables = data?.tables || [];
  const slots = data?.timeSlotsConfig?.slots || [];
  const dateSlots =
    data?.timeSlotsConfig?.dates?.[blockDate]?.slots || [];
  const blockedTables = data?.blockedTables || [];
  const capacity = tables.reduce(
    (total, table) => total + Number(table.seats || 0),
    0,
  );

  const configure = (table) => {
    setSelected(table?.id || "NEW");
    setNumber(table?.number || `Table ${tables.length + 1}`);
    setSeats(table ? String(table.seats || "") : "");
  };
  const save = async () => {
    if (!selected || !number.trim()) return;
    if (!seats || Number(seats) < 1) {
      showToast("Choose the seating capacity for this table.", "error");
      return;
    }
    const next =
      selected === "NEW"
        ? [
            ...tables,
            { id: `temp-tbl-${Date.now()}`, number, seats: Number(seats) },
          ]
        : tables.map((table) =>
            table.id === selected
              ? { ...table, number, seats: Number(seats) }
              : table,
          );
    try {
      await storage.saveTableLayout(next);
      refresh();
      setSelected(null);
      showToast("Table layout saved.");
    } catch (error) {
      showToast(error.message || "Unable to save table layout.", "error");
    }
  };
  const remove = async () => {
    if (
      !selected ||
      selected === "NEW" ||
      !window.confirm("Are you sure you want to remove this table?")
    )
      return;
    try {
      await storage.saveTableLayout(
        tables.filter((table) => table.id !== selected),
      );
      refresh();
      setSelected(null);
      showToast("Table removed from layout.", "info");
    } catch (error) {
      showToast(error.message || "Unable to remove table.", "error");
    }
  };
  const duplicate = () => {
    if (!selected || selected === "NEW") {
      showToast("Please select a table to duplicate.", "info");
      return;
    }
    const source = tables.find((table) => table.id === selected);
    configure({
      number: `Table ${tables.length + 1}`,
      seats: source?.seats || 2,
      id: "NEW",
    });
  };
  const reset = async () => {
    if (!window.confirm("Reset the table layout?")) return;
    try {
      await storage.saveTableLayout([]);
      refresh();
      setSelected(null);
      showToast("Table layout reset.", "info");
    } catch (error) {
      showToast(error.message || "Unable to reset layout.", "error");
    }
  };
  const addBlock = async (event) => {
    event.preventDefault();
    if (!blockTable || !blockDate || !blockSlot) {
      showToast("Choose a table, date, and timeslot.", "error");
      return;
    }
    if (blockDate < todayIso()) {
      showToast("Cannot block tables for past dates.", "error");
      return;
    }
    try {
      await storage.updateTableSlotStatus(blockTable, blockSlot, "occupied");
      refresh();
      setBlockTable("");
      setBlockSlot("");
      showToast("Table blocked for the selected slot.");
    } catch (error) {
      showToast(error.message || "Unable to block table.", "error");
    }
  };
  const removeBlock = async (blocked) => {
    try {
      await storage.updateTableSlotStatus(
        blocked.tableId,
        blocked.slot,
        "available",
      );
      refresh();
      showToast("Table unblocked.", "info");
    } catch (error) {
      showToast(error.message || "Unable to unblock table.", "error");
    }
  };

  return (
    <ManagerLayout
      title="Table Layout Management"
      description="Configure and organize the seating layout of your restaurant."
      pageClassName="manager-page-restaurant-header"
    >
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h5>Total Tables</h5>
            <h2>{tables.length}</h2>
          </div>
          <div className="metric-icon">
            <i className="ph ph-squares-four" />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <h5>Total Capacity</h5>
            <h2>{capacity} Seats</h2>
          </div>
          <div className="metric-icon">
            <i className="ph ph-users" />
          </div>
        </div>
      </div>
      <div className="toolbar">
        <button
          className="btn btn-primary-orange"
          type="button"
          onClick={() => configure(null)}
        >
          <i className="ph ph-plus" /> Add Table
        </button>
        <button className="btn btn-outline" type="button" onClick={remove}>
          <i className="ph ph-trash" /> Remove Table
        </button>
        <button className="btn btn-outline" type="button" onClick={duplicate}>
          <i className="ph ph-copy" /> Duplicate Table
        </button>
        <button className="btn btn-outline" type="button" onClick={reset}>
          <i className="ph ph-arrow-counter-clockwise" /> Reset Layout
        </button>
      </div>
      <div className="layout-grid">
        <div className="table-area">
          {tables.length ? (
            tables.map((table) => (
              <button
                className={`table-card ${selected === table.id ? "selected" : ""}`}
                type="button"
                key={table.id}
                onClick={() => configure(table)}
              >
                <h5>{table.number}</h5>
                <span>{table.seats} Seats</span>
              </button>
            ))
          ) : (
            <div className="empty-state" style={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center", 
              width: "100%", 
              minHeight: "300px", 
              gridColumn: "1 / -1", 
              color: "var(--text-muted)", 
              gap: "12px",
              textAlign: "center" 
            }}>
              <i className="ph ph-squares-four" style={{ fontSize: "48px", color: "var(--border-color)" }} />
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "500" }}>No tables configured in your layout yet.</p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-light)" }}>Click "Add Table" to start building your floor plan.</p>
            </div>
          )}
        </div>
        <section className="card table-config-card">
          <h4>Table Configuration</h4>
          <label>
            Table Number
            <input
              className="form-control"
              value={number}
              disabled={!selected}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="e.g. Table 1"
            />
          </label>
          <label>
            Seating Capacity
            <select
              className="form-control"
              value={seats}
              disabled={!selected}
              onChange={(event) => setSeats(event.target.value)}
            >
              <option value="">Choose capacity</option>
              <option value="2">2 Seats</option>
              <option value="4">4 Seats</option>
              <option value="6">6 Seats</option>
              <option value="8">8 Seats</option>
              <option value="10">10 Seats</option>
            </select>
          </label>
          <button
            className="btn btn-primary-orange"
            type="button"
            disabled={!selected}
            onClick={save}
          >
            {selected === "NEW" ? "Add Table" : "Update Details"}
          </button>
        </section>
      </div>
      <section className="card block-tables-card">
        <h4>Block Tables</h4>
        <p>Temporarily block tables for specific time slots.</p>
        <form onSubmit={addBlock}>
          <div className="block-grid">
            <label>
              Select Table
              <select
                className="form-control"
                value={blockTable}
                onChange={(event) => setBlockTable(event.target.value)}
                required
              >
                <option value="">Choose a table</option>
                {tables.map((table) => (
                  <option value={table.id} key={table.id}>
                    {table.number}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Select Date
              <input
                className="form-control"
                type="date"
                min={todayIso()}
                value={blockDate}
                onChange={(event) => {
                  setBlockDate(event.target.value);
                  setBlockSlot("");
                }}
                required
              />
            </label>
            <label>
              Select Timeslot
              <select
                className="form-control"
                value={blockSlot}
                onChange={(event) => setBlockSlot(event.target.value)}
                required
              >
                <option value="">Choose timeslot</option>
                {dateSlots.map((slot) => (
                  <option value={slot.id} key={slot.id}>
                    {slot.text || `${slot.start} - ${slot.end}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn block-button" type="submit">
            <i className="ph ph-lock-key" /> Block Table
          </button>
        </form>
        <hr />
        <h5>Currently Blocked</h5>
        <div className="blocked-list">
          {blockedTables.length ? (
            blockedTables.map((blocked) => (
              <div
                className="blocked-row"
                key={`${blocked.tableId}-${blocked.date}-${blocked.slot}`}
              >
                <div className="blocked-row-content">
                  <strong>
                    {tables.find((table) => table.id === blocked.tableId)
                      ?.number || blocked.tableId}
                  </strong>
                  <span>
                    {blocked.date} • {blocked.slotLabel ||
                      slots.find((slot) => slot.id === blocked.slot)?.text ||
                      blocked.slot}
                  </span>
                </div>
                <button
                  className="btn btn-small unblock-button"
                  type="button"
                  onClick={() => removeBlock(blocked)}
                >
                  Unblock
                </button>
              </div>
            ))
          ) : (
            <p className="empty-state">No tables are currently blocked.</p>
          )}
        </div>
      </section>
    </ManagerLayout>
  );
}

