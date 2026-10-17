import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scopeActorStyles } from "./build/scopeStyles.js";

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [scopeActorStyles()] } },
});
