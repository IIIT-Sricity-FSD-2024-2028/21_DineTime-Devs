import { useState } from "react";
import { Icon } from "./Navigation.jsx";

export function Field({
  label,
  id: providedId,
  className = "form-group",
  inputClass = "form-control",
  ...props
}) {
  const [fieldId] = useState(() => `diner-field-${crypto.randomUUID()}`);
  const id = providedId || fieldId;
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className={inputClass} {...props} />
    </div>
  );
}

export function PasswordField({ label = "Password", id: providedId, ...props }) {
  const [fieldId] = useState(() => `diner-password-${crypto.randomUUID()}`);
  const id = providedId || fieldId;
  const [visible, setVisible] = useState(false);
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="password-input input-container">
        <input id={id} type={visible ? "text" : "password"} {...props} />
        <button
          type="button"
          className="visibility-btn view-toggle"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          onClick={() => setVisible(!visible)}
        >
          <Icon name={visible ? "eye-slash" : "eye"} />
        </button>
      </div>
    </div>
  );
}

export function LocationFields({ value, onChange }) {
  const update = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <>
      <Field label="Address" value={value.address || ""} onChange={update("address")} required />
      <div className="form-row form-row-2col">
        <Field label="City" value={value.city || ""} onChange={update("city")} required />
        <Field
          label="Pincode / ZIP"
          value={value.pincode || ""}
          onChange={update("pincode")}
          maxLength={10}
        />
      </div>
      <Field label="Country" value={value.country || ""} onChange={update("country")} required />
    </>
  );
}
