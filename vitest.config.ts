import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromSrc = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

// Terpisah dari vite.config.ts: tes tidak perlu plugin Cloudflare/Tailwind/React.
export default defineConfig({
  resolve: {
    alias: {
      "@web": fromSrc("web"),
      "@shared": fromSrc("shared"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
});
