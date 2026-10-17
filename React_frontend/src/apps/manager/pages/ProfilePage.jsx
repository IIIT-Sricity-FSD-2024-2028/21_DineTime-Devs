import { useEffect, useState, useContext } from "react";
import ManagerLayout from "../components/ManagerLayout";
import { ManagerContext } from "../context/ManagerContext.jsx";
import { ToastContext } from "../context/ToastContext.jsx";

export default function ProfilePage() {
  const { data, storage, refresh, navigate } = useContext(ManagerContext);
  const profile = data?.profile || {};
  const restaurant = data?.restaurant || {};
  const [tab, setTab] = useState("profile-info");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(false);
  const [editingPolicies, setEditingPolicies] = useState(false);
  const [serving, setServing] = useState(Boolean(restaurant.is_open));
  const canOpenRestaurant =
    restaurant.verificationStatus === "approved" &&
    restaurant.tableCount > 0 &&
    restaurant.timeSlotCount > 0;
  const openBlockReason =
    restaurant.verificationStatus !== "approved"
      ? "Opening is available after the restaurant is verified."
      : restaurant.tableCount === 0
        ? "Add at least one table before opening the restaurant."
        : restaurant.timeSlotCount === 0
          ? "Add at least one time slot before opening the restaurant."
          : "";
  const [profileForm, setProfileForm] = useState({
    name: profile.name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    city: profile.city || "",
    restaurantName: profile.restaurantName || "",
  });
  const [restaurantForm, setRestaurantForm] = useState({
    name: restaurant.name || "",
    about: restaurant.about || "",
    cuisine: restaurant.cuisine || "",
    capacity: restaurant.capacity || "",
    location: restaurant.location || "",
    address: restaurant.address || "",
    state: restaurant.state || "",
    pincode: restaurant.pincode || "",
    hours: restaurant.hours || "",
    parking: restaurant.parking || "",
    dressCode: restaurant.dressCode || "",
    contact: restaurant.contact || "",
    reservationFeePerGuest: restaurant.reservationFeePerGuest ?? 0,
    cancellationCutoffMinutes: restaurant.cancellationCutoffMinutes ?? 0,
    noShowGraceMinutes: restaurant.noShowGraceMinutes ?? 0,
  });
  const [policies, setPolicies] = useState(data?.policies || []);

  // Context starts with an empty cache while the backend refresh is in flight.
  // Keep edit controls in step with the loaded source data until a user begins editing.
  useEffect(() => {
    if (editingProfile || editingRestaurant || editingPolicies) return;
    setProfileForm({
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      city: profile.city || "",
      restaurantName: profile.restaurantName || "",
    });
    setRestaurantForm({
      name: restaurant.name || "",
      about: restaurant.about || "",
      cuisine: restaurant.cuisine || "",
      capacity: restaurant.capacity || "",
      location: restaurant.location || "",
      address: restaurant.address || "",
      state: restaurant.state || "",
      pincode: restaurant.pincode || "",
      hours: restaurant.hours || "",
      parking: restaurant.parking || "",
      dressCode: restaurant.dressCode || "",
      contact: restaurant.contact || "",
      reservationFeePerGuest: restaurant.reservationFeePerGuest ?? 0,
      cancellationCutoffMinutes: restaurant.cancellationCutoffMinutes ?? 0,
      noShowGraceMinutes: restaurant.noShowGraceMinutes ?? 0,
    });
    setPolicies(data?.policies || []);
    setServing(Boolean(restaurant.is_open));
  }, [data, editingPolicies, editingProfile, editingRestaurant]);

  const update = (setter) => (event) =>
    setter((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  const saveProfile = async (event) => {
    event.preventDefault();
    if (
      profileForm.name.trim().length < 2 ||
      !/^\S+@\S+\.\S+$/.test(profileForm.email) ||
      !/^\d{10}$/.test(profileForm.phone) ||
      !profileForm.city.trim() ||
      !profileForm.restaurantName.trim()
    ) {
      showToast(
        "Please complete the profile fields with a valid email and 10-digit phone number.",
        "error",
      );
      return;
    }
    try {
      await storage.updateProfile({
        ...profileForm,
        phone: profileForm.phone.replace(/\D/g, ""),
      });
      refresh();
      setEditingProfile(false);
      showToast("Profile updated successfully.");
    } catch (error) {
      showToast(error.message || "Unable to update the profile.", "error");
    }
  };
  const saveRestaurant = async (event) => {
    event.preventDefault();
    if (
      !restaurantForm.name ||
      !restaurantForm.about ||
      !restaurantForm.cuisine ||
      !restaurantForm.contact
    ) {
      showToast("Complete the required restaurant details.", "error");
      return;
    }
    try {
      await storage.updateRestaurantDetails({
        ...restaurantForm,
        reservationFeePerGuest: Number(restaurantForm.reservationFeePerGuest),
        cancellationCutoffMinutes: Number(restaurantForm.cancellationCutoffMinutes),
        noShowGraceMinutes: Number(restaurantForm.noShowGraceMinutes),
      });
      refresh();
      setEditingRestaurant(false);
      showToast("Restaurant details saved.");
    } catch (error) {
      showToast(error.message || "Unable to update restaurant details.", "error");
    }
  };
  const toggleServing = async (event) => {
    const next = event.target.checked;
    setServing(next);
    try {
      await storage.setServingStatus(next);
      refresh();
      showToast(
        next
          ? "Your restaurant is now visible to diners."
          : "Your restaurant is now hidden from diners.",
      );
    } catch (error) {
      setServing(!next);
      showToast(error.message || "Could not update serving status.", "error");
    }
  };
  const savePolicies = async () => {
    try {
      await storage.updatePolicies(policies);
      refresh();
      setEditingPolicies(false);
      showToast("Policies updated successfully.");
    } catch (error) {
      showToast(error.message || "Unable to update policies.", "error");
    }
  };
  const addPolicy = () => {
    setPolicies((current) => [
      ...current,
      { title: "New Policy", desc: "Policy description goes here." },
    ]);
    setEditingPolicies(true);
  };
  const removePolicy = (index) =>
    setPolicies((current) => current.filter((_policy, itemIndex) => itemIndex !== index));
  const uploadProfilePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await storage.uploadProfilePhoto(file);
      refresh();
      showToast("Profile photo updated successfully.");
    } catch (error) {
      showToast(error.message || "Profile photo upload failed.", "error");
    }
    event.target.value = "";
  };
  const removeProfilePhoto = async () => {
    try {
      await storage.removeProfilePhoto();
      refresh();
      showToast("Profile photo removed.", "info");
    } catch (error) {
      showToast(error.message || "Unable to remove the profile photo.", "error");
    }
  };
  const uploadRestaurantImages = async (event, primary = false) => {
    const files = Array.from(event.target.files || []);
    try {
      for (const file of files)
        await storage.uploadRestaurantImage(file, primary && file === files[0]);
      refresh();
      showToast(`${files.length} image${files.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      showToast(error.message || "Restaurant image upload failed.", "error");
    }
    event.target.value = "";
  };
  const removeRestaurantImage = async (image = restaurant.image) => {
    try {
      await storage.removeRestaurantImage(image);
      refresh();
      showToast("Restaurant photo removed.", "info");
    } catch (error) {
      showToast(error.message || "Unable to remove the restaurant photo.", "error");
    }
  };

  const profileDetails = [
    ["Email Address", "email"],
    ["Phone Number", "phone"],
    ["City", "city"],
    ["Restaurant Name", "restaurantName"],
    ["Member Since", "memberSince"],
    ["Restaurant ID", "restaurantId"],
  ];
  const detailFields = [
    ["Cuisine Type", "cuisine"],
    ["Seating Capacity", "capacity"],
    ["Address", "address"],
    ["State", "state"],
    ["Pincode", "pincode"],
    ["Opening Hours", "hours"],
    ["Parking", "parking"],
    ["Dress Code", "dressCode"],
    ["Contact Number", "contact"],
    ["Reservation Deposit / Guest", "reservationFeePerGuest"],
    ["Cancellation Cutoff", "cancellationCutoffMinutes"],
    ["No-Show Grace Period", "noShowGraceMinutes"],
  ];

  return (
    <ManagerLayout
      title="Manager Profile"
      description="Manage your personal and restaurant information"
      headerVariant="profile"
    >
      <section className="card profile-card">
        <div className="profile-left">
          <div className="avatar-circle">
            {profile.avatar ? (
              <img src={profile.avatar} alt="Manager profile" />
            ) : (
              <i className="ph ph-user" />
            )}
          </div>
          <label className="btn btn-primary-green btn-small">
            <i className="ph ph-image" /> Upload Photo
            <input type="file" accept="image/*" hidden onChange={uploadProfilePhoto} />
          </label>
          {profile.avatar && (
            <button
              className="btn btn-danger-outline btn-small"
              type="button"
              onClick={removeProfilePhoto}
            >
              <i className="ph ph-trash" /> Remove Photo
            </button>
          )}
        </div>
        <div className="profile-right">
          <div className="profile-header">
            <h3>{profile.name || "Manager"}</h3>
            <button
              className="btn btn-primary-orange btn-small"
              type="button"
              onClick={() => setEditingProfile((value) => !value)}
            >
              <i className={`ph ${editingProfile ? "ph-x" : "ph-pencil-simple"}`} />{" "}
              {editingProfile ? "Cancel" : "Edit Profile"}
            </button>
          </div>
          {editingProfile ? (
            <form className="profile-details-grid" onSubmit={saveProfile}>
              {[
                ["Full Name", "name"],
                ["Email Address", "email"],
                ["Phone Number", "phone"],
                ["City", "city"],
                ["Restaurant Name", "restaurantName"],
              ].map(([label, name]) => (
                <label className="detail-item" key={name}>
                  <span className="detail-label">{label}</span>
                  <input
                    className="editable-input"
                    name={name}
                    value={profileForm[name]}
                    onChange={update(setProfileForm)}
                  />
                </label>
              ))}
              <button className="btn btn-primary-green" type="submit">
                Save Profile
              </button>
            </form>
          ) : (
            <div className="profile-details-grid">
              {profileDetails.map(([label, key]) => (
                <div className="detail-item" key={key}>
                  <span className="detail-label">{label}</span>
                  <span className="detail-value">
                    {key === "restaurantId" ? restaurant.id || "-" : profile[key] || "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="card restaurant-card">
        <div className="restaurant-card-header">
          <h3>Restaurant Overview</h3>
          <div className="restaurant-actions">
            <div className="serving-status-widget">
              <span>{serving ? "Open to Serve" : "Closed to Serve"}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={serving}
                  disabled={!serving && !canOpenRestaurant}
                  title={!serving ? openBlockReason : "Close the restaurant to new reservations"}
                  onChange={toggleServing}
                />
                <span className="slider" />
              </label>
              {!serving && !canOpenRestaurant && (
                <small className="serving-status-hint">{openBlockReason}</small>
              )}
            </div>
            <button
              className="btn btn-primary-green btn-small"
              type="button"
              onClick={() => navigate("staff")}
            >
              Manage Staff Access
            </button>
          </div>
        </div>
        <div className="tabs">
          {[
            ["profile-info", "Profile Information"],
            ["reservation-policies", "Reservation Policies"],
            ["restaurant-images", "Restaurant Images"],
          ].map(([id, label]) => (
            <button
              className={`tab-btn ${tab === id ? "active" : ""}`}
              type="button"
              key={id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tab-content-container">
          {tab === "profile-info" && (
            <div className="rest-info-layout">
              <div className="rest-info-image">
                {restaurant.image ? (
                  <>
                    <img src={restaurant.image} alt="Restaurant interior" />
                    <button
                      className="rest-image-remove"
                      type="button"
                      onClick={() => removeRestaurantImage()}
                    >
                      <i className="ph ph-trash" /> Remove
                    </button>
                  </>
                ) : (
                  <label className="rest-img-empty">
                    <i className="ph ph-image" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => uploadRestaurantImages(event, true)}
                    />
                  </label>
                )}
              </div>
              <div className="rest-info-details">
                <div className="rest-info-header">
                  <h4>{restaurant.name || profile.restaurantName || "Restaurant"}</h4>
                  <button
                    className="btn btn-primary-orange btn-small"
                    type="button"
                    onClick={() => setEditingRestaurant((value) => !value)}
                  >
                    {editingRestaurant ? "Cancel" : "Edit Restaurant Details"}
                  </button>
                </div>
                {editingRestaurant ? (
                  <form onSubmit={saveRestaurant} className="rest-edit-grid">
                    {detailFields.map(([label, key]) => (
                      <label key={key}>
                        {label}
                        <input
                          name={key}
                          value={restaurantForm[key]}
                          readOnly={
                            key === "hours" ||
                            key === "address" ||
                            key === "state" ||
                            key === "pincode"
                          }
                          onChange={update(setRestaurantForm)}
                        />
                        {key === "hours" && (
                          <button
                            type="button"
                            className="phase1-help-link"
                            onClick={() => navigate("time-slots")}
                          >
                            Configure operating hours
                          </button>
                        )}
                      </label>
                    ))}
                    <label className="rest-about-editor">
                      About
                      <textarea
                        name="about"
                        value={restaurantForm.about}
                        onChange={update(setRestaurantForm)}
                      />
                    </label>
                    <button className="btn btn-primary-green" type="submit">
                      Save Details
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="rest-about">
                      <h5>About</h5>
                      <p>
                        {restaurant.about || "Restaurant details will appear here once configured."}
                      </p>
                    </div>
                    <div className="rest-details-grid">
                      {[
                        ["Cuisine Type", restaurant.cuisine],
                        ["Seating Capacity", restaurant.capacity],
                        ["City", restaurant.location],
                        ["Address", restaurant.address],
                        ["State", restaurant.state],
                        ["Pincode", restaurant.pincode],
                        ["Opening Hours", restaurant.hours],
                        ["Parking", restaurant.parking],
                        ["Dress Code", restaurant.dressCode],
                        ["Contact Number", restaurant.contact],
                        [
                          "Reservation Deposit / Guest",
                          `Rs.${restaurant.reservationFeePerGuest ?? 0}`,
                        ],
                        [
                          "Cancellation Cutoff",
                          `${restaurant.cancellationCutoffMinutes ?? 0} minutes before`,
                        ],
                        [
                          "No-Show Grace Period",
                          `${restaurant.noShowGraceMinutes ?? 0} minutes after`,
                        ],
                      ].map(([label, value]) => (
                        <div className="detail-col" key={label}>
                          <span className="detail-label">{label}</span>
                          <span className="detail-value">{value || "-"}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {tab === "reservation-policies" && (
            <div className="policies-panel">
              <div className="policies-header">
                <h4>Reservation Policies</h4>
                <div>
                  <button
                    className="btn btn-primary-orange btn-small"
                    type="button"
                    onClick={() => (editingPolicies ? savePolicies() : setEditingPolicies(true))}
                  >
                    {editingPolicies ? "Save Policies" : "Edit Policies"}
                  </button>
                </div>
              </div>
              {policies.length ? (
                policies.map((policy, index) => (
                  <div className="policy-row" key={index}>
                    {editingPolicies ? (
                      <>
                        <input
                          value={policy.title}
                          onChange={(event) =>
                            setPolicies((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, title: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <textarea
                          value={policy.desc}
                          onChange={(event) =>
                            setPolicies((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, desc: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <button
                          className="btn btn-small"
                          type="button"
                          onClick={() => removePolicy(index)}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <strong>{policy.title}</strong>
                        <span>{policy.desc}</span>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="policy-empty">
                  <button className="btn policy-add-btn" type="button" onClick={addPolicy}>
                    <i className="ph ph-plus" /> Add New Policy
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === "restaurant-images" && (
            <div className="gallery-panel">
              <div className="gallery-panel-head">
                <h4>Restaurant Gallery</h4>
                <label className="btn btn-primary-orange btn-small">
                  Upload Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => uploadRestaurantImages(event)}
                  />
                </label>
              </div>
              <div className="gallery-grid">
                {(data?.gallery || []).map((image) => (
                  <div className="gallery-item" key={image}>
                    <img src={image} alt="Restaurant gallery" />
                    <button
                      className="gallery-remove"
                      type="button"
                      aria-label="Remove restaurant image"
                      onClick={() => removeRestaurantImage(image)}
                    >
                      <i className="ph ph-trash" />
                    </button>
                  </div>
                ))}
                {!(data?.gallery || []).length && <p>No restaurant images have been added yet.</p>}
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="activity-section">
        <h3>Today&apos;s Activity</h3>
        <div className="activity-cards">
          <div className="activity-card">
            <div className="activity-icon bg-green-light text-green">
              <i className="ph ph-calendar-blank" />
            </div>
            <span className="activity-label">Today&apos;s Reservations</span>
            <span className="activity-value">{data?.activity?.reservations || 0}</span>
          </div>
          <div className="activity-card">
            <div className="activity-icon bg-green-light text-green">
              <i className="ph ph-squares-four" />
            </div>
            <span className="activity-label">Available Tables</span>
            <span className="activity-value">{data?.activity?.availableTables || 0}</span>
          </div>
          <div className="activity-card">
            <div className="activity-icon bg-green-light text-green">
              <i className="ph ph-star" />
            </div>
            <span className="activity-label">Average Rating</span>
            <span className="activity-value rating-inline">
              {data?.activity?.avgRating || 0} <i className="ph-fill ph-star text-orange" />
            </span>
          </div>
        </div>
      </section>
    </ManagerLayout>
  );
}
