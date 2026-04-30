import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src",
  build: {
    outDir: "../dist/client",
    emptyDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3142",
    },
  },
});
