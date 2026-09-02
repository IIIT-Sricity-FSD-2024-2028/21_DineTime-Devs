const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';

function apiRequest(path, options = {}, role = 'staff') {
    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            role,
            ...(options.headers || {}),
        },
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(`Request failed (${response.status})`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    });
}

document.getElementById('toggle-pwd').addEventListener('click', function() {
    const pwdInput = document.getElementById('password');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        this.classList.remove('fa-eye');
        this.classList.add('fa-eye-slash');
    } else {
        pwdInput.type = 'password';
        this.classList.remove('fa-eye-slash');
        this.classList.add('fa-eye');
    }
});

const forgotModal = document.getElementById('forgotPasswordModal');
const closeForgotModal = document.getElementById('closeForgotModal');
const resetSuccessMsg = document.getElementById('reset-success-msg');

document.getElementById('forgot-link').addEventListener('click', (e) => {
    e.preventDefault();
    forgotModal.classList.remove('hidden');
});

closeForgotModal.addEventListener('click', () => {
    forgotModal.classList.add('hidden');
    resetSuccessMsg.classList.add('hidden');
});

forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) {
        forgotModal.classList.add('hidden');
        resetSuccessMsg.classList.add('hidden');
    }
});

document.getElementById('forgot-password-form').addEventListener('submit', (e) => {
    e.preventDefault();
    resetSuccessMsg.classList.remove('hidden');
    setTimeout(() => {
        forgotModal.classList.add('hidden');
        resetSuccessMsg.classList.add('hidden');
        document.getElementById('reset-email').value = '';
    }, 2500);
});

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const staffId = document.getElementById('staff-id').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();
    const remember = document.getElementById('remember-me').checked;
    const errorMsg = document.getElementById('login-error');

    errorMsg.style.display = 'none';

    if (!staffId || !password) {
        errorMsg.textContent = 'Please enter both Staff ID and Password.';
        errorMsg.style.display = 'block';
        return;
    }

    const loginBtn = document.querySelector('.btn-primary');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Authenticating...';
    loginBtn.disabled = true;

    try {
        const auth = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: staffId, password }),
        }, 'staff');
        const restaurantsRes = await apiRequest('/restaurants', {}, 'staff');
        const restaurants = restaurantsRes?.data || [];
        const user = auth?.user;

        if (!user || user.role !== 'staff') {
            throw new Error('Invalid Staff ID or Password.');
        }

        if (user.status !== 'active') {
            throw new Error('Your account is pending manager approval.');
        }

        const staffRestaurant = restaurants.find((r) => r.id === user.restaurant_id);

        const sessionData = {
            id: user.id,
            staffId: user.id,
            name: user.name,
            email: user.email,
            role: 'Staff',
            restaurant: staffRestaurant?.name || 'Spice Garden',
            restaurant_id: staffRestaurant?.id || user.restaurant_id || '',
            access_token: auth.access_token,
            loggedInAt: new Date().toISOString(),
            remember,
        };

        sessionStorage.setItem('dinetime_session', JSON.stringify(sessionData));
        sessionStorage.setItem('dinetime_profile', JSON.stringify({
            name: user.name,
            email: user.email,
            phone: user.phone || '',
        }));

        window.location.href = 'check-in.html';
    } catch (error) {
        errorMsg.textContent = error.message || 'Login failed.';
        errorMsg.style.display = 'block';
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
});

function checkExistingSession() {
    const session = sessionStorage.getItem('dinetime_session');
    if (session) {
        window.location.href = 'check-in.html';
    }
}

document.addEventListener('DOMContentLoaded', checkExistingSession);
