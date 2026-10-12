import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { dinerApi } from "../api/dinerApi.js";
import { DinerContext } from "../hooks/useDiner.js";
import DinerSurface from "../components/DinerSurface.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import RegisterPage from "../pages/RegisterPage.jsx";
import BrowsePage from "../pages/BrowsePage.jsx";
import SearchPage from "../pages/SearchPage.jsx";
import RestaurantPage from "../pages/RestaurantPage.jsx";
import BookPage from "../pages/BookPage.jsx";
import PaymentMakingPage from "../pages/PaymentMakingPage.jsx";
import PaymentMethodPage from "../pages/PaymentMethodPage.jsx";
import ConfirmationPage from "../pages/ConfirmationPage.jsx";
import ReservationsPage from "../pages/ReservationsPage.jsx";
import DetailsPage from "../pages/DetailsPage.jsx";
import MenuPage from "../pages/MenuPage.jsx";
import ProfilePage from "../pages/ProfilePage.jsx";
import SettingsPage from "../pages/SettingsPage.jsx";
import SupportPage from "../pages/SupportPage.jsx";
import "../styles/app.css";

const pages = new Set([
  "login",
  "register",
  "browse",
  "search",
  "restaurant",
  "book",
  "payment_making",
  "payment_method",
  "confirmation",
  "reservations",
  "details",
  "menu",
  "profile",
  "settings",
  "support",
]);
const publicPages = new Set([
  "login",
  "register",
  "browse",
  "search",
  "restaurant",
  "book",
  "menu",
]);

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
  const [booking, setBooking] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const { user } = useSyncExternalStore(
    dinerApi.subscribe,
    dinerApi.getSnapshot,
  );

  const navigate = useCallback((page, nextParams = {}) => {
    const nextPage = pages.has(page) ? page : "browse";
    const query = new URLSearchParams(nextParams).toString();
    window.history.pushState(
      {},
      "",
      `/diner/${nextPage}${query ? `?${query}` : ""}`,
    );
    setParams(nextParams);
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const route = readRoute();
      setCurrentPage(route.page);
      setParams(route.params);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    dinerApi.refresh();
    const onFocus = () => dinerApi.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setBooking(null);
      setConfirmation(null);
    }
  }, [user?.id]);

  const page = !user && !publicPages.has(currentPage) ? "login" : currentPage;
  useEffect(() => {
    document.title = `DineTime - ${page.replaceAll("_", " ")}`;
  }, [page]);

  // Navigation updates currentPage; only the selected React page is mounted.
  let content;
  switch (page) {
    case "register":
      content = <RegisterPage />;
      break;
    case "browse":
      content = <BrowsePage />;
      break;
    case "search":
      content = <SearchPage />;
      break;
    case "restaurant":
      content = <RestaurantPage />;
      break;
    case "book":
      content = <BookPage />;
      break;
    case "payment_making":
      content = <PaymentMakingPage />;
      break;
    case "payment_method":
      content = <PaymentMethodPage />;
      break;
    case "confirmation":
      content = <ConfirmationPage />;
      break;
    case "reservations":
      content = <ReservationsPage />;
      break;
    case "details":
      content = <DetailsPage />;
      break;
    case "menu":
      content = <MenuPage />;
      break;
    case "profile":
      content = <ProfilePage />;
      break;
    case "settings":
      content = <SettingsPage />;
      break;
    case "support":
      content = <SupportPage />;
      break;
    default:
      content = <LoginPage />;
  }
  const stacked = ["payment_making", "payment_method", "confirmation"].includes(
    page,
  );
  return (
    <DinerContext.Provider
      value={{
        currentPage,
        params,
        navigate,
        booking,
        setBooking,
        confirmation,
        setConfirmation,
      }}
    >
      <DinerSurface>
        <div
          className={`diner-app diner-${page}${stacked ? " layout-stacked" : ""}`}
          key={`${page}:${params.id || ""}:${params.q || ""}`}
        >
          {content}
        </div>
      </DinerSurface>
    </DinerContext.Provider>
  );
}
