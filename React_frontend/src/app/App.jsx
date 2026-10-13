import { lazy, Suspense, useEffect, useState } from 'react';

const DinerApp     = lazy(() => import('../apps/diner/app/App.jsx'));
const StaffApp     = lazy(() => import('../apps/restaurant-staff/app/App.jsx'));
const ManagerApp   = lazy(() => import('../apps/manager/app/App.jsx'));
const SubAdminApp  = lazy(() => import('../apps/sub-admin/app/App.jsx').then(m => ({ default: m.App })));
const SuperAdminApp = lazy(() => import('../apps/super-admin/app/App.jsx').then(m => ({ default: m.App })));
const LandingPage  = lazy(() => import('../apps/landing/LandingPage.jsx'));

const actors = {
  landing: LandingPage,
  diner: DinerApp,
  'restaurant-staff': StaffApp,
  manager: ManagerApp,
  'sub-admin': SubAdminApp,
  'super-admin': SuperAdminApp,
};

function getActor() {
  const path = window.location.pathname;
  if (path === '/' || path === '') return 'landing';
  const firstSegment = path.split('/').filter(Boolean)[0];
  return actors[firstSegment] ? firstSegment : 'landing';
}

export default function App() {
  const [actor, setActor] = useState(getActor);

  useEffect(() => {
    const handleNavigation = () => setActor(getActor());
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  const ActorApp = actors[actor];
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#64748b' }}>Loading...</div>}>
      <ActorApp />
    </Suspense>
  );
}
