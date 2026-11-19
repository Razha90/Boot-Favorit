# AGENTS.md — Boot-Favorit

Web **Penilaian Booth Terfavorit LPPM Expo Tahun 2026**: booth peserta mendaftar (atau dibuat admin), pengunjung memberi bintang + review, dashboard publik live. Berkas ini dibaca pertama oleh agent mana pun (Claude Code, Codex, Cursor, dll.).

## Mulai di sini

1. Baca **`docs/STATUS.md`**: tahap sekarang, yang selesai, langkah berikutnya.
2. Baca **`docs/DECISIONS.md`**: keputusan yang sudah final. Jangan diperdebatkan ulang tanpa diminta pemilik proyek.
3. Baca **`docs/BUILD-PLAN.md`** untuk tahap yang sedang dikerjakan (kriteria selesai).
4. Spesifikasi lengkap ada di **`explore.md`** (±2.600 baris, **jangan dibaca sekaligus**). Cari bagian yang relevan dengan Grep pada judul `^## ` lalu baca per bagian. Peta bagian di bawah.

## Aturan menjaga konteks (WAJIB)

- **Aturan edit saat ada perubahan (WAJIB):** setiap ada perubahan spesifikasi, fitur, visual, atau alur yang diminta pemilik proyek → **segera perbarui ke `explore.md`** (bagian terkait + Keputusan Terbuka), **`docs/DECISIONS.md`** (tambah baris/bagian baru yang menggantikan aturan lama, jangan menghapus riwayat), **`docs/BUILD-PLAN.md`** (bila mengubah cakupan/kriteria tahap), **`docs/STATUS.md`**, dan **`AGENTS.md`** sebelum berhenti.
- **Jangan abaikan spesifikasi yang sudah disetujui:** `docs/BUILD-PLAN.md` hanyalah ringkasan tahapan. Agent wajib memeriksa bagian rinci di `explore.md` (termasuk **A12**, **B19**, **B23**) dan rujukan interaktif di `demo-event.html`. **Dilarang** menyatakan fitur yang sudah ada di `explore.md` / `docs/DECISIONS.md` sebagai "di luar lingkup" atau menghapusnya tanpa persetujuan eksplisit pemilik proyek.
- Selesai satu tahap, atau ada keputusan baru → **perbarui `docs/STATUS.md` dan `docs/DECISIONS.md` sebelum berhenti**.
- Jangan menyimpan konteks penting hanya di memori agent; tulis di repo.

## Batasan proyek (tidak terlihat dari kode)

- **Satu event aktif** di domain utama `eventunimed.id`; tanpa slug di URL publik. Gambar di `media.eventunimed.id`.
- **Nama resmi acara = judul utama** halaman. Dari UNIMED **hanya palet warna** (hijau `#1EB05F`, oranye `#FDA31B`, gelap `#19232B`, krem turunan); jangan meniru tata letak situs UNIMED; **tanpa navigasi**.
- Halaman pengunjung bergaya **Seru** (polaroid, stiker, bahasa mengajak: kamu/yuk/cobain/mampir); admin dan portal booth bergaya **Profesional**. Hindari tampilan generik "buatan AI" dan nuansa korporat.
- **Keadilan**: urutan booth acak per pengunjung, tanpa lencana peringkat di kartu, peringkat selalu di bagian paling bawah.
- **Booth boleh tanpa pemilik dan tanpa email**; satu-satunya data wajib adalah **nama**. **Foto opsional**: tanpa gambar atau saat gambar gagal dimuat, tampil **bersih hanya nama & teks tanpa kotak inisial `PhotoFrame`**; **tidak pernah** gambar rusak (explore.md A16, B26).
- Booth **tidak boleh** menyembunyikan komentar; hanya melaporkan.
- Setelah event selesai semua tampilan **hanya-baca**; hanya admin yang bisa mengubah apa pun.

## Stack

