/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // Expose HELPDESK_URL and HELPDESK_TOKEN from .env as import.meta.env.HELPDESK_*.
  // They end up in the browser bundle: fine for the practice API, worth a line in DECISIONS.md.
  envPrefix: ["VITE_", "HELPDESK_"],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
