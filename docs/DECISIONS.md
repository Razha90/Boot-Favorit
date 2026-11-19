# DECISIONS

> Keputusan yang sudah final. Jangan diubah tanpa persetujuan pemilik proyek; bila berubah, tambahkan baris baru (jangan hapus yang lama). Rincian dan alasan lengkap ada di `explore.md` pada bagian yang dirujuk.

## Produk

| Keputusan | Rujukan |
|---|---|
| Hanya **satu event aktif**, tampil di domain utama `eventunimed.id`; tanpa slug dan tanpa daftar event publik | A0 |
| Akun booth dan pengunjung **per-event**; event baru = daftar ulang | A4 |
| Status event **dihitung dari tanggal**, bukan pilihan manual; event selesai = dibekukan, hanya admin yang bisa mengubah | A2, B17 |
| Tombol "Daftar Toko" hilang setelah penutupan; **link `/register` tetap hidup** (susulan) sampai event selesai; semua pendaftaran wajib diverifikasi admin | A2, A4 |
| **Booth tidak boleh menyembunyikan komentar**; hanya melaporkan. Yang menyembunyikan: filter kata dan admin | A15, B25 |
| Peringkat memakai **rata-rata Bayesian**; **tidak ada kategori booth**, pemenang utama hanya Booth Terfavorit | A7 |
| Halaman event adil: sorotan → semua booth (acak per pengunjung) → peringkat paling bawah; tanpa lencana peringkat di kartu | A8, B20 |
| Peringkat dan rating bisa disembunyikan admin; admin bisa memutar animasi pemenang; setelah hasil diumumkan setiap pengunjung melihat animasi lalu mode hanya-baca | A3, A8 |
| Kategori ulasan hanya chip pilihan, diatur admin | A5 |
| Produk & harga **opsional**; maks. 24 per booth (bisa diatur admin, batas atas 100); **satu andalan dipilih toko**; web hanya etalase tanpa pembayaran; dilarang menawarkan imbalan untuk bintang | A14, B24 |
| Nomor WhatsApp pemilik **opsional**, tidak tampil sebagai teks, lewat pengalihan `/go/wa` | A14, B24 |
| **Booth boleh tanpa pemilik dan tanpa email**; data wajib hanya **nama**; semua keputusan di admin bila tanpa email | A16 |
| Booth buatan admin **selalu langsung tayang**; **impor CSV masuk MVP** (kolom wajib hanya nama) | A16, B26 |
| **Foto sepenuhnya opsional**, tanpa pengaturan untuk mewajibkannya | A16, B26 |
| Tanpa gambar, komponen beralih ke **bingkai**, **hanya-teks**, atau **hilang**; tidak pernah gambar rusak; grid tanpa satu pun foto beralih ke mode hanya-teks | A16, B26 |
| Admin boleh mengubah booth tanpa pemilik tanpa alasan (tetap tercatat); untuk booth berpemilik aktif alasan wajib | A16 |

## Visual

| Keputusan | Rujukan |
|---|---|
| Gaya **Seru** untuk pengunjung; **Profesional** untuk admin, portal booth, dan cadangan | A12 |
| Nama resmi acara = judul utama; dari UNIMED hanya palet warna; **tanpa navigasi** | A12 |
| Font: Bricolage Grotesque, DM Sans, Caveat; di-host sendiri; dipanggil lewat token | B4, B20 |
| Nada bahasa santai dan mengajak (kamu, yuk, cobain, mampir) | A12 |
| Palet hijau-oranye-krem; tanpa emoji sebagai ikon | A12 |
| Efek klik, suara sintesis (bawaan nyala, volume rendah, mati bila gerak minimal), dan ikon kursor | B23 |

## Teknis

