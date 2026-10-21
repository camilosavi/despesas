/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./": o site fica em camilosavi.github.io/despesas/ (subpasta), então os caminhos são relativos.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, target: "es2020", chunkSizeWarningLimit: 700 },
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
});
