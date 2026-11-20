import { createContext } from "react";

// Routing metadata only. Account, booking and server data are owned by Redux.
export const NavigationContext = createContext({
  currentPage: "",
  params: {},
  navigate() {},
});
