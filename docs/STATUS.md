# STATUS

> Diperbarui setiap tahap selesai atau keputusan berubah. Agent baru: mulai dari sini.

**Terakhir diperbarui:** 2026-11-19

## Posisi sekarang

- **Fase:** pengerjaan (pemilik proyek menyetujui masuk tahap pengerjaan, 2026-11-19).
- **Tahap 0 sampai 8: SELESAI** (Tahap 6–8 dengan batasan jujur di bawah). `npm run check` lulus (exit 0): Biome, tiga penjaga, `tsc -b` (4 proyek), **1168 tes** (61 file). Build produksi berhasil; chunk awal **±72 KB gzip** (portal booth 8 KB, lazy); galeri tidak ikut produksi. Portal booth diuji di Chrome sungguhan (`booth-flow.mjs`, 26 pemeriksaan). Chrome sungguhan (dev server, viewport HP 390×844 + desktop): alur admin (`admin-flow.mjs`), halaman pengunjung (`visitor-flow.mjs`), alur penilaian (`review-flow.mjs`), **alur peringkat/hasil/Layar Besar/animasi** (`standings-flow.mjs`, 31 pemeriksaan), galeri **9/9** (`gallery-visual.mjs`), **0 teks di bawah kontras AA** di tiga kombinasi (`gallery-contrast.mjs`).
- **Tahap berikutnya:** **Tahap 9: Admin lanjutan** (Data Grid, log, poster QR, ekspor; lihat `BUILD-PLAN.md`). Belum dimulai.
- **Git:** `9556f9c` (Tahap 0–5), `b9ff2ce` (Tahap 6), `a3ab182` (Tahap 7). **Tahap 8 belum di-commit**; commit hanya atas permintaan pemilik proyek.

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

## Tahap 6 (review, moderasi): ringkasan

- **Fungsi murni** (`src/shared/`): `moderation.ts` (normalisasi kata: huruf berulang, leetspeak, homoglyph, penanda tak terlihat, eja "a.n.j.i.n.g", imbuhan; pencocokan kata utuh vs `contains`; `allow` menang atas `block`; pola kontak/tautan/iklan; penyamaran `b***t`), `moderation-seed.ts` (**daftar awal**, ±39 entri termasuk 4 pengecualian), `risk.ts` (skor risiko), `schemas.ts` (skema masukan **strict**: kolom asing ditolak).
- **Worker**: login pengunjung (`routes/visitor.ts`: email OTP, Google ID token, kode tiket, anonim bila mode terbuka; mode diatur per event; cookie HttpOnly bertanda tangan terikat event; Turnstile; pembatas laju), review (`routes/reviews.ts`: kirim/edit, daftar publik berkursor, milikku, lapor), moderasi admin (`routes/admin/moderation.ts`: antrean, keputusan laporan, status komentar, sunting/pulihkan/hapus, daftar kata + uji kalimat, blokir pengunjung). Layanan: `reviews`, `public-reviews`, `reports`, `admin-moderation`, `moderation`, `otp`, `visitors`, `stats`.
- **Statistik**: `booth_stats` dihitung **ulang dari tabel review** dalam satu pernyataan SQL di dalam `batch()` yang sama dengan penulisan review (`services/stats.ts`); hanya review `visible` yang dihitung; komentar `held`/`masked` tidak mempengaruhi bintang. Peringkat (`rankBooths`) dibuktikan konsisten dengan review di tes.
- **Frontend**: `ReviewFlow` (masuk → form → terima kasih) di kartu penilaian, `ReviewsSection` (ulasan berkursor + "Sering disebut"), `ReportDialog`; admin: halaman **Moderasi** (4 tab) dan pemilih **mode masuk** di pengaturan event. Teks di `copy.ts`; widget Turnstile dan Google dimuat dinamis (tidak di bundle awal).
- **Tes**: shared (moderasi 163 termasuk korpus salah-tangkap/lolos dan kinerja, risiko), Worker +105 (login 28, review 52, moderasi admin 25), web ±62 (komponen review 33, halaman booth +4, matriks data kosong +14, UI admin 11). Galeri `ReviewGallery` + fixture `REVIEWS`.
- **Hasil uji yang mengubah desain/kode**: (1) `db.run(sql…)` **tidak bisa dimasukkan ke `batch()`** Drizzle D1 (`stmt.bind` tak ada) → pernyataan statistik ditulis sebagai `update().set()` dengan sub-kueri; (2) bintang terisi oranye murni hanya 1,9:1 → token `--star` diganti amber turunan `#cc7700` (≥ 3:1); (3) booth tanpa pemilik dilewati pada cek "menilai diri sendiri"; (4) tes login yang lulus palsu karena `await` hilang pada D1 → dikoreksi.