| Keputusan | Rujukan |
|---|---|
| Stack: Cloudflare Workers + D1 + R2 + Durable Objects; React SPA; Tailwind v4; Hono; Drizzle; Zod | B1–B3 |
| Realtime **Hibrida**: polling + cache edge, dengan Durable Object hemat | B8 |
| Gambar **dikonversi ke WebP di client**, disimpan di R2, disajikan dari `media.eventunimed.id` | B15 |
| Satu SPA dengan kode dipisah per area (`event`, `booth`, `admin`, `screen`); antar-area dilarang saling impor | B16 |
| Admin dilindungi **Cloudflare Access**; booth passwordless (OTP); sesi booth terikat ke email | B7 |
| Warna dan font **hanya di theme.css/fonts.css** (token); dijaga lint | B4 |
| Setiap aksi tulis: tombol ber-loader + `Idempotency-Key` + batasan unik DB | B21 |
| Fitur web mengikuti **Baseline (Widely available)** | B22 |
| Log tanpa tabel DB (Workers Logs + Analytics Engine) | B13 |
| Admin: **Data Grid ala Excel** untuk melihat dan menyunting semua data, alasan wajib | A3, B18 |
| Filter kata Indonesia + Inggris tanpa klasifikasi AI di MVP | A15, B25 |
| Format dan lint memakai **Biome** (bukan ESLint + Prettier); penjaga khusus (`lint-tokens`, `no-raw-img`, `lint-boundaries`) berupa skrip Node murni dengan tes sendiri, masuk `npm run check` | AGENTS.md, BUILD-PLAN Tahap 1 |
| Batas lapisan ditegakkan skrip: `ui` < `shared` < `areas`; `shared/` tidak mengimpor `web/`/`worker/`; `web/` hanya `import type` dari `worker/` | B14, B16 |
| Rute SPA: pathless layout per area + halaman `lazy` per rute (halaman booth chunk sendiri); `router.tsx` hanya peta | B16 |
| Tipe Worker dihasilkan `wrangler types` (`worker-configuration.d.ts`, di-commit); tes Worker lewat `app.request` Hono | B3 |
| Font di-host sendiri lewat Fontsource (DM Sans, Bricolage Grotesque, Caveat variabel); nama font hanya di `theme.css` dan `fonts.css` | B4, B20 |

### Keputusan teknis dari pengerjaan (Tahap 2)

| Keputusan | Alasan |
|---|---|
| Tes database memakai **D1 palsu di atas `node:sqlite`** (`src/worker/test/d1.ts`) yang menerapkan `drizzle/*.sql` apa adanya | D1 adalah SQLite; indeks parsial, CHECK, dan kunci asing teruji tanpa runtime Cloudflare. Dikonfirmasi juga pada D1 lokal workerd (`wrangler d1 migrations apply --local`) |
| `hash32` = FNV-1a **+ finalizer murmur3** (B20 diperbarui) | FNV-1a murni bias untuk id yang hanya beda di karakter terakhir; ketahuan oleh uji keadilan 10.000 seed |
| Kolom ditambahkan ke B6: `booths.about`, `booths.team_name`, `booth_stats.last_review_at`, `idempotency_keys.updated_at` | Dipakai di B20, A7, B21 tetapi belum punya kolom |
| `review_reports`: dua indeks unik parsial (bukan satu indeks `COALESCE`) + CHECK peran pelapor | drizzle-kit memecah ekspresi `coalesce(a, b)` pada koma sehingga SQL rusak |
| `getEventState` murni dengan `now` sebagai argumen; `createApp({ now })` menyuntikkan jam | Jadwal event bisa diuji tanpa menunggu waktu |
| Respons idempotensi **5xx tidak disimpan** (kunci dilepas); **4xx disimpan** dan diputar ulang; respons > 16 KB tidak disimpan | "Coba lagi" setelah galat server harus bisa jalan; galat validasi bersifat deterministik |
| Pembatas laju saat ini **di memori satu isolate** (best-effort); yang tegas (OTP, review) memakai binding/Durable Object di Tahap 6 lewat antarmuka yang sama | Jujur soal batasan; B9 sudah menyebut kedua mekanisme |
| `/api/health` terdaftar **sebelum** middleware event | Tetap menjawab bila D1 bermasalah |
| Penelusuran otomatis semua rute tulis non-admin saat event `ended` (harus `403 event_ended` kecuali `FROZEN_ALLOWLIST`) | Rute baru yang lupa dilindungi menggagalkan tes (B17) |

### Keputusan teknis dari pengerjaan (Tahap 3)

