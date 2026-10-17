import "./styles.css";
import { AuthProvider, AuthContext } from "../context/AuthContext.jsx";
import { ToastProvider } from "../context/ToastContext.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { SupportDashboard } from "../pages/support/SupportDashboard.jsx";
import { FinanceDashboard } from "../pages/finance/FinanceDashboard.jsx";
import { VerificationDashboard } from "../pages/verification/VerificationDashboard.jsx";

import { useEffect, useState, useContext } from "react";

function getInitialPage() {
  return window.location.pathname.split("/").pop() || "login";
}

function AppBody() {
  const { isAuthenticated, profile } = useContext(AuthContext);
  const [currentPage, setCurrentPage] = useState(getInitialPage);

  useEffect(() => {
    const handleNavigation = () => setCurrentPage(getInitialPage());
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  useEffect(() => {
    if (!isAuthenticated && currentPage !== "login") {
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [isAuthenticated, currentPage]);

  if (!isAuthenticated || currentPage === "login") {
    return <LoginPage />;
  }

  if (currentPage.includes("support") || profile?.team === "support") {
    return <SupportDashboard />;
  }
  if (currentPage.includes("finance") || profile?.team === "finance") {
    return <FinanceDashboard />;
  }
  if (currentPage.includes("verification") || profile?.team === "verification") {
    return <VerificationDashboard />;
  }
  return <LoginPage />;
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppBody />
      </AuthProvider>
    </ToastProvider>
  );
}
