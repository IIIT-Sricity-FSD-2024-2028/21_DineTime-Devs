class UIRenderer {
    static renderProfile(profile) {
        document.getElementById('profile-name').innerText = profile.name;
        document.getElementById('profile-email').innerText = profile.email;
        document.getElementById('profile-phone').innerText = profile.phone;
        document.getElementById('profile-city').innerText = profile.city;
        document.getElementById('profile-rest').innerText = profile.restaurantName;
        document.getElementById('profile-member').innerText = profile.memberSince;

        const avatarCircle = document.querySelector('.avatar-circle');
        const removeBtn = document.getElementById('remove-photo-btn');
        if (avatarCircle) {
            if (profile.avatar) {
                avatarCircle.innerHTML = `<img src="${profile.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                if(removeBtn) removeBtn.style.display = 'inline-flex';
            } else {
                avatarCircle.innerHTML = `<i class="ph ph-user"></i>`;
                if(removeBtn) removeBtn.style.display = 'none';
            }
        }
    }

    static renderRestaurantDetails(rest) {
        document.getElementById('rest-name').innerText = rest.name;
        document.getElementById('rest-about-text').innerText = rest.about;
        document.getElementById('rest-cuisine').innerText = rest.cuisine;
        document.getElementById('rest-capacity').innerText = rest.capacity;
        document.getElementById('rest-location').innerText = rest.location;
        document.getElementById('rest-hours').innerText = rest.hours;
        document.getElementById('rest-parking').innerText = rest.parking;
        document.getElementById('rest-rating').innerHTML = rest.rating
            ? `<i class="ph-fill ph-star" style="color: #F59E0B;"></i> ${rest.rating}`
            : 'No ratings yet';
        document.getElementById('rest-dress').innerText = rest.dressCode;
        document.getElementById('rest-contact').innerText = rest.contact;
        document.getElementById('rest-fee-per-guest').innerText = `₹${rest.reservationFeePerGuest ?? 0} / guest`;
        document.getElementById('rest-cancellation-cutoff').innerText = `${rest.cancellationCutoffMinutes ?? 0} minutes before`;
        document.getElementById('rest-no-show-grace').innerText = `${rest.noShowGraceMinutes ?? 0} minutes after`;

        const imgEl = document.getElementById('rest-profile-img');
        const emptyEl = document.getElementById('rest-img-empty');
        const removeEl = document.getElementById('rest-img-remove');
        
        if (imgEl && emptyEl && removeEl) {
            if (rest.image) {
                imgEl.src = rest.image;
                imgEl.onerror = function onErr() {
                    this.onerror = null;
                    this.src = 'images/restaurant.jpg';
                };
                imgEl.style.display = 'block';
                emptyEl.style.display = 'none';
                removeEl.style.display = 'flex';
            } else {
                imgEl.src = '';
                imgEl.style.display = 'none';
                emptyEl.style.display = 'flex';
                removeEl.style.display = 'none';
            }
        }
    }

    static renderPolicies(policies) {
        const container = document.querySelector('.policies-grid');
        if (container) {
            container.innerHTML = policies.map((pol, index) => `
                <div class="policy-item" data-index="${index}" style="position: relative;">
                    <div class="delete-policy-btn" style="position: absolute; top: -10px; right: -10px; width: 24px; height: 24px; background: #EF4444; color: white; border-radius: 50%; display: none; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">
                        <i class="ph ph-x"></i>
                    </div>
                    <h5>${pol.title}</h5>
                    <p>${pol.desc}</p>
                </div>
            `).join('');
        }
    }


    static renderGallery(images) {
        const container = document.querySelector('.gallery-grid');
        if (container) {
            if (images.length === 0) {
                container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); padding: 20px; text-align: center; border: 1px dashed var(--border-color); border-radius: 8px;">No images uploaded yet.</div>`;
                return;
            }
            container.innerHTML = images.map((imgSrc, index) => `
                <div class="gallery-item" style="position: relative; overflow: hidden; border-radius: 8px;">
                    <button class="delete-gallery-btn" data-index="${index}" style="position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; z-index: 10; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); transition: 0.2s;">
                        <i class="ph ph-trash" style="font-size: 14px;"></i>
                    </button>
                    <img src="${imgSrc}" alt="Gallery" onerror="this.onerror=null;this.src='images/gallery-1.jpg';">
                </div>
            `).join('');
            
            // Bind deletion handlers
            container.querySelectorAll('.delete-gallery-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                    
                    if (window.showConfirm) {
                        window.showConfirm("Are you sure you want to remove this image from the gallery?", () => {
                            const data = StorageManager.getData();
                            data.gallery.splice(idx, 1);
                            StorageManager.saveData(data);
                            StorageManager.updateRestaurantDetails({});
                            
                            // Show global toast if it exists natively in scope or window
                            if(typeof showToast === 'function') {
                                showToast('Image removed from gallery.', 'success');
                            } else if(window.showToast) {
                                window.showToast('Image removed from gallery.', 'success');
                            }
                            
                            this.renderGallery(data.gallery);
                        }, "Remove Image", "Remove");
                    }
                });
            });
        }
    }

    static renderActivity(activity) {
        document.getElementById('act-res-val').innerText = activity.reservations;
        document.getElementById('act-tbl-val').innerText = activity.availableTables;
        document.getElementById('act-rtg-val').innerHTML = `${activity.avgRating} <i class="ph-fill ph-star" style="color: #F59E0B;"></i>`;
    }

    static renderAll(data) {
        this.renderProfile(data.profile);
        this.renderRestaurantDetails(data.restaurant);
        this.renderPolicies(data.policies);
        this.renderGallery(data.gallery);
        this.renderActivity(data.activity);
    }
}