### Batasan jujur Tahap 6 (belum selesai atau belum teruji sungguhan)

- **Google, Turnstile, dan email OTP belum diuji dengan layanan asli.** Verifikasi Google diuji dengan JWT RS256 palsu bertanda tangan sungguhan; Turnstile dengan verifikator palsu; email lewat pengirim palsu. Di dev lokal: tanpa kunci, Turnstile dilewati dan kode OTP dikembalikan sebagai `devCode` (hanya `APP_ENV=development` + `localhost`); **di produksi tanpa kunci/penyedia permintaan GAGAL** (tidak dilewati). **Penyedia email belum dipilih (item 5)**: OTP produksi belum bisa mengirim email.
- **Daftar kata hanyalah daftar awal** (`moderation-seed.ts`): belum dari sumber A15, **belum ditinjau panitia**, skrip `build-terms` dan `THIRD_PARTY_NOTICES` belum ada. Filter pasti meloloskan sebagian dan salah tangkap sebagian; admin bisa menambah/mengecualikan tanpa deploy.
- **Pembatas laju tetap di memori satu isolate** (best-effort): Workers Rate Limiting binding/Durable Object untuk yang tegas **belum dipasang**. Batas OTP per email (di D1) sudah tegas.
- **Belum ada**: laporan oleh **booth** (butuh sesi booth, Tahap 8; tabel dan antrean sudah siap, termasuk penanda "pelaporan mencurigakan" yang diuji lewat data langsung); **pembuat kode tiket** di admin (mode `ticket_code` baru berguna bila kode disiapkan lewat cara lain); tautan QR ber-`?k=` (`qr_required`); **ulasan pilihan / `GET /spotlight`**; pembatas laju unggahan per booth; Data Grid review (Tahap 9).
- **Identitas pengunjung = HMAC(email)** untuk Google **dan** OTP (spesifikasi B7 menyebut HMAC(`sub`)): satu orang satu identitas lintas penyedia agar tidak bisa menilai dua kali, dan bisa dicocokkan dengan email booth. Lihat DECISIONS.
- **Mode `open_turnstile`** membuat identitas acak per login (paling mudah diakali, sesuai A6).

## Kriteria selesai Tahap 6 (BUILD-PLAN): terpenuhi

| Kriteria | Bukti |
|---|---|
| Review masuk dan mengubah peringkat konsisten (batch atomik) | `reviews.test.ts` (invarian statistik == hitungan ulang dari review), `moderation.test.ts` admin (peringkat berubah/keluar ambang), E2E |
| Duplikat ditolak | satu baris per (booth, pengunjung): kirim ulang = edit; indeks unik; tes + E2E (tetap 1 ulasan) |
| Booth tidak bisa menyembunyikan komentar (B25 butir 1) | skema strict (kolom status ditolak 400), inventaris rute non-admin (hanya 4 rute review yang sah, tanpa PATCH/PUT/DELETE), PATCH/DELETE publik 404, laporan tidak mengubah status |
| Komentar `held`/`hidden` tidak pernah di respons publik | tes (daftar ulasan, detail, snapshot) + E2E (JSON publik) |

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

- ~~"Kirim undangan" ke pemilik~~: selesai di Tahap 8.
- ~~Unggah gambar event~~: selesai di Tahap 5 (`EventMediaCard`).
- ~~`ProductEditor` ke `shared/`~~: selesai di Tahap 8 (`features/booth-editor/` + `BoothScope`).
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
- Pembatas laju per IP/pengunjung masih di memori satu isolate (best-effort); OTP per email tegas (D1). Pemasangan yang tegas untuk review/laporan belum dilakukan (lihat batasan Tahap 6).
- **Sebelum deploy** tambahan (Tahap 10): `wrangler secret put` untuk `SESSION_SECRET`, `TURNSTILE_SECRET`; set `TURNSTILE_SITE_KEY` dan `GOOGLE_CLIENT_ID` (publik); pilih dan pasang penyedia email; tinjau daftar kata dengan panitia.
- **E2E penilaian**: `node scripts/e2e/review-flow.mjs` (dev server hidup). Tiap pengunjung diberi `cf-connecting-ip` sendiri karena pembatas login per-IP di dev memakai satu kunci "unknown" bila header tak ada. Kode OTP dibaca dari `devCode`.
- **Pola tes Worker pengunjung**: `liveHarness()` (event berlangsung dengan jendela panjang), `loginWithOtp()`, `directVisitor()` (pengunjung langsung di DB + cookie sah, untuk skenario berskala), `visitorClient()` (cookie jar), `PROD_ENV` per panggilan (`{ env }`) agar penyemaian admin tetap lewat jalur dev.

