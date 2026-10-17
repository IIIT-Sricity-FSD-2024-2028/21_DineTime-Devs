import { useEffect, useState } from "react";
import { readBoundSession } from "../../../app/session.js";
import { ManagerProvider } from "../context/ManagerContext.jsx";
import { ToastProvider } from "../context/ToastContext.jsx";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ProfilePage from "../pages/ProfilePage";
import ReservationsPage from "../pages/ReservationsPage";
import MenuPage from "../pages/MenuPage";
import TimeSlotsPage from "../pages/TimeSlotsPage";
import TablesPage from "../pages/TablesPage";
import RevenuePage from "../pages/RevenuePage";
import ReviewsPage from "../pages/ReviewsPage";
import IssuesPage from "../pages/IssuesPage";
import StaffPage from "../pages/StaffPage";
import "../styles/manager.css";
import "../styles/react-overrides.css";

const pages = new Set([
  "login",
  "register",
  "profile",
  "reservations",
  "menu",
  "time-slots",
  "tables",
  "revenue",
  "reviews",
  "issues",
  "staff",
]);
const publicPages = new Set(["login", "register"]);

function readRoute() {
  const segment = window.location.pathname
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/\.html$/, "");
  return {
    page: pages.has(segment) ? segment : "login",
    params: Object.fromEntries(new URLSearchParams(window.location.search)),
  };
}

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => readRoute().page);
  const [params, setParams] = useState(() => readRoute().params);

  function navigate(page, nextParams = {}, confirmed = false) {
    if (page === "login") {
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    if (
      !window.dispatchEvent(
        new CustomEvent("manager:navigate", {
          cancelable: true,
          detail: { page, params: nextParams, confirmed },
        }),
      )
    )
      return;
    const nextPage = pages.has(page) ? page : "profile";
    const query = new URLSearchParams(nextParams).toString();
    window.history.pushState({}, "", `/manager/${nextPage}${query ? `?${query}` : ""}`);
    setParams(nextParams);
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  useEffect(() => {
    const onPopState = () => {
      const route = readRoute();
      setCurrentPage(route.page);
      setParams(route.params);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const session = readBoundSession("manager_session_v1");
  const isAuthenticated = !!session?.email && !!session?.access_token;

  useEffect(() => {
    if (!isAuthenticated && !publicPages.has(currentPage)) navigate("login");
  }, [isAuthenticated, currentPage]);

  let page = currentPage;
  if (!isAuthenticated && !publicPages.has(currentPage)) {
    page = "login";
  } else if (isAuthenticated && currentPage === "login") {
    page = "profile";
  }

  useEffect(() => {
    document.title = `DineTime - ${page.replace("-", " ")}`;
  }, [page]);

  let content;
  switch (page) {
    case "register":
      content = <RegisterPage navigate={navigate} />;
      break;
    case "login":
      content = <LoginPage navigate={navigate} />;
      break;
    case "profile":
      content = <ProfilePage />;
      break;
    case "reservations":
      content = <ReservationsPage />;
      break;
    case "menu":
      content = <MenuPage />;
      break;
    case "time-slots":
      content = <TimeSlotsPage />;
      break;
    case "tables":
      content = <TablesPage />;
      break;
    case "revenue":
      content = <RevenuePage />;
      break;
    case "reviews":
      content = <ReviewsPage />;
      break;
    case "issues":
      content = <IssuesPage />;
      break;
    case "staff":
      content = <StaffPage />;
      break;
    default:
      content = <LoginPage />;
  }

  return (
    <ToastProvider>
      <ManagerProvider
        key={`${session?.email || "guest"}:${session?.access_token || ""}`}
        navigate={navigate}
        currentPage={page}
        params={params}
      >
        {content}
      </ManagerProvider>
    </ToastProvider>
  );
}