Cloudflare Workers + D1 + R2 + Durable Objects · Vite + `@cloudflare/vite-plugin` · React SPA (kode dipisah per area) · Tailwind v4 dengan token variabel · Hono · Drizzle · Zod. Rincian: explore.md B1–B3.

## Aturan teknis wajib

- **Warna dan font hanya di `theme.css`/`fonts.css`**; komponen memakai token (`bg-primary`, `font-display`). Dijaga skrip `lint-tokens`.
- **`<img>` hanya boleh ada di `SafeImage`** (lint `no-raw-img`). Bagian opsional dibungkus `Present`.
- **Setiap aksi yang mengubah data memakai `ActionButton`/`useAction`** (loader, anti klik ganda) dan server menerima `Idempotency-Key` (B21). Tombol tulis dibungkus `WriteAction` (hanya-baca setelah event selesai).
- **Teks UI hanya di `lib/copy.ts`.** Jangan memakai tanda kurung `(...)` untuk keterangan tambahan pada label/teks UI; pakai `InfoTip` (`Field.info` / `Card.info` / `<InfoTip />`). Angka tunable hanya di `shared/config.ts`.
- **Fitur web mengikuti Baseline** (Widely available; yang lebih baru dengan cadangan), B22.
- Antar-area (`event`, `booth`, `admin`, `screen`) **dilarang saling impor**; kode bersama ke `shared/` (B14, B16).
- Rahasia hanya lewat `wrangler secret`, tidak pernah di repo.

## Gaya kode

- **Bahasa**: kode (variabel, fungsi, kolom DB, endpoint) berbahasa **Inggris**; teks untuk pengguna berbahasa **Indonesia**. Komentar hanya untuk **"kenapa"**, boleh Indonesia.
- **TypeScript `strict`**, tanpa `any` (pakai `unknown` lalu persempit). Tipe diturunkan dari **skema Zod di `shared/schemas.ts`** (`z.infer`); tidak ditulis ulang di client dan server.
- **Nilai fixed bertipe sempit**: uang = integer rupiah, waktu = epoch ms UTC, status = union literal.
- **Logika bisnis berupa fungsi murni** (`getEventState`, `scoring`, `fairOrder`, `visual`), tanpa `Date.now()` langsung (waktu jadi argumen), agar bisa diuji dan dipakai client dan server.
- **Server berlapis searah**: route → service → query DB. Route hanya memvalidasi lalu memanggil service; service tidak tahu soal HTTP.
- **Komponen tampilan murni** (props saja); data diambil di hook/container. Variasi lewat prop `cva`, bukan salin-tempel. **Aturan dua**: markup di ≥ 2 tempat diekstrak.
- **File kecil, satu tanggung jawab** (±200 baris). Abstraksi baru hanya setelah dipakai dua kali.
- **Galat memakai kode tetap** (`product_limit`, `owner_changed`, …) dari daftar bersama; UI memetakannya ke teks di `copy.ts`. Jangan menelan galat diam-diam: catat lewat `logger` (B13) atau tampilkan. Semua input luar **divalidasi ulang di server**.
- **Dependensi baru** hanya dengan alasan jelas (cek ukuran dan perawatannya).
- **Satu alat format + lint: Biome.** Skrip khusus (`lint-tokens`, `no-raw-img`) terpisah.
- **Tes ditulis bersama fiturnya** (fungsi murni, keadilan, data kosong, idempotensi). Commit kecil berformat `feat:` / `fix:` / `docs:`.
- **Selesai** berarti: tes lulus, lint bersih, `docs/STATUS.md` diperbarui.

## Perintah

Node ≥ 22 (dicoba di Node 24, npm 11). Windows/PowerShell.