| Keputusan | Alasan |
|---|---|
| Unggah gambar = **satu POST multipart** (`full` + `thumb`), bukan dua PUT (B15 diperbarui) | Atomik, satu Idempotency-Key, satu validasi |
| Hash idempotensi dari **byte** salinan permintaan, dengan **batas multipart dinormalkan** | Browser membuat batas baru tiap kirim; tanpa normalisasi "Coba lagi" ditolak 422 |
| Rute admin: `requireAdmin` (JWT Access) di `/api/admin/*`; bypass dev hanya `APP_ENV=development` **dan** host `localhost` | Pertahanan berlapis agar tidak terbawa ke produksi; gagal tertutup bila Access belum dikonfigurasi |
| Event: "Jadikan aktif" = batch dua langkah (nonaktifkan yang lama, aktifkan yang baru) sekaligus **menerbitkan** | Indeks unik parsial `one_active`; tidak pernah ada dua aktif |
| Alasan perubahan admin wajib **hanya** untuk booth berpemilik aktif; tolak/revisi selalu butuh alasan penolakan | Disetujui (A16); booth tanpa pemilik tidak merugikan pihak lain |
| `booths.updated_at` dipakai sebagai `version` dan **selalu naik monoton** (`max(now, versi+1)`) | Dua perubahan dalam milidetik sama tidak boleh menghasilkan versi sama |
| Impor CSV: nama kembar **dilewati** secara bawaan (juga di dalam berkas); email kembar/terpakai = galat; potongan 50 baris per `batch()` | Mencegah booth ganda bila berkas diunggah dua kali; kegagalan satu potongan tidak membatalkan yang lain |
| Produk: batas dicek dalam **satu pernyataan SQL** (`INSERT … SELECT … WHERE COUNT < max`); produk `hidden` ikut dihitung | Tahan permintaan serentak (diuji 30 serentak → tepat 24) |
| Frontend admin memakai **TanStack Query hanya di area admin** (QueryClient di layout admin), bukan di bundle awal | Pengunjung tidak mengunduhnya (B16) |
| Parser CSV buatan sendiri (`lib/csv.ts`, ±120 baris, diuji) | Tanpa dependensi baru; mendukung titik koma Excel Indonesia, kutip, BOM |
| Komponen booth khusus admin tetap di `areas/admin/components/` sampai portal booth memakainya | Aturan dua (B14): pindah ke `shared/` saat dipakai ≥ 2 area |
| Teks UI admin di `lib/copy.ts` (`Record<ErrorCode, string>` memaksa kode galat baru diberi teks) | Aturan B14 butir 6 |

### Keputusan teknis dari pengerjaan (Tahap 4)

| Keputusan | Alasan |
|---|---|
| Komponen bergambar membaca URL lewat **`useMediaUrl()`** (konteks), bukan memanggil `mediaUrl` langsung | Komponen tetap murni; galeri/tes memasok gambar contoh dan 404 simulasi tanpa server |
| `BoothGrid`/`ProductGrid` memutuskan mode (`photo`/`text`) **sekali** untuk seluruh daftar | Aturan A16; kartu seragam (keadilan) dan tak ada deretan bingkai raksasa identik bila tak ada foto |
| Sorotan beralih ke tata letak hanya-teks juga bila fotonya **gagal dimuat** (`SafeImage.onFail`) | Foto gagal = tanpa foto (A16) |
| Blok berwarna stiker menimpa `--muted` menjadi `--primary-fg`; `--star-off` digelapkan (≥ 3:1) | Hasil ukur WCAG di Chrome (teks 2,1:1 / 1,1:1; bintang 1,3:1) |
| Dialog memakai **`<dialog>` bawaan** (Baseline), dikunci selama aksi pending | Tanpa pustaka; sejalan B21 (dialog tak tertutup saat pending) |
| Galeri `/dev/components` hanya lewat `import.meta.env.DEV` (terbukti tidak ada di build produksi) | B14 butir 8 |
| `no-raw-img` mengabaikan baris komentar dan berkas tes | Mencegah positif palsu; tes tidak ikut dikirim |
| Bintang input = tombol `role="radio"` dengan roving tabindex (`biome-ignore` beralasan) | `<input type="radio">` tidak bisa digayakan sebagai bintang |
| Penjaga visual di Chrome sungguhan disimpan di `scripts/e2e/` (`gallery-visual`, `gallery-contrast`) | jsdom tidak mengukur tata letak maupun kontras |

### Keputusan teknis dari pengerjaan (Tahap 5)

