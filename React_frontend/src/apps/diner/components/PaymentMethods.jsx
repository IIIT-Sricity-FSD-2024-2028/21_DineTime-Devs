import { Field } from "./Fields.jsx";
import { Icon } from "./Navigation.jsx";

const methods = [
  ["card", "Credit / Debit Card", "Visa, Mastercard, RuPay", "credit-card"],
  ["upi", "UPI", "Google Pay, PhonePe, Paytm", "mobile-screen"],
  [
    "netbanking",
    "Net Banking",
    "All major banks supported",
    "building-columns",
  ],
  ["wallet", "Wallets", "Paytm, Amazon Pay, PhonePe", "wallet"],
];

export default function PaymentMethods({
  method,
  setMethod,
  values,
  setValues,
}) {
  const bind = (key) => ({
    value: values[key] || "",
    onChange: (event) => setValues({ ...values, [key]: event.target.value }),
  });
  return (
    <div className="methods-list">
      {methods.map(([id, name, subtitle, icon]) => (
        <div key={id} className={`method-row ${method === id ? "active" : ""}`}>
          <button
            type="button"
            className="method-header"
            aria-expanded={method === id}
            onClick={() => {
              setMethod(id);
              setValues({});
            }}
          >
            <div className="method-icon">
              <Icon name={icon} />
            </div>
            <div className="method-label">
              <span className="method-name">{name}</span>
              <span className="method-sub">{subtitle}</span>
            </div>
            {id === "card" && (
              <div className="method-badges">
                <span className="badge badge-visa">VISA</span>
                <span className="badge badge-mc">MC</span>
              </div>
            )}
            <Icon name="chevron-down" className="method-arrow" />
          </button>
          {method === id && (
            <div className="method-body">
              <div className="method-divider" />
              {id === "card" && (
                <>
                  <Field
                    label="Card Number"
                    className="field-group"
                    inputClass="field-input"
                    placeholder="1234 5678 9012 3456"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    pattern="[0-9 ]{16,19}"
                    maxLength={19}
                    required
                    {...bind("number")}
                  />
                  <Field
                    label="Cardholder Name"
                    className="field-group"
                    inputClass="field-input"
                    placeholder="Name as on card"
                    autoComplete="cc-name"
                    required
                    {...bind("name")}
                  />
                  <div className="field-row">
                    <Field
                      label="Expiry Date"
                      className="field-group"
                      inputClass="field-input"
                      placeholder="MM/YY"
                      autoComplete="cc-exp"
                      pattern="(0[1-9]|1[0-2])/[0-9]{2}"
                      maxLength={5}
                      required
                      {...bind("expiry")}
                    />
                    <Field
                      label="CVV"
                      type="password"
                      className="field-group"
                      inputClass="field-input"
                      placeholder="•••"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      pattern="[0-9]{3,4}"
                      maxLength={4}
                      required
                      {...bind("cvv")}
                    />
                  </div>
                </>
              )}
              {id === "upi" && (
                <>
                  <div className="upi-apps">
                    {["GPay", "PhonePe", "Paytm"].map((app) => (
                      <button
                        key={app}
                        type="button"
                        className={`upi-app-btn ${values.app === app ? "selected" : ""}`}
                        onClick={() => setValues({ app })}
                      >
                        {app}
                      </button>
                    ))}
                  </div>
                  <Field
                    label="Or enter UPI ID"
                    className="field-group"
                    inputClass="field-input"
                    placeholder="yourname@upi"
                    required={!values.app}
                    pattern="[^\s@]+@[^\s@]+"
                    {...bind("upi")}
                  />
                </>
              )}
              {id === "netbanking" && (
                <>
                  <label className="field-group">
                    Select Bank
                    <select className="field-select" required {...bind("bank")}>
                      <option value="">Choose your bank</option>
                      {[
                        "State Bank of India",
                        "HDFC Bank",
                        "ICICI Bank",
                        "Axis Bank",
                        "Kotak Mahindra Bank",
                        "Punjab National Bank",
                        "Bank of Baroda",
                        "Canara Bank",
                        "Union Bank of India",
                        "Yes Bank",
                      ].map((bank) => (
                        <option key={bank}>{bank}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Customer ID / Username"
                    className="field-group"
                    inputClass="field-input"
                    placeholder="Enter your net banking ID"
                    required
                    {...bind("username")}
                  />
                </>
              )}
              {id === "wallet" && (
                <div className="wallet-options">
                  {["Paytm", "Amazon Pay", "PhonePe"].map((wallet) => (
                    <label
                      key={wallet}
                      className={`wallet-option ${values.wallet === wallet ? "selected" : ""}`}
                    >
                      <Icon name="wallet" />
                      <span>{wallet}</span>
                      <input
                        type="radio"
                        name="wallet"
                        required
                        value={wallet}
                        checked={values.wallet === wallet}
                        onChange={() => setValues({ wallet })}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
