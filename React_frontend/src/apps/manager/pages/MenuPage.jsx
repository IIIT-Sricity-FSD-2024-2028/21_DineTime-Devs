import { useState } from "react";
import ManagerLayout from "../components/ManagerLayout";
import { useManager } from "../hooks/useManager";
import { useToast } from "../hooks/useToast";

const categoryOrder = ["Starters", "Main Course", "Desserts", "Beverages"];
const emptyForm = {
  id: "",
  name: "",
  category: "Starters",
  price: "",
  image: "",
  imageFile: null,
};

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MenuPage() {
  const { data, storage, refresh } = useManager();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const items = data?.menu || [];
  const grouped = (() => {
    const result = Object.fromEntries(
      categoryOrder.map((category) => [category, []]),
    );
    items.forEach((item) => {
      if (!result[item.category]) result[item.category] = [];
      result[item.category].push(item);
    });
    return result;
  })();

  const openCreate = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setForm({
      id: item.id,
      name: item.name || "",
      category: item.category || "Starters",
      price: item.price || "",
      image: item.image || "",
      imageFile: null,
    });
    setModalOpen(true);
  };

  const updateField = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

  const selectImage = async (event) => {
    const imageFile = event.target.files?.[0] || null;
    const image = await readImage(imageFile);
    setForm((current) => ({ ...current, image, imageFile }));
  };

  const toggleAvailability = async (item) => {
    try {
      await storage.toggleMenuAvailability(item.id);
      refresh();
      showToast("Item availability updated.", "info");
    } catch (error) {
      showToast(error.message || "Unable to update availability.", "error");
    }
  };

  const removeItem = async (item) => {
    if (!window.confirm("Are you sure you want to delete this menu item?"))
      return;
    try {
      await storage.deleteMenuItem(item.id);
      refresh();
      showToast("Item successfully removed from menu.", "info");
    } catch (error) {
      showToast(error.message || "Unable to delete menu item.", "error");
    }
  };

  const saveItem = async (event) => {
    event.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || !price || price > 300) {
      showToast(
        price > 300
          ? "Price must be Rs.300 or less."
          : "Please complete all required fields.",
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      const image = form.imageFile
        ? await storage.uploadMenuImage(form.imageFile)
        : form.image;
      if (form.id) {
        await storage.updateMenuItem(form.id, {
          name: form.name.trim(),
          category: form.category,
          price,
          ...(image ? { image } : {}),
        });
        showToast(`${form.name} updated successfully!`);
      } else {
        await storage.addMenuItem({
          name: form.name.trim(),
          category: form.category,
          price,
          available: true,
          image: image || "/assets/dish-1.jpg",
        });
        showToast(`${form.name} added to the menu!`);
      }
      refresh();
      setModalOpen(false);
    } catch (error) {
      showToast(error.message || "Unable to save menu item.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagerLayout
      title="Menu Management"
      description="Manage restaurant menu items and live availability."
    >
      <section className="card menu-items-card">
        <div className="menu-card-header">
          <h4>Menu Items</h4>
          <button
            className="btn btn-primary-orange"
            type="button"
            onClick={openCreate}
          >
            <i className="ph ph-plus" /> Add Menu Item
          </button>
        </div>
        {items.length === 0 ? (
          <div className="menu-empty">
            <i className="ph ph-fork-knife" />
            <p>No menu items added yet.</p>
          </div>
        ) : (
          categoryOrder
            .concat(
              Object.keys(grouped).filter(
                (category) => !categoryOrder.includes(category),
              ),
            )
            .map((category) =>
              grouped[category]?.length ? (
                <div className="category-group" key={category}>
                  <h5 className="category-title">{category}</h5>
                  <table className="menu-table">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Availability</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[category].map((item) => (
                        <tr key={item.id}>
                          <td>
                            <img
                              src={item.image || "/assets/dish-1.jpg"}
                              alt={item.name}
                              className="menu-item-img"
                            />
                          </td>
                          <td>
                            <div className="item-name">{item.name}</div>
                          </td>
                          <td>
                            <div className="item-cat">{item.category}</div>
                          </td>
                          <td>
                            <div className="item-price">Rs.{item.price}</div>
                          </td>
                          <td>
                            <button
                              className={`avail-badge ${item.available !== false ? "avail-true" : "avail-false"}`}
                              type="button"
                              onClick={() => toggleAvailability(item)}
                            >
                              {item.available !== false
                                ? "Available"
                                : "Unavailable"}
                            </button>
                          </td>
                          <td>
                            <div className="menu-actions">
                              <button
                                className="action-icon edit-icon"
                                type="button"
                                aria-label="Edit item"
                                onClick={() => openEdit(item)}
                              >
                                <i className="ph ph-pencil-simple" />
                              </button>
                              <button
                                className="action-icon delete-icon"
                                type="button"
                                aria-label="Delete item"
                                onClick={() => removeItem(item)}
                              >
                                <i className="ph ph-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null,
            )
        )}
      </section>

      {modalOpen && (
        <div
          className="modal-overlay"
          style={{ display: "flex" }}
          onMouseDown={(event) =>
            event.target === event.currentTarget && setModalOpen(false)
          }
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>{form.id ? "Edit Menu Item" : "Add New Menu Item"}</h3>
              <button
                className="icon-btn modal-close"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={saveItem}>
                <div className="form-group">
                  <label htmlFor="menu-name">Item Name</label>
                  <input
                    id="menu-name"
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    required
                    placeholder="e.g. Samosa Chaat"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="menu-category">Category</label>
                    <select
                      id="menu-category"
                      name="category"
                      value={form.category}
                      onChange={updateField}
                    >
                      <option>Starters</option>
                      <option>Main Course</option>
                      <option>Desserts</option>
                      <option>Beverages</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="menu-price">Price (Rs.)</label>
                    <input
                      id="menu-price"
                      name="price"
                      type="number"
                      min="10"
                      value={form.price}
                      onChange={updateField}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="menu-image">Upload Product Image</label>
                  <input
                    id="menu-image"
                    type="file"
                    accept="image/*"
                    onChange={selectImage}
                  />
                  <small>Recommended: Square image, max 2MB.</small>
                </div>
                <div className="form-actions">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary-green"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
