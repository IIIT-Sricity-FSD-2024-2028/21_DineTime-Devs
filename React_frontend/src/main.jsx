import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import { Provider } from "react-redux";
import { store } from "./store/store.js";
import "./styles/global.css";
import "./apps/diner/styles/app.css";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
