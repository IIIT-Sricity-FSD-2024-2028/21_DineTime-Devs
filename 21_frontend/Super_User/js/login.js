
document.addEventListener('DOMContentLoaded', function() {
    const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';
    const loginForm = document.getElementById('superLoginForm');
    const errorMsg = document.getElementById('login-error-msg');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const emailInput = document.getElementById('superEmail').value.trim().toLowerCase();
            const passInput = document.getElementById('superPassword').value.trim();

            try {
                const response = await fetch(`${API_BASE}/super-admin/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: emailInput,
                        password: passInput,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Invalid credentials');
                }

                const payload = await response.json();
                const user = payload?.data;

                sessionStorage.setItem('super_auth_status', 'true');
                sessionStorage.setItem('super_access_token', user.access_token || '');
                sessionStorage.setItem('super_admin_profile', JSON.stringify({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                }));
                window.location.href = 'super-dashboard.html';
            } catch (error) {
                showError();
            }
        });
    }

    function showError() {
        if (!errorMsg) return;
        errorMsg.classList.remove('hidden');

        errorMsg.style.animation = 'none';
        errorMsg.offsetHeight;
        errorMsg.style.animation = null;

        setTimeout(function() {
            errorMsg.classList.add('hidden');
        }, 3000);
    }
});
