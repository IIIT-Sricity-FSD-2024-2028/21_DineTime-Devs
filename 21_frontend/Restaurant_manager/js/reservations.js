document.addEventListener('DOMContentLoaded', async () => {
    await StorageManager.ready();
    // ---- Toast System (Duplicated logic for multi-page simplicity, ideal to move to utils.js) ----
    const toastContainer = document.getElementById('toast-container');
    window.showToast = function(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        let iconClass = type === 'success' ? 'ph-check-circle' : 'ph-info';
        if (type === 'error') iconClass = 'ph-x-circle';
        toast.innerHTML = `<i class="ph ${iconClass} toast-icon"></i><span class="toast-message">${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    };

    // ---- Elements ----
    const listContainer = document.getElementById('reservations-list');
    const searchInput = document.getElementById('search-input');
    const filterDateCustom = document.getElementById('filter-date-custom');
    const filterStatus = document.getElementById('filter-status');
    const filterGuests = document.getElementById('filter-guests');
    const clearFiltersBtn = document.getElementById('clear-filters');


    // Set initial date to Today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    if (filterDateCustom) {
        filterDateCustom.value = `${yyyy}-${mm}-${dd}`;
    }

    // ---- Rendering Logic ----
    function renderReservations() {
        const allRes = StorageManager.getReservations();
        
        // 1. Calculate Stats (Today's Total)
        const todayStr = new Date().toLocaleDateString('en-CA');

        const todayRes = allRes.filter(r => r.date === todayStr);

        const stats = {
            total: todayRes.length,
            confirmed: todayRes.filter(r => r.status === 'Confirmed').length,
            pending: todayRes.filter(r => r.status === 'Pending').length,
            cancelled: todayRes.filter(r => r.status === 'Cancelled').length,
            noshow: todayRes.filter(r => r.status === 'No-show').length
        };
        
        document.getElementById('stat-total').innerText = stats.total;
        document.getElementById('stat-confirmed').innerText = stats.confirmed;
        document.getElementById('stat-pending').innerText = stats.pending;
        document.getElementById('stat-cancelled').innerText = stats.cancelled;
        document.getElementById('stat-noshow').innerText = stats.noshow;

        // 2. Filter logic
        const qSearch = searchInput.value.toLowerCase();
        const qDate = filterDateCustom ? filterDateCustom.value : "";
        const qStatus = filterStatus.value;
        const qGuests = filterGuests.value;

        const filtered = allRes.filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(qSearch) || r.email.toLowerCase().includes(qSearch) || r.phone.includes(qSearch);
            const matchesStatus = qStatus === "" || r.status === qStatus;
            
            let matchesDate = true;
            if (qDate) matchesDate = (r.date === qDate);
            
            let matchesGuests = true;
            if (qGuests === "2" && parseInt(r.guests) !== 2) matchesGuests = false;
            else if (qGuests === "4" && parseInt(r.guests) !== 4) matchesGuests = false;
            else if (qGuests === "6+" && parseInt(r.guests) < 6) matchesGuests = false;

            return matchesSearch && matchesStatus && matchesGuests && matchesDate;
        });




        // 3. Render HTML
        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 48px 24px; text-align: center; color: var(--text-muted); background: white; border-radius: 12px; border: 2px dashed #E2E8F0;">
                    <i class="ph ph-calendar-blank" style="font-size: 32px; color: #CBD5E1; margin-bottom: 8px;"></i>
                    <p style="font-size: 15px;">No reservations found matching your criteria.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered.map(r => {
            // Determine badge style
            let badgeStyle = "background: #D1FAE5; color: #10B981;"; // green (Confirmed)
            if (r.status === 'Pending') badgeStyle = "background: #DBEAFE; color: #3B82F6;"; // blue
            if (r.status === 'Cancelled' || r.status === 'No-show') badgeStyle = "background: #FEE2E2; color: #EF4444;"; // red
            if (r.status === 'Complete') badgeStyle = "background: #E0E7FF; color: #4F46E5;"; // indigo

            const displayDate = r.date.split('-').reverse().join('-');

            return `
                <div class="res-card card" data-id="${r.id}">
                    <div class="res-summary">
                        <div class="res-primary">
                            <h4>${r.name} <span class="res-badge" style="${badgeStyle}">${r.status}</span></h4>
                            <div class="res-meta">
                                <span><i class="ph ph-calendar-blank"></i> ${displayDate} | ${r.time}</span>
                                <span><i class="ph ph-users"></i> ${r.guests} guests</span>
                                <span><i class="ph ph-armchair"></i> Table ${r.table}</span>
                            </div>
                        </div>
                        <div class="res-toggle">
                            <span class="toggle-text">View Details <i class="ph ph-caret-down"></i></span>
                        </div>
                    </div>

                    
                    <div class="res-details" style="display: none;">
                        <div class="details-grid">
                            <div class="detail-item-small">
                                <span class="detail-label">Email Address</span>
                                <span class="detail-value">${r.email}</span>
                            </div>
                            <div class="detail-item-small">
                                <span class="detail-label">Phone Number</span>
                                <span class="detail-value">${r.phone}</span>
                            </div>
                            <div class="detail-item-small" style="grid-column: span 2;">
                                <span class="detail-label">Special Request</span>
                                <span class="detail-value">${r.request}</span>
                            </div>
                        </div>
                        <div class="res-actions">
                            <button class="btn btn-primary-green btn-small mark-complete-btn" data-id="${r.id}" ${r.status !== 'Confirmed' ? 'disabled style="opacity:0.5"' : ''}>Mark Complete</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // 4. Attach Listeners
        attachCardListeners();
    }

    function attachCardListeners() {
        // Expand/Collapse Details
        document.querySelectorAll('.res-summary').forEach(summary => {
            summary.addEventListener('click', (e) => {
                if(e.target.closest('button')) return; // ignore btn clicks
                const card = summary.closest('.res-card');
                const details = card.querySelector('.res-details');
                const caret = summary.querySelector('.ph-caret-down, .ph-caret-up');
                
                if (details.style.display === 'none') {
                    details.style.display = 'block';
                    if(caret) caret.classList.replace('ph-caret-down', 'ph-caret-up');
                } else {
                    details.style.display = 'none';
                    if(caret) caret.classList.replace('ph-caret-up', 'ph-caret-down');
                }
            });
        });

        // "Mark Complete" CRUD Operation
        document.querySelectorAll('.mark-complete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                StorageManager.updateReservationStatus(id, 'Complete').then(() => {
                    showToast(`Reservation #${id} marked as complete.`);
                    renderReservations();
                }).catch((err) => {
                    showToast((err && err.message) ? err.message : 'Unable to update reservation.', 'error');
                });
            });
        });
    }

    // ---- Event Listeners for Filters ----
    searchInput.addEventListener('input', renderReservations); // Real-time search
    if (filterDateCustom) {
        filterDateCustom.addEventListener('input', renderReservations);
    }
    filterStatus.addEventListener('change', renderReservations);
    filterGuests.addEventListener('change', renderReservations);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            searchInput.value = "";
            
            // Reset to Today's date on clear
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            if (filterDateCustom) {
                filterDateCustom.value = `${yyyy}-${mm}-${dd}`;
            }

            filterStatus.value = "";
            filterGuests.value = "";
            renderReservations(); // Reset view
            showToast('Filters cleared.');
        });
    }

    // Initial render
    renderReservations();
});

