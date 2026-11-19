import { defineConfig } from "drizzle-kit";

// Migrasi SQL dihasilkan ke ./drizzle dan diterapkan oleh `wrangler d1 migrations apply` (wrangler.jsonc: migrations_dir).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/worker/db/schema.ts",
  out: "./drizzle",
});
