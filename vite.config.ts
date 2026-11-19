import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const fromSrc = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@web": fromSrc("web"),
      "@shared": fromSrc("shared"),
    },
  },
});
