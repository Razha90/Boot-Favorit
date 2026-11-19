# STATUS

> Diperbarui setiap tahap selesai atau keputusan berubah. Agent baru: mulai dari sini.

**Terakhir diperbarui:** 2026-11-19

## Posisi sekarang

- **Fase:** pengerjaan (pemilik proyek menyetujui masuk tahap pengerjaan, 2026-11-19).
- **Tahap 0 sampai 5: SELESAI.** `npm run check` lulus (exit 0): Biome, tiga penjaga, `tsc -b` (4 proyek), **615 tes**. Build produksi berhasil; bundle awal **±69 KB gzip**; galeri tidak ikut produksi. Chrome sungguhan (dev server, viewport HP 390×844 + desktop): alur admin **17/17** (`admin-flow.mjs`), **halaman pengunjung semua lulus** (`visitor-flow.mjs`, ±65 pemeriksaan), galeri **9/9** (`gallery-visual.mjs`), **0 teks di bawah kontras AA** di tiga kombinasi gaya/tema (`gallery-contrast.mjs`).
- **Tahap berikutnya:** **Tahap 6: Review, peringkat, moderasi dasar** (lihat `BUILD-PLAN.md`). Belum dimulai. **Item 58** (ambang peringkat) perlu dijawab dulu.
- **Git:** repo diinisialisasi (`main`). **Belum ada commit**; commit hanya atas permintaan pemilik proyek.

## Sudah ada

- Spesifikasi: `explore.md` (A0–A16, B1–B26, Keputusan Terbuka). Demo visual: `demo-event.html` (belum mencerminkan A16).
- Konteks: `AGENTS.md`, `CLAUDE.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/BUILD-PLAN.md`.
- **Tahap 1:** scaffold, tema (`theme.css`), empat area dimuat terpisah, penjaga `lint-tokens`/`no-raw-img`/`lint-boundaries`.
- **Tahap 2:** logika murni di `src/shared/`, 14 tabel D1 + migrasi, middleware (`eventWriteGate`, `idempotency`, `rateLimit`, logger), `GET /api/event`.
- **Tahap 3 (backend, `src/worker/`):**
  - `requireAdmin`: verifikasi JWT Cloudflare Access (RS256, Web Crypto, rotasi kunci) + daftar `ADMIN_EMAILS`; gagal tertutup; jalur dev hanya di `localhost` dan `APP_ENV=development`.
  - Event (`routes/admin/events.ts`, `services/events.ts`): buat (slug otomatis, kategori ulasan bawaan), ubah jadwal/pengaturan dengan validasi gabungan, **jadikan aktif dalam satu `batch()`** (tepat satu aktif), sembunyikan/tampilkan, tutup/perpanjang pendaftaran, kategori ulasan (tidak pernah dihapus).
  - Booth (`services/booths.ts`): **buat hanya dengan nama** (langsung tayang), **impor CSV** (potongan 50 per batch atomik, hasil per baris), daftar + filter, ubah dengan kontrol versi dan alasan wajib hanya untuk pemilik aktif, isi/lepas pemilik, WhatsApp atas nama pemilik.
  - Media (`services/media.ts`): unggah multipart `full`+`thumb`, validasi WebP (tipe, byte, dimensi dari header), R2 dengan bersih-bersih bila gagal, foto galeri (maks. 6, urutkan, hapus), logo, foto produk; `GET /media/*`.
  - Produk (`services/products.ts`): batas atomik per event, satu andalan, `booth_stats` turunan, foto opsional.
- **Tahap 3 (frontend, `src/web/`):** `lib/api.ts` (klien + `NetworkError`), `lib/action.ts` + `use-action.ts` (anti klik ganda, kunci idempotensi per niat), `ActionButton`, `WriteAction` + `EventStateProvider` (waktu server), `SafeImage`, `ImageUploader` + `convert-to-webp` (EXIF, kualitas bertahap, verifikasi WebP), `lib/csv.ts` (parser + pratinjau), `ui/` (Button, Form, Card, Badge, Spinner), halaman admin: daftar/buat event, kelola event (jadwal + kategori), daftar booth + tambah, impor CSV, editor booth (profil, pemilik, foto/logo, produk, WhatsApp). Teks admin di `lib/copy.ts`.

## Tahap 4 (komponen & galeri): ringkasan

