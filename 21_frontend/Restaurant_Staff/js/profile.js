/* ──────────────────────────────────────────────────────
   Profile Page — script.js
   ────────────────────────────────────────────────────── */

const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';

async function apiRequest(path, options = {}, role = 'staff') {
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
}

// ─────────────────────────────────────────
// Auth Guard
// ─────────────────────────────────────────
function checkAuth() {
    const session = sessionStorage.getItem('dinetime_session');
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}
// Run immediately
checkAuth();

// ─────────────────────────────────────────
// Edit Profile Toggle
// ─────────────────────────────────────────
const editBtn    = document.getElementById('edit-profile-btn');
const saveBtn    = document.getElementById('save-profile-btn');
const profileInputs = ['full-name', 'email', 'phone'].map(id => document.getElementById(id));

let editing = false;

editBtn.addEventListener('click', () => {
    editing = !editing;
    profileInputs.forEach(input => {
        input.disabled = !editing;
    });
    if (editing) {
        editBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancel';
        saveBtn.disabled = false;
        profileInputs[0].focus();
    } else {
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Profile';
        saveBtn.disabled = true;
    }
});

saveBtn.addEventListener('click', async () => {
    // Persist to backend and keep session copy in sync
    const nameInput = document.getElementById('full-name');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();

    // Validation Rules
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{10}$/;

    // Reset error highlights
    [nameInput, emailInput, phoneInput].forEach(inp => inp.classList.remove('input-error'));

    if (!name || name.length < 2) {
        showToast('Name must be at least 2 characters.', 'error');
        nameInput.classList.add('input-error');
        nameInput.focus();
        nameInput.addEventListener('input', () => nameInput.classList.remove('input-error'), { once: true });
        return;
    }

    if (!email || !emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        emailInput.classList.add('input-error');
        emailInput.focus();
        emailInput.addEventListener('input', () => emailInput.classList.remove('input-error'), { once: true });
        return;
    }

    if (!phone || !phoneRegex.test(phone.replace(/\D/g, ''))) {
        showToast('Phone number must be exactly 10 digits.', 'error');
        phoneInput.classList.add('input-error');
        phoneInput.focus();
        phoneInput.addEventListener('input', () => phoneInput.classList.remove('input-error'), { once: true });
        return;
    }

    const data = {
        name,
        email,
        phone: phone.replace(/\D/g, ''),
    };

    try {
        const session = JSON.parse(sessionStorage.getItem('dinetime_session') || '{}');
        if (session.staffId) {
            await apiRequest(`/users/${session.staffId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                }),
            }, 'staff');
        }

        sessionStorage.setItem('dinetime_profile', JSON.stringify(data));
    } catch (_e) {
        showToast('Failed to save profile. Please try again.', 'error');
        return;
    }

    // Update hero header name immediately
    const heroName = document.querySelector('.hero-name');
    if (heroName) heroName.textContent = data.name;

    // Restore disabled state
    profileInputs.forEach(inp => inp.disabled = true);
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Profile';
    saveBtn.disabled = true;
    editing = false;

    showToast('Profile saved successfully!', 'success');
});

// Logout listener for the new hero button
const profOutBtn = document.getElementById('logout-btn');
if (profOutBtn) {
    profOutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('dinetime_session');
        window.location.href = 'login.html';
    });
}

// Load saved profile on page load
(function loadProfile() {
    const saved = sessionStorage.getItem('dinetime_profile');
    if (saved) {
        const data = JSON.parse(saved);
        if (data.name) {
            document.getElementById('full-name').value = data.name;
            const heroName = document.querySelector('.hero-name');
            if (heroName) heroName.textContent = data.name;
        }
        if (data.email) document.getElementById('email').value      = data.email;
        if (data.phone) document.getElementById('phone').value      = data.phone;
    }
})();


// ─────────────────────────────────────────
// Change Password (with verification)
// ─────────────────────────────────────────
const changePwdBtn = document.getElementById('change-pwd-btn');
const pwdError     = document.getElementById('pwd-error');
const pwdSuccess   = document.getElementById('pwd-success');

changePwdBtn.addEventListener('click', () => {
    const current  = document.getElementById('current-password').value;
    const newPwd   = document.getElementById('new-password').value;
    const confirm  = document.getElementById('confirm-password').value;

    pwdError.textContent   = '';
    pwdSuccess.textContent = '';

    if (!current || !newPwd || !confirm) {
        pwdError.textContent = 'Please fill in all password fields.';
        return;
    }

    const session = JSON.parse(sessionStorage.getItem('dinetime_session') || '{}');

    if (!session || !session.staffId) {
        pwdError.textContent = 'Unable to verify account session.';
        return;
    }

    // --- VALIDATE NEW PASSWORD ---
    if (newPwd.length < 8) {
        pwdError.textContent = 'New password must be at least 8 characters.';
        return;
    }
    if (newPwd !== confirm) {
        pwdError.textContent = 'New passwords do not match.';
        return;
    }

    (async () => {
        try {
            const verified = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: session.email, password: current }),
            }, 'staff');

            if (!verified?.user || verified.user.id !== session.staffId) {
                pwdError.textContent = 'Current password incorrect. Please try again.';
                return;
            }

            await apiRequest(`/users/${session.staffId}`, {
                method: 'PATCH',
                body: JSON.stringify({ password_hash: newPwd }),
            }, 'staff');

            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value     = '';
            document.getElementById('confirm-password').value = '';
            pwdSuccess.textContent = 'Password changed successfully!';
            setTimeout(() => { pwdSuccess.textContent = ''; }, 4000);
        } catch (_e) {
            pwdError.textContent = 'Unable to change password right now.';
        }
    })();
});


// ─────────────────────────────────────────
// Notification toggles — persist
// ─────────────────────────────────────────
const notifKeys = ['notif-email', 'notif-sms', 'notif-daily', 'notif-manager'];

notifKeys.forEach(key => {
    const el = document.getElementById(key);
    // Load saved state
    const saved = sessionStorage.getItem(key);
    if (saved !== null) el.checked = saved === 'true';

    el.addEventListener('change', () => {
        sessionStorage.setItem(key, el.checked);
    });
});


// Toast helper
function showToast(message, type = 'success') {
    // Remove existing toast if any
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    // Inject toast styles if not already present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 28px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: #1f2937;
                color: #fff;
                padding: 12px 22px;
                border-radius: 10px;
                font-size: 0.88rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 9999;
                box-shadow: 0 8px 24px rgba(0,0,0,0.18);
                animation: slideUp 0.3s ease forwards;
            }
            .toast-success i { color: #22C55E; }
            .toast-error   i { color: #EF4444; }
            .input-error {
                border-color: #EF4444 !important;
                background-color: #FEF2F2 !important;
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
            }
            @keyframes slideUp {
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity    = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
