import { Hono } from "hono";
import type { AppEnv } from "../app-env";

// Cadangan penyaji gambar (explore.md B15): produksi memakai domain kustom R2 (media.eventunimed.id) tanpa
// memanggil Worker; rute ini dipakai saat pengembangan lokal atau bila domain kustom bermasalah.
// Kunci objek diacak (uuid), jadi isi berkas aman di-cache selamanya.
const PREFIX = "/media/";

export const mediaRoutes = new Hono<AppEnv>().get(`${PREFIX}*`, async (c) => {
  const key = decodeURIComponent(c.req.path.slice(PREFIX.length));
  // Hanya ruang nama gambar kita; tidak ada penelusuran jalur.
  if (!key.startsWith("events/") || key.includes("..")) return c.body(null, 404);

  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.body(null, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("content-type", "image/webp");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(obj.body, { headers });
});