- **`src/web/components/ui/`**: `Button`, `ActionButton` (+ `onStatusChange`), `Form` (Field/Input/Textarea/Select), `Card` + `Badge`, `Spinner`, `Modal` + `ConfirmDialog` (`<dialog>`, terkunci saat pending), `Toast`, `states` (`Skeleton`, `EmptyState`, `ErrorState`).
- **`src/web/components/shared/`**: `SafeImage` (+ `onFail`), `Present`, `PhotoFrame`, `RatingStars` (display + input radiogroup), `RatingSummary`, `PriceTag`, `ProfileCompleteness`, `BoothCard` (card, spotlight, row, compact, admin), `BoothGrid`, `ProductCard`/`ProductGrid`/`FeaturedProduct`, `WriteAction`, `ImageUploader`.
- **Tipe publik**: `PublicBooth`, `PublicProduct`, `FeaturedProductBrief` di `shared/api-types.ts` (Tahap 5 mengisinya dari snapshot).
- **Galeri `/dev/components`** (`src/web/dev/`, hanya `import.meta.env.DEV`; **terbukti tidak ikut build produksi**): tiap komponen × fixture × gaya (`seru`/`pro`) × tema (`kertas`/`panggung`). Fixture bersama (`dev/fixtures.ts`): Lengkap, Nama+nomor, Hanya nama, Foto gagal (404), Teks kosong/spasi, Nama 60 huruf, Emoji/simbol, Semua gratis.
- **Matriks data kosong** (`empty-data.test.tsx`, 70+ tes): setiap varian × fixture bersih sebelum dan sesudah gambar gagal; foto gagal = tanpa foto (HTML bingkai identik); sorotan beralih ke hanya-teks; kartu seragam; grid tanpa foto → mode teks.
- **Hasil uji yang mengubah desain**: (1) teks `muted` tak terbaca di atas warna stiker (2,1:1 terang, 1,1:1 gelap) → blok stiker menimpa `--muted`; (2) bintang input kosong 1,3:1 → token `--star-off` digelapkan (≥ 3:1); (3) label aksesibel bintang memakai titik desimal → koma id-ID; (4) penjaga `no-raw-img` memberi positif palsu pada komentar/tes → mengabaikan komentar dan berkas tes.

## Tahap 5 (halaman pengunjung): ringkasan

- **API publik** (`routes/public.ts`, `services/public.ts`): `GET /api/snapshot`, `GET /api/booths/:id`, `GET /api/booths/:id/products`. Rating disembunyikan **ditegakkan server** (angka, jumlah, sebaran tidak dikirim). Promo dan penanda produk serta `hasWhatsapp` hilang setelah event selesai. Nomor WhatsApp **tidak pernah** ada di JSON/HTML; tombol menuju `GET /go/wa/:boothId?p=` (302 ke `wa.me`, dibatasi laju, `no-store`, 404 setelah event selesai).
- **Pratinjau tautan** (`routes/pages.ts`, `lib/page-meta.ts`): Worker melayani `/` dan `/b/:id` lewat `env.ASSETS.fetch("/")` lalu menyisipkan meta (nama event/booth, deskripsi, OG image absolut); semua nilai di-escape. **Terbukti jalan di dev** (binding `ASSETS` + `run_worker_first` di `wrangler.jsonc`).
- **Gambar event** (`services/event-media.ts`, `EventMediaCard`): logo, gambar OG, 0–3 foto kolase hero; semuanya opsional.
- **Area event** (`areas/event/`): `layout` (QueryClient + jam server + incaran), `pages/home` (Hero, Sorotan adil, Semua booth acak per pengunjung dan stabil, kaki halaman), `pages/booth` (chunk terpisah; slideshow, andalan, etalase 6 + "lebih banyak" + chip kategori > 8, Kenalan 4 baris, ulasan baca-saja, kartu penilaian menurut status, bilah bawah HP). Lib: `visitor-seed`, `wishlist` (maks. 50, per event, `safe-storage`), `share`, `hero-copy`.
- **Tes**: Worker 222; web: komponen event (41), halaman utuh dengan `fetch` palsu (32, termasuk matriks setiap fixture booth di halaman booth dan beranda sebelum/sesudah semua gambar 404), matriks data kosong komponen event (42), pembantu `src/web/test/render.tsx` (`renderEvent`, `isEmpty`). Galeri `/dev/components` kini memuat `dev/EventGallery.tsx` (Hero ×4 status, slideshow 0/1/3, sorotan, etalase, Kenalan, kartu penilaian ×3, kaki halaman).
- **Hasil uji yang mengubah desain/kode**: (1) tinggi kartu booth bergantung kelengkapan data (booth hanya-nama 26 px lebih pendek) → blok info kartu kini **tinggi tetap** (baris stiker disisakan, judul `line-clamp-2` + tinggi 2 baris; diukur 318 px untuk 8 fixture) dan nomor booth tidak diulang di dalam bingkai; (2) `Modal` memakai `id="modal-title"` tetap → id ganda dan `aria-labelledby` salah bila banyak dialog (satu per tombol Bagikan) → `useId`; (3) segmen progres slideshow adalah `<li>` kosong → disembunyikan dari teknologi bantu; (4) skrip kontras tidak membaca `oklab()` (positif palsu) → membaca warna lewat canvas, dan bagian "Event ·" hanya diukur di seru/kertas karena area event tidak pernah memakai tema lain.
- **Catatan jujur**: kartu penilaian saat event berjalan masih pengganti ("Form penilaian lagi disiapkan") sampai **Tahap 6**. Snapshot dibaca langsung dari D1 (tanpa Cache API/Durable Object) sampai **Tahap 7**. Kontras halaman sungguhan diukur lewat komponen di galeri, bukan skrip khusus halaman.

