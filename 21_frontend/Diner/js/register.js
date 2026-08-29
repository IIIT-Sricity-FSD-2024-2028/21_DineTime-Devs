document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';

    const apiRequest = async (path, options = {}, role = 'manager') => {
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                role,
                ...(options.headers || {}),
            },
        });

        if (!response.ok) {
            throw new Error(`Request failed (${response.status})`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    };

    const stepAccount = document.getElementById('step-account');
    const stepLocation = document.getElementById('step-location');
    const step1Info = document.getElementById('step-1-info');
    const step2Info = document.getElementById('step-2-info');
    
    const accountForm = document.getElementById('account-form');
    const locationForm = document.getElementById('location-form');
    const backBtn = document.getElementById('back-to-step-1');
    const detectLocationBtn = document.querySelector('.btn-location-detect');

    // Social Login Simulation
    const socialBtns = document.querySelectorAll('.btn-social');
    const toastWrapper = document.getElementById('toast-wrapper');
    const toastMsgEl = document.getElementById('toast-msg');
    const toastContent = document.getElementById('toast-content');

    function showToast(message, type = 'processing', iconClass = 'ph-circle-notch ph-spin') {
        if (!toastWrapper || !toastMsgEl) return;
        
        toastMsgEl.innerText = message;
        toastContent.querySelector('i').className = `ph ${iconClass}`;
        
        if (type === 'error') toastContent.style.borderLeft = '4px solid #ef4444';
        else if (type === 'success') toastContent.style.borderLeft = '4px solid var(--primary-green)';
        else toastContent.style.borderLeft = 'none';

        toastWrapper.classList.remove('hidden');
        
        if (type !== 'processing') {
            setTimeout(() => {
                toastWrapper.classList.add('hidden');
            }, 4000);
        }
    }

    socialBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.innerText.includes('Google') ? 'Google' : 'Apple';
            showToast(`Establishing secure connection with ${provider}...`, 'processing', 'ph-circle-notch ph-spin');
            setTimeout(() => {
                toastWrapper.classList.add('hidden');
            }, 3000);
        });
    });

    let map;
    let marker;

    function initMap() {
        if (map) return; // Already initialized

        // Initial view - Bengaluru, India
        const initialLat = 12.9716;
        const initialLng = 77.5946;


        map = L.map('reg-map-ui', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([initialLat, initialLng], 13);
        
        // Move zoom control to top right to avoid overlap with HUD
        map.zoomControl.setPosition('topright');


        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Custom Green Icon (to match theme)
        const greenIcon = L.icon({
            iconUrl: '../../images/map-marker-green.png',
            shadowUrl: '../../images/map-marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        marker = L.marker([initialLat, initialLng], {
            draggable: true,
            icon: greenIcon
        }).addTo(map);

        // Update HUD on load
        updateMapHUD(initialLat, initialLng, 13);

        // Marker Events
        marker.on('drag', function(e) {
            const pos = marker.getLatLng();
            updateMapHUD(pos.lat, pos.lng, map.getZoom());
        });

        map.on('zoomend', function() {
            const pos = marker.getLatLng();
            updateMapHUD(pos.lat, pos.lng, map.getZoom());
        });

        // Click to place marker
        map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            updateMapHUD(e.latlng.lat, e.latlng.lng, map.getZoom());
        });
    }

    function updateMapHUD(lat, lng, zoom) {
        document.getElementById('map-coords').innerText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        document.getElementById('map-zoom').innerText = `Zoom ${zoom}`;
    }

    // ---- Step Navigation ----
    function goToStep(stepNumber) {
        if (stepNumber === 1) {
            stepLocation.classList.remove('active');
            step2Info.classList.remove('active');
            setTimeout(() => {
                stepAccount.classList.add('active');
                step1Info.classList.add('active');
            }, 300);
        } else if (stepNumber === 2) {
            stepAccount.classList.remove('active');
            step1Info.classList.remove('active');
            setTimeout(() => {
                stepLocation.classList.add('active');
                step2Info.classList.add('active');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                // Initialize Map when step becomes active
                setTimeout(initMap, 400);
            }, 300);
        }
    }

    // Step 1 -> Step 2
    accountForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check if email already registered
        const emailInput = document.getElementById('reg-email');
        const phoneInput = document.getElementById('reg-phone');
        const phoneVal = phoneInput.value.replace(/\D/g, ''); // Remove non-numeric

        if (phoneVal.length !== 10) {
            const phoneError = document.getElementById('phone-error');
            if (phoneError) {
                phoneError.style.display = 'block';
                phoneInput.addEventListener('input', () => {
                    phoneError.style.display = 'none';
                }, {once: true});
            } else {
                showToast('Please enter a valid 10-digit phone number.', 'error', 'ph-warning-circle');
            }
            return;
        }

        if (emailInput) {
            const emailVal = emailInput.value.trim().toLowerCase();
            const passVal = document.getElementById('reg-password').value;
            const confPassVal = document.getElementById('reg-confirm-password').value;

            // Email Format Validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailVal)) {
                showToast('Please enter a valid email address.', 'error', 'ph-warning-circle');
                return;
            }

            if (passVal.length < 8) {
                showToast('Password must be at least 8 characters long.', 'error', 'ph-warning-circle');
                return;
            }

            if (passVal !== confPassVal) {
                showToast('Passwords do not match. Please re-enter.', 'error', 'ph-warning-circle');
                return;
            }

            try {
                const usersRes = await apiRequest('/users', {}, 'manager');
                const users = usersRes?.data || [];
                const exists = users.some((u) => String(u.email || '').toLowerCase() === emailVal);
                if (exists) {
                    const errorSpan = document.getElementById('email-error');
                    if (errorSpan) {
                        errorSpan.style.display = 'block';
                        emailInput.addEventListener('input', () => {
                            errorSpan.style.display = 'none';
                        }, { once: true });
                    } else {
                        showToast('This email is already registered. Please log in.', 'error', 'ph-warning-circle');
                    }
                    return;
                }
            } catch (_e) {
                showToast('Unable to validate email right now. Try again.', 'error', 'ph-warning-circle');
                return;
            }
        }

        const submitBtn = accountForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Processing...';
        
        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            goToStep(2);
        }, 800);
    });

    // Step 2 -> Step 1 (Back logic hidden in HTML but kept in JS for future)
    // Actually, backBtn is removed from HTML but let's keep the listener safe
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            goToStep(1);
        });
    }

    // Step 2 -> Dashboard (Final)
    locationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = locationForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Finalizing...';
        
        // Grab values to save persistently
        const nameVal = document.getElementById('reg-name').value;
        const emailVal = document.getElementById('reg-email').value.trim().toLowerCase();
        const phoneVal = document.getElementById('reg-phone').value.replace(/\D/g, '');
        const passVal = document.getElementById('reg-password').value;
        
        const addressVal = document.getElementById('reg-address').value;
        const cityVal = document.getElementById('reg-city').value;
        const pincodeVal = document.getElementById('reg-pincode').value;
        if (!/^\d{6}$/.test(pincodeVal)) {
            showToast('Pincode must be exactly 6 digits.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
        const countryVal = document.getElementById('reg-country').value || "India";
        
        let finalLocation = cityVal ? `${cityVal}, ${countryVal === 'IN' ? 'India' : 'USA'}` : "New York, USA";
        if (addressVal) finalLocation = `${addressVal}, ${finalLocation}`;

        const markerLat = marker ? marker.getLatLng().lat : 12.9716;
        const markerLng = marker ? marker.getLatLng().lng : 77.5946;

        let createdUserId = null;
        try {
            const created = await apiRequest('/users', {
                method: 'POST',
                body: JSON.stringify({
                    name: nameVal || 'Diner User',
                    email: emailVal,
                    phone: phoneVal,
                    password_hash: passVal || 'password123',
                    role: 'diner',
                    status: 'active',
                    location_id: 'loc_blr_1',
                }),
            }, 'diner');
            createdUserId = created?.data?.id || null;
        } catch (_e) {
            showToast('Unable to create account right now.', 'error', 'ph-warning-circle');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        // Save into DinetimeStore immediately 
        DinetimeStore.setUser({
            name: nameVal || "New User",
            email: emailVal || "user@example.com",
            phone: phoneVal,
            password: passVal || "password123",
            location: finalLocation,
            address: addressVal,
            city: cityVal,
            pincode: pincodeVal,
            country: countryVal === 'IN' ? 'India' : (countryVal || 'USA'),
            lat: markerLat,
            lng: markerLng,
            avatar: "../images/avatar-1.jpg",
            joined: "March 2026",
            reviews: 0,
            photos: 0,
            backend_user_id: createdUserId,
            role: 'diner',
        });

        // Wipe all old user-specific data so new user starts fresh
        DinetimeStore.initNewUser();

        setTimeout(() => {
            showToast('Welcome to DineTime! Your account has been created.', 'success', 'ph-check-circle');
            // Route seamlessly to browse.html instead of a dashboard
            setTimeout(() => {
                window.location.href = 'browse.html';
            }, 1500);
        }, 1200);
    });

    // ---- Password Visibility Toggle ----
    document.querySelectorAll('.view-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const input = btn.parentElement.querySelector('input');
            const icon = btn.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('ph-eye', 'ph-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('ph-eye-slash', 'ph-eye');
            }
        });
    });

    // ---- Input Focus Effects (Optional Premium Polish) ----

    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('focus', () => {
            const container = el.closest('.input-container') || el.closest('.password-field') || el.closest('.select-container');
            if (container) container.style.borderColor = 'var(--primary-green)';
        });
        el.addEventListener('blur', () => {
            const container = el.closest('.input-container') || el.closest('.password-field') || el.closest('.select-container');
            if (container) container.style.borderColor = 'var(--border-color)';
        });
    });
});
