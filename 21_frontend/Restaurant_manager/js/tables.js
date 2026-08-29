document.addEventListener('DOMContentLoaded', async () => {
    await StorageManager.ready();
    // ---- Toast System Helper ----
    const toastContainer = document.getElementById('toast-container');
    window.showToast = function(message, type = 'success') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        let iconClass = type === 'success' ? 'ph-check-circle' : 'ph-info';
        if (type === 'error') iconClass = 'ph-trash';
        toast.innerHTML = `<i class="ph ${iconClass} toast-icon"></i><span class="toast-message">${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    };

    // ---- State ----
    let stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables() || []));
    let selectedTableId = null;

    // ---- DOM Elements ----
    const tablesContainer = document.getElementById('tables-container');
    const totalTablesEl = document.getElementById('metric-total-tables');
    const totalCapacityEl = document.getElementById('metric-total-seats');
    
    const configForm = document.getElementById('table-config-form');
    const tableIdInput = document.getElementById('config-table-id');
    const tableNumInput = document.getElementById('config-table-number');
    const tableSeatsSelect = document.getElementById('config-table-seats');
    const configActionBtn = document.getElementById('config-action-btn');
    
    // Action Bars
    const addToolbarBtn = document.getElementById('toolbar-add-btn');
    const removeToolbarBtn = document.getElementById('toolbar-remove-btn');
    const duplicateToolbarBtn = document.getElementById('toolbar-duplicate-btn');
    const resetToolbarBtn = document.getElementById('toolbar-reset-btn');

    // Block logic
    const blockSelect = document.getElementById('block-table-select');
    const blockTimeslot = document.getElementById('block-timeslot');
    const blockDate = document.getElementById('block-date');
    const blockForm = document.getElementById('block-table-form');

    // Date Constraints (Prevent selecting past dates)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    
    if (blockDate) {
        blockDate.setAttribute('min', todayStr);
        blockDate.value = todayStr; // Default to today
        
        blockDate.addEventListener('change', (e) => {
            const selected = e.target.value;
            if (!selected) return;
            
            const now = new Date();
            now.setHours(0,0,0,0);
            const selectedDate = new Date(selected);
            selectedDate.setHours(12,0,0,0);
            
            if (selectedDate < now) {
                if(window.showToast) window.showToast("Cannot block tables for past dates.", 'error');
                blockDate.value = todayStr;
            }
            void populateBlockDropdown();
            void renderBlockedTables();
        });
    }


    // ---- Rendering ----
    function renderGrid() {
        let capacity = 0;
        let html = '';

        if (stagedTables.length === 0) {
            html = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); border: 2px dashed #E2E8F0; border-radius: 12px;">
                <i class="ph ph-squares-four" style="font-size: 32px; color: #CBD5E1; margin-bottom: 8px;"></i>
                <p>No tables configured in your layout yet.</p>
            </div>`;
        } else {
            stagedTables.forEach(t => {
                capacity += parseInt(t.seats);
                const isSelected = t.id === selectedTableId;
                html += `
                    <div class="table-card ${isSelected ? 'selected' : ''}" data-id="${t.id}">
                        <h5>${t.number}</h5>
                        <span>${t.seats} Seats</span>
                    </div>
                `;
            });
        }

        tablesContainer.innerHTML = html;
        totalTablesEl.innerText = stagedTables.length;
        totalCapacityEl.innerText = capacity + " Seats";

        void populateBlockDropdown();
        bindGridEvents();
        updateConfigPanelState();
    }

    function bindGridEvents() {
        document.querySelectorAll('.table-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                if (selectedTableId === id) {
                    selectedTableId = null; // deselect
                } else {
                    selectedTableId = id;
                }
                updateConfigPanelState();
                renderGrid(); // re-render to apply 'selected' class
            });
        });
    }

    function updateConfigPanelState() {
        if (!selectedTableId) {
            // New mode or empty
            tableIdInput.value = '';
            tableNumInput.value = '';
            tableNumInput.readOnly = true;
            tableSeatsSelect.disabled = true;
            configActionBtn.disabled = true;
            configActionBtn.innerText = "Select a table to edit";
            configActionBtn.className = "btn btn-primary-orange";
            return;
        }

        if (selectedTableId === 'NEW') {
            tableNumInput.readOnly = false;
            tableSeatsSelect.disabled = false;
            configActionBtn.disabled = false;
            configActionBtn.innerText = "Add Table";
            
            // Auto-generate a name if blank
            if(!tableNumInput.value) {
                let maxInt = 0;
                stagedTables.forEach(t => {
                    const match = t.number.match(/Table (\d+)/i);
                    if(match) {
                        const num = parseInt(match[1]);
                        if(num > maxInt) maxInt = num;
                    }
                });
                tableNumInput.value = `Table ${maxInt + 1}`;
                tableSeatsSelect.value = "2";
            }
            return;
        }

        // Edit mode
        const table = stagedTables.find(t => t.id === selectedTableId);
        if (table) {
            tableIdInput.value = table.id;
            tableNumInput.value = table.number;
            tableNumInput.readOnly = false;
            tableSeatsSelect.value = table.seats;
            tableSeatsSelect.disabled = false;
            
            configActionBtn.disabled = false;
            configActionBtn.innerText = "Update Details";
            
            // Re-render UI to remove selected highlight if it got out of sync
        }
    }


    // ---- Interactivity ----
    
    // 1. Toolbar Add Button
    addToolbarBtn.addEventListener('click', () => {
        selectedTableId = 'NEW';
        tableNumInput.value = '';
        renderGrid();
        tableNumInput.focus();
    });

    // 2. Toolbar Remove Button
    removeToolbarBtn.addEventListener('click', () => {
        if (!selectedTableId || selectedTableId === 'NEW') {
            showToast("Please select a table to remove.", "info");
            return;
        }
        
        if(window.showConfirm) {
            window.showConfirm("Are you sure you want to remove this table?", async () => {
                stagedTables = stagedTables.filter(t => t.id !== selectedTableId);
                selectedTableId = null;
                showToast("Saving changes...");
                await StorageManager.saveTableLayout(stagedTables);
                stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables()));
                renderGrid();
                showToast("Table removed from layout.", "info");
            });
        }
    });

    // 3. Toolbar Duplicate
    duplicateToolbarBtn.addEventListener('click', async () => {
        if (!selectedTableId || selectedTableId === 'NEW') {
            showToast("Please select a table to duplicate.", "info");
            return;
        }
        const source = stagedTables.find(t => t.id === selectedTableId);
        if(source) {
            let maxInt = 0;
            stagedTables.forEach(t => {
                const match = String(t.number).match(/(\d+)/);
                if(match) {
                    const val = parseInt(match[1]);
                    if(val > maxInt) maxInt = val;
                }
            });

            const newId = 'temp-tbl-' + Date.now();
            stagedTables.push({
                id: newId,
                number: `Table ${maxInt + 1}`,
                seats: source.seats
            });
            selectedTableId = newId;
            showToast("Saving copy...");
            await StorageManager.saveTableLayout(stagedTables);
            stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables()));
            selectedTableId = null;
            renderGrid();
            showToast("Table duplicated!");
        }
    });

    // 4. Reset Layout
    resetToolbarBtn.addEventListener('click', () => {
        if(window.showConfirm) {
            window.showConfirm("Are you sure you want to reset all unsaved changes?", () => {
                stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables()));
                selectedTableId = null;
                renderGrid();
                showToast("Layout reset to last saved state.", "info");
            }, "Reset Layout", "Reset");
        }
    });

    // 5. Config Action (Add / Save Edit)
    configActionBtn.addEventListener('click', async () => {
        const num = tableNumInput.value.trim();
        const seats = parseInt(tableSeatsSelect.value);
        if(!num) {
            showToast("Table Number cannot be empty.", "error");
            return;
        }
        
        try {
            showToast("Saving changes...");
            if (selectedTableId === 'NEW') {
                // Create
                const newTable = {
                    id: 'temp-tbl-' + Date.now(),
                    number: num,
                    seats: seats
                };
                stagedTables.push(newTable);
                selectedTableId = newTable.id;
                await StorageManager.saveTableLayout(stagedTables);
                stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables()));
                selectedTableId = null;
                renderGrid();
                showToast("Table added to layout!");
            } else {
                // Update
                const table = stagedTables.find(t => t.id === selectedTableId);
                if (table) {
                    table.number = num;
                    table.seats = seats;
                    await StorageManager.saveTableLayout(stagedTables);
                    stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables()));
                    selectedTableId = null;
                    renderGrid();
                    showToast("Table details updated.");
                }
            }
        } catch (e) {
            console.error('Failed to save table changes:', e);
            showToast("Failed to save changes. Check if the table number already exists.", "error");
            // Re-sync with backend to discard failed changes
            stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables()));
            selectedTableId = null;
            renderGrid();
        }
    });




    // ---- Block Logic ----
    function to12h(value) {
        const [hRaw, mRaw] = String(value || '00:00').split(':');
        let h = Number(hRaw);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mRaw} ${ampm}`;
    }

    function getSlotLabel(slot) {
        return `${to12h(slot.start_time)} - ${to12h(slot.end_time)}`;
    }

    async function getSlotsForDate(dateStr) {
        const ids = StorageManager._getIds();
        if (!ids.restaurantId) return [];
        try {
            await StorageManager._request('/tableslots/seed', {
                method: 'POST',
                headers: StorageManager._headers('manager'),
                body: JSON.stringify({ restaurant_id: ids.restaurantId }),
            });
        } catch (_e) {
        }
        const slotsRes = await StorageManager._request(`/timeslots?restaurant_id=${ids.restaurantId}`, {
            headers: StorageManager._headers('manager'),
        });
        return (slotsRes?.data || [])
            .filter((slot) => (slot.slot_date || slot.date) === dateStr)
            .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
    }

    async function populateBlockDropdown() {
        if (!blockSelect || !blockTimeslot || !blockDate) return;
        blockSelect.innerHTML = '<option value="" disabled selected>Choose a table</option>';
        stagedTables.forEach(t => {
            blockSelect.innerHTML += `<option value="${t.id}">${t.number} (${t.seats} Seats)</option>`;
        });

        blockTimeslot.innerHTML = '<option value="" disabled selected>Choose timeslot</option>';
        const selectedDate = blockDate.value || todayStr;
        try {
            const slots = await getSlotsForDate(selectedDate);
            slots.forEach((slot) => {
                blockTimeslot.innerHTML += `<option value="${slot.id}">${getSlotLabel(slot)}</option>`;
            });
        } catch (_e) {
        }
    }

    blockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tid = blockSelect.value;
        const dt = blockDate.value;
        const slotId = blockTimeslot.value;
        
        if(!tid || !dt || !slotId) return;
        
        try {
            await StorageManager._request('/tableslots/status', {
                method: 'PATCH',
                headers: StorageManager._headers('manager'),
                body: JSON.stringify({
                    table_id: tid,
                    slot_id: slotId,
                    status: 'occupied',
                }),
            });
            await StorageManager.refreshFromBackend();
            stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables()));
            showToast('Table successfully blocked for selected timeslot.');
            blockForm.reset();
            blockDate.value = todayStr;
            renderGrid();
            await populateBlockDropdown();
            await renderBlockedTables();
        } catch (_e) {
            showToast('Unable to block table in backend.', 'error');
        }
    });

    async function renderBlockedTables() {
        const listContainer = document.getElementById('blocked-tables-list');
        if(!listContainer) return;

        const ids = StorageManager._getIds();
        const selectedDate = blockDate.value || todayStr;
        let blocked = [];

        try {
            const [slotsRes, tableSlotsRes] = await Promise.all([
                StorageManager._request(`/timeslots?restaurant_id=${ids.restaurantId}`, { headers: StorageManager._headers('manager') }),
                StorageManager._request(`/tableslots?restaurant_id=${ids.restaurantId}`, { headers: StorageManager._headers('manager') }),
            ]);

            const slotMap = {};
            (slotsRes?.data || [])
                .filter((slot) => (slot.slot_date || slot.date) === selectedDate)
                .forEach((slot) => { slotMap[slot.id] = slot; });

            blocked = (tableSlotsRes?.data || [])
                .filter((ts) => ts.status === 'occupied' && slotMap[ts.slot_id])
                .map((ts) => ({ tableId: ts.table_id, slotId: ts.slot_id, slot: slotMap[ts.slot_id] }));
        } catch (_e) {
            blocked = [];
        }

        if(blocked.length === 0) {
            listContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">No tables currently blocked.</div>`;
            return;
        }

        let html = '';
        blocked.forEach((b) => {
            const linkedTable = stagedTables.find(t => t.id === b.tableId);
            const tName = linkedTable ? linkedTable.number : 'Unknown Table';
            
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #FFF1F2; border: 1px solid #FFE4E6; border-radius: 8px;">
                    <div>
                        <strong style="display: block; font-size: 13px; color: #BE123C; margin-bottom: 2px;">${tName}</strong>
                        <span style="font-size: 12px; color: #E11D48;">${selectedDate} &bull; ${getSlotLabel(b.slot)}</span>
                    </div>
                    <button class="btn btn-outline unblock-btn" data-table-id="${b.tableId}" data-slot-id="${b.slotId}" style="padding: 6px 10px; font-size: 12px; border-color: #FECDD3; color: #BE123C; background: white;">
                        Unblock
                    </button>
                </div>
            `;
        });
        
        listContainer.innerHTML = html;
        
        listContainer.querySelectorAll('.unblock-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tableId = btn.getAttribute('data-table-id');
                const slotId = btn.getAttribute('data-slot-id');
                try {
                    await StorageManager._request('/tableslots/status', {
                        method: 'PATCH',
                        headers: StorageManager._headers('manager'),
                        body: JSON.stringify({
                            table_id: tableId,
                            slot_id: slotId,
                            status: 'available',
                        }),
                    });
                    await StorageManager.refreshFromBackend();
                    stagedTables = JSON.parse(JSON.stringify(StorageManager.getTables()));
                    renderGrid();
                    await renderBlockedTables();
                    showToast("Table unblocked.", "info");
                } catch (_e) {
                    showToast("Unable to unblock table.", "error");
                }
            });
        });
    }

    // Init run
    renderGrid();
    await populateBlockDropdown();
    await renderBlockedTables();
});

