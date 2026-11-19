# Panduan Deploy, Observability, dan Runbook Hari-H

> Rujukan: `explore.md` B11 (Keamanan & privasi) dan B12 (Biaya, deploy, observability).

## 1. Sumber daya Cloudflare yang dibutuhkan

Buat terpisah untuk `staging` dan `production`:

1. **D1 Database**
   - `npx wrangler d1 create booth-favorit` (lalu isi `database_id` di `wrangler.jsonc` / lingkungan `staging`).
   - Terapkan migrasi: `npx wrangler d1 migrations apply booth-favorit --remote`.
2. **R2 Bucket & Custom Domain Media**
   - `npx wrangler r2 bucket create booth-media`.
   - Pasang **Custom Domain** `media.eventunimed.id` pada bucket tersebut (tanpa cookie) dan set `MEDIA_BASE_URL=https://media.eventunimed.id`.
   - Bila memakai URL lain saat build SPA, isi `VITE_MEDIA_BASE_URL=https://media.eventunimed.id` sebelum `npm run build`.
3. **Durable Objects & Analytics Engine**
   - `LiveHub` (`LIVE_HUB`) dan dataset AE `booth_favorit_logs` (`LOG`) sudah terkonfigurasi di `wrangler.jsonc`.
4. **Workers Paid & Alarm Anggaran**
   - Aktifkan **Workers Paid** sebelum acara agar kuota request dan Durable Objects mencukupi, lalu pasang alarm penggunaan/biaya di dashboard Cloudflare.

## 2. Variabel & Rahasia (`wrangler secret put`)

**Jangan pernah menaruh rahasia di repo atau `wrangler.jsonc`.**

| Nama | Jenis | Wajib di prod? | Keterangan |
|---|---|---|---|
| `APP_ENV` | var (`wrangler.jsonc`) | Ya (`production`) | Mematikan bypass dev (`devCode` OTP, jalur admin lokal, skip Turnstile) |
| `MEDIA_BASE_URL` | var (`wrangler.jsonc`) | Ya | `https://media.eventunimed.id` |
| `SESSION_SECRET` | secret | **Wajib** | String acak ≥ 32 karakter (HMAC sesi pengunjung & booth) |
| `ACCESS_TEAM_DOMAIN` | secret/var | **Wajib** | Domain tim Cloudflare Access (`<tim>.cloudflareaccess.com`) |
| `ACCESS_AUD` | secret | **Wajib** | Application Audience Tag dari kebijakan Cloudflare Access untuk `/admin/*` |
| `ADMIN_EMAILS` | secret | **Wajib** | Daftar email admin dipisahkan koma |
| `TURNSTILE_SECRET` | secret | **Wajib** | Secret key Cloudflare Turnstile (domain `eventunimed.id` terdaftar) |
| `TURNSTILE_SITE_KEY` | secret/var | **Wajib** | Site key publik Cloudflare Turnstile |
| `GOOGLE_CLIENT_ID` | var | Opsional* | Client ID Google Identity (*wajib bila mode `google_or_email` memakai tombol Google) |
| `RESEND_API_KEY` | secret | Opsional* | API key Resend (*wajib agar OTP email dan undangan booth terkirim di produksi) |
| `EMAIL_FROM` | var/secret | Opsional* | Alamat pengirim terverifikasi SPF/DKIM pada domain `eventunimed.id` |
| `CF_ACCOUNT_ID` | secret | Opsional | ID akun Cloudflare untuk membaca Analytics Engine di halaman `/admin/e/:id/logs` |
| `CF_API_TOKEN` | secret | Opsional | Token API **read-only** (`Account Analytics: Read`) untuk AE SQL API |

## 3. Cloudflare Access & Domain

- Pasang aplikasi Cloudflare Access melindungi `eventunimed.id/admin*` dan `eventunimed.id/api/admin*`.
- Daftarkan `https://eventunimed.id` sebagai *Authorized Origin* di Google Identity Services dan Turnstile.
- Pastikan header keamanan (`public/_headers` untuk aset statis + middleware `securityHeaders` / `buildCsp` di Worker) aktif setelah deploy.

## 4. Perintah Deploy & CI

- CI otomatis berjalan di `.github/workflows/ci.yml`: `npm ci` → `npm run check` → `npm run build`.
- Deploy manual setelah seluruh cek lulus:
  1. `npx wrangler d1 migrations apply booth-favorit --remote`
  2. `npm run build`
  3. `npx wrangler deploy`
  4. Cek asap: `GET https://eventunimed.id/api/health` → `{ "ok": true, "env": "production" }` dan buka `/` serta `/admin`.

## 5. Runbook Hari-H (Observability & Tindakan Darurat)

- **Pantau kesehatan acara**: buka `/admin/e/:id/logs` → panel **Kesehatan hari-H** (WebSocket penonton aktif, Layar Besar aktif, ulasan/menit, ulasan ditahan, laporan terbuka, booth menunggu) + Workers Logs di dashboard Cloudflare.
- **Menutup voting darurat**: buka `/admin/e/:id` → ubah **Event selesai** ke waktu sekarang → Simpan jadwal. Semua penulisan non-admin langsung ditolak (`403 event_ended`).
- **Menyembunyikan rating/peringkat saat ada indikasi manipulasi**: buka `/admin/e/:id` → **Hasil dan tampilan** → ubah **Rating booth** ke *Sembunyikan* (peringkat otomatis ikut tersembunyi di server).
- **Memblokir pengunjung bermasalah**: buka `/admin/e/:id/data` → tab **Pengunjung** → ubah kolom `Diblokir?` menjadi `Ya` → Simpan dengan alasan.
- **Beban WebSocket tinggi**: `LiveHub` otomatis membatasi penonton di `CONFIG.live.maxLiveViewers` (400, dengan 5 slot Layar Besar) dan klien yang ditolak (`503`) otomatis beralih ke polling tanpa galat tampilan.
- **Setelah acara selesai (privasi UU PDP, B11)**: hapus nomor WhatsApp booth lewat admin atau SQL retensi sesuai keputusan panitia, serta bersihkan sesi/data uji sebelum arsip.
