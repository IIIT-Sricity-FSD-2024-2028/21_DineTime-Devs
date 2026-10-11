import './styles.css';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { SupportDashboard } from '../pages/support/SupportDashboard.jsx';
import { FinanceDashboard } from '../pages/finance/FinanceDashboard.jsx';
import { VerificationDashboard } from '../pages/verification/VerificationDashboard.jsx';

import { useEffect, useState } from 'react';

function getInitialPage() {
  const page = window.location.pathname.split('/').pop() || 'login';
  return page;
}

function AppBody() {
  const { isAuthenticated, profile } = useAuth();
  const [currentPage, setCurrentPage] = useState(getInitialPage);

  useEffect(() => {
    const handleNavigation = () => setCurrentPage(getInitialPage());
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  if (!isAuthenticated || currentPage === 'login') {
    return <LoginPage />;
  }

  if (currentPage.includes('support') || profile?.team === 'support') return <SupportDashboard />;
  if (currentPage.includes('finance') || profile?.team === 'finance') return <FinanceDashboard />;
  if (currentPage.includes('verification') || profile?.team === 'verification') return <VerificationDashboard />;
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
