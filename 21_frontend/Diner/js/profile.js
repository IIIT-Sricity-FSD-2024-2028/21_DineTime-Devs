// profile.js - connected to global DinetimeStore

var notifications = [];

let currentRatingId = null;
let currentStarValue = 0;

// Render logic
function initProfile() {
    try {
        setupEventListeners();
        loadUserDetails();
        notifications = (DinetimeStore.getNotifications && DinetimeStore.getNotifications()) || [];
        renderUpcoming();
        renderHistory();
        renderNotifications();
        openPendingReviewFromUrl();
    } catch (err) {
        console.error("Critical error during profile initialization:", err);
    }
}

function openPendingReviewFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const reviewId = params.get('review');
    if (!reviewId) return;

    const reservation = (DinetimeStore.getReservations() || []).find(r => r.id === reviewId);
    if (reservation && reservation.status === 'Completed') {
        setTimeout(() => openRatingModal(reviewId), 0);
    }

    params.delete('review');
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, nextUrl);
}

function loadUserDetails() {
    const user = DinetimeStore.getUser();
    if (!user) {
        console.warn("No user found in store.");
        return;
    }

    if (document.getElementById('welcomeName')) {
        const displayName = (user.name || "User").split(' ')[0];
        document.getElementById('welcomeName').innerText = displayName;
    }
    if (document.getElementById('userName')) document.getElementById('userName').innerText = user.name || "Diner User";
    if (document.getElementById('userEmail')) document.getElementById('userEmail').innerText = user.email || "";
    if (document.getElementById('userPhone')) document.getElementById('userPhone').innerText = user.phone || "";
    
    // Use explicit city if available, otherwise parse from location
    let city = user.city || (typeof user.location === 'string' ? user.location : "Bangalore");
    if (!user.city && typeof user.location === 'string' && user.location.includes(',')) {
        city = user.location.split(',')[0].trim();
    }
    
    if (document.getElementById('userCity')) document.getElementById('userCity').innerText = city;
    if (document.getElementById('userPincode')) document.getElementById('userPincode').innerText = user.pincode || "560102";
    if (document.getElementById('userCountry')) document.getElementById('userCountry').innerText = user.country || "India";
    if (document.getElementById('userSince')) document.getElementById('userSince').innerText = user.joinDate || "January 2026";
    
    applyAvatarPhoto(user.photo_url || user.photo);
    updateLocationUI();
}

function renderNotifications() {
    const list = document.getElementById('notifList');
    if (!list) return;
    
    if (notifications.length === 0) {
        list.innerHTML = '<p class="empty-notif-msg">You have no new notifications</p>';
        list.classList.add('empty-state');
        return;
    }
    
    list.classList.remove('empty-state');
    list.innerHTML = '';
    notifications.forEach(n => {
        let div = document.createElement('div');
        div.className = 'notif-item';
        div.innerHTML = `
            <span class="notif-title">${n.title}</span>
            <span class="notif-desc">${n.desc}</span>
        `;
        list.appendChild(div);
    });
}

