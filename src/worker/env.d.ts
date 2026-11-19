// Konfigurasi opsional yang TIDAK ada di wrangler.jsonc: diisi lewat `wrangler secret` (produksi)
// atau `.dev.vars` (lokal). Digabung ke interface Env hasil `wrangler types`.
interface Env {
  /** Domain tim Cloudflare Access, mis. "lppm.cloudflareaccess.com" (tanpa https://). */
  ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience (AUD) tag aplikasi Access untuk /admin/* dan /api/admin/*. */
  ACCESS_AUD?: string;
  /** Daftar email admin dipisah koma. Hanya email di daftar ini yang boleh masuk /api/admin/*. */
  ADMIN_EMAILS?: string;
  /** Basis URL gambar (domain kustom R2, mis. https://media.eventunimed.id). Kosong = `${origin}/media`. */
  MEDIA_BASE_URL?: string;
  /**
   * HANYA untuk pengembangan lokal: email admin palsu. Hanya berlaku bila APP_ENV = "development"
   * DAN permintaan datang ke localhost/127.0.0.1 (pertahanan berlapis agar tidak terbawa ke produksi).
   */
  DEV_ADMIN_EMAIL?: string;
}
