document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';

    // DOM Elements - Steps
    const steps = [
        document.getElementById('step-1'),
        document.getElementById('step-2'),
        document.getElementById('step-3')
    ];

    // Left Panel Elements
    const leftTitle = document.getElementById('left-panel-title');
    const leftDesc = document.getElementById('left-panel-desc');
    const feat2Text = document.getElementById('feat-2-text');
    const feat3Text = document.getElementById('feat-3-text');

    // Forms
    const form3 = document.getElementById('form-step-3');

    // Navigation Buttons
    const backToStep1 = document.getElementById('back-to-step-1');
    const backToStep2 = document.getElementById('back-to-step-2');
    const toStep2Btn = document.getElementById('btn-to-step-2');
    const toStep3Btn = document.getElementById('btn-to-step-3');

    // Data object to collect all registration info
    let registrationData = {
        account: {},
        restaurant: {},
        locationId: '',
        documentFile: null,
    };

    // --- Utility: Show Toast ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (type === 'error') toast.style.borderLeftColor = '#DC2626';

        toast.innerHTML = `
            <i class="ph ${type === 'error' ? 'ph-warning' : 'ph-check-circle'} toast-icon" style="color: ${type === 'error' ? '#DC2626' : 'var(--primary-green)'}"></i>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);
        setTimeout(() => toast.classList.add('hiding'), 3000);
        setTimeout(() => toast.remove(), 3350);
    }

    // --- STEP NAVIGATION LOGIC ---
    function goToStep(stepNumber) {
        steps.forEach((s, idx) => {
            s.classList.toggle('active', idx === stepNumber - 1);
        });

        if (stepNumber === 1) {
            leftTitle.innerHTML = 'Register Your<br>Restaurant on<br>DineTime';
            leftDesc.innerText = 'Create a manager account to manage your restaurant, track reservations, and optimize seating capacity.';
            feat2Text.innerText = 'Monitor table availability';
            feat3Text.innerText = 'Grow your customer reach';
        } else if (stepNumber === 2) {
            leftTitle.innerHTML = 'Add Your Restaurant<br>to DineTime';
            leftDesc.innerText = 'List your restaurant so diners can discover it, reserve tables, and enjoy a seamless dining experience.';
            feat2Text.innerText = 'Optimize seating capacity';
            feat3Text.innerText = 'Grow your restaurant visibility';
        } else if (stepNumber === 3) {
            leftTitle.innerHTML = 'Set Your Restaurant<br>Location';
            leftDesc.innerText = 'Tell us which DineTime location your restaurant belongs to.';
            feat2Text.innerText = 'Reach diners in your area';
            feat3Text.innerText = 'Get reviewed by our Verification Team';
            loadLocations();
        }

        document.querySelector('.login-right').scrollTop = 0;
    }

    async function loadLocations() {
        const select = document.getElementById('loc-select');
        if (select.dataset.loaded === 'true') return;

        try {
            const response = await fetch(`${API_BASE}/restaurants/locations`);
            const payload = await response.json();
            const locations = payload?.data || [];

            select.innerHTML = '<option value="" disabled selected>Select a location</option>' +
                locations.map((loc) => `<option value="${loc.id}">${loc.address}</option>`).join('');
            select.dataset.loaded = 'true';
        } catch (_e) {
            select.innerHTML = '<option value="" disabled selected>Unable to load locations — please retry</option>';
        }
    }

    // --- STEP 1: Verification document upload ---
    const docDropzone = document.getElementById('doc-dropzone');
    const docInput = document.getElementById('reg-document');
    const docUploadTitle = document.getElementById('doc-upload-title');

    docDropzone.addEventListener('click', () => docInput.click());
    document.getElementById('doc-upload-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        docInput.click();
    });

    docInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            registrationData.documentFile = file;
            docUploadTitle.textContent = file.name;
            document.getElementById('err-document').classList.remove('show');
        }
    });

    // --- STEP 1 LOGIC ---
    if (toStep2Btn) {
        toStep2Btn.addEventListener('click', () => {
            const name = document.getElementById('reg-name').value;
            const phone = document.getElementById('reg-phone').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            const license = document.getElementById('reg-license').value;
            const authorized = document.getElementById('reg-auth').checked;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.toLowerCase())) {
                document.getElementById('err-email').classList.add('show');
                return;
            }
            document.getElementById('err-email').classList.remove('show');

            if (password.length < 8) {
                document.getElementById('err-pass').classList.add('show');
                return;
            }
            document.getElementById('err-pass').classList.remove('show');

            if (password !== confirm) {
                document.getElementById('err-confirm').classList.add('show');
                return;
            }
            document.getElementById('err-confirm').classList.remove('show');

            if (!license || !authorized || !name || !phone) {
                showToast('Please fill all required fields and authorize.', 'error');
                return;
            }

            const licenseRegex = /^BL-[A-Z]{2}-\d{4}$/;
            if (!licenseRegex.test(license.toUpperCase())) {
                document.getElementById('err-license')?.classList.add('show');
                showToast('Invalid Business License format (BL-XX-XXXX).', 'error');
                return;
            }
            document.getElementById('err-license')?.classList.remove('show');

            if (!/^\d{10}$/.test(phone)) {
                document.getElementById('err-phone').classList.add('show');
                return;
            }
            document.getElementById('err-phone')?.classList.remove('show');

            if (!registrationData.documentFile) {
                document.getElementById('err-document').classList.add('show');
                showToast('Please attach a verification document.', 'error');
                return;
            }

            registrationData.account = { name, phone, email, password, license };
            goToStep(2);
        });
    }

    // --- STEP 2 LOGIC ---
    if (toStep3Btn) {
        toStep3Btn.addEventListener('click', () => {
            const name = document.getElementById('res-name').value;
            const cuisine = document.getElementById('res-cuisine').value;
            const desc = document.getElementById('res-desc').value;
            const phone = document.getElementById('res-phone').value;

            if (!name || !cuisine || !phone) {
                showToast('Please fill all required fields.', 'error');
                return;
            }

            if (!/^\d{10}$/.test(phone)) {
                showToast('Restaurant contact number must be exactly 10 digits.', 'error');
                return;
            }

            registrationData.restaurant = { name, cuisine, desc, phone };
            goToStep(3);
        });
    }

    backToStep1.addEventListener('click', () => goToStep(1));

    // --- STEP 3 LOGIC ---
    form3.addEventListener('submit', (e) => {
        e.preventDefault();

        const locationId = document.getElementById('loc-select').value;
        if (!locationId) {
            document.getElementById('err-location').classList.add('show');
            return;
        }
        document.getElementById('err-location').classList.remove('show');

        registrationData.locationId = locationId;
        finishRegistration();
    });

    backToStep2.addEventListener('click', () => goToStep(2));

    async function finishRegistration() {
        const finishBtn = document.getElementById('btn-finish');
        finishBtn.disabled = true;
        showToast('Submitting your application...');

        const cuisineLabel = registrationData.restaurant.cuisine
            ? registrationData.restaurant.cuisine.charAt(0).toUpperCase() + registrationData.restaurant.cuisine.slice(1)
            : '';

        const formData = new FormData();
        formData.append('name', registrationData.account.name);
        formData.append('email', registrationData.account.email);
        formData.append('phone', registrationData.account.phone);
        formData.append('password', registrationData.account.password);
        formData.append('business_license_number', registrationData.account.license);
        formData.append('location_id', registrationData.locationId);
        formData.append('restaurant_name', registrationData.restaurant.name);
        formData.append('cuisine_type', cuisineLabel);
        formData.append('description', registrationData.restaurant.desc || `${registrationData.restaurant.name} - ${cuisineLabel} restaurant.`);
        formData.append('document', registrationData.documentFile);

        try {
            const response = await fetch(`${API_BASE}/managers/register`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(Array.isArray(body.message) ? body.message.join(', ') : (body.message || 'Registration failed.'));
            }

            showToast('Application submitted! You will be able to log in once it is verified.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } catch (error) {
            showToast(error.message, 'error');
            finishBtn.disabled = false;
        }
    }

    // Password Toggle Utility
    document.querySelectorAll('.toggle-eye-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('ph-eye', 'ph-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('ph-eye-slash', 'ph-eye');
            }
        });
    });
});
