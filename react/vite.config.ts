import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// O motor de cálculo fica em ../novo/base (uma só fonte, testada lá). O React só importa de lá.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { fs: { allow: [".."] } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/setup.ts"] },
});