## Tahap 7 (realtime, peringkat, hasil): ringkasan

- **Fungsi murni** (`src/shared/`): `results.ts` (`visibility`: peringkat bergantung pada rating; `buildResults`, `resultsDiffer`), `live-core.ts` (`LiveCore.tick`: delta booth/feed/peringkat per tick, tanpa I/O), `reveal.ts` (`revealSteps` 3-2-1 → juara 3 → 2 → 1 → daftar ±13,5 dtk, `shouldPlayLive`, `shouldAutoReplay`, `screenPanels`, `panelAt`). Angka di `config.ts` (`live.screenPanelMs`, blok `reveal`).
- **Worker**: semua rute publik lewat `edgeJson` (`lib/edge-cache.ts`: Cache API, kunci memuat `activeVersion/statsVersion/resultsVersion`, ETag/304, TTL 5 dtk saat live, 60 dtk setelah selesai). `services/results.ts` + `routes/admin/results.ts`: mode rating/peringkat, **Umumkan hasil** (hanya setelah event selesai; hasil dibekukan di `results_json`), **Perbarui hasil**, **Putar animasi** (`reveal_seq`, target `screen|everyone`). Peringkat/rating yang disembunyikan **tidak dikirim server sama sekali**. `GET /ws` → Durable Object `LiveHub` (WebSocket Hibernation, satu bacaan D1 per tick 2,5 dtk untuk semua penonton, soket `viewer` vs `screen`, batas 400 penonton + 5 slot Layar Besar, alarm akhir event menutup soket `viewer`). `notifyLive` dari review dan aksi admin membuat tick/refresh segera (throttle 1 dtk).
- **Frontend**: `features/event-data.tsx` (dipindah dari `areas/event/data.tsx`; snapshot sadar live/beku), `features/live/` (`LiveProvider`, `useLive`, `applyTick`), `features/reveal/` (`useReveal`, `RevealLayer`), `features/EventBoundary.tsx`. Beranda: chip LIVE, `ResultsBanner`, `StandingsSection` (peringkat + ulasan terbaru, **paling bawah**), halaman `/results`. `components/shared/ResultsList` + `WinnerReveal` (`<dialog>`, chunk lazy, tombol "Lompat ke daftar hasil", Esc menutup). Layar Besar `/screen` (Sorotan → Semua booth → Ulasan terbaru → Peringkat/Hasil, ganti panel deterministik dari jam server). Admin: `ResultsCard` di halaman event.
- **Tes**: shared (results 11, live-core 10, reveal 13, edge-cache), Worker (hasil admin 19, live/`/ws` 12), web (live 17, hasil/ResultsList 24 termasuk matriks fixture, standings 15, layar, admin hasil). Galeri `ResultsGallery`.
- **Uji beban lokal** (`scripts/e2e/live-load.mjs`, `VIEWERS=300 REVIEWS=120 BOOTHS=10`): 301 koneksi + 120 review = **satu tick per penonton**, tidak ada pembacaan D1 per penonton; batas penonton umum bekerja (95 diterima, 55 ditolak pada batas uji).
- **Hasil uji yang mengubah desain/kode**: (1) DO tidak tahu jadwal berubah (notifikasi admin membawa event lama) → `notifyLive(…, fresh)`; (2) `refresh` baru sampai setelah tick berikutnya → refresh langsung dengan throttle; (3) soket ditutup setelah event selesai padahal animasi pemenang diputar sesudahnya → soket **screen** tetap tersambung; (4) opt-out animasi sempat menutup lapisan reveal → status `autoActive` terkunci sampai `close`; (5) pil nomor booth di `PhotoFrame` tak terbaca di tema panggung (teks gelap di pil gelap) → `text-text`; (6) handler klik pada elemen statis ditolak Biome → tombol transparan.

### Batasan jujur Tahap 7

