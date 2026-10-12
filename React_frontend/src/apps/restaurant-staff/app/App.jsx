// Restaurant-staff sub-router — mirrors diner/app/App.jsx structure.
// Mounted under /restaurant-staff/* by the root src/app/App.jsx.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { staffApi } from "../api/staffApi.js";
import { StaffContext } from "../hooks/useStaff.js";
import LoginPage from "../pages/LoginPage.jsx";
import RegisterPage from "../pages/RegisterPage.jsx";
import RequestPage from "../pages/RequestPage.jsx";
import DashboardPage from "../pages/DashboardPage.jsx";
import CheckInPage from "../pages/CheckInPage.jsx";
import ProfilePage from "../pages/ProfilePage.jsx";
import StaffSurface from "../components/StaffSurface.jsx";

const pages = new Set([
  "login",
  "register",
  "request",
  "dashboard",
  "check-in",
  "profile",
]);

const publicPages = new Set(["login", "register", "request"]);

function readRoute() {
  // URL: /restaurant-staff/<page>
  const parts = window.location.pathname.split("/").filter(Boolean);
  // parts[0] = "sub-admin", parts[1] = page segment
  const segment = parts[1] || "";
  return {
    page: pages.has(segment) ? segment : "check-in",
    params: Object.fromEntries(new URLSearchParams(window.location.search)),
  };
}

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => readRoute().page);
  const [params, setParams] = useState(() => readRoute().params);
  const { user } = useSyncExternalStore(staffApi.subscribe, staffApi.getSnapshot);

  const navigate = useCallback((page, nextParams = {}) => {
    const nextPage = pages.has(page) ? page : "check-in";
    const query = new URLSearchParams(nextParams).toString();
    window.history.pushState(
      {},
      "",
      `/restaurant-staff/${nextPage}${query ? `?${query}` : ""}`,
    );
    setParams(nextParams);
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Sync state with browser back/forward
  useEffect(() => {
    const onPop = () => {
      const route = readRoute();
      setCurrentPage(route.page);
      setParams(route.params);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Auth guard: redirect to login if not authenticated on a private page
  const page = !user && !publicPages.has(currentPage) ? "login" : currentPage;

  // Redirect logged-in users away from auth pages
  useEffect(() => {
    if (user && publicPages.has(currentPage)) navigate("check-in");
  }, [user?.id, currentPage]);

  useEffect(() => {
    document.title = `DineTime Staff — ${page.replaceAll("-", " ")}`;
  }, [page]);

  let content;
  switch (page) {
    case "register":
      content = <RegisterPage />;
      break;
    case "request":
      content = <RequestPage />;
      break;
    case "dashboard":
      content = <DashboardPage />;
      break;
    case "check-in":
      content = <CheckInPage />;
      break;
    case "profile":
      content = <ProfilePage />;
      break;
    default:
      content = <LoginPage />;
  }

  return (
    <StaffSurface page={page}>
      <StaffContext.Provider value={{ currentPage: page, params, navigate }}>
        <div className={`staff-app staff-${page}`} key={page}>
          {content}
        </div>
      </StaffContext.Provider>
    </StaffSurface>
  );
}
