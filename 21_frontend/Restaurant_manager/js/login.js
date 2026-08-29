// ---- Toast ----
const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';

async function apiRequest(path, options = {}, role = 'manager') {
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

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    const icon = type === 'error' ? 'ph-warning' : 'ph-check-circle';
    const iconColor = type === 'error' ? '#DC2626' : '#527A59';
    toast.innerHTML = `<i class="ph ${icon}" style="font-size:18px;color:${iconColor};flex-shrink:0;"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// ---- Toggle password visibility ----
const toggleEye = document.getElementById('toggle-eye');
const eyeIcon   = document.getElementById('eye-icon');
const passInput = document.getElementById('password-input');

toggleEye.addEventListener('click', () => {
    const isHidden = passInput.type === 'password';
    passInput.type = isHidden ? 'text' : 'password';
    eyeIcon.className = isHidden ? 'ph ph-eye-slash' : 'ph ph-eye';
});

// ---- Forgot password ----
const forgotModal = document.getElementById('forgotPasswordModal');
const closeForgotModal = document.getElementById('closeForgotModal');

document.getElementById('forgot-link').addEventListener('click', (e) => {
    e.preventDefault();
    forgotModal.classList.remove('hidden');
});

closeForgotModal.addEventListener('click', () => {
    forgotModal.classList.add('hidden');
    document.getElementById('reset-success-msg').classList.add('hidden');
});

forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) {
        forgotModal.classList.add('hidden');
        document.getElementById('reset-success-msg').classList.add('hidden');
    }
});

document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resetEmail = document.getElementById('reset-email').value.trim();
    if (!resetEmail) return;

    try {
        const usersRes = await apiRequest('/users', {}, 'manager');
        const users = usersRes?.data || [];
        const exists = users.some((u) => u.role === 'manager' && u.email.toLowerCase() === resetEmail.toLowerCase());
        if (!exists) {
            showToast('Email address not found in our system.', 'error');
            return;
        }
    } catch (_err) {
        showToast('Unable to validate email right now. Please try again.', 'error');
        return;
    }

    document.getElementById('reset-success-msg').classList.remove('hidden');
    setTimeout(() => {
        forgotModal.classList.add('hidden');
        document.getElementById('reset-success-msg').classList.add('hidden');
        document.getElementById('reset-email').value = '';
    }, 2500);
});

// ---- Form submit ----
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailVal    = document.getElementById('email-input').value.trim();
    const passwordVal = document.getElementById('password-input').value;

    const emailInput  = document.getElementById('email-input');
    const pwInput     = document.getElementById('password-input');
    const emailErr    = document.getElementById('email-error');
    const passwordErr = document.getElementById('password-error');

    // Reset errors
    emailInput.classList.remove('input-error');
    pwInput.classList.remove('input-error');
    emailErr.classList.remove('show');
    passwordErr.classList.remove('show');

    let valid = true;
    if (!emailVal) {
        emailInput.classList.add('input-error');
        emailErr.classList.add('show');
        valid = false;
    }
    if (!passwordVal) {
        pwInput.classList.add('input-error');
        passwordErr.textContent = 'Please enter your password.';
        passwordErr.classList.add('show');
        valid = false;
    }
    if (!valid) return;

    let auth = null;
    try {
        auth = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: emailVal.toLowerCase(), password: passwordVal }),
        }, 'manager');
    } catch (_err) {
        pwInput.classList.add('input-error');
        passwordErr.textContent = 'Invalid email or password. Please try again.';
        passwordErr.classList.add('show');
        showToast('Login failed. Check your credentials.', 'error');
        return;
    }

    if (!auth?.user || auth.user.role !== 'manager' || auth.user.status !== 'active') {
        pwInput.classList.add('input-error');
        passwordErr.textContent = 'Invalid email or password. Please try again.';
        passwordErr.classList.add('show');
        showToast('Login failed. Check your credentials.', 'error');
        return;
    }

    // Success - Load the correct user context
    StorageManager.login(emailVal, auth.access_token);
    
    const btn = document.getElementById('login-btn');
    btn.textContent = 'Logging in…';
    btn.disabled = true;
    showToast('Login successful! Redirecting…');
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
});

// Demo helper kept but without hardcoded credentials
document.getElementById('demo-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Use a registered manager account to log in.', 'info');
});

// Social Login Simulation
document.querySelectorAll('.btn-social').forEach(btn => {
    btn.addEventListener('click', () => {
        const provider = btn.innerText.includes('Google') ? 'Google' : 'Apple';
        showToast(`<i class="ph ph-circle-notch ph-spin" style="margin-right: 8px;"></i> Establishing secure connection with ${provider}...`, 'info');
    });
});