| Perintah | Fungsi |
|---|---|
| `npm install` | pasang dependensi |
| `npm run dev` | dev server Vite + Worker lokal (port 5173; `npx vite --port N` untuk port lain) |
| `npm run build` | build produksi ke `dist/` |
| `npm run check` | **gerbang wajib sebelum selesai**: Biome → `lint:tokens` → `lint:img` → `lint:boundaries` → `tsc -b` → Vitest |
| `npm run lint:fix` | Biome memformat dan memperbaiki otomatis |
| `npm test` | Vitest sekali jalan (`src/**/*.test.ts(x)`, `scripts/**/*.test.mjs`) |
| `npm run cf-typegen` | buat ulang `worker-configuration.d.ts` (jalankan setelah mengubah `wrangler.jsonc`) |
| `npx drizzle-kit generate --name <nama>` | buat migrasi SQL di `drizzle/` setelah mengubah `src/worker/db/schema.ts` |
| `npx wrangler d1 migrations apply booth-favorit --local` | terapkan migrasi ke D1 lokal (dipakai `npm run dev`) |

Catatan kerja:
- Biome tidak memformat `*.md`, `demo-event.html`, dan `worker-configuration.d.ts`; `biome.json` tidak boleh berisi komentar.
- Satu baris boleh dikecualikan dari penjaga dengan komentar `lint-ignore: token-color | token-font | raw-img | boundary` di baris yang sama. Pakai sangat jarang dan jelaskan alasannya.
- Alias impor: `@web/*` → `src/web/*`, `@shared/*` → `src/shared/*`. Berkas Worker memakai tipe `Env` global dari `worker-configuration.d.ts`.
- **Tes Worker**: `createTestDb()` (`src/worker/test/d1.ts`) memberi SQLite sungguhan yang sudah dimigrasi; `createApp({ now })` menerima jam palsu; `testEnv(t)` membuat `Env`. Tes `eventWriteGate` menelusuri semua rute tulis: rute `/api/*` non-admin baru otomatis harus menjawab `403 event_ended` setelah event selesai, kecuali ada di `FROZEN_ALLOWLIST`.
- **Lokal admin**: salin `.dev.vars.example` ke `.dev.vars` (`DEV_ADMIN_EMAIL`); bypass hanya di `localhost` + `APP_ENV=development`. **E2E browser**: `npm i --no-save puppeteer-core`, jalankan `npx vite --port 5197 --strictPort`, lalu `node scripts/e2e/admin-flow.mjs` atau `visitor-flow.mjs` (halaman pengunjung di viewport HP; menyemai event baru dan **mengaktifkannya**) (Chrome sistem; `agent-browser` menggantung di lingkungan ini). Skrip galeri `gallery-visual.mjs`/`gallery-contrast.mjs` memakai `E2E_BASE` (bawaan `http://localhost:5197`).
- **Tes area event**: `renderEvent()` (`src/web/test/render.tsx`) membungkus komponen dengan semua provider (router, query, status event, incaran, toast); `isEmpty(container)` untuk "tidak dirender" (wilayah `aria-live` milik Toast diabaikan). Tes halaman memakai `fetch` palsu (`areas/event/pages.test.tsx`). Di jsdom `AnimationEvent` dan `matchMedia` tidak ada: kirim `animationend` bersama `webkitAnimationEnd` dan pasang `matchMedia` sementara.
- **Tes pengunjung/review (Worker)**: `liveHarness()`, `loginWithOtp()`, `directVisitor()`, `visitorClient()`, `PROD_ENV` (`src/worker/test/visitor.ts`); `adminHarness(start, env, deps)` menerima `turnstile`/`email`/`googleKeys` palsu. **Rahasia baru** (`SESSION_SECRET`, `TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY`, `GOOGLE_CLIENT_ID`): lihat `.dev.vars.example`; produksi gagal tertutup bila kosong. E2E penilaian: `node scripts/e2e/review-flow.mjs`.
- **Realtime/hasil (Tahap 7)**: kode yang dipakai lebih dari satu area ada di `src/web/features/` (`event-data.tsx`, `live/`, `reveal/`, `EventBoundary.tsx`); `LiveProvider` hanya dipasang di halaman yang butuh (beranda event, Layar Besar). Worker: `live/hub.ts` (Durable Object `LiveHub`, binding `LIVE_HUB` + migrasi di `wrangler.jsonc`; jalankan `npm run cf-typegen` setelah mengubah), `lib/edge-cache.ts` (`edgeJson`), `lib/live-notify.ts` (`notifyLive`), `shared/live-core.ts` (murni). Vitest memakai alias `cloudflare:workers` → `src/worker/test/cloudflare-workers-stub.ts`. E2E: `node scripts/e2e/standings-flow.mjs` (peringkat, hasil, Layar Besar, animasi) dan `VIEWERS=300 REVIEWS=120 BOOTHS=10 node scripts/e2e/live-load.mjs` (WebSocket fungsional + beban lokal). Di lingkungan Windows ini jalankan `npm run check`/Vitest dari **PowerShell**: di shell Bash Vitest gagal memuat (`reading 'config'`).
- **Portal booth (Tahap 8)**: auth di `routes/booth/auth.ts` (tanpa sesi) dipasang SEBELUM `routes/booth/portal.ts` (`requireBooth` untuk semua `/api/booth/*`): urutan di `index.ts` penting. Rute media/produk portal berbentuk sama dengan admin; UI berbagi `features/booth-editor/` lewat `BoothScope` (`adminScope`/`ownerScope`). Tes: `test/booth.ts` (`loginBooth`, `registerBoothVia`, `setOwnerEmail`); `visitorClient.call` menerima `raw` (FormData). Email: `RESEND_API_KEY` + `EMAIL_FROM` (lihat `.dev.vars.example`). Rute `/api/*` non-admin yang baru otomatis diuji pembekuan; allowlist kini cocok path persis. E2E: `node scripts/e2e/booth-flow.mjs`. Alat Write lebih aman daripada heredoc Bash untuk berkas berisi tanda kutip melengkung.
- **Admin lanjutan & ruang kerja admin (Tahap 9 + UI redesign)**: definisi kolom & whitelist ada di `shared/data-grid.ts`; pratinjau peringkat di `shared/rank-impact.ts`. Backend: `routes/admin/{data,logs}.ts`, `services/data/`, `lib/analytics-logs.ts` (butuh `CF_ACCOUNT_ID` + `CF_API_TOKEN` untuk AE SQL API; tanpa itu `{configured:false}`). Frontend (`areas/admin/`): `layout.tsx` memasang `ToastProvider`, breadcrumb, pintasan publik/Layar Besar, dan kerangka persisten `components/EventWorkspace.tsx` (satu `<nav>` responsif untuk seluruh rute `/admin/e/:id*`); `/admin` (`pages/events.tsx`) tata letak 2 kolom; `/admin/e/:id` (`pages/event.tsx`) menampilkan 4 kartu KPI + tab tugas (`overview` default berisi `ResultsCard` & checklist, `identity`, `schedule`, `categories`); halaman lain `pages/{data,logs,posters}.tsx`, komponen Data Grid di `components/data/`, ekspor CSV klien di `csv-export.ts` (dipakai `logs` dan `ResultsCard`). E2E: `node scripts/e2e/data-flow.mjs` (menguji setelah event selesai).
- **Pengerasan & observability (Tahap 10)**: header keamanan, CSP dev-vs-prod, dan guard CSRF ada di `src/worker/middleware/security.ts` + `public/_headers` (`security.test.ts`); endpoint kesehatan hari-H di `GET /api/admin/e/:id/health` + `LiveHub.stats()` (`routes/admin/logs.ts`, `EventHealth` di `shared/api-types.ts`, kartu **Kesehatan hari-H** di `areas/admin/pages/logs.tsx`); panduan deploy & runbook hari-H di `docs/DEPLOY.md`; CI di `.github/workflows/ci.yml`. E2E responsif/a11y: `scripts/e2e/a11y-responsive.mjs`; simulasi hari-H penuh: `scripts/e2e/full-event-sim.mjs`.
- **Interaksi & motion graphic (B23, A12, WinnerReveal)**: efek klik/percik bintang/tilt (`src/web/features/fx/ClickFx.tsx`), suara Web Audio sintesis tanpa berkas (`src/web/lib/sfx.ts`, `src/web/lib/sfx-bridge.ts`, `src/web/features/fx/SoundProvider.tsx` + `SoundToggle`), kursor kustom `--cursor-*` dan animasi ikon/panggung/pita/confetti/alert di `src/web/styles/theme.css`, sistem ikon SVG animatif `src/web/components/ui/Icon.tsx` (`Button` otomatis berikon), `MarqueeBanner` di `areas/event/components/chrome.tsx`, `WinnerReveal` panggung gelap bergaya motion graphic di `src/web/components/shared/WinnerReveal.tsx`, serta sistem alert kanan atas (`src/web/components/ui/Alert.tsx`, `Toast.tsx`, `ReadOnlyBanner` di `WriteAction.tsx`; loader hanya tampil saat `loading` atau `durationMs > 0`, alert `persistent`/tanpa auto-tutup tidak menampilkan loader).
- **`batch()` D1**: hanya pembangun kueri Drizzle (`insert/update/delete`) yang bisa masuk; `db.run(sql…)` tidak. Statistik booth ditulis ulang lewat `recomputeStatsStatement` (`services/stats.ts`).
- **Kartu booth bertinggi tetap** (keadilan): jangan membuat bagian kartu yang tingginya bergantung pada kelengkapan data; ukur dengan `gallery-visual.mjs`.
- **Galeri komponen**: `npm run dev` lalu buka `/dev/components` (hanya dev). Setiap komponen domain baru WAJIB ditambahkan ke galeri dan ke matriks `empty-data.test.tsx` (fixture di `src/web/dev/fixtures.ts`). Gambar di komponen lewat `SafeImage` + `useMediaUrl()`; bagian opsional lewat `Present`. Pemeriksaan visual/kontras: `scripts/e2e/gallery-visual.mjs` dan `gallery-contrast.mjs` (butuh `puppeteer-core`).
- **Aksi tulis di UI** selalu lewat `ActionButton` (`ctx.key` → header `Idempotency-Key`; `resetOn` saat isian berubah). Tipe respons API ada di `src/shared/api-types.ts` (dipakai worker dan web).
- **Pola middleware** (urutan): `baseContext` → `loadActiveEvent` → `eventWriteGate` → (auth) → `idempotency` → handler. Galat dilempar sebagai `ApiError(kode)`; jangan membuat respons galat manual.
- **Logging hanya lewat `logEvent`** (`src/worker/lib/logger.ts`); jangan `console.log` langsung. Tambah aksi baru di `src/shared/log-events.ts`.
- Rute `/api/*` ditangani Worker (Hono, `src/worker/index.ts`); selain itu SPA. Rute SPA dipetakan di `src/web/router.tsx` (hanya peta, tanpa isi halaman).

## Peta explore.md

| Bagian | Isi |
|---|---|
| A0–A3 | event aktif, peran, jadwal & status, flow admin, Data Grid |
| A4–A7 | flow booth, flow reviewer, anti-spam, peringkat Bayesian |
| A8–A10 | halaman event (keadilan), sitemap, prinsip UX |
| A12–A13 | gaya visual & gerak, responsif |
| A14–A16 | produk & promosi, moderasi kata, booth tanpa pemilik & data kosong |
| B1–B5 | stack, arsitektur, struktur repo, tema, konfigurasi |
| B6–B11 | model data, auth, realtime, anti-spam, API, keamanan |
| B12–B13 | biaya/deploy, log |
| B14–B16 | komponen, upload gambar, pemisahan kode |
| B17–B21 | jadwal event, Data Grid, animasi, keadilan tampilan, anti klik ganda |
| B22–B26 | Baseline, efek interaksi, produk teknis, moderasi teknis, booth admin & data kosong |
| Keputusan Terbuka | daftar keputusan (yang dicoret sudah final) |
