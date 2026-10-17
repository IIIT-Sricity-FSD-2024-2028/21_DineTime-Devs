import { useContext, useEffect } from "react";
import "./styles.css";
import { AuthProvider, AuthContext } from "../context/AuthContext.jsx";
import { ToastProvider } from "../context/ToastContext.jsx";
import { AdminProvider } from "../context/AdminContext.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { DashboardPage } from "../pages/DashboardPage.jsx";

function Body() {
  const { isAuthenticated } = useContext(AuthContext);

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
      <AuthProvider>
        <AdminProvider>
          <Body />
        </AdminProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
