// Cangkang halaman admin (`/admin`, `/admin/*`) dijaga di Worker, bukan hanya datanya (explore.md B7, B11, B31):
// HTML aplikasi admin hanya disajikan bila lolos pemeriksaan yang SAMA dengan /api/admin/* (JWT Cloudflare Access +
// daftar email admin; bypass dev hanya localhost + APP_ENV=development). Selain itu halaman 403 polos, tanpa
// membocorkan isi aplikasi. Pertahanan berlapis: Cloudflare Access di tepi tetap jalur utama.
import { ApiError } from "@shared/errors";
import { Hono } from "hono";
import type { AppContext, AppEnv } from "../app-env";
import { type RequireAdminOptions, requireAdmin } from "../middleware/require-admin";
import { buildCsp } from "../middleware/security";

const DENIED_HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Akses ditolak</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f5;color:#19232b;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center}
main{max-width:28rem}
h1{margin:0 0 8px;font-size:1.75rem}
p{margin:0 0 20px;color:#4a5560}
a{display:inline-block;padding:10px 20px;border:3px solid #19232b;border-radius:999px;background:#fda31b;color:#19232b;font-weight:700;text-decoration:none}
</style>
</head>
<body>
<main>
<h1>Akses ditolak</h1>
<p>Halaman ini hanya untuk panitia. Masuk dengan akun yang terdaftar sebagai admin, lalu buka kembali halaman ini.</p>
<a href="/">Kembali ke halaman utama</a>
</main>
</body>
</html>
`;

export function createAdminPageRoutes(opts: RequireAdminOptions = {}) {
  const guard = requireAdmin({ getJwks: opts.getJwks });

  async function serve(c: AppContext) {
    let allowed = false;
    try {
      await guard(c, async () => {
        allowed = true;
      });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e; // hanya penolakan yang diubah menjadi halaman 403
    }
    const headers = {
      "content-type": "text/html; charset=utf-8",
      // Halaman per-pengguna: jangan pernah disimpan cache bersama
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      "content-security-policy": buildCsp(c.env),
    };
    if (!allowed) return new Response(DENIED_HTML, { status: 403, headers });

    const res = await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
    if (!res.ok) return new Response("Not found", { status: 404 });
    return new Response(await res.text(), { headers });
  }

  return new Hono<AppEnv>().get("/admin", serve).get("/admin/*", serve);
}
