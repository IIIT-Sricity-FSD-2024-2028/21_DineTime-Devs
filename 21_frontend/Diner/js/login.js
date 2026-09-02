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

    const loginForm = document.getElementById('login-form');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');

    // Toggle Password Visibility
    if (togglePasswordBtn && passwordInput && eyeIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle Icon
            eyeIcon.classList.toggle('ph-eye');
            eyeIcon.classList.toggle('ph-eye-slash');
        });
    }

    // Form Submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value.trim();
            const errorMsg = document.getElementById('login-error-msg');
            errorMsg.classList.add('hidden');

            try {
                const auth = await apiRequest('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password }),
                }, 'diner');
                const diner = auth?.user;

                if (!diner || diner.role !== 'diner' || diner.status !== 'active') {
                    errorMsg.classList.remove('hidden');
                    setTimeout(() => errorMsg.classList.add('hidden'), 3500);
                    return;
                }

                DinetimeStore.setUser({
                    name: diner.name,
                    email: diner.email,
                    location: 'Bangalore',
                    city: 'Bangalore',
                    country: 'India',
                    avatar: '../images/icon-profile.png',
                    backend_user_id: diner.id,
                    access_token: auth.access_token,
                    role: diner.role,
                    photo_url: diner.photo_url,
                    photo: diner.photo_url ? `${API_BASE}${diner.photo_url}` : undefined,
                });
            } catch (_e) {
                errorMsg.classList.remove('hidden');
                setTimeout(() => errorMsg.classList.add('hidden'), 3500);
                return;
            }

            const btn = loginForm.querySelector('.btn-login');
            const originalText = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Logging in...';

            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                
                // Redirect to browse.html on exact match only
                window.location.href = 'browse.html';
            }, 1000);
        });
    }


    // Social Login Simulation
    const socialBtns = document.querySelectorAll('.btn-social');
    const toastMsg = document.getElementById('login-error-msg');
    
    function showSocialToast(provider) {
        if (!toastMsg) return;
        
        const originalHTML = toastMsg.innerHTML;
        toastMsg.classList.remove('hidden');
        toastMsg.classList.add('social-toast');
        toastMsg.innerHTML = `<i class="ph ph-circle-notch"></i> Establishing secure connection with ${provider}...`;
        
        setTimeout(() => {
            toastMsg.classList.add('hidden');
            toastMsg.classList.remove('social-toast');
            toastMsg.innerHTML = originalHTML;
        }, 3000);
    }

    socialBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.innerText.includes('Google') ? 'Google' : 'Apple';
            showSocialToast(provider);
        });
    });

    // Demo Login Link
    const demoBtn = document.getElementById('demo-login-btn');
    if (demoBtn) {
        demoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const errorMsg = document.getElementById('login-error-msg');
            if (errorMsg) {
                errorMsg.classList.remove('hidden');
                errorMsg.innerText = 'Use a real backend diner account to sign in.';
                setTimeout(() => errorMsg.classList.add('hidden'), 2500);
            }
        });
    }

    // Forgot Password Modal Logic
    const forgotModal = document.getElementById('forgotPasswordModal');
    const linkForgotPassword = document.getElementById('linkForgotPassword');
    const closeForgotModal = document.getElementById('closeForgotModal');
    const forgotForm = document.getElementById('forgot-password-form');
    const resetSuccessMsg = document.getElementById('reset-success-msg');

    if (linkForgotPassword && forgotModal) {
        linkForgotPassword.addEventListener('click', (e) => {
            e.preventDefault();
            forgotModal.classList.remove('hidden');
            resetSuccessMsg.classList.add('hidden');
            forgotForm.style.display = 'block';
            forgotForm.reset();
        });
        
        closeForgotModal.addEventListener('click', () => {
            forgotModal.classList.add('hidden');
        });

        // Close when clicking outside content
        forgotModal.addEventListener('click', (e) => {
            if (e.target === forgotModal) {
                forgotModal.classList.add('hidden');
            }
        });

        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = forgotForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Sending...';

            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                forgotForm.style.display = 'none';
                resetSuccessMsg.classList.remove('hidden');
                
                // Hide modal automatically after 3 seconds
                setTimeout(() => {
                    forgotModal.classList.add('hidden');
                }, 3000);
            }, 1000);
        });
    }
});
