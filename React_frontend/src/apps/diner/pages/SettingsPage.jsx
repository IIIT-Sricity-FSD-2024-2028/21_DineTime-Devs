import { createAction } from "../../../app/actions.js";
import { useEffect, useState, useContext } from "react";
import { DinerLayout, Hero, Icon } from "../components/Navigation.jsx";
import { Field } from "../components/Fields.jsx";
import { ErrorMessage } from "../components/Feedback.jsx";
import { DinerContext } from "../context/DinerContext.js";

function SettingsCard({ title, subtitle, icon, children }) {
  return (
    <section className="settings-card">
      <div className="card-header">
        <Icon name={icon} />
        <h3>{title}</h3>
      </div>
      <p className="card-subtitle">{subtitle}</p>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { api, user, restaurants = [], locations = [] } = useContext(DinerContext);
  const [account, setAccount] = useState(user);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [settings, setSettings] = useState([]);
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [preferences, setPreferences] = useState(() => api.preferences());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  useEffect(() => {
    setAccount(user ? { ...user } : user);
  }, [user]);
  useEffect(() => {
    let active = true;
    api
      .cities()
      .then((items) => {
        if (active) setCities(items);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);
  const cityOptions = cities.length
    ? cities
    : [
        ...new Map(
          restaurants
            .map(
              (restaurant) =>
                restaurant.city ||
                locations.find((location) => location.id === restaurant.location_id)?.city,
            )
            .map((city) => String(city || "").trim())
            .filter(Boolean)
            .map((city) => [city.toLocaleLowerCase(), city]),
        ).values(),
      ].sort((a, b) => a.localeCompare(b));
  useEffect(() => {
    let active = true;
    api
      .settings()
      .then((values) => {
        if (active) setSettings(values);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [api, user.id]);
  const bindAccount = (key) => ({
    value: account[key] || "",
    onChange: (event) => setAccount({ ...account, [key]: event.target.value }),
  });

  function togglePreference(key, value) {
    run(async () => {
      const setting = settings.find((item) => item.key === key)?.setting;
      if (setting) await api.updateSetting(setting.id, value);
      const next = { ...preferences, [key]: value };
      api.savePreferences(next);
      setPreferences(next);
      setSettings((items) =>
        items.map((item) =>
          item.key === key && item.setting
            ? { ...item, setting: { ...item.setting, value } }
            : item,
        ),
      );
      setMessage(setting ? "Preference saved." : "Preference saved for this browser session.");
    });
  }

  return (
    <DinerLayout header={false}>
      <Hero
        settings
        title="Settings"
        subtitle="Manage your account preferences, security, and notifications."
      />
      <div className="settings-container">
        <ErrorMessage message={error} />
        {message && (
          <p className="diner-success" role="status">
            {message}
          </p>
        )}
        <SettingsCard
          title="Account Settings"
          subtitle="Update your personal information"
          icon="user"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                await api.updateProfile(account);
                setMessage("Account saved.");
              });
            }}
          >
            <div className="form-grid">
              <Field label="Full Name" required {...bindAccount("name")} />
              <Field label="Email Address" type="email" required {...bindAccount("email")} />
              <Field label="Phone Number" type="tel" {...bindAccount("phone")} />
              <Field label="Address" className="form-group span-2" {...bindAccount("address")} />
              <div className="form-group span-2">
                <label htmlFor="diner-preferred-city">Preferred city</label>
                <select
                  id="diner-preferred-city"
                  className="form-control"
                  required
                  value={account.city || ""}
                  disabled={!cityOptions.length}
                  onChange={(event) => setAccount({ ...account, city: event.target.value })}
                  aria-describedby="preferred-city-settings-note"
                >
                  <option value="" disabled>
                    {citiesLoading && !cityOptions.length ? "Loading cities…" : "Choose a city"}
                  </option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                <small id="preferred-city-settings-note">
                  Restaurant results will use this city after you save.
                </small>
              </div>
              <Field label="Country" {...bindAccount("country")} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy}>
                <Icon name="floppy-disk" /> Save Changes
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setAccount(user ? { ...user } : user)}
              >
                <Icon name="rotate-left" /> Reset
              </button>
            </div>
          </form>
        </SettingsCard>
        <SettingsCard
          title="Security Settings"
          subtitle="Manage your password and security options"
          icon="lock"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                if (passwords.next !== passwords.confirm)
                  throw new Error("New password and confirmation do not match.");
                await api.changePassword(passwords.current, passwords.next);
                setPasswords({ current: "", next: "", confirm: "" });
                setMessage("Password updated.");
              });
            }}
          >
            <Field
              label="Current Password"
              type="password"
              autoComplete="current-password"
              required
              value={passwords.current}
              onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
            />
            <div className="form-grid">
              <Field
                label="New Password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={passwords.next}
                onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
              />
              <Field
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                required
                value={passwords.confirm}
                onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
              />
            </div>
            <div className="setting-row highlight-box">
              <div className="setting-info">
                <strong>Enable Two-Factor Authentication</strong>
                <span>Not available for this account yet</span>
              </div>
              <label className="toggle-switch">
                <input
                  aria-label="Enable Two-Factor Authentication"
                  type="checkbox"
                  checked={false}
                  disabled
                />
                <span className="slider" />
              </label>
            </div>
            <div className="form-actions-left">
              <button className="btn btn-accent" disabled={busy}>
                Update Password
              </button>
            </div>
          </form>
        </SettingsCard>
        <SettingsCard
          title="Notification Preferences"
          subtitle="Choose how you want to be notified"
          icon="bell"
        >
          <div className="setting-list">
            {[
              ["notifications", "Reservation Confirmations"],
              ["promotions", "Promotional Offers"],
              ["restaurantUpdates", "Restaurant Updates"],
              ["emailNotifications", "Email Notifications"],
              ["smsNotifications", "SMS Notifications"],
            ].map(([key, label]) => (
              <div className="setting-row" key={key}>
                <span>{label}</span>
                <label className="toggle-switch">
                  <input
                    aria-label={label}
                    type="checkbox"
                    disabled={busy}
                    checked={Boolean(
                      settings.find((item) => item.key === key)?.setting?.value ?? preferences[key],
                    )}
                    onChange={(event) => togglePreference(key, event.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            ))}
          </div>
        </SettingsCard>
        <SettingsCard
          title="Privacy Settings"
          subtitle="Control your privacy and data sharing"
          icon="shield-halved"
        >
          <div className="setting-list checkboxes">
            {[
              [
                "contact",
                "Allow restaurants to contact me",
                "Restaurants can send you messages about reservations",
              ],
              [
                "history",
                "Share dining history for recommendations",
                "Help us provide better restaurant suggestions",
              ],
            ].map(([key, title, subtitle]) => (
              <label className="custom-checkbox-row" key={key}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={Boolean(preferences[key])}
                  onChange={(event) => togglePreference(key, event.target.checked)}
                />
                <div className="checkbox-box">
                  <Icon name="check" className="checkmark" />
                </div>
                <div className="checkbox-info">
                  <strong>{title}</strong>
                  <span>{subtitle}</span>
                </div>
              </label>
            ))}
          </div>
        </SettingsCard>
      </div>
    </DinerLayout>
  );
}
