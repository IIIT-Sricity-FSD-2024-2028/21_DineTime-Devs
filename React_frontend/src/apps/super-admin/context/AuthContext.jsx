import { createContext, useContext, useMemo, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { bindSession, getTabId, readBoundSession } from '../../../app/session.js';

const AuthContext = createContext(null);

function readProfile() {
  try {
    return readBoundSession('super_admin_profile') || {};
  } catch (_error) {
    return {};
  }
}

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(readProfile);
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem('super_auth_status') === 'true' &&
    sessionStorage.getItem('super_tab_id') === getTabId(),
  );

  async function login(email, password) {
    const payload = await apiRequest('/super-admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const user = payload?.data;
    const nextProfile = { id: user.id, name: user.name, email: user.email, role: user.role };
    sessionStorage.setItem('super_auth_status', 'true');
    sessionStorage.setItem('super_access_token', user.access_token || '');
    sessionStorage.setItem('super_tab_id', getTabId());
    sessionStorage.setItem('super_admin_profile', JSON.stringify(bindSession(nextProfile)));
    setProfile(nextProfile);
    setIsAuthenticated(true);
  }

  function logout() {
    sessionStorage.clear();
    setProfile({});
    setIsAuthenticated(false);
    window.history.pushState({}, '', '/super-admin/login');
  }

  const value = useMemo(() => ({ profile, isAuthenticated, login, logout }), [profile, isAuthenticated]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