## Kriteria selesai Tahap 5 (BUILD-PLAN): terpenuhi

| Kriteria | Bukti |
|---|---|
| Booth lengkap dan hanya-nama tampil benar di semua halaman | `pages.test.tsx` (matriks fixture × halaman) + `visitor-flow.mjs` (booth A lengkap, B hanya-nama, C foto 404; tanpa gambar rusak, tanpa gulir horizontal) |
| Mobile-first | `visitor-flow.mjs` di 390×844 (kartu ≥ 44 px, bilah bawah, tanpa gulir horizontal) + tangkapan layar desktop |
| Status event mengubah teks dan CTA | `event-components.test.tsx`, `pages.test.tsx`, dan E2E (belum mulai → live → selesai lewat ubah jadwal di admin API) |
| Keadilan | E2E: urutan berbeda antar pengunjung (6 dari 8) dan stabil saat reload; kartu seragam; tanpa lencana peringkat |

## Kriteria selesai Tahap 3 (BUILD-PLAN): terpenuhi

| Kriteria | Bukti |
|---|---|
| Admin membuat event aktif | E2E + tes `events.test.ts` |
| Membuat booth hanya dengan nama | E2E + `booths.test.ts` |
| Impor CSV termasuk tanpa kolom email | E2E (daftar nama; titik koma) + `booths.test.ts` + `csv.test.ts` |
| Mengunggah foto | E2E (konversi WebP di Chrome → R2 → tampil dari `/media`) + `media.test.ts` |
| Semua aksi tahan klik ganda | E2E (3 klik satu tick → 1 booth), `action.test.ts`, `ActionButton.test.tsx`, tes idempotensi per rute |
| Tes B26 butir 5–8 | `booths.test.ts` (booth hanya-nama, pemilik, klik ganda, impor CSV) |

## Belum dikerjakan dari lingkup Tahap 3 (sengaja)

- **"Kirim undangan"** ke pemilik (`POST …/invite`): menunggu penyedia email (Tahap 8). Mengisi email sudah bekerja tanpa mengirim apa pun.
- ~~Unggah gambar event~~: selesai di Tahap 5 (`EventMediaCard`).
- **`ProductEditor`/`BoothProfileForm` masih di `areas/admin/components/`**, bukan `shared/`: pindah ke `shared/` saat portal booth (Tahap 8) memakainya, lalu beri adaptor API (pemilik vs admin).
- **Pembatas laju unggahan per booth**: Tahap 6 (bersama pembatas yang tegas).
- Konversi gambar masih di thread utama (belum Web Worker) dan tanpa encoder WASM cadangan (B15).

## Hal yang perlu diketahui agent berikutnya

