import './styles.css';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { AdminProvider } from '../context/AdminContext.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { useEffect, useState } from 'react';

function Body() {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => {
    const page = window.location.pathname.split('/').pop() || 'login';
    return page;
  });

  useEffect(() => {
    const handleNavigation = () => {
      const page = window.location.pathname.split('/').pop() || 'login';
      setCurrentPage(page);
    };
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

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