| Keputusan | Alasan |
|---|---|
| Pratinjau tautan: Worker mengambil `index.html` lewat binding `ASSETS` dan **mengganti meta dengan string replace** (nilai di-escape), bukan `HTMLRewriter` (B-pratinjau diperbarui). `run_worker_first` hanya untuk `/api/*`, `/ws/*`, `/media/*`, `/go/*`, `/`, `/b/*` | Berkas HTML kecil dan templatnya kita kendalikan; lebih mudah diuji murni (`page-meta.test.ts`). Aset statis lain tetap dilayani langsung (murah) |
| Snapshot publik **sementara dibaca dari D1** per permintaan; cache edge + `LiveHub` menyusul di Tahap 7 | Antarmuka respons sudah final (`PublicSnapshot`), jadi Tahap 7 hanya mengganti sumber |
| Nomor WhatsApp tidak pernah di JSON/HTML; `/go/wa/:boothId?p=` 302 ke `wa.me`, `Cache-Control: no-store`, dibatasi laju, **404 setelah event selesai**; setelah selesai `hasWhatsapp=false` dan promo/penanda produk disembunyikan | B24, A14: tombol pesan hanya untuk saat event berjalan |
| Urutan acak per pengunjung = `fairOrder(booths, seed)` dengan `seed` disimpan di penyimpanan lokal (`visitor-seed`); sorotan berotasi dari **waktu server** (`spotlightOrder`/`spotlightPosition`) | Stabil saat reload dan booth baru tidak menggeser yang lama; semua pengunjung berbagi jadwal sorotan yang sama tetapi urutan putaran berbeda |
| Blok info `BoothCard` **bertinggi tetap** (baris stiker disisakan, judul 2 baris, `line-clamp-2` + `title`) | Hasil ukur Chrome: booth hanya-nama 26 px lebih pendek; keadilan A8 menuntut kartu seragam |
| Slideshow: pewaktu = **animasi CSS** `slide-fill` per segmen (`animationend` memajukan foto); jeda otomatis saat hover/fokus/sentuh/tab tersembunyi/gerak minimal | Menjeda animasi otomatis menjeda pergantian, tanpa `setInterval` yang bisa menyimpang |
| Daftar incaran: maks. 50, per event, di penyimpanan lokal aman (`safe-storage`, tidak melempar bila diblokir); tombol hilang setelah event selesai | A14; tanpa akun |
| `Modal` memakai `useId` untuk judul | Banyak dialog dalam satu halaman (satu per tombol Bagikan) tidak boleh berbagi id |
| TanStack Query dipakai juga di area event (QueryClient di `areas/event/layout.tsx`), tetap di luar bundle awal | Polling berjitter ±20% dan cache booth/produk; bundle awal ±69 KB gzip |
| Area event selalu **seru/kertas**; skrip kontras hanya mengukur bagian "Event ·" pada kombinasi itu | Tema lain tidak pernah dipakai area ini |

### Keputusan teknis dari pengerjaan (Tahap 6)

| Keputusan | Alasan |
|---|---|
| **Identitas pengunjung = HMAC(email terverifikasi)** untuk Google **dan** OTP (B7 menyebut HMAC(`sub`) untuk Google) | Satu orang satu identitas lintas penyedia: tidak bisa menilai dua kali dengan berganti Google/OTP, dan bisa dicocokkan dengan email booth untuk tolak "menilai diri sendiri" (B9). Email asli tidak disimpan. Tiket = HMAC(kode), anonim = HMAC(id acak) |
| `booth_stats` **dihitung ulang dari tabel review** (satu pernyataan SQL dalam `batch()` yang sama), bukan selisih (`statsDelta`) | Selalu konsisten dengan data; aman diulang (B21); tidak bergeser oleh permintaan serentak; sama untuk submit/edit/sembunyikan/pulihkan/hapus. `statsDelta` tetap ada sebagai fungsi murni teruji |
| Statistik ditulis sebagai `update().set()` dengan sub-kueri `sql`, **bukan `db.run(sql…)`** | `db.run` tidak bisa masuk `batch()` Drizzle D1 (ketahuan oleh tes) |
| Filter kata hanya **menahan/menyamarkan teks komentar**; bintang selalu terhitung; skor risiko hanya **menahan review (`held`) diam-diam**, tidak pernah menolak | A15, B9: pengirim tidak diberi tahu kata mana yang tertangkap dan tidak diberi tahu review ditahan karena risiko (komentar ditahan filter boleh diberi tahu netral) |
| Review/komentar yang sudah `held` atau `hidden` **tetap begitu walau pengirim mengirim ulang** | Pengirim tidak bisa melepas tahanan/penyembunyian admin dengan mengedit |
| Mencocokkan istilah: kata utuh, `contains` hanya untuk istilah ≥ 4 huruf; huruf berulang dilebur pada kedua sisi; imbuhan konservatif (tanpa `pe-/se-/ke-`: salah tangkap "petai"); pencocokan fuzzy mati | A15/B25; pengecualian (`allow`) menang atas blokir; korpus salah-tangkap diuji |
| Daftar istilah **per event**, dimuat dari daftar awal saat pemakaian pertama; `filter_version` = waktu perubahan terbaru; dikompilasi per versi di memori isolat | Admin mengubah tanpa deploy; tidak perlu kolom/migrasi baru |
| Masuk pengunjung: cookie `visitor_session` HttpOnly bertanda tangan (HMAC) berisi `{sub, eid, exp}`; keberadaan, event, dan status blokir **selalu dicek ulang di D1** | B7; sesi event lain tidak berlaku |
| Produksi **gagal tertutup**: tanpa `SESSION_SECRET`, `TURNSTILE_SECRET`, atau penyedia email, permintaan gagal; bypass hanya `APP_ENV=development` + `localhost` | Sama pola admin; `devCode` OTP tidak pernah di produksi |
| Moderasi admin: alasan wajib (≥ 5 huruf), `original_*` disimpan **sekali** dan tidak ditimpa, `stats_version` naik, keputusan laporan berlaku untuk **semua laporan terbuka** pada komentar itu, komentar yang dipulihkan **dikunci** (keluar dari antrean) | A15, B25 |
| Skema masukan review/laporan/login **strict** (kolom asing ditolak 400) | B25 pengujian 1: tidak ada jalur klien untuk mengubah status moderasi; dijaga tes inventaris rute |
| Token `--star` diganti amber turunan `#cc7700` | Oranye murni hanya 1,9:1 pada permukaan terang (WCAG 1.4.11); bintang kosong sudah diperbaiki di Tahap 4 |
| Widget Turnstile dan Google dimuat dinamis hanya di kotak penilaian | Tidak membebani bundle awal (B16) |

