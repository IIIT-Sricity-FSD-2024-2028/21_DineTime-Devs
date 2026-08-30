document.addEventListener('DOMContentLoaded', async () => {
    await StorageManager.ready();

    const BOOKING_WINDOW_DAYS = 7;

    const editHoursBtn = document.getElementById('edit-hours-btn');
    const openTimeInput = document.getElementById('open-time');
    const closeTimeInput = document.getElementById('close-time');
    const addSlotBtn = document.getElementById('add-slot-btn');
    const slotModal = document.getElementById('slot-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const slotForm = document.getElementById('slot-form');
    const slotsTbody = document.getElementById('slots-tbody');

    let isEditingHours = false;

    function toIsoDate(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function getBookingDates() {
        const today = new Date();
        return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) => {
            const date = new Date(today);
            date.setDate(today.getDate() + index);
            return toIsoDate(date);
        });
    }

    function formatTime12h(time24) {
        let [h, m] = String(time24 || '00:00').split(':');
        h = parseInt(h, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    function minutesOf(time24) {
        const [h, m] = String(time24 || '00:00').split(':');
        return (Number(h) * 60) + Number(m);
    }

    function slotText(start, end) {
        return `${formatTime12h(start)} - ${formatTime12h(end)}`;
    }

    function defaultSlots() {
        return [
            { id: 'def-1', start: '18:00', end: '20:00', text: '6:00 PM - 8:00 PM', maxTables: 6 },
            { id: 'def-2', start: '20:00', end: '22:00', text: '8:00 PM - 10:00 PM', maxTables: 6 },
            { id: 'def-3', start: '22:00', end: '00:00', text: '10:00 PM - 12:00 AM', maxTables: 6 },
        ];
    }

    function normalizeSlot(slot, fallbackIndex) {
        const start = slot.start || slot.start_time || '18:00';
        const end = slot.end || slot.end_time || '20:00';
        return {
            id: slot.id || `slot-${fallbackIndex + 1}`,
            start,
            end,
            text: slot.text || slotText(start, end),
            maxTables: Number(slot.maxTables || slot.max_tables || StorageManager.getTables().length || 1),
        };
    }

    function getTemplateSlotsFromExistingDates(data) {
        const dates = data.timeSlotsConfig?.dates || {};
        const firstDate = Object.keys(dates).sort()[0];
        if (!firstDate || !Array.isArray(dates[firstDate]?.slots)) {
            return [];
        }

        return dates[firstDate].slots.map(normalizeSlot);
    }

    function initTimeSlotData() {
        const data = StorageManager.getData();
        let changed = false;

        if (!data.timeSlotsConfig) {
            data.timeSlotsConfig = {
                operatingHours: { open: '11:00', close: '23:00' },
                dates: {},
                slots: defaultSlots(),
            };
            changed = true;
        }

        if (!data.timeSlotsConfig.operatingHours) {
            data.timeSlotsConfig.operatingHours = { open: '11:00', close: '23:00' };
            changed = true;
        }

        if (!Array.isArray(data.timeSlotsConfig.slots)) {
            const existingSlots = getTemplateSlotsFromExistingDates(data);
            data.timeSlotsConfig.slots = existingSlots.length ? existingSlots : defaultSlots();
            changed = true;
        }

        data.timeSlotsConfig.slots = data.timeSlotsConfig.slots
            .map(normalizeSlot)
            .sort((a, b) => a.start.localeCompare(b.start));

        if (changed) {
            StorageManager.saveData(data);
        }
    }

    function getScheduleConfig() {
        initTimeSlotData();
        const data = StorageManager.getData();
        return {
            slots: [...(data.timeSlotsConfig.slots || [])],
            operatingHours: data.timeSlotsConfig.operatingHours || { open: '11:00', close: '23:00' },
        };
    }

    async function syncScheduleToBackend(slots) {
        const ids = StorageManager._getIds();
        if (!ids.restaurantId) return;

        const targetDates = new Set(getBookingDates());
        const slotsRes = await StorageManager._request(`/timeslots?restaurant_id=${ids.restaurantId}`, {
            headers: StorageManager._headers('manager'),
        });

        const existingInWindow = (slotsRes?.data || []).filter((slot) =>
            targetDates.has(slot.slot_date || slot.date),
        );

        await Promise.all(existingInWindow.map((slot) =>
            StorageManager._request(`/timeslots/${slot.id}`, {
                method: 'DELETE',
                headers: StorageManager._headers('manager'),
            }),
        ));

        const createRequests = [];
        targetDates.forEach((date) => {
            slots.forEach((slot) => {
                createRequests.push(
                    StorageManager._request('/timeslots', {
                        method: 'POST',
                        headers: StorageManager._headers('manager'),
                        body: JSON.stringify({
                            restaurant_id: ids.restaurantId,
                            slot_date: date,
                            start_time: slot.start,
                            end_time: slot.end,
                        }),
                    }),
                );
            });
        });

        await Promise.all(createRequests);
        await StorageManager._request('/tableslots/seed', {
            method: 'POST',
            headers: StorageManager._headers('manager'),
            body: JSON.stringify({ restaurant_id: ids.restaurantId }),
        });
        await StorageManager.refreshFromBackend();
    }

    async function saveScheduleConfig(slots) {
        initTimeSlotData();
        const data = StorageManager.getData();
        data.timeSlotsConfig.slots = slots
            .map(normalizeSlot)
            .sort((a, b) => a.start.localeCompare(b.start));
        StorageManager.saveData(data);

        try {
            await syncScheduleToBackend(data.timeSlotsConfig.slots);
            showToast('Time slots synced to upcoming booking dates.');
        } catch (error) {
            console.error('Time slot backend sync failed:', error);
            showToast('Saved locally, backend sync failed.');
        }
    }

    function saveOperatingHours(open, close) {
        const data = StorageManager.getData();
        if (!data.timeSlotsConfig) initTimeSlotData();
        data.timeSlotsConfig.operatingHours = { open, close };
        StorageManager.saveData(data);
        showToast('Operating hours updated.');
    }

    function renderPage() {
        const config = getScheduleConfig();

        if (!isEditingHours) {
            openTimeInput.value = config.operatingHours.open;
            closeTimeInput.value = config.operatingHours.close;
        }

        slotsTbody.innerHTML = '';

        if (config.slots.length === 0) {
            slotsTbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 32px; color: var(--text-muted);">
                        No time slots configured. Click "Add Time Slot" to create one.
                    </td>
                </tr>
            `;
        } else {
            config.slots.forEach((slot) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                tr.innerHTML = `
                    <td style="padding: 16px; font-size: 14px; color: #475569;">${slot.text}</td>
                    <td style="padding: 16px; font-size: 14px; color: #475569;">${slot.maxTables}</td>
                    <td style="padding: 16px;">
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-small edit-slot-btn" data-id="${slot.id}" style="background: transparent; border: 1px solid var(--primary-green); color: var(--primary-green); font-weight: 500;"><i class="ph ph-pencil-simple"></i> Edit</button>
                            <button class="btn btn-small del-slot-btn" data-id="${slot.id}" style="background: transparent; border: 1px solid #f87171; color: #ef4444; font-weight: 500;"><i class="ph ph-trash"></i> Delete</button>
                        </div>
                    </td>
                `;
                slotsTbody.appendChild(tr);
            });
        }

        bindSlotButtons();
    }

    function bindSlotButtons() {
        document.querySelectorAll('.edit-slot-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const slot = getScheduleConfig().slots.find((item) => item.id === id);
                if (!slot) return;

                document.getElementById('modal-title').textContent = 'Edit Time Slot';
                document.getElementById('slot-id').value = slot.id;
                document.getElementById('slot-start').value = slot.start;
                document.getElementById('slot-end').value = slot.end;
                document.getElementById('slot-max').value = slot.maxTables;
                slotModal.style.display = 'flex';
            });
        });

        document.querySelectorAll('.del-slot-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                window.showConfirm('Are you sure you want to delete this time slot?', () => {
                    const nextSlots = getScheduleConfig().slots.filter((slot) => slot.id !== id);
                    void saveScheduleConfig(nextSlots).then(() => renderPage());
                });
            });
        });
    }

    function closeSlotModal() {
        slotModal.style.display = 'none';
        slotForm.reset();
        document.getElementById('slot-id').value = '';
    }

    function validateSlotDuration(start, end) {
        const startMin = minutesOf(start);
        const endMin = minutesOf(end);
        const duration = endMin > startMin ? (endMin - startMin) : ((endMin + 1440) - startMin);
        return duration === 120;
    }

    addSlotBtn.addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'Add Time Slot';
        slotForm.reset();
        document.getElementById('slot-id').value = '';
        document.getElementById('slot-max').value = StorageManager.getTables().length || 1;
        slotModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', closeSlotModal);
    cancelModalBtn.addEventListener('click', closeSlotModal);

    slotForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const id = document.getElementById('slot-id').value;
        const start = document.getElementById('slot-start').value;
        const end = document.getElementById('slot-end').value;
        const maxTables = parseInt(document.getElementById('slot-max').value, 10);

        if (!validateSlotDuration(start, end)) {
            showToast('Each time slot must be exactly 2 hours.');
            return;
        }

        const nextSlot = { id: id || `ts-${Date.now()}`, start, end, text: slotText(start, end), maxTables };
        const slots = getScheduleConfig().slots;

        if (id) {
            const index = slots.findIndex((slot) => slot.id === id);
            if (index !== -1) {
                slots[index] = nextSlot;
            }
        } else {
            slots.push(nextSlot);
        }

        void saveScheduleConfig(slots).then(() => {
            closeSlotModal();
            renderPage();
        });
    });

    function attachTimeSlotCancelBtn(saveBtn, discardAction) {
        if (!saveBtn.parentElement.classList.contains('actions-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'actions-wrapper';
            wrapper.style.display = 'flex';
            wrapper.style.gap = '8px';
            saveBtn.parentNode.insertBefore(wrapper, saveBtn);
            wrapper.appendChild(saveBtn);
        }

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-small';
        cancelBtn.style.backgroundColor = '#F1F5F9';
        cancelBtn.style.color = 'var(--text-dark)';
        cancelBtn.style.border = '1px solid #E2E8F0';
        cancelBtn.innerHTML = 'Cancel';
        cancelBtn.onclick = () => {
            discardAction();
            cancelBtn.remove();
        };
        saveBtn.parentElement.insertBefore(cancelBtn, saveBtn);
        return cancelBtn;
    }

    editHoursBtn.addEventListener('click', () => {
        if (!isEditingHours) {
            isEditingHours = true;
            openTimeInput.disabled = false;
            closeTimeInput.disabled = false;
            openTimeInput.style.backgroundColor = '#FFFFFF';
            closeTimeInput.style.backgroundColor = '#FFFFFF';
            openTimeInput.focus();

            editHoursBtn.innerHTML = '<i class="ph ph-check"></i> <span id="edit-hours-text">Save Changes</span>';
            editHoursBtn.classList.remove('btn-primary-orange');
            editHoursBtn.classList.add('btn-primary-green');

            editHoursBtn.cancelNode = attachTimeSlotCancelBtn(editHoursBtn, () => {
                isEditingHours = false;
                const opHours = getScheduleConfig().operatingHours;
                openTimeInput.value = opHours.open;
                closeTimeInput.value = opHours.close;

                openTimeInput.disabled = true;
                closeTimeInput.disabled = true;
                openTimeInput.style.backgroundColor = '#F8FAFC';
                closeTimeInput.style.backgroundColor = '#F8FAFC';

                editHoursBtn.innerHTML = '<i class="ph ph-pencil-simple"></i> <span id="edit-hours-text">Edit Operating Hours</span>';
                editHoursBtn.classList.remove('btn-primary-green');
                editHoursBtn.classList.add('btn-primary-orange');
            });
        } else {
            isEditingHours = false;
            openTimeInput.disabled = true;
            closeTimeInput.disabled = true;
            openTimeInput.style.backgroundColor = '#F8FAFC';
            closeTimeInput.style.backgroundColor = '#F8FAFC';

            if (editHoursBtn.cancelNode) editHoursBtn.cancelNode.remove();

            saveOperatingHours(openTimeInput.value, closeTimeInput.value);

            editHoursBtn.innerHTML = '<i class="ph ph-pencil-simple"></i> <span id="edit-hours-text">Edit Operating Hours</span>';
            editHoursBtn.classList.remove('btn-primary-green');
            editHoursBtn.classList.add('btn-primary-orange');
        }
    });

    function showToast(message) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '8px';
        toast.innerHTML = `<i class="ph ph-check-circle" style="color: #10B981; font-size: 20px;"></i> <span>${message}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    initTimeSlotData();
    renderPage();
});
