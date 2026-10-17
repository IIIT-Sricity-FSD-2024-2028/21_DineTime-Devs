import { useEffect, useState } from "react";

// Ordinary JavaScript imports retain this project's per-portal loading behavior.
// React state chooses the portal; effects load the selected component.
const actorLoaders = {
  landing: () => import("../apps/landing/LandingPage.jsx"),
  auth: () => import("../apps/auth/UnifiedAuthPage.jsx"),
  diner: () => import("../apps/diner/app/App.jsx"),
  staff: () => import("../apps/restaurant-staff/app/App.jsx"),
  manager: () => import("../apps/manager/app/App.jsx"),
  subAdmin: () =>
    import("../apps/sub-admin/app/App.jsx").then((module) => ({ default: module.App })),
  superAdmin: () =>
    import("../apps/super-admin/app/App.jsx").then((module) => ({ default: module.App })),
};

function getActor() {
  const pathname = window.location.pathname;
  if (
    pathname === "/login" ||
    pathname === "/login/" ||
    /^\/(diner|manager|restaurant-staff|sub-admin|super-admin)\/login\/?$/.test(pathname)
  )
    return "auth";
  if (pathname.startsWith("/diner")) return "diner";
  if (pathname.startsWith("/restaurant-staff")) return "staff";
  if (pathname.startsWith("/manager")) return "manager";
  if (pathname.startsWith("/sub-admin")) return "subAdmin";
  if (pathname.startsWith("/super-admin")) return "superAdmin";
  return "landing";
}

export default function App() {
  const [actor, setActor] = useState(getActor);
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    const navigate = () => setActor(getActor());
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);
  useEffect(() => {
    let active = true;
    actorLoaders[actor]()
      .then((module) => {
        if (active) setLoaded({ actor, Component: module.default });
      })
      .catch((error) => {
        if (active) setLoaded({ actor, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [actor]);
  if (loaded?.actor !== actor)
    return (
      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "sans-serif",
          color: "#64748b",
        }}
      >
        Loading...
      </div>
    );
  if (loaded.error)
    return (
      <div role="alert">
        Unable to load this page. <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  const ActorApp = loaded.Component;
  return <ActorApp />;
}