- **Cache API, Durable Object, dan WebSocket hanya diuji di dev lokal (workerd)**, belum di Cloudflare produksi. Uji beban hanya lokal, **bukan** k6 terhadap produksi; angka kapasitas (400 penonton) belum terbukti di edge.
- **Item 58** (ambang peringkat) masih default sementara: 3 review, `m` = 5. Belum keputusan pemilik.
- **Suara animasi tidak diimplementasikan.** Ulasan pilihan / `GET /spotlight` belum ada. Pembatas laju tegas (Rate Limiting binding) belum.
- Penonton biasa **setelah event selesai** menerima animasi `everyone` lewat polling jarang (60 dtk) atau saat membuka/menyegarkan halaman, bukan WebSocket (soketnya ditutup; hanya Layar Besar yang tetap).
- Penutupan soket dari sisi server tidak terlihat di klien lewat proxy dev Vite (diverifikasi lewat ping tak dijawab); klien nyata menutup sendiri saat menerima `event_status`.
- `GET /api/event` belum lewat Cache API.
- **Alat ukur**: tes dijalankan lewat PowerShell; di shell Bash lingkungan ini Vitest gagal memuat (`reading 'config'`) padahal kodenya sama. Jalankan `npm run check` dari PowerShell.

## Kriteria selesai Tahap 7 (BUILD-PLAN): terpenuhi (dengan batasan di atas)

| Kriteria | Bukti |
|---|---|
| Peringkat konsisten dengan review, selalu di bagian paling bawah, tanpa lencana di kartu | `standings.test.tsx`, `standings-flow.mjs` |
| Rating/peringkat tersembunyi tidak dikirim server | `results.test.ts`, tes snapshot, E2E (JSON publik) |
| Hasil dibekukan saat diumumkan; animasi pemenang dapat diputar ulang | `results.test.ts` (Worker), `reveal.test.ts`, `WinnerReveal` tes, E2E |
| Layar Besar berganti panel dan tersinkron | `screen.test.tsx`, `standings-flow.mjs` |
| Realtime hemat: satu bacaan D1 per tick | `live-core.test.ts`, `live-load.mjs` |

## Tahap 8 (portal booth & pendaftaran mandiri): ringkasan

- **Auth booth** (`routes/booth/auth.ts`, `lib/booth-session.ts`, `middleware/booth-session.ts`): OTP email dengan tujuan terpisah (`booth_register`/`booth_login`/`visitor`). Login hanya mengirim kode bila email tercatat, tetapi **jawabannya sama** (email tak terbongkar; jeda OTP juga disamarkan). Sesi = cookie `booth_session` bertanda tangan, klaim `{sub, eid, eh, exp}`; **setiap permintaan** mencocokkan `eh` dengan HMAC(`booths.email`) di D1, jadi pemilik dilepas/diganti admin → `401 owner_changed` + cookie dihapus. Pendaftaran: OTP → cookie bukti email `booth_register` (30 mnt) → `POST /api/booth/register` (email harus sama dengan bukti) → `pending`, `is_late` bila lewat penutupan reguler, langsung bersesi.
- **Portal** (`routes/booth/portal.ts`): `GET/PUT /api/booth/me` (skema strict: tanpa status/email/kolom moderasi), `POST /resubmit` (hanya dari `revision`), foto/logo/produk/WhatsApp **dengan bentuk rute sama seperti admin** dan layanan yang sama (`boothId` dari sesi), ulasan masuk (baca saja) dan **laporan oleh booth** (tidak menyembunyikan apa pun). `rejected`/`suspended` → hanya-baca (`booth_not_editable`); event selesai → `403 event_ended` kecuali login/OTP/logout (allowlist). Produk `removed_by_admin` tidak bisa disentuh pemilik. Statistik portal mengikuti aturan tampil publik (rating/peringkat tersembunyi = semua angka null).
- **Email**: `lib/email.ts` kini punya pengirim **Resend** (aktif bila `RESEND_API_KEY` + `EMAIL_FROM`); tanpa itu perilaku lama (dev: `devCode`, produksi: gagal). Admin: notifikasi ke pemilik saat status berubah (disetujui/revisi/ditolak/ditangguhkan, `lib/booth-mail.ts`; gagal kirim tidak menggagalkan aksi) dan **`POST …/booths/:bid/invite`** (jeda 60 dtk) + tombol di kartu Pemilik.
- **Frontend**: `areas/booth/` (layout dengan `EventBoundary`, halaman `register` 3 langkah, `portal`; komponen OtpForm, LoginPanel, StatusBanner, StatsCard, ReviewsCard + dialog laporan, ProfileCard dengan **draf di penyimpanan peramban**, WhatsappCard, ShareCard dengan **QR**). `features/booth-editor/` (`BoothScope` + `MediaCard`/`ProductsCard`) dipakai admin **dan** portal dengan basis path berbeda; `QueryState` pindah ke `components/ui/states`. `components/shared/QrCode` (dependensi baru `uqr`, MIT, 79 KB; SVG tanpa innerHTML; token `--qr-fg/--qr-bg` tetap gelap-di-atas-terang di tema mana pun).
- **Tes**: Worker: auth booth 21, portal 27, email/mail 5 (total Worker 416), web 24 (`booth.test.tsx`). E2E Chrome `booth-flow.mjs` (26 pemeriksaan: login OTP, edit profil, unggah foto, produk, WhatsApp, owner_changed, daftar → pending → revisi → kirim ulang → disetujui, hanya-baca setelah event selesai).
- **Hasil uji yang mengubah kode**: (1) **`FROZEN_ALLOWLIST` tidak pernah cocok di aplikasi nyata** (`routePath` jatuh ke catch-all `/api/*`): kini mencocokkan path persis; tanpa ini login booth setelah event selesai ditolak; (2) `key={booth.version}` me-remount `ProfileCard` sehingga "Profil tersimpan." hilang (ketahuan E2E, bukan tes unit); (3) inventaris rute B25 diperbarui: hanya `GET /api/booth/reviews` dan `POST /api/booth/reviews/:rid/report` yang baru, tidak ada PATCH/PUT/DELETE; (4) di Bash lingkungan ini heredoc berisi tanda kutip melengkung kadang membuat seluruh perintah gagal: pakai alat Write.

