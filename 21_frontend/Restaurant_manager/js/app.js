document.addEventListener('DOMContentLoaded', async () => {
    await StorageManager.ready();
    // 1. Initial data load
    const appData = StorageManager.getData();
    UIRenderer.renderAll(appData);

    // ---- Toast Notification System ----
    const toastContainer = document.getElementById('toast-container');
    window.showToast = function(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let iconClass = type === 'error' ? 'ph-warning-circle' : (type === 'success' ? 'ph-check-circle' : 'ph-info');
        toast.innerHTML = `<i class="ph ${iconClass} toast-icon"></i><span class="toast-message">${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    };

    // ---- Tab Switching Logic ----
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            button.classList.add('active');
            const targetId = button.getAttribute('data-target');
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
        });
    });

    // ---- Button visual feedback ----
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousedown', function() { this.style.transform = 'scale(0.98)'; });
        btn.addEventListener('mouseup', function() { this.style.transform = 'scale(1)'; });
        btn.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
    });

    // ---- File Upload Triggers ----
    const photoUploadInput = document.getElementById('photo-upload-input');
    document.getElementById('upload-photo-btn')?.addEventListener('click', () => photoUploadInput?.click());
    
    document.getElementById('remove-photo-btn')?.addEventListener('click', () => {
        window.showConfirm("Are you sure you want to remove your profile photo?", () => {
            StorageManager.updateProfile({ avatar: null });
            UIRenderer.renderProfile(StorageManager.getData().profile);
            showToast('Profile photo removed.', 'info');
        }, "Remove Photo", "Remove");
    });

    photoUploadInput?.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                await StorageManager.uploadProfilePhoto(file);
                UIRenderer.renderProfile(StorageManager.getData().profile);
                showToast('Profile photo updated successfully!');
            } catch (error) {
                showToast(error.message || 'Profile photo upload failed.', 'error');
            } finally {
                e.target.value = '';
            }
        }
    });

    // ---- Restaurant Image Upload Triggers ----
    const restImgUploadInput = document.getElementById('rest-img-upload');
    const restImgRemoveBtn = document.getElementById('rest-img-remove');
    
    restImgUploadInput?.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                await StorageManager.uploadRestaurantImage(file, true);
                const data = StorageManager.getData();
                UIRenderer.renderRestaurantDetails(data.restaurant);
                UIRenderer.renderGallery(data.gallery || []);
                showToast('Restaurant profile photo updated!');
            } catch (error) {
                showToast(error.message || 'Restaurant photo upload failed.', 'error');
            } finally {
                e.target.value = '';
            }
        }
    });

    restImgRemoveBtn?.addEventListener('click', () => {
        if (window.showConfirm) {
            window.showConfirm("Are you sure you want to remove the restaurant photo?", () => {
                const data = StorageManager.getData();
                const removedImage = data.restaurant.image;
                data.restaurant.image = null;
                data.gallery = (data.gallery || []).filter((image) => image !== removedImage);
                StorageManager.saveData(data);
                StorageManager.updateRestaurantDetails({});
                UIRenderer.renderRestaurantDetails(data.restaurant);
                UIRenderer.renderGallery(data.gallery || []);
                showToast('Restaurant photo removed.', 'info');
            }, "Remove Photo", "Remove");
        }
    });

    const galleryUploadInput = document.getElementById('gallery-upload-input');
    document.getElementById('upload-images-btn')?.addEventListener('click', () => galleryUploadInput?.click());
    galleryUploadInput?.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            try {
                for (const file of files) {
                    await StorageManager.uploadRestaurantImage(file, false);
                }
                const data = StorageManager.getData();
                if (document.querySelector('.gallery-grid')) {
                    UIRenderer.renderGallery(data.gallery || []);
                }
                UIRenderer.renderRestaurantDetails(data.restaurant);
                showToast(`${files.length} images added to gallery.`);
            } catch (error) {
                showToast(error.message || 'Gallery upload failed.', 'error');
            } finally {
                e.target.value = '';
            }
        }
    });

    // ---- Edit Profile Logic (Simulated CRUD) ----
    const editProfileBtn = document.getElementById('edit-profile-btn');
    let isEditingProfile = false;

    // Helper to append a cancel button and wrap them in a flex container dynamically
    function attachCancelBtn(saveBtn, discardAction) {
        if (!saveBtn.parentElement.classList.contains('actions-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'actions-wrapper';
            wrapper.style.display = 'flex';
            wrapper.style.gap = '8px';
            saveBtn.parentNode.insertBefore(wrapper, saveBtn);
            wrapper.appendChild(saveBtn);
        }
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-small';
        cancelBtn.style.backgroundColor = '#F1F5F9';
        cancelBtn.style.color = 'var(--text-dark)';
        cancelBtn.style.border = '1px solid #E2E8F0';
        cancelBtn.innerHTML = 'Cancel';
        cancelBtn.onclick = () => {
            discardAction();
            cancelBtn.remove();
        };
        saveBtn.parentElement.insertBefore(cancelBtn, saveBtn);
        return cancelBtn;
    }

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            if (!isEditingProfile) {
                // Switch to Edit Mode
                ['profile-name', 'profile-email', 'profile-phone', 'profile-city', 'profile-rest'].forEach(id => {
                    const el = document.getElementById(id);
                    el.innerHTML = `<input type="text" class="editable-input" value="${el.innerText}">`;
                });
                
                editProfileBtn.classList.replace('btn-primary-orange', 'btn-primary-green');
                editProfileBtn.innerHTML = '<i class="ph ph-check"></i><span>Save Profile</span>';
                
                // Add Cancel Option
                editProfileBtn.cancelNode = attachCancelBtn(editProfileBtn, () => {
                    UIRenderer.renderProfile(StorageManager.getData().profile);
                    editProfileBtn.classList.replace('btn-primary-green', 'btn-primary-orange');
                    editProfileBtn.innerHTML = '<i class="ph ph-pencil-simple"></i><span>Edit Profile</span>';
                    isEditingProfile = false;
                });
                
                isEditingProfile = true;
            } else {
                // Save Changes
                const nameInput = document.getElementById('profile-name').querySelector('input');
                const emailInput = document.getElementById('profile-email').querySelector('input');
                const phoneInput = document.getElementById('profile-phone').querySelector('input');
                const cityInput = document.getElementById('profile-city').querySelector('input');
                const restInput = document.getElementById('profile-rest').querySelector('input');

                const name = nameInput.value.trim();
                const email = emailInput.value.trim();
                const phone = phoneInput.value.trim();
                const city = cityInput.value.trim();
                const restName = restInput.value.trim();

                // Validation Rules
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const phoneRegex = /^\d{10}$/;

                let isValid = true;
                let errorMsg = '';
                let firstInvalidField = null;

                // Reset error highlights
                [nameInput, emailInput, phoneInput, cityInput, restInput].forEach(input => {
                    input.classList.remove('input-error');
                });

                if (!name || name.length < 2) {
                    errorMsg = 'Full Name must be at least 2 characters.';
                    nameInput.classList.add('input-error');
                    isValid = false;
                    firstInvalidField = nameInput;
                } else if (!email || !emailRegex.test(email)) {
                    errorMsg = 'Please enter a valid email address.';
                    emailInput.classList.add('input-error');
                    isValid = false;
                    firstInvalidField = emailInput;
                } else if (!phone || !phoneRegex.test(phone.replace(/\D/g, ''))) {
                    errorMsg = 'Phone number must be exactly 10 digits.';
                    phoneInput.classList.add('input-error');
                    isValid = false;
                    firstInvalidField = phoneInput;
                } else if (!city) {
                    errorMsg = 'City is required.';
                    cityInput.classList.add('input-error');
                    isValid = false;
                    firstInvalidField = cityInput;
                } else if (!restName) {
                    errorMsg = 'Restaurant Name is required.';
                    restInput.classList.add('input-error');
                    isValid = false;
                    firstInvalidField = restInput;
                }

                if (!isValid) {
                    showToast(errorMsg, 'error');
                    if (firstInvalidField) {
                        firstInvalidField.focus();
                        firstInvalidField.addEventListener('input', () => {
                            firstInvalidField.classList.remove('input-error');
                        }, { once: true });
                    }
                    return;
                }

                const updates = {
                    name,
                    email,
                    phone: phone.replace(/\D/g, ''),
                    city,
                    restaurantName: restName
                };
                
                // Save updated profile
                StorageManager.updateProfile(updates);
                
                // Re-render UI from updated storage
                UIRenderer.renderProfile(StorageManager.getData().profile);
                
                // Remove cancel button
                if (editProfileBtn.cancelNode) editProfileBtn.cancelNode.remove();
                
                // Revert Button Style
                editProfileBtn.classList.replace('btn-primary-green', 'btn-primary-orange');
                editProfileBtn.innerHTML = '<i class="ph ph-pencil-simple"></i><span>Edit Profile</span>';
                isEditingProfile = false;
                showToast('Profile updated successfully!');
            }
        });
    }

    // ---- Edit Restaurant Details Logic (Simulated CRUD) ----
    const editRestBtn = document.getElementById('edit-rest-btn');
    let isEditingRest = false;
    
    if (editRestBtn) {
        editRestBtn.addEventListener('click', () => {
            const fields = [
                {id: 'rest-name'}, {id: 'rest-about-text', isTextArea: true},
                {id: 'rest-cuisine'}, {id: 'rest-capacity'}, {id: 'rest-location'},
                {id: 'rest-hours'}, {id: 'rest-parking'}, {id: 'rest-dress'},
                {id: 'rest-contact'}

            ];
            
            if (!isEditingRest) {
                fields.forEach(field => {
                    const el = document.getElementById(field.id);
                    if (field.isTextArea) {
                        el.innerHTML = `<textarea class="editable-input" style="height: 80px; resize: vertical;">${el.innerText}</textarea>`;
                    } else {
                        el.innerHTML = `<input type="text" class="editable-input" value="${el.innerText}">`;
                    }
                });
                
                editRestBtn.classList.replace('btn-primary-orange', 'btn-primary-green');
                editRestBtn.innerHTML = '<i class="ph ph-check"></i><span>Save Details</span>';
                
                editRestBtn.cancelNode = attachCancelBtn(editRestBtn, () => {
                    UIRenderer.renderRestaurantDetails(StorageManager.getData().restaurant);
                    editRestBtn.classList.replace('btn-primary-green', 'btn-primary-orange');
                    editRestBtn.innerHTML = '<i class="ph ph-pencil-simple"></i><span>Edit Restaurant Details</span>';
                    isEditingRest = false;
                });
                
                isEditingRest = true;
            } else {
                // Collect inputs for validation
                const nameInput = document.getElementById('rest-name').querySelector('input');
                const aboutInput = document.getElementById('rest-about-text').querySelector('textarea');
                const cuisineInput = document.getElementById('rest-cuisine').querySelector('input');
                const capacityInput = document.getElementById('rest-capacity').querySelector('input');
                const locationInput = document.getElementById('rest-location').querySelector('input');
                const hoursInput = document.getElementById('rest-hours').querySelector('input');
                const parkingInput = document.getElementById('rest-parking').querySelector('input');
                const dressInput = document.getElementById('rest-dress').querySelector('input');
                const contactInput = document.getElementById('rest-contact').querySelector('input');

                const name = nameInput.value.trim();
                const about = aboutInput.value.trim();
                const cuisine = cuisineInput.value.trim();
                const capacity = capacityInput.value.trim();
                const location = locationInput.value.trim();
                const hours = hoursInput.value.trim();
                const parking = parkingInput.value.trim();
                const dressCode = dressInput.value.trim();
                const contact = contactInput.value.trim();

                // Validation Rules
                let isValid = true;
                let errorMsg = '';
                let firstInvalidField = null;

                // Reset highlights
                [nameInput, aboutInput, cuisineInput, capacityInput, locationInput, hoursInput, parkingInput, dressInput, contactInput].forEach(inp => {
                    inp.classList.remove('input-error');
                });

                const phoneRegex = /^\d{10}$/;

                if (!name || name.length < 2) {
                    errorMsg = 'Restaurant Name must be at least 2 characters.';
                    isValid = false; firstInvalidField = nameInput;
                } else if (!about || about.length < 10) {
                    errorMsg = 'About section should be at least 10 characters.';
                    isValid = false; firstInvalidField = aboutInput;
                } else if (!cuisine) {
                    errorMsg = 'Cuisine Type is required.';
                    isValid = false; firstInvalidField = cuisineInput;
                } else if (!capacity) {
                    errorMsg = 'Seating Capacity is required.';
                    isValid = false; firstInvalidField = capacityInput;
                } else if (!location) {
                    errorMsg = 'Location is required.';
                    isValid = false; firstInvalidField = locationInput;
                } else if (!hours) {
                    errorMsg = 'Opening Hours are required.';
                    isValid = false; firstInvalidField = hoursInput;
                } else if (!parking) {
                    errorMsg = 'Parking information is required.';
                    isValid = false; firstInvalidField = parkingInput;
                } else if (!dressCode) {
                    errorMsg = 'Dress Code is required.';
                    isValid = false; firstInvalidField = dressInput;
                } else if (!contact || !phoneRegex.test(contact.replace(/\D/g, ''))) {
                    errorMsg = 'Contact number must be exactly 10 digits.';
                    isValid = false; firstInvalidField = contactInput;
                }

                if (!isValid) {
                    showToast(errorMsg, 'error');
                    if (firstInvalidField) {
                        firstInvalidField.classList.add('input-error');
                        firstInvalidField.focus();
                        firstInvalidField.addEventListener('input', () => {
                            firstInvalidField.classList.remove('input-error');
                        }, { once: true });
                    }
                    return;
                }

                // Collect updates
                const updates = {
                    name, about, cuisine, capacity, location, hours, parking, dressCode,
                    contact: contact.replace(/\D/g, '')
                };
                
                StorageManager.updateRestaurantDetails(updates);
                UIRenderer.renderRestaurantDetails(StorageManager.getData().restaurant);
                
                if (editRestBtn.cancelNode) editRestBtn.cancelNode.remove();
                
                editRestBtn.classList.replace('btn-primary-green', 'btn-primary-orange');
                editRestBtn.innerHTML = '<i class="ph ph-pencil-simple"></i><span>Edit Restaurant Details</span>';
                isEditingRest = false;
                showToast('Restaurant details saved!');
            }
        });
    }

    // ---- Edit Policies Logic (Simulated CRUD) ----
    const editPoliciesBtn = document.getElementById('edit-policies-btn');
    let isEditingPolicies = false;

    if (editPoliciesBtn) {
        editPoliciesBtn.addEventListener('click', () => {
            const policyItems = document.querySelectorAll('.policy-item');
            
            if (!isEditingPolicies) {
                policyItems.forEach(item => {
                    const p = item.querySelector('p');
                    const h5 = item.querySelector('h5');
                    h5.innerHTML = `<input type="text" class="editable-input" style="font-weight:bold" value="${h5.innerText}">`;
                    p.innerHTML = `<textarea class="editable-input" style="height: 60px; resize: vertical;">${p.innerText}</textarea>`;
                });
                
                editPoliciesBtn.classList.replace('btn-primary-orange', 'btn-primary-green');
                editPoliciesBtn.innerHTML = '<i class="ph ph-check"></i><span>Save Policies</span>';

                // Show delete buttons
                document.querySelectorAll('.delete-policy-btn').forEach(btn => btn.style.display = 'flex');

                
                editPoliciesBtn.cancelNode = attachCancelBtn(editPoliciesBtn, () => {
                    UIRenderer.renderPolicies(StorageManager.getData().policies);
                    document.querySelectorAll('.delete-policy-btn').forEach(btn => btn.style.display = 'none');
                    editPoliciesBtn.classList.replace('btn-primary-green', 'btn-primary-orange');
                    editPoliciesBtn.innerHTML = '<i class="ph ph-pencil-simple"></i><span>Edit Policies</span>';
                    isEditingPolicies = false;
                });

                
                isEditingPolicies = true;
            } else {
                const newPolicies = Array.from(policyItems).map(item => {
                    return {
                        title: item.querySelector('h5 input').value,
                        desc: item.querySelector('p textarea').value
                    };
                });
                
                StorageManager.updatePolicies(newPolicies);
                UIRenderer.renderPolicies(StorageManager.getData().policies);
                document.querySelectorAll('.delete-policy-btn').forEach(btn => btn.style.display = 'none');
                
                if (editPoliciesBtn.cancelNode) editPoliciesBtn.cancelNode.remove();

                
                editPoliciesBtn.classList.replace('btn-primary-green', 'btn-primary-orange');
                editPoliciesBtn.innerHTML = '<i class="ph ph-pencil-simple"></i><span>Edit Policies</span>';
                isEditingPolicies = false;
                showToast('Policies updated successfully!');
            }
        });
    }

    // Add New Policy Logic
    const addPolicyBtn = document.getElementById('add-policy-btn');
    if (addPolicyBtn) {
        addPolicyBtn.addEventListener('click', () => {
            const currentData = StorageManager.getData();
            if (!currentData.policies) currentData.policies = [];
            
            const newPolicy = { title: "New Policy", desc: "Policy description goes here." };
            currentData.policies.push(newPolicy);
            
            // Critical: Save first to ensure the new item is persistent
            StorageManager.updatePolicies(currentData.policies);
            
            // Force pure re-render from storage to clear any stale DOM
            UIRenderer.renderPolicies(StorageManager.getData().policies);
            
            // Enter edit mode specifically for policies

            if (!isEditingPolicies) {
                editPoliciesBtn.click();
            } else {
                // If already editing, we need to refresh the inputs for the new element
                isEditingPolicies = false; 
                editPoliciesBtn.click(); 
            }
            
            showToast('New policy placeholder added. Edit it now!');
        });
    }


    // Global Event Delegation for Dynamic Deletes
    document.addEventListener('click', (e) => {
        if (e.target.closest('.delete-policy-btn')) {
            window.showConfirm("Are you sure you want to remove this policy?", () => {
                const index = parseInt(e.target.closest('.policy-item').getAttribute('data-index'));
                const currentData = StorageManager.getData();
                currentData.policies.splice(index, 1);
                StorageManager.updatePolicies(currentData.policies);
                UIRenderer.renderPolicies(currentData.policies);
                // Re-enter edit mode if we were in it
                if (isEditingPolicies) {
                    isEditingPolicies = false; // reset so click() triggers it correctly
                    editPoliciesBtn.click();
                }
                showToast('Policy removed.', 'info');
            }, "Remove Policy", "Remove");
        }
    });


    // Misc Actions
    document.getElementById('manage-staff-btn')?.addEventListener('click', () => {
        window.location.href = 'staff.html';
    });
    document.querySelectorAll('.header-actions .icon-btn').forEach(icon => {
        if (icon.id === 'notification-btn') return;
        if (icon.getAttribute('aria-label') === 'Logout') {
            icon.addEventListener('click', () => {
                window.location.href = 'login.html';
            });
        } else {
            icon.addEventListener('click', () => showToast(`Opening ${icon.getAttribute('aria-label')}...`, 'info'));
        }
    });

    // ---- Notification Dropdown Logic ----
    const notifBtn = document.getElementById('notification-btn');
    const notifDropdown = document.getElementById('notification-dropdown');
    const notifList = document.getElementById('notification-list');
    const notifBadge = notifBtn ? notifBtn.querySelector('.notification-badge') : null;

    function renderNotifications() {
        const notifications = StorageManager.getNotifications();
        if (!notifList) return;

        const unreadCount = notifications.filter(n => !n.read).length;
        if (notifBadge) {
            notifBadge.textContent = unreadCount;
            notifBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }

        notifList.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
                <div class="notif-icon ${n.bgClass}">
                    <i class="ph ${n.icon} ${n.iconColor}"></i>
                </div>
                <div class="notif-content">
                    <p>${n.text}</p>
                    <span class="notif-time">${n.time}</span>
                </div>
            </div>
        `).join('');
    }

    // Initial render
    renderNotifications();

    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('show');
        });

        // Mark all as read
        const markReadBtn = notifDropdown.querySelector('.mark-read-btn');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                StorageManager.markAllNotificationsRead();
                renderNotifications();
            });
        }

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                notifDropdown.classList.remove('show');
            }
        });
    }
});

