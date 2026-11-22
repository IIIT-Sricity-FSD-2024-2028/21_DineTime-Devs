import { useEffect } from "react";
import "./styles.css";
import { useAuth } from "../../../store/hooks/useAuth.js";
import { ToastProvider } from "../context/ToastContext.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { DashboardPage } from "../pages/DashboardPage.jsx";

function Body() {
  const { isAuthenticated } = useAuth("super_user");

  useEffect(() => {
    if (!isAuthenticated && window.location.pathname !== "/super-admin/login") {
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginPage />;
  return <DashboardPage />;
}

export function App() {
  return (
    <ToastProvider>
      <Body />
    </ToastProvider>
  );
}
