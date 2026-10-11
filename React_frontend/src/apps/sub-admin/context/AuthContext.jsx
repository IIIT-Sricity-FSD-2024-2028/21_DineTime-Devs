import { createContext, useContext, useMemo, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { bindSession, getTabId, readBoundSession } from '../../../app/session.js';

const AuthContext = createContext(null);

function readProfile() {
  try {
    return readBoundSession('subadmin_profile') || {};
  } catch (_error) {
    return {};
  }
}

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(readProfile);
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem('subadmin_auth_status') === 'true' &&
    sessionStorage.getItem('subadmin_tab_id') === getTabId(),
  );

  async function login({ team, email, password }) {
    const payload = await apiRequest('/sub-admin/login', {
      method: 'POST',
      body: JSON.stringify({ team, email, password }),
    });
    const account = payload?.data;
    const nextProfile = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      team: account.team,
      location_id: account.location_id,
    };

    sessionStorage.setItem('subadmin_auth_status', 'true');
    sessionStorage.setItem('subadmin_access_token', account.access_token || '');
    sessionStorage.setItem('subadmin_tab_id', getTabId());
    sessionStorage.setItem('subadmin_profile', JSON.stringify(bindSession(nextProfile)));
    setProfile(nextProfile);
    setIsAuthenticated(true);
    return nextProfile;
  }

  function logout() {
    sessionStorage.clear();
    setProfile({});
    setIsAuthenticated(false);
    window.history.pushState({}, '', '/sub-admin/login');
  }

  const value = useMemo(() => ({
    profile,
    isAuthenticated,
    login,
    logout,
    adminId: profile?.id || '',
  }), [profile, isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
