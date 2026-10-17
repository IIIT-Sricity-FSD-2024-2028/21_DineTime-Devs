import sharedStyles from "../styles/shared.css?inline";
import checkInStyles from "../styles/check-in.css?inline";
import dashboardStyles from "../styles/dashboard.css?inline";
import loginStyles from "../styles/login.css?inline";
import profileStyles from "../styles/profile.css?inline";
import registrationStyles from "../styles/registration.css?inline";
import requestStyles from "../styles/request.css?inline";
import { image } from "../utils/images.js";

const pageStyles = {
  "check-in": checkInStyles,
  dashboard: dashboardStyles,
  login: loginStyles,
  profile: profileStyles,
  register: registrationStyles,
  request: requestStyles,
};

/** CSS scopes keep the staff portal's original styles isolated. */
export default function StaffSurface({ children, page }) {
  return (
    <div className="staff-surface">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
      />
      <style>{`.staff-surface { display: block; min-height: 100vh; width: 100%; }\n${(pageStyles[page] || loginStyles).replaceAll("../utils/images/staff-hero-bg.png", image("staff-hero-bg.png"))}\n${sharedStyles}`}</style>
      {children}
    </div>
  );
}