function renderUpcoming() {
    const list = document.getElementById('upcomingList');
    if (!list) return;
    list.innerHTML = '';

    const allReservations = DinetimeStore.getReservations() || [];
    const upcoming = allReservations.filter(r => r.status === 'Confirmed');

    if (upcoming.length === 0) {
        list.innerHTML = '<p style="color:#718096; font-size: 0.9rem;">No upcoming reservations.</p>';
        return;
    }

    upcoming.forEach(r => {
        let card = document.createElement('div');
        card.className = 'up-card';
        card.innerHTML = `
            <img src="${r.image}" class="up-thumb" alt="${r.restaurant}">
            <div class="up-details">
                <div class="up-title">${r.restaurant}</div>
                <div class="up-meta"><i class="fa-regular fa-calendar"></i> ${r.date}</div>
                <div class="up-meta"><i class="fa-regular fa-clock"></i> ${r.time}</div>
                <div class="up-meta"><i class="fa-solid fa-people-group"></i> ${r.guests} Guests</div>
                <div class="up-meta badge-col"><span class="badge-success">Confirmed</span></div>
            </div>
            <div class="up-actions">
                <button class="btn-blue" onclick="viewDetails('${r.id}')"><i class="fa-solid fa-eye"></i> View Details</button>
                <button class="btn-red" onclick="cancelReservation('${r.id}')"><i class="fa-solid fa-xmark"></i> Cancel</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderHistory() {
    const tbody = document.getElementById('historyList');
    if (!tbody) return;
    tbody.innerHTML = '';

    const allReservations = DinetimeStore.getReservations() || [];
    const history = allReservations.filter(r => r.status !== 'Confirmed');

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#718096;">No past reservations.</td></tr>';
        return;
    }

    history.forEach(r => {
        let statusBadge = r.status === 'Completed' ? '<span class="badge-success">Completed</span>' : '<span class="badge-danger">Cancelled</span>';
        
        let actionBtn = '';
        if (r.status === 'Completed') {
            if (r.hasRated) {
                actionBtn = `<button class="btn-orange-outline" onclick="openRatingModal('${r.id}')"><i class="fa-solid fa-star"></i> View Rating</button>`;
            } else {
                actionBtn = `<button class="btn-orange-solid" onclick="openRatingModal('${r.id}')"><i class="fa-regular fa-star"></i> Rate Experience</button>`;
            }
        } else if (r.status === 'Cancelled') {
            actionBtn = '';
        }

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500;">${r.restaurant}</td>
            <td>${r.date}</td>
            <td>${r.guests}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Actions
function viewDetails(id) {
    window.location.href = `details.html?id=${id}`;
}

async function cancelReservation(id) {
    const allReservations = DinetimeStore.getReservations();
    let res = allReservations.find(r => r.id === id);
    if(res) {
        showConfirmModal(
            'Cancel Reservation',
            `Are you sure you want to cancel your reservation at ${res.restaurant}?`,
            async () => {
                await DinetimeStore.cancelReservation(id);
                renderUpcoming();
                renderHistory();
                showToast("Reservation cancelled successfully.");
            }
        );
    }
}

// Modal Logic
function openRatingModal(id) {
    currentRatingId = id;
    const allReservations = DinetimeStore.getReservations();
    let res = allReservations.find(r => r.id === id);
    if(!res) return;

    document.getElementById('modalSubtitle').innerText = `How was your visit to ${res.restaurant}?`;
    let starContainer = document.getElementById('starContainer');
    let textArea = document.getElementById('iptReview');
    let footer = document.getElementById('modalFooter');
    let title = document.getElementById('modalTitle');

    let stars = starContainer.querySelectorAll('.star-btn');
    stars.forEach(s => s.classList.remove('active'));

    if (res.hasRated) {
        title.innerText = "Your Experience Rating";
        textArea.value = res.reviewText || "";
        textArea.disabled = true;
        starContainer.classList.add('read-only');
        footer.classList.add('hidden'); 
        currentStarValue = res.rating;
        setStars(res.rating);
    } else {
        title.innerText = "Rate Experience";
        textArea.value = "";
        textArea.disabled = false;
        starContainer.classList.remove('read-only');
        footer.classList.remove('hidden');
        currentStarValue = 0;
    }

    const m = document.getElementById('ratingModal');
    if (m) {
        m.classList.add('show');
    }
}

function closeRatingModal() {
    const m = document.getElementById('ratingModal');
    if (m) {
        m.classList.remove('show');
    }
    currentRatingId = null;
}

// Apply a saved photo (data URL) to the avatar circle
function applyAvatarPhoto(photoUrl) {
    const avatarCircle = document.getElementById('avatarCircle');
    const avatarIcon = document.getElementById('avatarIcon');
    const btnRemove = document.getElementById('btnRemovePhoto');
    if (!avatarCircle) return;

    if (photoUrl) {
        const src = String(photoUrl).startsWith('/uploads/')
            ? `${DinetimeStore.API_BASE}${photoUrl}`
            : photoUrl;
        // Remove existing photo img if any, then add fresh one
        const existing = avatarCircle.querySelector('img');
        if (existing) existing.remove();
        if (avatarIcon) avatarIcon.style.display = 'none';

        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        avatarCircle.appendChild(img);
        
        if (btnRemove) btnRemove.style.display = 'flex';
    } else {
        // No photo — show default icon
        const existing = avatarCircle.querySelector('img');
        if (existing) existing.remove();
        if (avatarIcon) avatarIcon.style.display = '';
        
        if (btnRemove) btnRemove.style.display = 'none';
    }
}

// Interactivity
function setupEventListeners() {
    // --- 1. CRITICAL: LOCATION MODAL ---
    const btnChangeLoc = document.getElementById('btnChangeLocation');
    const locModal = document.getElementById('locationModal');
    
    if (btnChangeLoc && locModal) {
        btnChangeLoc.addEventListener('click', (e) => {
            e.preventDefault();
            const user = DinetimeStore.getUser() || {};
            
            // Pre-fill fields with fallbacks
            if (document.getElementById('iptAddress')) document.getElementById('iptAddress').value = user.address || '';
            if (document.getElementById('iptCity')) document.getElementById('iptCity').value = user.city || '';
            if (document.getElementById('iptPincode')) document.getElementById('iptPincode').value = user.pincode || '';
            if (document.getElementById('iptCountry')) document.getElementById('iptCountry').value = user.country || '';
            
            // Show modal
            locModal.classList.add('show');
            locModal.classList.remove('hidden'); // Just in case
            
            // Fix map size when modal opens (only if Leaflet exists)
            setTimeout(() => {
                if (typeof window.L !== 'undefined' && modalMapInstance) {
                    modalMapInstance.invalidateSize();
                }
            }, 300);
        });
    }

    // --- 2. CRITICAL: LOGOUT ---
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }

    // --- 3. PHOTO UPLOADS ---
    const btnUpload = document.getElementById('btnUploadPhoto');
    const fileInput = document.getElementById('filePhotoInput');
    if (btnUpload && fileInput) {
        btnUpload.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) return;
            try {
                const updatedUser = await DinetimeStore.uploadProfilePhoto(file);
                applyAvatarPhoto(updatedUser.photo_url || updatedUser.photo);
                showToast('Photo updated successfully!');
            } catch (error) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    const user = DinetimeStore.getUser() || {};
                    user.photo = dataUrl;
                    DinetimeStore.setUser(user);
                    applyAvatarPhoto(dataUrl);
                    showToast(error.message || 'Photo saved locally for this session.', 'error');
                };
                reader.readAsDataURL(file);
            } finally {
                fileInput.value = '';
            }
        });
    }

    const btnRemove = document.getElementById('btnRemovePhoto');
    if (btnRemove) {
        btnRemove.addEventListener('click', () => {
            showConfirmModal(
                'Remove Photo',
                'Are you sure you want to remove your profile photo?',
                () => {
                    const user = DinetimeStore.getUser() || {};
                    user.photo = null;
                    user.photo_url = null;
                    DinetimeStore.setUser(user);
                    applyAvatarPhoto(null);
                    showToast('Photo removed.');
                }
            );
        });
    }

    // --- 4. MODAL CLOSE & SAVE ---
    if (document.getElementById('btnCloseLocModal')) {
        document.getElementById('btnCloseLocModal').addEventListener('click', () => {
            if (locModal) {
                locModal.classList.remove('show');
                locModal.classList.add('hidden'); // Double check
            }
        });
    }

    const btnSaveLoc = document.getElementById('btnSaveLocationModal');
    if (btnSaveLoc) {
        btnSaveLoc.addEventListener('click', () => {
            const cityEl = document.getElementById('iptCity');
            const city = cityEl ? cityEl.value.trim() : "";
            const address = document.getElementById('iptAddress') ? document.getElementById('iptAddress').value.trim() : "";
            const pincode = document.getElementById('iptPincode') ? document.getElementById('iptPincode').value.trim() : "";
            const country = document.getElementById('iptCountry') ? document.getElementById('iptCountry').value.trim() : "";
            
            if (!city) {
                showToast('City is required to set a location.', 'error');
                return;
            }

            const user = DinetimeStore.getUser() || {};
            user.address = address;
            user.city = city;
            user.pincode = pincode;
            user.country = country;
            user.location = [address, city, country].filter(Boolean).join(', ');
            
            if (typeof window.L !== 'undefined' && modalMapMarker) {
                const pos = modalMapMarker.getLatLng();
                user.lat = pos.lat;
                user.lng = pos.lng;
            }
            
            DinetimeStore.setUser(user);
            loadUserDetails();
            if (locModal) {
                locModal.classList.remove('show');
                locModal.classList.add('hidden');
            }
            showToast('Location saved successfully!');
        });
    }

    // --- 5. NOTIFICATIONS & SETTINGS ---
    const btnNotif = document.getElementById('btnNotifications');
    const dropNotif = document.getElementById('notifDropdown');
    if (btnNotif && dropNotif) {
        btnNotif.addEventListener('click', (e) => {
            e.stopPropagation();
            dropNotif.classList.toggle('hidden');
        });
        document.body.addEventListener('click', () => {
            dropNotif.classList.add('hidden');
        });
        dropNotif.addEventListener('click', (e) => e.stopPropagation());
    }

    const btnCloseNotif = document.getElementById('btnCloseNotif');
    if (btnCloseNotif && dropNotif) {
        btnCloseNotif.addEventListener('click', () => dropNotif.classList.add('hidden'));
    }

    const btnProfileSettings = document.getElementById('btnProfileSettings');
    if (btnProfileSettings) {
        btnProfileSettings.addEventListener('click', () => {
            window.location.href = 'settings.html';
        });
    }

    // --- 6. STAR RATING ---
    const btnCloseRating = document.getElementById('btnCloseModal');
    if (btnCloseRating) btnCloseRating.addEventListener('click', closeRatingModal);
    
    const btnCancelRate = document.getElementById('btnCancelRate');
    if (btnCancelRate) btnCancelRate.addEventListener('click', closeRatingModal);

    const btnSubmitRate = document.getElementById('btnSubmitRate');
    if (btnSubmitRate) {
        btnSubmitRate.addEventListener('click', async () => {
            if(currentStarValue === 0) {
                showToast('Please select a star rating.', 'error');
                return;
            }
            const allRes = DinetimeStore.getReservations();
            let resIndex = allRes.findIndex(r => r.id === currentRatingId);
            if(resIndex !== -1) {
                const user = DinetimeStore.getUser() || {};
                const reservation = allRes[resIndex];
                const reviewText = document.getElementById('iptReview').value;
                if (user.backend_user_id && reservation.restaurant_id) {
                    try {
                        await DinetimeStore.addReview({
                            user_id: user.backend_user_id,
                            restaurant_id: reservation.restaurant_id,
                            reservation_id: reservation.backend_id || reservation.id,
                            rating: currentStarValue,
                            comment: reviewText || 'Great experience!',
                        });
                        allRes[resIndex].hasRated = true;
                        allRes[resIndex].rating = currentStarValue;
                        allRes[resIndex].reviewText = reviewText;
                        DinetimeStore.setReservations(allRes);
                    } catch (_e) {
                        showToast('Unable to submit review right now.', 'error');
                        return;
                    }
                }
            }
            closeRatingModal();
            renderHistory();
            showToast("Review submitted! Thank you.");
        });
    }

    let starContainer = document.getElementById('starContainer');
    if (starContainer) {
        let stars = starContainer.querySelectorAll('.star-btn');
        stars.forEach(star => {
            star.addEventListener('click', function() {
                if (starContainer.classList.contains('read-only')) return;
                let val = parseInt(this.getAttribute('data-value'));
                currentStarValue = val;
                setStars(val);
            });
            star.addEventListener('mouseenter', function() {
                if (starContainer.classList.contains('read-only')) return;
                let hoverVal = parseInt(this.getAttribute('data-value'));
                stars.forEach(s => {
                    const sVal = parseInt(s.getAttribute('data-value'));
                    s.style.color = sVal <= hoverVal ? '#f59e0b' : '#cbd5e1';
                });
            });
        });

        starContainer.addEventListener('mouseleave', function() {
            if (!starContainer.classList.contains('read-only')) {
                setStars(currentStarValue);
            }
        });
    }
}

function updateLocationUI() {
    const user = DinetimeStore.getUser();
    if (!user) return;
    
    const mapLabel = document.getElementById('mapLabel');
    if (mapLabel) {
        if (user.location && typeof user.location === 'string') {
            const parts = user.location.split(',');
            mapLabel.innerText = parts[0].trim();
        } else {
            mapLabel.innerText = user.city || "Bangalore";
        }
    }
    if (typeof window.L !== 'undefined') {
        updateLeafletMaps(user);
    } else {
        console.warn("Leaflet not loaded. Skipping map update.");
    }
}

let profileMapInstance = null;
let profileMapMarker = null;
let modalMapInstance = null;
let modalMapMarker = null;

function updateLeafletMaps(user) {
    if (typeof window.L === 'undefined') return;

    const defaultLat = 12.9716;
    const defaultLng = 77.5946;
    const lat = user.lat !== undefined ? user.lat : defaultLat;
    const lng = user.lng !== undefined ? user.lng : defaultLng;

    try {
        const greenIcon = L.icon({
            iconUrl: '../../images/map-marker-green.png',
            shadowUrl: '../../images/map-marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        const profileMapEl = document.getElementById('profileMapUI');
        if (profileMapEl) {
            if (!profileMapInstance) {
                profileMapInstance = L.map('profileMapUI', {
                    zoomControl: false,
                    scrollWheelZoom: false
                }).setView([lat, lng], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(profileMapInstance);
                profileMapMarker = L.marker([lat, lng], {icon: greenIcon}).addTo(profileMapInstance);
            } else {
                profileMapInstance.setView([lat, lng], 13);
                profileMapMarker.setLatLng([lat, lng]);
            }
        }

        const modalMapEl = document.getElementById('modalMapUI');
        if (modalMapEl) {
            if (!modalMapInstance) {
                modalMapInstance = L.map('modalMapUI', {
                    zoomControl: true,
                    scrollWheelZoom: true
                }).setView([lat, lng], 13);
                modalMapInstance.zoomControl.setPosition('topright');
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(modalMapInstance);
                modalMapMarker = L.marker([lat, lng], {
                    draggable: true,
                    icon: greenIcon
                }).addTo(modalMapInstance);
            } else {
                modalMapInstance.setView([lat, lng], 13);
                modalMapMarker.setLatLng([lat, lng]);
            }
        }
    } catch (e) {
        console.error("Leaflet initialization failed gracefully:", e);
    }
}

function setStars(val) {
    let stars = document.getElementById('starContainer').querySelectorAll('.star-btn');
    stars.forEach(s => {
        s.style.color = ''; 
        if (parseInt(s.getAttribute('data-value')) <= val) s.classList.add('active');
        else s.classList.remove('active');
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMsg');
    
    if (toast && msg) {
        toast.className = `toast ${type === 'error' ? 'error' : ''}`;
        msg.innerText = message;
        
        const icon = toast.querySelector('i');
        if (icon) {
            icon.className = `fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'} toast-icon`;
            if (type === 'error') {
                icon.style.color = '#ef4444';
            } else {
                icon.style.color = '#4ade80';
            }
        }

        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 4000);
    }
}

function showConfirmModal(title, message, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const btnCancel = document.getElementById('btnModalCancel');
    const btnConfirm = document.getElementById('btnModalConfirm');

    titleEl.innerText = title;
    msgEl.innerText = message;
    overlay.classList.add('show');

    const closeModal = () => {
        overlay.classList.remove('show');
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
    };

    btnConfirm.onclick = () => {
        onConfirm();
        closeModal();
    };
    btnCancel.onclick = closeModal;
    overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };
}

// Ensure initialization runs even if DOMContentLoaded has already passed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
            await DinetimeStore.ready();
        }
        initProfile();
    });
} else {
    Promise.resolve()
        .then(async () => {
            if (window.DinetimeStore && typeof DinetimeStore.ready === 'function') {
                await DinetimeStore.ready();
            }
        })
        .then(() => initProfile());
}