### Keputusan teknis dari pengerjaan (Tahap 7)

| Keputusan | Alasan |
|---|---|
| Snapshot dari **Cache API + D1** (bukan memori DO); DO hanya menyiarkan delta; **satu bacaan D1 per tick** untuk semua penonton | Sederhana dan tahan restart; beban D1 tidak dikalikan jumlah penonton (terukur di uji beban lokal: 301 koneksi = 1 tick per penonton) |
| Kunci cache memuat `activeVersion/statsVersion/resultsVersion`; TTL 5 dtk live, 60 dtk setelah selesai; ETag/304 | Perubahan admin/review terlihat tanpa menunggu TTL; murah |
| Peringkat bergantung pada rating (`visibility()`): peringkat `visible` ditolak bila rating `hidden` (`ratings_hidden`); yang tersembunyi **tidak dikirim** server | A7/B9: penyembunyian harus ditegakkan server, bukan CSS |
| **Hasil dibekukan** saat "Umumkan hasil" (`results_json`, `results_version`); "Perbarui hasil" membuat versi baru; hanya bisa setelah event selesai (`event_not_ended`) | Hasil akhir tidak berubah diam-diam; bisa diputar ulang identik |
| Animasi pemenang: `live` (sekali per `reveal_seq`, hanya bila < 90 dtk sejak mulai, sesuai target `screen|everyone`) dan `replay` (setelah diumumkan; opt-out per pengunjung di localStorage per `resultsVersion`) | Tidak mengganggu pengunjung yang datang belakangan; tetap bisa diputar ulang manual |
| Soket **`screen` tetap tersambung** setelah event selesai; soket `viewer` ditutup dan ditolak `event_ended` | Layar Besar harus menerima animasi pemenang yang diputar admin sesudah event |
| Batas `maxLiveViewers` 400 dan `reservedScreenSlots` 5; bila penuh/gagal klien memakai polling | Degradasi halus, biaya terbatas (B8) |
| `notifyLive(c, kind, fresh)`: aksi admin membuat DO membaca ulang segera (throttle 1 dtk) | DO tidak tahu jadwal yang baru diubah; jangan menunggu tick |
| Layar Besar: urutan panel Sorotan → Semua booth → Ulasan terbaru → Peringkat/Hasil; panel dipilih dari **jam server** (`panelAt`) | Semua layar serempak tanpa pesan server; peringkat tetap terakhir (keadilan) |
| Kode bersama antar-area (`event`, `screen`, `admin`) dipindah ke `src/web/features/` (`event-data`, `live`, `reveal`, `EventBoundary`) | Penjaga `lint-boundaries` melarang impor antar-area |
| Tombol transparan "Lompat ke daftar hasil" di lapisan animasi (bukan handler klik pada elemen statis) | Aksesibel dan lolos Biome |
| Pil nomor booth `PhotoFrame` memakai `text-text` | Di tema panggung teks mewarisi warna gelap bingkai di atas pil gelap (tak terbaca) |
| Suara animasi tidak diimplementasikan | Di luar lingkup; bukan kebutuhan acara |