- **Lokal**: salin `.dev.vars.example` ke `.dev.vars` (admin dev), terapkan migrasi (`npx wrangler d1 migrations apply booth-favorit --local`), lalu `npm run dev`. E2E: `npm i --no-save puppeteer-core` lalu `node scripts/e2e/admin-flow.mjs` (lihat header berkas).
- **Sebelum deploy** (Tahap 10): set `APP_ENV` produksi ≠ `development`; isi secret `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS`; buat D1 dan R2 sungguhan; pasang domain `media.eventunimed.id` lalu `VITE_MEDIA_BASE_URL`.
- **Temuan Tahap 3 yang mengubah desain**: (1) unggah = satu POST multipart, bukan dua PUT (B15 diperbarui); (2) hash idempotensi menormalkan batas multipart (kalau tidak, "Coba lagi" ditolak 422); (3) `version` booth dibuat naik monoton (`max(now, versi+1)`), karena dua perubahan dalam milidetik yang sama membuat kontrol konkurensi buta; (4) middleware idempotensi menghitung hash dari salinan permintaan (`raw.clone()`), bukan `c.req.text()` yang merusak badan biner.
- **Pola layanan**: route (validasi Zod + log) → service (`db`, `Deps {now, newId}`) → tipe respons di `shared/api-types.ts`. Tes rute memakai `adminHarness()` (`src/worker/test/admin.ts`) lengkap dengan D1 SQLite dan R2 palsu.
- **Pola UI**: setiap aksi tulis memakai `ActionButton`; teruskan `ctx.key` sebagai `Idempotency-Key`; pakai `resetOn` agar kunci baru dibuat saat isian berubah; data lewat TanStack Query hanya di area admin (`QueryClient` dibuat di `areas/admin/layout.tsx`, chunk terpisah ±5 KB gzip).
- Bundle awal ±69 KB gzip; chunk admin tidak termuat pengunjung; halaman booth chunk sendiri (±3 KB gzip).
- **E2E pengunjung**: jalankan dev server (`npx vite --port 5197 --strictPort`) lalu `node scripts/e2e/visitor-flow.mjs`. Skrip menyemai event BARU lewat API admin dan **mengaktifkannya** (menggantikan event aktif di D1 lokal), membuat foto WebP sungguhan lewat canvas, dan mengubah jadwal untuk menguji tiga status. Pelajaran: bilah bawah HP bersifat `fixed`, jadi klik harus didahului gulir ke tengah (`tap()`); gambar *lazy* di luar layar belum `complete`, jangan dihitung rusak.
- Tes jsdom memakai docblock `// @vitest-environment jsdom`; di jsdom `offsetWidth` = 0 dan isian di `<fieldset disabled>` dicek dengan `:disabled`.
- Versi paket lebih baru dari yang lazim (Vite 8, React Router 8, TypeScript 7, Biome 2.6, Vitest 5, React Query 5.108); semuanya berjalan bersama. `npm audit`: temuan hanya di rantai dev `drizzle-kit → esbuild`; jangan `fix --force`.
- Pembatas laju masih di memori satu isolate (best-effort); yang tegas dipasang di Tahap 6.

## Langkah berikutnya (Tahap 6: Review, peringkat, moderasi dasar, A5–A7, A15, B9, B25)

1. Login reviewer (Google 1-tap + OTP email, Turnstile), form review di `RatePanel` (saat ini pengganti), satu review per orang per booth, `booth_stats` dihitung dalam `batch()` yang sama, `stats_version` naik.
2. Filter kata, laporan, review `held`, deteksi anomali dasar; **booth tidak boleh menyembunyikan komentar** (tes B25 butir 1).
3. Pembatas laju yang tegas (review, OTP, unggahan per booth) lewat antarmuka `rateLimit` yang sudah ada.
4. Ulasan pada halaman booth (kartu "Kata pengunjung lain" saat ini hanya sebaran + ajakan; isi ulasan menyusul bersama API review).
5. Halaman booth: prefill/`?p=` sudah siap; kartu penilaian cukup mengganti `children` pada `RatePanel`.

## Keputusan sementara (default dipakai sampai pemilik proyek memutuskan)

| Hal | Default sementara | Item di explore.md |
|---|---|---|
| Mode verifikasi reviewer | `google_or_email` (Google 1-tap + OTP email cadangan) | 2 |
| Review yang ditandai anomali | **ditahan** sampai admin memutuskan | 6 |
| Penyedia email | abstraksi modul `email`; penyedia dipilih nanti | 5 |
| Format ekspor | CSV di MVP, XLSX di v1 | 16 |
| `minReviewsToRank` / `m` | 3 / 5 (perlu ditinjau, lihat 58) | 58 |

## Blokir / pertanyaan terbuka

- Tidak ada yang memblokir Tahap 6 selain **item 58** di bawah. **Item 58** (ambang peringkat) dan perkiraan skala (item 1) perlu dijawab sebelum Tahap 6; penyedia email (item 5) sebelum Tahap 8.
- `demo-event.html` belum menampilkan booth tanpa foto/hanya nama (A16); opsional diperbarui.
