document.addEventListener('DOMContentLoaded', function () {
    const API_BASE = (window.DINETIME_CONFIG && window.DINETIME_CONFIG.API_BASE) || 'http://localhost:3000';
    const form = document.getElementById('subAdminLoginForm');
    const errorMsg = document.getElementById('loginError');

    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        errorMsg.classList.remove('show');

        const team = document.getElementById('team').value;
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_BASE}/sub-admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, team }),
            });

            if (!response.ok) {
                throw new Error('Invalid credentials');
            }

            const payload = await response.json();
            const account = payload?.data;

            sessionStorage.setItem('subadmin_auth_status', 'true');
            sessionStorage.setItem('subadmin_access_token', account.access_token || '');
            sessionStorage.setItem('subadmin_profile', JSON.stringify({
                id: account.id,
                name: account.name,
                email: account.email,
                role: account.role,
                team: account.team,
                location_id: account.location_id,
            }));

            const destinations = {
                support: 'support-dashboard.html',
                verification: 'verification-dashboard.html',
                finance: 'finance-dashboard.html',
            };
            window.location.href = destinations[account.team] || 'coming-soon.html';
        } catch (error) {
            errorMsg.classList.add('show');
        }
    });
});
