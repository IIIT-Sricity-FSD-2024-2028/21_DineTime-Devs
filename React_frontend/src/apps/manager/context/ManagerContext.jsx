import { createContext, useEffect, useState } from "react";
import managerApi from "../api/managerApi";

export const ManagerContext = createContext(null);

function snapshot() {
  const source = managerApi.getData();
  return {
    ...source,
    profile: { ...source.profile },
    restaurant: { ...source.restaurant },
    policies: [...(source.policies || [])],
    gallery: [...(source.gallery || [])],
    menu: [...(source.menu || [])],
    reservations: [...(source.reservations || [])],
    staff: [...(source.staff || [])],
    notifications: [...(source.notifications || [])],
    tables: [...(source.tables || [])],
    slotRecords: [...(source.slotRecords || [])],
    tableSlotRecords: [...(source.tableSlotRecords || [])],
    blockedTables: [...(source.blockedTables || [])],
    reviews: [...(source.reviews || [])],
    activity: { ...source.activity },
    timeSlotsConfig: {
      ...source.timeSlotsConfig,
      dates: { ...(source.timeSlotsConfig?.dates || {}) },
      slots: [...(source.timeSlotsConfig?.slots || [])],
    },
    schedule: {
      ...(source.schedule || {}),
      weekly: [...(source.schedule?.weekly || [])],
      rules: [...(source.schedule?.rules || [])],
    },
  };
}

export function ManagerProvider({ children, navigate, currentPage, params }) {
  const [data, setData] = useState(snapshot);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      // Force a fresh init so page refreshes always re-fetch data
      managerApi._readyPromise = null;
      await managerApi.ready();
      if (!mounted) return;
      setData(snapshot());
      setReady(true);

      // Check if we got actual data - if not, retry once after a short delay
      // (happens on page refresh when IDs need to be re-resolved from the API)
      const ids = JSON.parse(sessionStorage.getItem("manager_backend_ids_v1") || "{}");
      if (!ids.managerId) {
        setTimeout(async () => {
          if (!mounted) return;
          managerApi._readyPromise = null;
          await managerApi.ready();
          if (mounted) {
            setData(snapshot());
            setReady(true);
          }
        }, 800);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true,
      loading = false;
    async function reload() {
      if (loading || !managerApi._session().access_token) return;
      loading = true;
      try {
        await managerApi.refreshFromBackend();
        if (mounted) setData(snapshot());
      } catch (error) {
        console.warn("Unable to refresh manager data:", error.message);
      } finally {
        loading = false;
      }
    }
    // Staff check-in happens in a separate portal. Keep completion controls current.
    reload();
    window.addEventListener("focus", reload);
    const timer = currentPage === "reservations" ? window.setInterval(reload, 15000) : null;
    return () => {
      mounted = false;
      window.removeEventListener("focus", reload);
      if (timer) window.clearInterval(timer);
    };
  }, [currentPage]);

  const refresh = () => setData(snapshot());

  const value = {
    data,
    ready,
    storage: managerApi,
    refresh,
    saveData: (nextData) => {
      managerApi.saveData(nextData);
      setData(snapshot());
    },
    navigate,
    currentPage,
    params,
  };

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}