### Batasan jujur Tahap 8

- **Resend belum diuji dengan layanan asli** (hanya dengan `fetch` palsu); penyedia email (keputusan terbuka 5) tetap sementara dan mudah diganti (satu fungsi `EmailSender`). Domain pengirim harus diverifikasi di penyedia sebelum produksi.
- **Poster QR dan unduhan poster** (A4 "Unduh poster QR booth") belum ada: portal hanya menampilkan QR; poster cetak ada di Tahap 9. QR memakai `?src=qr` yang belum dibedakan dari lainnya di sinyal risiko.
- **Balasan publik pemilik atas ulasan** (A4, opsional) tidak dibuat. **Prefill dari event sebelumnya** (A4) tidak dibuat (nice-to-have yang sengaja ditunda).
- Pembatas laju OTP booth masih di memori satu isolate (best-effort), batas OTP per email di D1 tegas (sama dengan pengunjung). Laporan oleh booth dibatasi 10/jam di D1.
- Sesi booth 3 hari (`auth.sessionDays`), tanpa pencabutan manual selain `owner_changed`. Booth yang dilepas pemiliknya tidak bisa masuk sama sekali (sesuai B7).
- Aksi admin "Kirim undangan" di prod gagal bila penyedia email belum diatur; di dev mengembalikan `sent:false`.

## Kriteria selesai Tahap 8 (BUILD-PLAN): terpenuhi

| Kriteria | Bukti |
|---|---|
| Alur daftar → verifikasi → login berjalan | `auth.test.ts`, `booth.test.tsx`, `booth-flow.mjs` |
| Melepas pemilik membuat sesi lama `401 owner_changed` | `auth.test.ts` (lepas dan ganti), E2E |
| Hanya-baca setelah event selesai | `auth.test.ts`, `event-gate.test.ts` (penelusuran semua rute tulis), `booth.test.tsx`, E2E |

## Langkah berikutnya (Tahap 9: Admin lanjutan, A3, B13, B18)

Baca `BUILD-PLAN.md` Tahap 9: Data Grid (sunting sel, alasan wajib, pratinjau dampak peringkat), log, poster QR (pakai `QrCode`), ekspor. Opsional yang tertunda: ulasan pilihan (`/spotlight`), pembatas laju tegas, balasan ulasan oleh booth.

## Keputusan sementara (default dipakai sampai pemilik proyek memutuskan)

| Hal | Default sementara | Item di explore.md |
|---|---|---|
| Mode verifikasi reviewer | `google_or_email` (Google 1-tap + OTP email cadangan) | 2 |
| Review yang ditandai anomali | **ditahan** sampai admin memutuskan | 6 |
| Penyedia email | abstraksi modul `email`; penyedia dipilih nanti | 5 |
| Format ekspor | CSV di MVP, XLSX di v1 | 16 |
| `minReviewsToRank` / `m` | 3 / 5 (perlu ditinjau, lihat 58) | 58 |

## Blokir / pertanyaan terbuka

- Tidak ada yang memblokir Tahap 9. **Item 58** (ambang peringkat) dan perkiraan skala (item 1) perlu dijawab pemilik proyek sebelum peringkat tampil; **penyedia email (item 5)** sebelum OTP bisa dipakai di produksi (dan Tahap 8).
- `demo-event.html` belum menampilkan booth tanpa foto/hanya nama (A16); opsional diperbarui.