### Keputusan teknis dari pengerjaan (Tahap 8)

| Keputusan | Alasan |
|---|---|
| Sesi booth = cookie HttpOnly bertanda tangan `{sub, eid, eh, exp}`; **tiap permintaan** membandingkan `eh` dengan HMAC(`booths.email`) di D1 → `401 owner_changed` | B7: pemilik dilepas/diganti admin langsung memutus sesi lama; token tidak dipercaya untuk kepemilikan |
| OTP login booth: jawaban **sama** untuk email terdaftar dan tidak (tanpa kode/email untuk yang tak terdaftar); jeda OTP pada login disamarkan | Tidak membocorkan email mana yang terdaftar. Pendaftaran justru memberi `email_in_use` (pendaftar perlu tahu) |
| Pendaftaran = OTP → **cookie bukti email** (`booth_register`, 30 mnt, awalan token berbeda dari sesi) → `POST /register` yang mensyaratkan email sama dengan bukti | Email terbukti milik pendaftar tanpa menyimpan state di server; token sesi tidak bisa dipakai sebagai bukti dan sebaliknya |
| Rute portal booth **berbentuk sama** dengan rute admin (`/api/booth/...`) dan memakai layanan yang sama; `boothId` dari sesi | Satu logika (batas produk, foto, validasi gambar); UI memakai `BoothScope` dengan basis path berbeda |
| Pemilik: skema profil **strict** (tanpa status/email/kolom moderasi), status produk hanya `active`/`hidden`, produk `removed_by_admin` tidak bisa disentuh | Pemilik tidak punya jalur menyembunyikan komentar atau menghapus bukti moderasi (A4, A15, B25) |
| `rejected`/`suspended` → portal hanya-baca (`booth_not_editable`); hanya `revision` bisa kirim ulang → `pending` | A4: tolak/revisi/kirim ulang; yang ditolak tidak bisa mengubah-ubah |
| Statistik portal mengikuti `visibility()`: rating/peringkat tersembunyi = semua angka null | Konsisten dengan aturan publik; tidak ada kebocoran lewat portal |
| Allowlist pembekuan mencocokkan **path persis**, bukan pola rute | `routePath` jatuh ke catch-all `/api/*` di aplikasi nyata sehingga allowlist tidak pernah cocok (login booth setelah event selesai terblokir) |
| Penyedia email sementara: **Resend** lewat `fetch`, aktif bila `RESEND_API_KEY` + `EMAIL_FROM` | Item 5 masih terbuka; satu fungsi `EmailSender`, mudah diganti. Tanpa penyedia: dev `devCode`, produksi gagal |
| Notifikasi ke pemilik saat status berubah; gagal kirim **tidak** menggagalkan aksi admin; undangan eksplisit lewat tombol (jeda 60 dtk) | Email hanya pelengkap; mengisi email tidak mengirim apa pun (A16) |
| Draf profil disimpan di penyimpanan peramban (`boothDraft:{id}`) | B7: isian belum tersimpan tidak hilang saat sesi berakhir |
| QR: dependensi `uqr` (matriks modul, digambar sebagai SVG), token warna tetap `--qr-fg/--qr-bg` | Pemindai tak andal bila terbalik di tema gelap; tanpa innerHTML; 79 KB, MIT; dipakai lagi untuk poster di Tahap 9 |

## Gaya kode (disetujui)

Lihat bagian "Gaya kode" di `AGENTS.md`. Ringkas: kode berbahasa Inggris, teks pengguna Indonesia; TypeScript strict tanpa `any`; tipe dari Zod; logika bisnis murni; server berlapis route → service → query; Biome untuk format dan lint; tes bersama fitur; commit `feat:`/`fix:`/`docs:`.

## Masih terbuka (lihat "Keputusan Terbuka" di explore.md)

Ambang minimal review untuk peringkat dan nilai `m` (58, lihat batas rumus Bayesian di A7), skala booth/pengunjung (1), mode verifikasi reviewer (2), bintang tunggal vs multi-kriteria (3), penyedia email (5), review anomali ditahan vs tayang (6), branding dan logo resmi (7), prefill form (8), retensi log (9), format ekspor (16), gaya gerak bawaan (17), aset LPPM (32), masukan hero dan halaman booth (43, 44), retensi nomor WhatsApp (49), peninjau daftar kata (51), tindakan default filter (52), klasifikasi AI (53).
