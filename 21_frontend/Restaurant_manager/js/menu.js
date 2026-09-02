document.addEventListener('DOMContentLoaded', async () => {
    await StorageManager.ready();
    // ---- Toast System (Duplicated for multi-page simplicity) ----
    const toastContainer = document.getElementById('toast-container');
    window.showToast = function(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        let iconClass = type === 'success' ? 'ph-check-circle' : 'ph-info';
        if (type === 'error') iconClass = 'ph-trash';
        toast.innerHTML = `<i class="ph ${iconClass} toast-icon"></i><span class="toast-message">${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    };

    const menuContainer = document.getElementById('menu-list-container');
    
    // ---- Modal Elements ----
    const modal = document.getElementById('add-item-modal');
    const addBtn = document.getElementById('add-menu-btn');
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-modal-btn');
    const form = document.getElementById('add-menu-form');

    // ---- Grouping Helper ----
    function groupBy(array, key) {
        return array.reduce((result, currentValue) => {
            (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
            return result;
        }, {});
    }

    // ---- Formatting Helper ----
    function formatPrice(number) {
        return "₹" + number.toString();
    }

    // ---- Render Core ----
    function renderMenu() {
        const items = StorageManager.getMenu();

        if (addBtn) {
            addBtn.style.display = 'flex';
        }

        if (items.length === 0) {

            menuContainer.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 48px 24px; margin-top: 24px; text-align: center; color: var(--text-muted); background: white; border-radius: 12px; border: 2px dashed #E2E8F0;">
                    <i class="ph ph-fork-knife" style="font-size: 32px; color: #CBD5E1; margin-bottom: 8px;"></i>
                    <p style="font-size: 15px;">No menu items added yet.</p>
                </div>
            `;
            return;
        }

        const grouped = groupBy(items, 'category');
        
        // Define desired display order
        const catOrder = ['Starters', 'Main Course', 'Desserts', 'Beverages'];

        let html = '';

        catOrder.forEach(cat => {
            const catItems = grouped[cat];
            if (!catItems || catItems.length === 0) return;

            html += `
                <div class="category-group">
                    <h5 class="category-title">${cat}</h5>
                    <table class="menu-table">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Availability</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${catItems.map(item => {
                                const isAvail = item.available !== false;
                                return `
                                <tr>
                                    <td style="width: 70px;">
                                        <img src="${item.image}" alt="${item.name}" class="menu-item-img" onerror="this.onerror=null;this.src='images/dish-1.jpg';">
                                    </td>
                                    <td>
                                        <div class="item-name">${item.name}</div>
                                    </td>
                                    <td>
                                        <div class="item-cat">${item.category}</div>
                                    </td>
                                    <td>
                                        <div class="item-price">${formatPrice(item.price)}</div>
                                    </td>
                                    <td>
                                        <span class="avail-badge toggle-avail-btn ${isAvail ? 'avail-true' : 'avail-false'}" data-id="${item.id}">
                                            ${isAvail ? 'Available' : 'Unavailable'}
                                        </span>
                                    </td>
                                    <td style="text-align: right;">
                                        <div class="menu-actions" style="justify-content: flex-end;">
                                            <i class="ph ph-pencil-simple action-icon edit edit-icon" data-id="${item.id}"></i>
                                            <i class="ph ph-trash action-icon delete delete-icon" data-id="${item.id}"></i>
                                        </div>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        menuContainer.innerHTML = html;
        attachListeners();
    }

    function attachListeners() {
        // Toggle Availability
        document.querySelectorAll('.toggle-avail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                StorageManager.toggleMenuAvailability(id);
                renderMenu();
                showToast(`Item availability updated.`, 'info');
            });
        });

        // Delete Item
        document.querySelectorAll('.delete-icon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                window.showConfirm("Are you sure you want to delete this menu item?", () => {
                    StorageManager.deleteMenuItem(id);
                    renderMenu();
                    showToast(`Item successfully removed from menu.`, 'error');
                });
            });
        });

        // Edit Item
        document.querySelectorAll('.edit-icon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const menu = StorageManager.getMenu();
                const item = menu.find(m => m.id === id);
                
                if (item) {
                    // Pre-fill form
                    document.getElementById('modal-title').innerText = "Edit Menu Item";
                    document.getElementById('edit-item-id').value = item.id;
                    document.getElementById('new-item-name').value = item.name;
                    document.getElementById('new-item-cat').value = item.category;
                    document.getElementById('new-item-price').value = item.price;
                    
                    // Show modal
                    modal.style.display = 'flex';
                }
            });
        });
    }

    // ---- Modal Logic ----
    addBtn.addEventListener('click', () => {
        form.reset();
        document.getElementById('modal-title').innerText = "Add New Menu Item";
        document.getElementById('edit-item-id').value = "";
        modal.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    cancelBtn.addEventListener('click', () => modal.style.display = 'none');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const editingId = document.getElementById('edit-item-id').value;
        const newName = document.getElementById('new-item-name').value;
        const newCat = document.getElementById('new-item-cat').value;
        const newPrice = document.getElementById('new-item-price').value;
        if (Number(newPrice) > 300) {
            showToast('Price must be ₹300 or less.', 'error');
            return;
        }
        const imgInput = document.getElementById('new-item-img');
        
        const saveItem = (imgData) => {
            if (editingId) {
                // UPDATE
                const updateData = {
                    name: newName,
                    category: newCat,
                    price: Number(newPrice)
                };
                if (imgData) updateData.image = imgData;

                StorageManager.updateMenuItem(editingId, updateData);
                showToast(`${newName} updated successfully!`);
            } else {
                // ADD
                const newItem = {
                    id: 'm_' + Date.now(),
                    name: newName,
                    category: newCat,
                    price: Number(newPrice),
                    available: true,
                    image: imgData || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80"
                };

                StorageManager.addMenuItem(newItem);
                showToast(`${newName} added to the menu!`);
            }

            modal.style.display = 'none';
            renderMenu();
        };

        if (imgInput.files && imgInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => saveItem(event.target.result);
            reader.readAsDataURL(imgInput.files[0]);
        } else {
            saveItem(null);
        }
    });



    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.style.display = 'none';
    });

    // Initial render
    renderMenu();
});

