# BUILD-PLAN

> Urutan pengerjaan MVP. Setiap tahap punya **kriteria selesai** yang bisa diuji. Jangan lompat tahap tanpa alasan. Centang di `docs/STATUS.md`, bukan di sini.
> Spesifikasi tiap hal ada di `explore.md` (bagian dirujuk di kurung).
> **Aturan sinkronisasi:** BUILD-PLAN adalah ringkasan; kode WAJIB mematuhi seluruh spesifikasi di `explore.md` (termasuk **A12**, **B19**, **B23**) dan rujukan `demo-event.html`. Setiap perubahan permintaan pemilik proyek harus disunting ke `explore.md`, `docs/DECISIONS.md`, dan `BUILD-PLAN.md`.

## Tahap 0: Konteks & repo
AGENTS.md, STATUS, DECISIONS, BUILD-PLAN; `git init`; `.gitignore`.
**Selesai bila:** agent baru bisa memahami proyek hanya dari berkas-berkas ini.

## Tahap 1: Scaffold & penjaga kualitas (B1–B5, B22)
- Proyek Vite + `@cloudflare/vite-plugin`, `wrangler.jsonc`, TypeScript strict, Tailwind v4.
- `theme.css` (token warna, font, gaya `seru`/`profesional`), `fonts.css`, `shared/config.ts`.
- Biome, Vitest, skrip `lint-tokens` dan `no-raw-img`, satu perintah `check`.
- Worker Hono kosong + SPA dengan 4 area (`event`, `booth`, `admin`, `screen`) dimuat terpisah.
**Selesai bila:** `check` lulus; dev server menyajikan SPA dan `/api/health`; mengganti warna di `theme.css` mengubah tampilan; menulis warna literal atau `<img>` mentah membuat lint gagal; bagian "Perintah" di AGENTS.md terisi.

## Tahap 2: Data & logika murni (B6, B13, B17, B20, B26)
- Skema Drizzle + migrasi D1 (events, booths, booth_photos, products, visitors, reviews, booth_stats, …).
- `shared/`: `schemas.ts` (Zod), `scoring.ts`, `event-state.ts` (`getEventState`), `fair-order.ts`, `visual.ts`, `log-events.ts`, daftar kode galat.
- `logger` terpusat; middleware `requireEvent`, `eventWriteGate`, `rateLimit`, `idempotency`.
**Selesai bila:** tes unit lulus untuk skor Bayesian, status event di semua kasus tepi (B17), keadilan urutan acak (10.000 seed), `completeness/initials/gridVisualMode`, dan idempotensi.

## Tahap 3: Admin inti (A3, A16, B7, B10, B26)
- Cloudflare Access (dengan bypass khusus dev), event: buat, jadwal, jadikan aktif, kategori ulasan.
- Booth: buat oleh admin, **impor CSV**, editor booth (profil, foto, produk), pemilik (isi/lepas email).
- `ActionButton`/`useAction`, `WriteAction`, `ImageUploader` + konversi WebP + validasi server.
**Selesai bila:** admin membuat event aktif, membuat booth **hanya dengan nama**, mengimpor CSV (termasuk tanpa kolom email), mengunggah foto; semua aksi tahan klik ganda; tes B26 butir 5–8 lulus.

## Tahap 4: Komponen & galeri (B14, A16)
- Primitif `ui/`, komponen `shared/` (`SafeImage`, `PhotoFrame`, `Present`, `BoothCard`, `RatingStars`, `PriceTag`, …).
- Galeri `/dev/components` dengan kolom **Data kosong** di semua tema.
**Selesai bila:** matriks fixture data kosong lulus (tidak ada `<img>` tanpa `src`, tidak ada heading kosong); kartu berukuran sama pada semua fixture.

## Tahap 5: Halaman pengunjung (A8, A12–A14, B19, B20, B23)
- Halaman event: hero + marquee, 01 Sorotan (bar progres), 02 Semua booth (kartu polaroid berselotip, hover/tilt mouse, acak per pengunjung), footer.
- Halaman booth: hero, slideshow (`grab`/`grabbing`), produk andalan + etalase, Kenalan, ulasan (baca saja dulu).
- Efek interaksi & animasi (**B23**, **B19**, `demo-event.html`): `ClickFx` (cincin klik, getar tombol nonaktif, percikan bintang), kursor kustom `--cursor-*`, suara Web Audio sintesis (`lib/sfx.ts`, `SoundProvider`, `SoundToggle`).
- Daftar incaran, bagikan, pratinjau tautan.
**Selesai bila:** booth lengkap dan booth hanya-nama tampil benar di semua halaman; mobile-first lolos; status event mengubah teks dan CTA; efek klik/mouse/kursor/suara B23 aktif pada gaya Seru dan menghormati `prefers-reduced-motion`.

## Tahap 6: Review, peringkat, moderasi dasar (A5–A7, A15, B9, B25)
- Login reviewer (Google 1-tap + OTP, Turnstile), form review, 1 review per orang per booth, `booth_stats`.
- Filter kata, laporan, review `held`, deteksi anomali dasar.
**Selesai bila:** review masuk dan mengubah peringkat konsisten (batch atomik); duplikat ditolak; booth tidak bisa menyembunyikan komentar (tes B25 butir 1).

## Tahap 7: Realtime, peringkat, hasil (A8, B8, B19, B20, B23)
- Snapshot + cache edge, `LiveHub` (DO), bagian 03 peringkat dan ulasan terbaru (animasi feed/baris & suara perubahan peringkat), layar besar `/screen`.
- Mode peringkat/rating, "Umumkan hasil", `WinnerReveal` (motion graphic panggung gelap, hitung mundur kinetik, pita juara, hiasan bunting/kilau/confetti palet UNIMED, fanfare suara), `ResultsList`.
**Selesai bila:** beban uji sesuai perkiraan B8; peringkat opsional benar-benar tidak dikirim server saat disembunyikan; animasi pemenang motion graphic + suara jalan di layar besar dan halaman pengunjung.

## Tahap 8: Portal booth & pendaftaran mandiri (A4, B7)
- `/register`, OTP, `/booth` portal (profil, produk, WhatsApp, Bagikan), email notifikasi.
**Selesai bila:** alur daftar → verifikasi → login berjalan; melepas pemilik membuat sesi lama `401 owner_changed`; hanya-baca setelah event selesai.

## Tahap 9: Admin lanjutan (A3, B13, B18)
- Data Grid (sunting sel, alasan wajib, pratinjau dampak peringkat), antrean moderasi, log, poster QR, ekspor.
**Selesai bila:** semua entitas bisa dilihat/disunting dengan jejak sebelum → sesudah; berfungsi penuh setelah event selesai.

## Tahap 10: Pengerasan & rilis (B11, B12, A13)
- Uji beban, aksesibilitas (WCAG AA, reduced motion), keamanan, domain (`eventunimed.id`, `media.eventunimed.id`), deploy.
**Selesai bila:** semua tes lulus, lalu ditinjau terhadap B11 (keamanan) dan B12 (biaya, deploy, observability), dan simulasi event penuh (booth, review, hasil) berjalan tanpa galat.

## Catatan urutan
- Tahap 3 dan 4 boleh bergantian bila perlu; keduanya hanya bergantung pada Tahap 2.
- Fitur v1 (XLSX, tampilan tersimpan, riwayat per baris, tema per event, deteksi anomali lanjutan) dikerjakan setelah MVP.
