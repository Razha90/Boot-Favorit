# Penilaian Booth Terfavorit LPPM Expo Tahun 2026

> Dokumen eksplorasi ide. Isinya dipisah jadi dua bagian besar:
> **Bagian A — Plan Web** (produk, flow, fitur, pengalaman pengguna) dan
> **Bagian B — Plan Tech** (stack, arsitektur, data, realtime, keamanan).
>
> Status: draft eksplorasi, belum final. Bagian "Keputusan Terbuka" di paling bawah perlu dijawab sebelum mulai coding.

**Konsep singkat:** web untuk event LPPM Expo di mana booth peserta mendaftar (diverifikasi admin), lalu pengunjung memberi nilai bintang + review. Dashboard publik bersifat *live* dan seru: review baru muncul di atas, booth disorot bergantian, dan "Booth Terbaik Saat Ini" selalu tampil.

## Daftar Isi

- [Bagian A — Plan Web](#bagian-a--plan-web)
  - [A0. Satu event aktif di domain utama](#a0-satu-event-aktif-di-domain-utama)
  - [A1. Peran pengguna](#a1-peran-pengguna)
  - [A2. Jadwal & status event](#a2-jadwal--status-event-dinamis-diatur-admin)
  - [A3. Flow Admin](#a3-flow-admin)
  - [A4. Flow Booth](#a4-flow-booth-akun-hanya-berlaku-per-event)
  - [A5. Flow Reviewer](#a5-flow-reviewer-bintang--review)
  - [A6. Menjaga dari spam nilai](#a6-menjaga-dari-spam-nilai-jawaban-pertanyaan-6)
  - [A7. Sistem penilaian & peringkat](#a7-sistem-penilaian--peringkat)
  - [A8. Dashboard interaktif](#a8-dashboard-interaktif)
  - [A9. Peta halaman](#a9-peta-halaman-sitemap)
  - [A10. Prinsip UX](#a10-prinsip-ux)
  - [A11. Roadmap fitur](#a11-roadmap-fitur)
  - [A12. Arah visual & gaya gerak](#a12-arah-visual--gaya-gerak-direvisi)
  - [A13. Desain responsif (mobile-first)](#a13-desain-responsif-mobile-first)
  - [A14. Produk & promosi booth](#a14-produk--promosi-booth)
  - [A15. Moderasi kata & komentar](#a15-moderasi-kata--komentar)
  - [A16. Booth tanpa pemilik & data tidak lengkap](#a16-booth-tanpa-pemilik--data-tidak-lengkap)
- [Bagian B — Plan Tech](#bagian-b--plan-tech)
  - [B1. Stack & jawaban "React cocok?"](#b1-stack--jawaban-react-cocok)
  - [B2. Arsitektur](#b2-arsitektur)
  - [B3. Struktur repo](#b3-struktur-repo)
  - [B4. Theming Tailwind + variabel (WAJIB)](#b4-theming-tailwind--variabel-wajib)
  - [B5. Variabel nilai selain warna (WAJIB)](#b5-variabel-nilai-selain-warna-wajib)
  - [B6. Model data (D1)](#b6-model-data-d1)
  - [B7. Auth & akun per-event](#b7-auth--akun-per-event)
  - [B8. Realtime yang hemat](#b8-realtime-yang-hemat-jawaban-pertanyaan-4)
  - [B9. Implementasi anti-spam](#b9-implementasi-anti-spam)
  - [B10. Daftar API](#b10-daftar-api)
  - [B11. Keamanan & privasi](#b11-keamanan--privasi)
  - [B12. Biaya, deploy, observability, testing](#b12-biaya-deploy-observability-testing)
  - [B13. Sistem log tanpa database](#b13-sistem-log-tanpa-database)
  - [B14. Arsitektur berbasis komponen](#b14-arsitektur-berbasis-komponen)
  - [B15. Upload gambar: konversi WebP di client](#b15-upload-gambar-konversi-webp-di-client)
  - [B16. Pemisahan kode per area (SPA hemat resource)](#b16-pemisahan-kode-per-area-spa-hemat-resource)
  - [B17. Jadwal event dinamis & pendaftaran booth](#b17-jadwal-event-dinamis--pendaftaran-booth)
  - [B18. Data Grid admin ala Excel](#b18-data-grid-admin-ala-excel)
  - [B19. Implementasi animasi hemat resource](#b19-implementasi-animasi-hemat-resource)
  - [B20. Keadilan tampilan & halaman booth](#b20-keadilan-tampilan--halaman-booth)
  - [B21. Perlindungan aksi ganda & jaringan buruk](#b21-perlindungan-aksi-ganda--jaringan-buruk-anti-double-click)
  - [B22. Standar kode web terbaru: Baseline & Modern Web Guidance](#b22-standar-kode-web-terbaru-baseline--modern-web-guidance)
  - [B23. Efek interaksi: klik, suara, dan kursor](#b23-efek-interaksi-klik-suara-dan-kursor)
  - [B24. Produk & promosi booth (teknis)](#b24-produk--promosi-booth-teknis)
  - [B25. Moderasi kata & komentar (teknis)](#b25-moderasi-kata--komentar-teknis)
  - [B26. Booth buatan admin & komponen tahan data kosong (teknis)](#b26-booth-buatan-admin--komponen-tahan-data-kosong-teknis)
- [Keputusan Terbuka](#keputusan-terbuka)

---

# Bagian A — Plan Web

## A0. Satu event aktif di domain utama

**Hanya ada satu event yang berjalan, dan ia langsung tampil di halaman utama** (domain utama `eventunimed.id`). Tidak ada halaman daftar event dan tidak ada slug di URL publik.

- **URL publik**: `/` (halaman event), `/b/:boothId` (halaman booth, tujuan QR), `/register`, `/booth` (portal pemilik booth), `/screen` (layar besar), `/results`. Admin di `/admin/*`.
- **Mengganti event**: admin membuat event baru (draft), mengisi jadwal dan identitas, lalu menekan **"Jadikan event aktif"**. Event aktif sebelumnya otomatis nonaktif (hanya admin yang melihatnya). **Tepat satu event aktif** pada satu waktu; dijamin oleh indeks unik parsial pada `is_active`, dan perpindahannya dilakukan dalam satu `batch()` D1.
- **Event aktif yang sudah selesai** tetap tampil (hanya-baca + animasi pemenang) selama belum ada pengganti. **Begitu admin mengaktifkan event lain, event lama otomatis disembunyikan dari publik** (hanya admin yang bisa melihatnya). Bila belum ada pengganti dan admin ingin menyembunyikannya, tersedia tombol **"Sembunyikan dari publik"**.
- **Tidak ada event aktif / disembunyikan**: halaman utama menampilkan layar sederhana **"Segera hadir"** (nama LPPM saja, tanpa data; disetujui).
- **Akun booth dan pengunjung tetap per-event** (`event_id`): saat event baru aktif, booth mendaftar ulang, sesuai aturan awal.
- **QR atau tautan booth milik event lama** (`/b/:id`) menampilkan "Event ini sudah berakhir" (`410`), bukan data booth.
- **Admin tetap bisa membuka event lama** lewat `/admin/e/:id` (Data Grid, hasil, ekspor).
- **Teknis**: Worker menemukan event aktif lewat `GET /api/event` (cache edge ±5 detik, kunci memuat `active_version`); `event_id` selalu diambil dari event aktif di server, bukan dari input klien; LiveHub memakai id event aktif; kunci cache snapshot memuat `eventId`.
- **Domain**: aplikasi di `eventunimed.id` (akar), gambar di `media.eventunimed.id` (B12, B15).

## A1. Peran pengguna

| Peran | Siapa | Akses | Login? |
|---|---|---|---|
| **Admin** | Panitia LPPM | Kelola event, verifikasi booth, moderasi review, lihat hasil | Ya (terpisah, lihat B7) |
| **Booth** | Peserta pameran | Daftar, edit profil booth, lihat nilai & review booth sendiri | Ya, **akun per-event**. **Opsional:** booth boleh **tanpa pemilik** (dibuat dan dikelola admin, A16) |
| **Reviewer** | Pengunjung | Beri bintang + review ke booth | Ringan (sekali per event) |
| **Publik / Layar besar** | Siapa saja, proyektor di lokasi | Lihat dashboard, leaderboard, daftar booth | Tidak |

## A2. Jadwal & status event (dinamis, diatur admin)

Setiap event punya jadwal yang **bisa diubah admin kapan saja**. Status event tidak disimpan sebagai pilihan manual, melainkan **dihitung dari tanggal** dan waktu server, jadi tampilan berubah sendiri tanpa admin menekan tombol.

| Data jadwal | Fungsi |
|---|---|
| **Pendaftaran dibuka** *(opsional)* | Kosong = terbuka sejak event dipublikasikan |
| **Pendaftaran ditutup** | Setelah waktu ini tombol **"Daftar Toko" hilang** dari semua halaman publik. **Link `/register` tetap berfungsi** sebagai *pendaftaran susulan* sampai event selesai (bisa dimatikan admin per event) |
| **Event dimulai** | Voting & dashboard live dibuka |
| **Event selesai** | Voting ditutup dan **event dibekukan**: hanya admin yang bisa mengubah apa pun |

Tiga kontrol manual yang tetap ada, semuanya di tangan admin: **mode peringkat** (tampil/sembunyi), tombol **"Putar animasi pemenang"** (boleh diputar kapan saja dan berulang), dan tombol **"Umumkan hasil"**. Rinciannya di A8 dan B20.

```
 daftar toko dibuka ──► tombol "Daftar Toko" hilang ──────────────────────► (link /register masih hidup)
   booth daftar → ADMIN VERIFIKASI                       "pendaftaran susulan" via link saja
                         event mulai ───────────────────────────────────► event selesai ──► BEKU (hanya admin)
                         voting + dashboard live                                             admin "Umumkan hasil"
```

Pendaftaran dan event adalah **dua sumbu yang berjalan sendiri-sendiri**:

| Kondisi | Tombol "Daftar Toko" | Link `/register` langsung | Verifikasi admin | Voting / review |
|---|---|---|---|---|
| Sebelum "pendaftaran ditutup" | **tampil** (+ hitung mundur "ditutup dalam …") | form aktif (pendaftaran reguler) | bisa | sesuai jadwal event |
| Sesudah "pendaftaran ditutup", event belum selesai | **hilang** | **form tetap aktif** dengan catatan "Pendaftaran reguler sudah ditutup, pendaftaran susulan tetap diperiksa admin"; booth ditandai **Susulan** di antrean admin | **bisa** | sesuai jadwal event |
| Sebelum event mulai | – | – | – | tombol review nonaktif: "Voting dibuka dalam …"; dashboard menampilkan hitung mundur + booth yang sudah disetujui |
| Event berlangsung | – | – | – | **review dibuka**, dashboard **live** |
| **Event selesai** | – | **ditolak** (halaman "Event telah berakhir") | hanya admin | review ditutup; dashboard final, "Hasil segera diumumkan" |
| Hasil diumumkan | – | – | – | **setiap pengunjung yang membuka/menyegarkan halaman event melihat animasi pemenang**, lalu bisa menutupnya untuk masuk mode hanya-baca |

**Aturan sederhananya:** pendaftaran booth terbuka sejak event dibuat (langsung dipublikasikan secara default). Setelah pendaftaran "ditutup", yang hilang hanyalah **tombolnya**; booth yang terlambat tetap bisa mendaftar lewat link, dan tetap harus diverifikasi admin. **Review baru terbuka tepat saat event dimulai**. Admin boleh menyimpan event sebagai `draft` bila masih menyiapkan; event `draft` tidak tampil di publik. Detail teknis dan kasus tepi: B17.

### Event selesai = dibekukan, admin tetap berkuasa

Begitu **event selesai**, **tidak ada aksi yang mengubah data** oleh siapa pun selain admin:

| Aksi | Sebelum event | Berlangsung | **Selesai** |
|---|---|---|---|
| Pengunjung melihat dashboard / daftar booth / hasil | ✅ | ✅ | ✅ (hanya baca) |
| Reviewer login & memberi/mengubah review | ❌ belum dibuka | ✅ | ❌ |
| Booth mendaftar (reguler atau susulan) | ✅ | ✅ susulan via link | ❌ |
| Booth **login** (OTP, hanya untuk akun yang sudah ada) dan melihat portalnya | ✅ | ✅ | ✅ **hanya-baca** |
| Booth edit profil, unggah gambar, laporkan review | ✅ | ✅ | ❌ (portal tampil hanya-baca) |
| **Admin: lihat semuanya** (semua booth tanpa memandang status, semua review termasuk `held`/`hidden`, data pengunjung, log) | ✅ | ✅ | ✅ |
| **Admin: ubah apa pun** (jadwal, tema, booth, status booth, review, hasil, buka kembali event) | ✅ | ✅ | ✅ |

**Setelah event selesai, semua tampilan menjadi hanya-baca:** halaman publik menampilkan hasil akhir, dan **portal booth tetap bisa dibuka (login OTP) tetapi hanya-baca**: ringkasan nilai, distribusi bintang, dan daftar ulasan tetap terlihat; kolom isian dinonaktifkan, tombol simpan/unggah/laporkan disembunyikan, dan ada banner "Event telah berakhir, tampilan hanya-baca". Login dibatasi pada booth yang sudah punya akun; **tidak ada pendaftaran baru dan tidak ada login pengunjung/reviewer**. Di sisi UI ini dikendalikan satu komponen pembungkus `WriteAction` (B14), jadi tidak ada tombol yang terlewat.

**Kemampuan admin pasca-event** (semuanya wajib mencantumkan alasan dan tercatat, lihat B17 dan B13):
- Mengubah **event**: jadwal (termasuk membuka kembali event dengan memundurkan tanggal selesai), tema, banner, kategori ulasan; mengumumkan atau menarik kembali hasil; mengarsipkan event.
- Mengubah **booth**: profil, gambar, status (setujui/tolak/suspend), no. booth.
- Mengubah **review**: sembunyikan, pulihkan, hapus, **sunting bintang/komentar**. Nilai asli dan alasan perubahan **selalu tersimpan** sehingga ada jejak "sebelum → sesudah".

## A3. Flow Admin

*Struktur navigasi panel panitia:* halaman `/admin` memisahkan daftar event (kiri) dengan panduan alur cepat & formulir buat event (kanan). Di dalam event (`/admin/e/:id*`), seluruh sub-halaman memakai **kerangka sidebar/navigasi persisten** (`Ringkasan & Hasil`, `Booth`, `Moderasi`, `Poster QR`, `Data Grid`, `Log aktivitas`) beserta pintasan langsung ke Halaman Publik dan Layar Besar. Halaman `/admin/e/:id` diringkas ke **4 angka KPI** + **tab tugas** (`Ringkasan & Hasil` sebagai tab awal, `Identitas & Gambar`, `Jadwal & Aturan`, `Kategori Ulasan`).

1. **Buat event**: nama resmi acara (tampil sebagai judul utama; tanpa slug di URL karena hanya ada satu event aktif), **jadwal** (pendaftaran dibuka/ditutup, event mulai/selesai; zona waktu default WIB), banner/logo, **tema warna** (primary/accent), **kategori ulasan** (pilihan yang bisa dipilih reviewer, diatur admin; lihat A5), mode verifikasi reviewer (lihat A6).
2. **Atur & pantau jadwal kapan saja**: form jadwal menampilkan pratinjau langsung ("Pendaftaran dibuka · ditutup 3 hari lagi · event mulai 12 hari lagi"), tombol cepat **"Tutup pendaftaran sekarang"** dan **"Perpanjang +1 hari / +1 minggu"**, serta peringatan bila ada booth `pending` saat pendaftaran akan ditutup (booth itu tetap bisa diverifikasi). Setiap perubahan jadwal tercatat di log. Bagikan link pendaftaran booth.
3. **Antrean verifikasi booth**: daftar booth berstatus `pending` → admin lihat detail → **Setujui / Tolak (wajib isi alasan) / Minta revisi**. Booth yang punya email mendapat notifikasi; booth tanpa email (A16) tidak, dan keputusannya sepenuhnya di admin.
   - *Hemat waktu (opsional)*: admin upload daftar email undangan (CSV); booth yang emailnya ada di daftar bisa **auto-setujui**.
   - **Tambah booth sendiri, tanpa pemilik (A16)**: admin bisa membuat booth cukup dengan **nama**; **email pemilik, foto, nomor, dan data lain opsional**. Booth langsung tayang dan dikelola admin lewat `/admin/e/:id/booths/:bid`. Banyak booth sekaligus bisa dimasukkan lewat **impor CSV** (MVP). Pemilik bisa ditambahkan belakangan (isi email) atau dilepas kapan saja.
4. **Cetak materi**: generate poster QR per booth (nama booth + QR yang mengarah ke halaman review booth itu) untuk dicetak A4/A5.
5. **Voting terbuka otomatis** saat event dimulai → pantau dashboard live + antrean moderasi.
6. **Moderasi review dan komentar** (A15): komentar yang ditahan filter kata, review yang ditandai sistem (flagged), dan **laporan dari booth atau pengunjung** masuk satu antrean; admin bisa **sembunyikan komentar saja**, **sembunyikan seluruh review**, **pulihkan**, atau **blokir pengunjung**, dan mengatur **daftar kata** (tambah, hapus, daftar pengecualian). Semua tindakan wajib alasan dan tercatat di log. **Hanya admin yang bisa menyembunyikan.**
7. **Panel kontrol peringkat & pemenang** (kapan saja, termasuk setelah event selesai):
   - **Mode peringkat**: *Tampil* (default; bagian 03 di halaman event), *Sembunyi* (komponen peringkat tidak ditampilkan dan datanya tidak dikirim ke pengunjung), atau *Tampil saat hasil diumumkan*. Peringkat adalah komponen **opsional** yang bisa disembunyikan admin.
   - **Putar animasi pemenang**: menayangkan 3-2-1, lalu juara 3, 2, 1 secara bertahap, di **Layar Besar** dan/atau di halaman event semua pengunjung (admin memilih). Bisa diputar ulang berkali-kali; ada pratinjau top 3 dan peringatan sebelum diputar.
   - **Mode rating (moderasi)**: *Tampil* (default), *Sembunyi*, atau *Tampil saat hasil diumumkan*. Saat disembunyikan, rata-rata bintang, jumlah ulasan, bintang pada ulasan, dan peringkat tidak tampil bagi pengunjung maupun booth (dan tidak dikirim server). Bisa diubah kapan saja sebagai alat moderasi, mis. saat dicurigai ada manipulasi. Peringkat otomatis ikut tersembunyi bila rating disembunyikan.
   - **Umumkan hasil**: membekukan hasil akhir (**seluruh peringkat semua booth**), menampilkan rating dan peringkat, serta menayangkan animasi pemenang. Setelah itu setiap pengunjung yang membuka halaman event melihat animasi tersebut (A8).
   - **Perbarui hasil**: bila admin menyunting review sesudah hasil diumumkan, hasil yang sudah diumumkan **tidak berubah sendiri**; admin menekan tombol ini untuk membekukan ulang (ada peringatan bila peringkat terkini berbeda dari yang diumumkan). Pembaruan juga menyalakan kembali pemutaran otomatis bagi pengunjung yang sebelumnya memilih "jangan putar lagi".
   - Export hasil CSV/PDF.
8. **Mode admin penuh kapan pun, termasuk setelah event selesai**: halaman **Data (tabel ala Excel)** untuk melihat dan menyunting semua data: booth, review, pengunjung, dan peringkat (rinciannya di bawah). Admin juga bisa menyunting event dan membuka kembali event. Setiap perubahan **wajib alasan**, ada dialog konfirmasi yang menyebut dampak ke peringkat, dan tiap baris punya **riwayat perubahan** (nilai asli → nilai sekarang).

### Halaman Data ala Excel (admin)

Satu halaman `/admin/e/:id/data` dengan **tab**: **Booth · Produk · Review · Pengunjung · Peringkat** (tab Log memakai tampilan log yang sudah ada). Tampilannya seperti spreadsheet:

| Kemampuan | Keterangan |
|---|---|
| **Tabel padat** | Header menempel (sticky), kolom pertama bisa dibekukan, ukuran kolom bisa digeser, baris bergaris, pilihan kerapatan (nyaman / padat) |
| **Sortir & filter per kolom** | Klik header untuk urut; filter per kolom (teks, angka/rentang, pilihan status, tanggal); pencarian global |
| **Tampil/sembunyikan kolom** | Admin memilih kolom yang ingin dilihat; pilihan diingat di browser |
| **Sunting langsung di sel** | Klik dua kali atau tekan Enter; Esc membatalkan; panah/Tab untuk berpindah sel seperti Excel. Bintang = pemilih bintang, status = dropdown, komentar = teks |
| **Perubahan tertunda** | Sel yang diubah diberi warna kuning dan bar atas menampilkan "3 perubahan belum disimpan" → **Simpan…** membuka dialog dengan **satu alasan wajib** dan **pratinjau dampak peringkat** ("Booth X turun #2 → #3") sebelum benar-benar disimpan; **Batalkan semua** tersedia |
| **Aksi massal** | Pilih banyak baris (kotak centang / Shift-klik): sembunyikan, pulihkan, hapus review; setujui/tolak booth; blokir pengunjung |
| **Penanda perubahan admin** | Sel yang pernah disunting admin diberi tanda kecil; arahkan kursor → "Asli: ★5 → Sekarang: ★3 · oleh X · 12 Nov · alasan: …". Panel samping **Riwayat** per baris |
| **Baris ringkasan (footer)** | Jumlah baris, rata-rata bintang, jumlah per status, mengikuti filter yang aktif |
| **Ekspor** | **CSV** dan **XLSX** untuk tampilan terfilter maupun semua data |
| **Tampilan tersimpan** (v1) | Menyimpan kombinasi filter/kolom, mis. "Review mencurigakan bintang 5" |
| **Tambah baris booth** | Tombol **"+ Booth"** di tab Booth: baris baru, ketik **nama** lalu Enter (hanya nama yang wajib). Langsung tersimpan sebagai booth tanpa pemilik; tidak memakai alur "perubahan tertunda" karena bukan mengubah data yang sudah ada, tetapi tercatat di log (A16) |

Kolom per tab:
- **Booth**: no., nama, email, **pemilik** (Tanpa pemilik / Diundang / Aktif), **kelengkapan** (Hanya nama / Sebagian / Lengkap), status, **Susulan?**, dibuat (oleh pemilik atau admin), disetujui oleh/pada, alasan tolak, jumlah review, rata-rata, skor Bayesian, peringkat. *Bisa disunting:* nama, tagline, deskripsi, no. booth, **email pemilik (kosongkan = lepas pemilik)**, status. Kolom *pemilik* dan *kelengkapan* bisa difilter, mis. "tampilkan booth yang masih hanya nama".
- **Produk**: booth, nama, kategori, harga, harga normal, penanda, andalan?, status, dibuat. *Bisa disunting:* nama, deskripsi, harga, status (sembunyikan atau tandai `removed_by_admin` untuk produk yang melanggar aturan A14, mis. menjanjikan hadiah untuk bintang). Wajib alasan seperti tab lain.
- **Review**: booth, pengunjung (nama tampil + penyedia + hash singkat), bintang, komentar, kategori ulasan, status, skor risiko & flag, ip-hash singkat, dibuat/diubah, dimoderasi oleh/pada/alasan, bintang & komentar asli. *Bisa disunting:* bintang, komentar, kategori ulasan, status.
- **Pengunjung**: nama tampil, penyedia, hash singkat, diblokir?, jumlah review, pertama terlihat. *Bisa disunting:* nama tampil, diblokir.
- **Peringkat** (hanya-baca): peringkat, booth, rata-rata mentah, jumlah review, skor Bayesian, selisih dari peringkat di atasnya. Berguna untuk melihat langsung dampak suntingan.

Kolom ID, cap waktu, hash, dan angka hasil hitung **tidak bisa disunting**. Data besar dimuat per halaman (server-side) agar tetap cepat; perubahan oleh admin lain terdeteksi (baris ditandai konflik jika sudah berubah). Halaman ini dapat dipakai penuh setelah event selesai.

## A4. Flow Booth (akun hanya berlaku per-event)

Aturan inti: **identitas booth = (event, email)**. Email yang sama di event berbeda = akun berbeda, harus daftar ulang. Tidak ada akun global.

```
Buka link pendaftaran event ─► isi email ─► kode OTP ke email (bukti kepemilikan email)
   ─► isi profil booth (**hanya nama yang wajib**; tagline, deskripsi, foto, no. booth, anggota tim opsional, A16)
   ─► status PENDING ("menunggu verifikasi admin")
   ─► admin SETUJUI ─► email notifikasi ─► booth login (OTP email) ─► Portal Booth
        (jalur pendaftaran mandiri; booth buatan admin tidak lewat alur ini dan boleh tanpa email, A16)
                  └─► TOLAK/REVISI ─► email berisi alasan ─► booth perbaiki & kirim ulang
```

Aturan pendaftaran:
- **Tombol "Daftar Toko" hanya tampil selama pendaftaran reguler dibuka** (di hero halaman utama dan pada daftar booth yang masih kosong). Begitu waktu tutup terlewati, tombol **hilang sendiri** tanpa perlu muat ulang halaman.
- **Pendaftaran susulan via link**: halaman `/register` **tetap bisa diakses dan dikirim setelah pendaftaran ditutup, bahkan setelah event dimulai**, sampai event selesai. Tidak ada tombol yang mengarah ke sana; panitia membagikan link-nya langsung ke booth yang terlambat. Halaman menampilkan catatan "Pendaftaran reguler sudah ditutup; pendaftaran susulan diperiksa admin", dan booth yang masuk lewat jalur ini ditandai **Susulan** di antrean admin. Admin dapat mematikan jalur ini per event (pengaturan `allowLateRegistration`).
- **Semua pendaftaran, reguler maupun susulan, wajib diverifikasi admin.** Booth berstatus `pending` **tidak muncul di daftar publik dan tidak bisa dinilai** sampai disetujui.
- Booth susulan yang disetujui saat voting sudah berjalan langsung muncul di daftar dan bisa dinilai mulai nol; peringkat Bayesian (A7) menjaga agar ia tidak dirugikan/diuntungkan karena jumlah review yang masih sedikit. Poster QR-nya dicetak setelah disetujui.
- **Setelah event selesai pendaftaran ditolak sepenuhnya** (event dibekukan, lihat A2). Admin tetap bisa menambah/mengubah booth secara manual bila perlu.

**Portal Booth** (setelah disetujui):
- Ringkasan: rating rata-rata, jumlah review, distribusi bintang, peringkat saat ini.
- Daftar review yang masuk (read-only; booth **tidak bisa menghapus maupun menyembunyikan** ulasan atau komentar, hanya bisa *melaporkan* ke admin dengan alasan; keputusan ada di admin, lihat A15). Ini disengaja: kalau booth boleh menyembunyikan komentar, komentar jelek bisa dihilangkan sepihak dan penilaian tidak lagi adil.
- Edit profil (logo, deskripsi) — hanya selama event belum selesai.
- **Kelola produk & harga** (A14) — **sepenuhnya opsional**: tambah/ubah/sembunyikan produk (**maksimal sesuai batas event, bawaan 24**), unggah satu foto per produk, atur kategori dan urutan, dan **pilih satu produk andalan** (boleh diganti kapan saja selama event belum selesai). Opsional pula: **nomor WhatsApp** untuk tombol "Pesan dulu".
- **Panel Bagikan** (A14): tautan booth dan tiap produk, teks siap kirim, dan QR booth.
- Unduh poster QR booth sendiri.
- (Opsional) balas review secara publik, 1 balasan per review.

Aturan pelengkap:
- Akun booth **tidak bisa memberi review** di event yang sama (cegah nilai diri sendiri). Detail teknis di B9.
- Booth yang `ditolak`/`suspended` tidak muncul di daftar publik.
- **Pemilik tidak wajib ada**: admin dapat membuat dan mengelola booth sendiri tanpa email pemilik (A16). Booth seperti itu tidak punya portal dan tidak menerima email; semua sisanya (tampil, dinilai, peringkat, QR) sama persis.
- **Foto sepenuhnya opsional**, untuk pendaftaran mandiri maupun booth buatan admin, dan **tidak ada pengaturan untuk mewajibkannya**. Form hanya menampilkan saran lembut ("kartu dengan foto lebih menarik"); booth tanpa foto disetujui seperti biasa. Karena semua komponen sudah punya ketetapan tampilan tanpa gambar (bingkai, hanya-teks, atau hilang; A16), tidak ada alasan menahan booth yang belum berfoto.
- Event baru → booth daftar lagi dari awal (sesuai permintaan). *Nice-to-have yang tidak melanggar aturan:* tombol "salin isi form dari event sebelumnya" hanya jika email yang sama login ulang — tetap akun baru, hanya prefill form. Putuskan nanti.

## A5. Flow Reviewer (bintang + review)

```
Scan QR di booth  (atau ketuk kartu booth di halaman event)
   ─► HALAMAN BOOTH  /b/:boothId
        galeri foto · nama · rating · chip harga · produk andalan · produk lain · tentang booth & tim · sebaran bintang · "sering disebut" · ulasan pilihan · semua ulasan (A14)
        + kotak "Beri penilaian" (di samping pada desktop; tombol melayang pada HP)
   ─► verifikasi ringan saat menekan Kirim (A6; login sekali per event, sesudahnya sesi tersimpan)
   ─► form:  ★★★★★ (wajib, 1–5)
             Kategori ulasan (opsional, maks. 3, pilihan dari admin): Inovatif · Ramah · Seru · Bermanfaat · Kreatif · Rapi
             Komentar (opsional, maks. 280 karakter)
   ─► kirim ─► "Terima kasih." + "Kamu sudah menilai 3 dari 24 booth" + 3 booth lain yang belum dinilai (urutan acak)
```

Keputusan desain:
- **Halaman khusus per booth**: pengunjung melihat detail toko (foto, deskripsi, tim, ulasan lain) sebelum menilai, dan **dashboard utama tetap ringan** karena form review, skrip Turnstile/Google, dan foto ukuran penuh tidak dimuat di sana (B16, B20).
- **Bintang saja sudah cukup** untuk submit. Komentar opsional supaya friksi rendah → partisipasi tinggi.
- **Kategori ulasan dikelola admin per event**: label, urutan, aktif/nonaktif; daftar awal Inovatif, Ramah, Seru, Bermanfaat, Kreatif, Rapi. Pengunjung memilih sampai 3. Hasilnya dirangkum sebagai **"Sering disebut: Seru (12) · Ramah (9)"** di spotlight dan halaman booth. Mengganti nama atau menonaktifkan kategori tidak menghapus data lama. Ini **bukan** bintang per kriteria (itu v2).
- **1 review per pengunjung per booth**. Boleh **mengedit** sampai event selesai (menimpa review lama, bukan menambah).
- Nama tampil di review = **alias/nama depan**, bukan email.
- Opsional (v2): bintang per kriteria (Kreativitas, Inovasi, Pelayanan, Tampilan). Untuk MVP pakai 1 bintang keseluruhan.

## A6. Menjaga dari spam nilai (jawaban pertanyaan 6)

**Kenyataannya:** tidak ada metode yang 100% anti-curang. Ancaman paling realistis di expo kampus bukan bot canggih, tapi (a) tim booth minta teman vote massal, (b) satu orang vote berkali-kali pakai incognito/email berbeda, (c) bot iseng. Tujuannya: **naikkan biaya curang, deteksi yang lolos, dan jangan bikin pengunjung asli malas menilai.**

### Perbandingan metode identitas reviewer

| Metode | Friksi | Kuat vs spam | Biaya/ribet | Catatan |
|---|---|---|---|---|
| **Email + kode OTP** | Sedang (buka email, salin kode) | Sedang (bisa banyak email) | Perlu kirim email, rawan "email-bombing" | Usulanmu. Bagus tapi lambat di keramaian |
| **Login Google 1-tap** | **Rendah** | Sedang–baik (bikin akun Google massal lebih susah) | Gratis, tanpa kirim email | Pengguna iPhone/tanpa akun Google perlu fallback |
| **QR di booth + Turnstile saja** (tanpa login) | **Sangat rendah** | Rendah–sedang (hapus cookie = bisa ulang) | Gratis | Hanya cukup untuk event santai |
| **Kode tiket dari panitia** (QR/gelang/kartu di meja registrasi) | Rendah | **Tertinggi** (1 kode = 1 orang fisik) | Logistik cetak & bagi | Cocok jika ada meja registrasi |
| **QR dinamis di booth** (berubah tiap ±60 dtk di layar booth) | Rendah | Mencegah vote dari jauh | Booth wajib punya layar | Tambahan, bukan pengganti identitas |

### Rekomendasi: berlapis, dan **mode-nya bisa dipilih admin per event**

Default yang disarankan:

1. **QR per booth** → pengunjung masuk lewat QR, bukan sembarang link. (Menjamin niat "sedang di booth".)
2. **Turnstile** (CAPTCHA tak terlihat dari Cloudflare, gratis) → menghalau bot tanpa mengganggu manusia.
3. **Login sekali per event**: **Google 1-tap** sebagai jalur utama, **email OTP** sebagai cadangan. Setelah itu sesi tersimpan, menilai booth ke-2, ke-3 dst. tanpa verifikasi lagi.
4. **1 review per identitas per booth**, bisa edit.
5. **Peringkat Bayesian** (A7) → memborong bintang 5 di booth yang hanya punya 3 review tidak langsung membuatnya juara.
6. **Deteksi anomali + antrean moderasi** (lonjakan review, pola mencurigakan) → ditahan untuk dicek admin, **bukan dihapus otomatis**.

Pilihan mode di pengaturan event (`reviewer_auth_mode`):
`google_or_email` (default) · `ticket_code` (paling ketat) · `open_turnstile` (paling santai, QR + Turnstile saja).

> **Ide praktis lain:** kalau LPPM punya meja registrasi, mode `ticket_code` adalah yang paling praktis *dan* paling kuat — pengunjung terima kartu ber-QR unik, scan sekali, selesai. Tanpa email, tanpa OTP.
>
> **Hati-hati:** hadiah/doorprize untuk reviewer meningkatkan partisipasi tapi juga **insentif spam**. Kalau dipakai, syaratkan identitas terverifikasi dan 1 undian per orang.

## A7. Sistem penilaian & peringkat

Rata-rata mentah itu tidak adil: booth dengan 1 review ★5 akan mengalahkan booth dengan 80 review rata-rata 4.8. Solusi: **rata-rata Bayesian** (tertimbang jumlah review).

```
skor = (v / (v + m)) × R  +  (m / (v + m)) × C
  R = rata-rata bintang booth    v = jumlah review booth
  C = rata-rata bintang semua booth    m = bobot awal (mis. 5 review)
```

- Booth dengan sedikit review "ditarik" ke rata-rata umum; makin banyak review makin dipercaya.
- **Batas rumus (hasil uji, Tahap 2):** penarikan ke rata-rata umum hanya melindungi bila rata-rata semua review **lebih rendah** daripada rata-rata booth mapan. Bila rata-rata umum sudah sekitar 4,8 (wajar untuk expo karena pengunjung cenderung memberi bintang tinggi), booth dengan **3 review ★5 tetap mengalahkan booth dengan 80 review rata-rata 4,8, berapa pun nilai `m`**. Penahan utamanya adalah **jumlah minimal review untuk masuk peringkat** (`minReviewsToRank`, bawaan 3). Lihat keputusan terbuka 58.
- Tampilkan ke pengguna dengan bahasa sederhana: *"Peringkat memperhitungkan jumlah ulasan agar adil."*
- Rata-rata mentah tetap ditampilkan di kartu booth; **peringkat** memakai skor Bayesian.
- Tie-break: skor → jumlah review → rata-rata mentah → waktu review terakhir (lebih dulu menang).
- Nilai `m`, jumlah minimal review untuk masuk peringkat, dan penghargaan tambahan opsional (mis. "Paling Banyak Diulas") ditentukan admin per event. **Tidak ada kategori booth**; pemenang utama hanya satu: Booth Terfavorit.

## A8. Halaman event (adil untuk semua booth)

**Prinsip:** halaman event tidak boleh menggiring pengunjung ke booth tertentu sebelum mereka melihat booth lain. Urutan dari atas ke bawah:

1. **Masthead**: judul event, penanda LIVE, dan satu baris statistik ("116 ulasan · 8 booth · rata-rata 4,43").
2. **01 Sorotan**: satu booth, bergantian, adil.
3. **02 Semua booth**: grid kartu (berfoto, berbingkai, atau hanya-teks bila data kosong, A16) dengan **urutan acak yang berbeda untuk setiap pengunjung**.
4. **03 Peringkat & ulasan terbaru**: **paling bawah**. "Booth terbaik saat ini" adalah baris pertama peringkat, bukan hero di atas halaman.

**Aturan keadilan**
- Tidak ada hero "booth terbaik" di bagian atas, **tidak ada lencana peringkat di kartu booth**, dan semua kartu berukuran sama.
- **Urutan acak per pengunjung**: tiap pengunjung mendapat seed acak yang disimpan di browser, jadi urutannya **stabil selama sesi** (tidak melompat saat data berubah) dan berbeda antar pengunjung. Booth baru yang disetujui masuk ke posisi acak tanpa mengacak ulang yang lama. Pengacakan dilakukan di client, sehingga data yang diambil semua orang sama dan tetap bisa di-cache edge (B20).
- **Sorotan bergilir adil**: tiap putaran, semua booth tampil tepat satu kali dalam urutan acak (opsional: booth yang jarang diulas lebih sering tampil, membantu pemerataan review).
- **Peringkat dan ulasan terbaru hanya di bagian paling bawah**, supaya tidak memengaruhi pilihan pengunjung sebelum menjelajah.
- Kartu booth adalah **tautan ke halaman booth**; form review tidak dibuka di dashboard (A5).

**Bagian 01 · Sorotan** (tata letak dua kolom: foto besar di kiri, teks di kanan)
- **Galeri foto asli booth, bila ada** (beberapa foto, bergeser otomatis ±2,8 detik, bisa digeser/diketuk, penanda segmen `02 / 04`). Berhenti saat disentuh/di-hover. Garis waktu tipis menunjukkan kapan sorotan berganti (±9 detik).
- Nomor booth, **nama booth** (besar), **rating gaya Google** `4,7 ★★★★★ (24)`, "Sering disebut: Bermanfaat (8) · Inovatif (5)" (dari kategori ulasan), satu kalimat deskripsi.
- **Kartu mini produk andalan** booth itu (foto kecil, nama, harga) di atas kutipan (A14).
- **Satu kutipan ulasan pilihan** dan tombol **"Lihat booth & beri nilai"**.
- **Aturan "Ulasan pilihan" (hanya yang bagus yang tampil):** ulasan harus (a) berbintang **4–5**, (b) berkomentar **≥ 30 karakter**, (c) berstatus `visible` (lolos moderasi), (d) tanpa kata terlarang. Urutan: **disematkan admin** lebih dulu → bintang tertinggi → komentar terpanjang → terbaru. Bila belum ada yang memenuhi syarat, tampil "Belum ada ulasan pilihan" dan **tidak pernah menampilkan ulasan buruk**. Nilainya ada di `CONFIG.spotlight`. Ulasan lain tetap muncul di feed dan halaman booth.
- Foto sampul **tidak wajib**. Booth tanpa foto tetap dapat giliran sorotan yang sama; tata letaknya berganti menjadi versi hanya-teks (nama besar pada blok warna, tanpa kolom foto) dan tinggi blok dijaga agar halaman tidak melompat saat sorotan berganti (A16, B26).

**Bagian 02 · Semua booth**
- Kartu: **foto 4:3**, nama, rating `4,5 ★★★★★ (18)`, nomor booth, dan **stiker harga di pojok foto** ("mulai Rp 14rb" atau "Gratis", A14). Seluruh kartu adalah tautan; saat disentuh/di-hover muncul "Lihat →". Tidak ada tombol, kategori, atau peringkat. **Tidak ada urutan atau filter berdasarkan harga**, sehingga urutan acak tetap adil.
- Dimuat bertahap (±24 kartu per tahap) dengan gambar *lazy*. Tidak ada kategori booth, jadi tidak ada filter kategori.
- Urutan **tidak diacak ulang** saat data berubah: di HP itu membuat jari salah tap.

**Bagian 03 · Peringkat & ulasan terbaru**
- **Peringkat**: nomor besar, nama, rating, skor. Baris pertama diberi latar. Saat urutan berubah, baris berpindah mulus dan berkedip; bila peringkat 1 berganti muncul toast "X naik ke peringkat 1" (tanpa mahkota atau confetti agar tetap adil selama voting).
- **Peringkat adalah komponen opsional**: admin dapat menyembunyikannya kapan saja (A3). Saat disembunyikan, bagian 03 hanya berisi "Ulasan terbaru", dan **server tidak mengirim data peringkat** sehingga tidak bisa diintip lewat jaringan (B20). Bagian ini selalu ditempatkan paling bawah, tidak pernah di atas, supaya pengunjung tidak terpaku pada peringkat 1.
- **Ulasan terbaru**: feed 5 item, masuk dari atas; saat ramai diringkas "+N ulasan baru".

**Lainnya**
- **Mode Layar Besar** (`/screen`) untuk proyektor: huruf besar, tanpa interaksi, auto-rotate antar panel dengan urutan **Sorotan → Semua booth → Ulasan terbaru → Peringkat**. Panel peringkat **boleh tampil tetapi selalu yang terakhir** (tidak pernah di awal), dan mengikuti mode peringkat yang diatur admin.
- **Animasi pemenang** diputar oleh admin *(diperbarui atas permintaan pemilik proyek)*: layar penuh panggung gelap (`panggung`) bergaya **motion graphic** meriah — hitung mundur kinetik 3-2-1 dengan cincin & sinar sorotan → juara 3 → 2 → 1 → **daftar hasil akhir seluruh booth**, lengkap dengan **pita bertuliskan juara** (folded banner ribbon), **hiasan kilau bintang, pita bendera (bunting), confetti palet UNIMED, dan piala vektor SVG pada Juara 1**, plus suara hitung mundur & fanfare (`lib/sfx.ts`, B23), tetap menghormati `prefers-reduced-motion`. Tampil di Layar Besar dan, bila dipilih admin, sebagai lapisan layar penuh yang bisa ditutup di halaman event pengunjung.
- **Setelah event selesai dan hasil diumumkan**: **setiap kali pengunjung membuka atau menyegarkan halaman event, animasi pemenang diputar otomatis.** Pengunjung bisa **Lewati/Tutup** kapan saja (tombol, Esc, atau sentuh) untuk masuk ke tampilan **hanya-baca**, yang menampilkan **alert kanan atas** `"Event telah berakhir. Tampilan ini hanya-baca."` (beserta seluruh notifikasi/toast sistem alert kanan atas beranimasi & ber-loader), hasil akhir di bagian bawah, dan tautan "Putar ulang animasi pemenang". Belum diumumkan: tidak ada animasi, tampil "Hasil segera diumumkan". Halaman booth tidak memutar animasi. Tersedia pilihan **"Jangan putar otomatis lagi di perangkat ini"** (kotak centang di bawah lapisan animasi, disimpan di browser); pengunjung tetap bisa memutar manual lewat tautan, dan bisa menyalakannya kembali lewat tombol "Putar otomatis saat dibuka: Nyala/Mati" di banner.
- **Daftar hasil akhir (layar akhir animasi dan bagian hasil di halaman hanya-baca)**: **seluruh booth** dicantumkan berurutan dari peringkat 1. **Juara 1, 2, dan 3 masing-masing punya bingkai yang berbeda** (juara 1 paling besar dengan garis hijau tebal dan foto besar; juara 2 dan 3 bingkai sedang dengan garis berbeda nada), sedangkan **peringkat 4 dan seterusnya memakai baris yang sama**. Bingkai khusus ini **hanya untuk hasil akhir**, tidak dipakai pada peringkat saat event berlangsung, supaya tidak ada sorotan sebelum diumumkan. Setiap baris menampilkan **peringkat, foto, nama, rata-rata bintang dengan jumlah ulasan, skor, dan tag ulasan teratas (maksimal 3, beserta jumlahnya)**, misalnya "Seru 12 · Ramah 8 · Bermanfaat 2". **Tag ulasan dibuat oleh admin** (kategori ulasan, A5) dan dipilih pengunjung saat menilai; label pada hasil yang diumumkan dibekukan bersama hasil. Komponennya `ResultsList` (B14).
- **Rating bisa disembunyikan (moderasi admin)**: lihat A3. Saat disembunyikan, tempat rating menampilkan "Rating disembunyikan", dan peringkat ikut tidak tampil.
- Lencana otomatis ("Lagi Panas", "Naik Daun") **tidak dipakai di kartu booth** karena menggiring; bila dipakai, hanya di bagian 03 (v2).
- Contoh interaktif: `demo-event.html` (halaman event + halaman booth, dua gaya **Seru** dan **Profesional**; foto di sana hanya pengganti).

**Aksesibilitas & kenyamanan:** hormati `prefers-reduced-motion` (animasi dikurangi), live feed memakai `aria-live="polite"` yang di-throttle, kontras warna lulus WCAG AA (juga untuk tema custom).

## A9. Peta halaman (sitemap)

```
/                                   Halaman event: sorotan → semua booth (acak per pengunjung) → peringkat & ulasan terbaru
/screen                     Mode layar besar
/b/:boothId                 Halaman booth: galeri, detail, ulasan + form "Beri penilaian" (tujuan QR)
/register                   Pendaftaran booth
/booth                      Portal booth (login → dashboard)
/results                    Pintasan ke halaman event dengan animasi pemenang (bila hasil sudah diumumkan)
/admin                              Daftar event (buat, jadikan aktif, arsipkan)
/admin/e/:id                        Pengaturan event + tema
/admin/e/:id/booths                 Antrean verifikasi + daftar booth + tombol "Tambah booth" (A16)
/admin/e/:id/booths/import          Impor CSV booth: unggah/tempel, pratinjau per baris, impor (MVP; hanya `nama` yang wajib, email opsional)
/admin/e/:id/booths/:bid            Kelola satu booth atas nama pemilik: profil, foto, produk, WhatsApp, pemilik (undang/lepas); dipakai juga untuk booth tanpa pemilik
/admin/e/:id/moderation             Antrean review ditandai
/admin/e/:id/data                   Data ala Excel: tab booths | products | reviews | visitors | ranking (lihat, filter, sunting sel, aksi massal, ekspor; juga setelah event selesai)
/admin/e/:id/logs                   Log aktivitas (siapa melakukan apa, kejadian spam, error)
/admin/e/:id/posters                Cetak poster QR (A4/A5, murni di klien dari booth approved)
/admin/e/:id/results                Hasil + export
```

**Pembagian area aplikasi** (masing-masing dengan layout sendiri dan dimuat terpisah, detail di B16):

| Area | Isi |
|---|---|
| **Tampilan all toko / halaman event** (`event`) | `/`: dashboard live + **daftar semua booth**, profil booth, alur review, hasil |
| **Tampilan admin** (`admin`) | Semua halaman `/admin/*` |
| *Portal pemilik booth* (`booth`) | Pendaftaran booth, login, portal booth (area tambahan, lihat catatan B16) |
| *Layar besar* (`screen`) | Mode proyektor tanpa navigasi (area tambahan) |

## A10. Prinsip UX

- **Setiap aksi yang mengubah data dilindungi dari klik ganda**: tombol langsung terkunci dan menampilkan loader, lebar tombol tetap, dan jaringan buruk tidak pernah membuat data tercatat dua kali (B21).
- **Mobile-first** (mayoritas reviewer pakai HP sambil berdiri di booth). Alur review harus selesai **< 15 detik**.
- Ramah koneksi buruk (WiFi expo sering padat): halaman ringan, gambar dioptimasi, UI tetap berguna saat offline sesaat (pesan jelas saat gagal kirim, tombol coba lagi).
- Bahasa: Indonesia (opsional i18n belakangan).
- **Tema bisa diganti tanpa menyentuh komponen** (aturan teknis di B4): ganti warna event dengan memilih warna di panel admin.

## A11. Roadmap fitur

| Tahap | Isi |
|---|---|
| **MVP** | **Produk & promosi booth (A14: maks. 24 produk, satu andalan pilihan toko, daftar incaran)** · Buat event + **jadwal dinamis (daftar dibuka/tutup, event mulai/selesai) yang bisa diedit admin** · daftar booth + OTP email · **booth dibuat admin tanpa pemilik dan tanpa email (A16)** · **impor CSV booth (A16, B26)** · **semua komponen tahan data kosong: booth boleh hanya nama, tanpa foto (A16, B26)** · antrean verifikasi · QR per booth · review bintang + komentar · **kategori ulasan yang diatur admin** · login reviewer (Google/OTP) + Turnstile · peringkat Bayesian · dashboard (hero, leaderboard, live feed, spotlight) · moderasi dasar · **Data Grid admin ala Excel (lihat, sortir, filter, ekspor CSV, sunting sel dengan alasan wajib)** · tampilan hanya-baca setelah event selesai · `logger` terpusat (B13) · galeri komponen |
| **v1** | Data Grid: aksi massal, ekspor XLSX, riwayat per baris, tampilan tersimpan · Halaman **Log Aktivitas** di admin · Mode layar besar · reveal pemenang · poster QR cetak · tema per event · deteksi anomali · export hasil |
| **v2** | Multi-kriteria · balasan booth · mode `ticket_code` · QR dinamis · penghargaan tambahan · lencana di bagian peringkat · auto-approve undangan CSV · i18n · arsip event publik |

## A12. Arah visual & gaya gerak (direvisi)

**Catatan jujur:** rancangan awal (5 tema: Kampus Segar, Festival, Arena, Glass, Brutalism; dengan emoji, ilustrasi kartun, gradasi, kartu berbayang lembut, mahkota dan confetti) dinilai generik, seperti desain buatan AI kebanyakan. **Seluruhnya ditinggalkan.** Arah di bawah menggantikannya dan sudah bisa dilihat di `demo-event.html`.

### Dua gaya yang dibandingkan: **Seru** (usulan, untuk pengunjung) dan **Profesional**

Gaya "Editorial" di bawah dinilai **terlalu profesional**; yang diinginkan adalah kesan **fun untuk pengunjung**. Maka ada dua gaya yang bisa dibandingkan di `demo-event.html` (grup tombol **GAYA**). **Keputusan sementara:** gaya **Seru** dipakai untuk halaman pengunjung (halaman event dan halaman booth); gaya **Profesional**, tanpa unsur seru, hanya untuk halaman admin, portal pemilik booth, dan sebagai cadangan. Perbandingannya:

| | **Seru** (usulan) | **Profesional** (Editorial, di bawah) |
|---|---|---|
| Perasaan | Pasar malam / scrapbook: santai, hangat, mengajak bermain | Majalah: rapi, tenang, formal |
| Foto booth | **Polaroid bertempel selotip**, miring tipis, melurus dan terangkat saat disentuh | Foto bersih tanpa bingkai |
| Warna | Krem hangat + hijau & oranye UNIMED sebagai blok warna besar; **stiker** berwarna (kuning, merah muda, biru muda) hanya sebagai aksen kecil | Putih tulang, hijau sebagai aksen |
| Bentuk | Sudut membulat besar, **garis tebal + bayangan keras** (gaya stiker/komik), tombol "chunky" yang menekan saat diklik | Garis tipis, tanpa bayangan |
| Tipografi | Judul tebal besar (Bricolage Grotesque), teks DM Sans, **catatan tulisan tangan** (Caveat) untuk keterangan kecil | Judul sans tebal atau serif, teks netral |
| Bahasa | **Santai dan mengajak** (kamu, yuk, cobain, mampir): "Booth mana yang paling bikin kamu **WOW**?", "Yuk, kasih bintang!", "Yeay, makasih ya!" | "Penilaian Booth Terfavorit", "Beri penilaian" |
| Elemen khas | Pita teks berjalan (*marquee*), lencana statistik, kutipan ulasan sebagai **gelembung percakapan**, ulasan berwarna-warni, ketukan bintang memercikkan bintang kecil | Bagian bernomor, garis tebal pemisah |
| Gerak bawaan | **Pop** (pegas) | **Glide** |

**Yang tetap sama di kedua gaya (tidak boleh berubah demi "fun"):** urutan keadilan (sorotan → semua booth acak → peringkat paling bawah), tidak ada lencana peringkat di kartu booth, peringkat dan rating bisa disembunyikan admin, tombol ber-loader, hanya-baca setelah event selesai.

**Aturan agar "fun" tidak menjadi norak atau melelahkan** (belajar dari penolakan versi awal yang penuh emoji dan gradasi):
- **Tanpa emoji sebagai ikon**; dekorasi dibuat dari bentuk (selotip, stiker, bayangan keras, bintang SVG/teks).
- **Palet terbatas**: hijau dan oranye UNIMED dominan; lima warna stiker (kuning, merah muda, biru muda, plus dua warna dasar) hanya untuk elemen kecil.
- **Gerak hanya pada interaksi dan momen penting**, bukan dekorasi terus-menerus di HP (pita teks berjalan berhenti pada mode gerak *Mati*/*reduced motion*).
- **Kontras tetap lulus**: teks selalu tinta gelap di atas hijau/kuning/krem (bukan putih di atas hijau).
- **Warna dan gaya hanya variabel** (`data-vibe="seru"` menimpa token, B4); mengganti ke gaya Profesional tidak mengubah komponen.

### Permintaan klien: nama acara jadi sorotan utama, warna UNIMED saja

**1. Nama resmi acara = judul utama (H1).** Teks lengkap **"Penilaian Booth Terfavorit LPPM Expo Tahun 2026"** ditampilkan paling besar di hero halaman utama, juga di bagian atas halaman booth (pita kecil), kaki halaman, judul tab, dan pratinjau tautan. Sapaan santai ("Booth mana yang paling bikin kamu WOW?") hanyalah sapaan kedua di bawahnya. Nama acara berasal dari data event (`events.name`), jadi admin yang mengubahnya.

**2. Dari UNIMED hanya meniru template warna.** Keputusan setelah melihat versi yang terlalu mirip situs UNIMED:
- **Dihapus**: bar kontak hijau dengan ikon sosial, panel navigasi putih dan menu, hero foto penuh dengan lapisan gelap, label oranye berikon, kata bergaris oranye, dan judul bagian ala "Berita **UNIMED**". **Tidak ada navigasi sama sekali**: halaman utama langsung berisi event (A0).
- **Dipertahankan**: palet hijau `#1EB05F`, oranye `#FDA31B`, gelap `#19232B`, dan krem/hijau muda sebagai turunan, ditambah gaya *Seru* yang disukai (polaroid bertempel selotip, bayangan keras, gelembung percakapan, tulisan tangan, bahasa mengajak).

**3. Hero (neobrutalism + scrapbook, versi sesuai brief klien)**

*Kanvas dan dekorasi*
- **Latar krem hangat `#FAF8F5` dengan pola grid grafik tipis** (garis 1 px berjarak 28 px, opasitas rendah) di seluruh halaman, supaya ruang kosong di kiri dan kanan tidak terasa seperti *wireframe*.
- **Doodle garis tipis bertema kuliner dan festival** (kilauan, donat, sate tusuk, gelas minuman bersedotan), kecil dan tidak menutupi teks. Pada layar lebar (≥ 1360 px) doodle berada di margin kiri dan kanan; pada layar sempit hanya satu kilauan kecil di dekat judul. Semuanya `aria-hidden` dan tidak bisa diklik.

*Hierarki judul*
- **"Penilaian Booth Terfavorit" adalah titik fokus terkuat**: satu baris besar (maks. ±84 px) dengan kata *Terfavorit* pada blok hijau.
- **"LPPM Expo Tahun 2026" menjadi lencana pendukung**: pil oranye yang jauh lebih kecil (±0,42× ukuran judul), tebal 700, bayangan tipis, sehingga tidak mengalahkan judul.

*Kolom kiri diseimbangkan dengan kolase*
- Urutan: sapaan tulisan tangan ("Booth mana yang paling bikin kamu **WOW**?") → **deskripsi 1–2 kalimat** yang mengajak mencicipi sajian di tiap stand dan memberi rating → **baris sorotan** (lencana "8 booth ikut serta" dan tiga langkah: ① Mampir → ② Cicipi → ③ Kasih bintang) → tombol CTA.

*Tombol CTA utama* (dibedakan dari semua stiker)
- Latar **hitam pekat**, teks **putih**, **ikon panah** dalam lingkaran oranye, border hitam tebal dan **bayangan keras oranye**.
- **Hover**: tombol naik sedikit dan bayangan membesar, panah bergeser ke kanan. **Ditekan (`:active`)**: tombol bergeser ke arah bayangan sehingga bayangan hampir hilang (efek menekan). Stiker lain ("WOW?", "Yuk, mampir!", pita tahun) tetap oranye/kuning agar jelas bukan tombol.

*Kolase polaroid (3 bingkai)*
- Foto diganti menjadi **foto suasana acara bertema kuliner yang cerah**: stand jajanan, minuman kekinian (boba), dan mahasiswa/pengunjung di booth. **Foto kolase diunggah admin sebagai foto suasana acara (bukan booth tertentu), sehingga netral.**
- Tiga bingkai miring dengan selotip warna-warni; **overlap dikurangi** (hanya ±2% di tepi) dan **stiker "Yuk, mampir!" dan "Kasih bintang ★" ditempel pada margin keterangan polaroid**, bukan di atas foto, sehingga bagian utama foto tidak tertutup.

*Responsif*: di tablet dan HP satu kolom; tombol selebar layar; polaroid digeser menyamping dengan foto utama tampil lebih dulu (A13).

*Status event dan teks ajakan selalu selaras* (dihitung dari `getEventState`, B17; semua teks di `copy.ts`):

| Status | Lencana atas | Teks ajakan (sub-copy) | CTA |
|---|---|---|---|
| Voting belum dibuka | ● VOTING SEGERA DIBUKA (+ hitung mundur) | Booth sedang bersiap; intip dulu sajiannya | Intip booth-nya |
| **Voting berjalan** | **● VOTING DIBUKA** | Cicipi sajian di tiap stand, lalu kasih rating buat booth favoritmu | **Yuk, cobain jelajah booth** |
| Event selesai, hasil belum diumumkan | ● EVENT UDAH SELESAI | Makasih udah ikut meramaikan, hasil segera diumumkan | Lihat semua booth |
| **Hasil sudah diumumkan** | **● EVENT UDAH SELESAI** | Makasih udah ikut meramaikan! Yuk, lihat rekapitulasi acara dan siapa saja booth terfavorit | **Lihat Rekap & Booth Terfavorit** (menggulir ke rekap hasil) |

Pada status selesai, baris sorotan berganti menjadi lencana "8 booth", "116 ulasan", dan "Hasil sudah diumumkan".

Catatan: versi hero sebelumnya (kipas foto tanpa tema kuliner, hierarki judul rata, CTA sama dengan stiker) digantikan oleh versi ini.

**3b. Gambar tetap menonjol**: pada desktop kolom foto dibuat jauh lebih lebar daripada kolom teks (±75% lebar kontainer) dan tiga foto berukuran besar; pada HP foto berukuran ±74% lebar layar dan menjadi elemen terbesar setelah judul.

**4. Judul bagian**: lingkaran bernomor `01/02/03` dan satu kata bergaris-bawah spidol (oranye; putih di blok hijau), menggantikan label oranye berikon.

**5. Kaki halaman baru**: pita bendera kecil berwarna (hijau, oranye, krem, hijau muda) di atas pita gelap `#19232B`, berisi tulisan tangan "Makasih udah mampir, sampai ketemu lagi!", nama lengkap acara besar, "Diselenggarakan oleh LPPM UNIMED", dan tombol oranye "Balik ke atas ↑". Logo kecil, kontak, dan media sosial LPPM bersifat opsional (diatur admin). Footer ada di semua halaman pengunjung.

**6. Font tidak mengikuti UNIMED** (hanya warna). Pilihan font tetap A/B/C/D di bawah.

**Catatan**: contoh di demo memakai foto Unsplash pengganti; foto booth asli diunggah booth (B15).

### Panduan nada bahasa (copy) untuk halaman pengunjung

Santai, tetapi **mengajak**, bukan sekadar memberi informasi.

- **Sapaan**: pakai **kamu** (bukan "Anda"). Kata ajakan yang dipilih: **yuk**, **cobain**, **mampir**, **intip**, **kasih bintang**, **ceritain**.
- **Kalimat mengajak** (ajakan ramah di depan kalimat) lebih disukai daripada pernyataan datar: "Yuk, mampir ke booth-nya" alih-alih "Lihat booth".
- **Tetap jelas dan sopan**: informasi penting (verifikasi, batas waktu, error, kebijakan) tetap eksplisit. Santai tidak boleh membuat bingung, dan hindari slang berlebihan atau kasar. Bentuk seperti "nggak", "udah", "kok" boleh secukupnya.
- **Konsisten**: satu istilah per hal (mis. "bintang" di tombol, "booth" bukan "stan/toko").
- **Saat gagal tetap menenangkan**: "Koneksi lagi bermasalah nih… aman kok, nggak bakal tercatat dua kali."
- **Aksesibilitas**: label tombol tetap menjelaskan fungsinya untuk pembaca layar; ajakan tidak menggantikan label fungsi.
- **Teks di satu tempat**: `lib/copy.ts` memiliki satu set per gaya (`pro` dan `seru`), sehingga mengubah nada tidak menyentuh komponen, dan seluruh teks bisa ditinjau LPPM sekaligus.
- **Halaman admin dan portal booth tetap memakai nada netral** (gaya Profesional).

| Tempat | Profesional | Seru (mengajak) |
|---|---|---|
| Judul halaman (nama acara) | Penilaian Booth Terfavorit LPPM Expo Tahun 2026 | **sama** (nama acara tetap judul utama) |
| Sapaan kedua di bawah judul | – | Booth mana yang paling bikin kamu **WOW**? |
| Ajakan di bawah judul | – | Yuk, mampir ke booth-booth yang menarik, cobain langsung, lalu kasih bintang buat favoritmu! |
| Sorotan | Sorotan | Mampir yuk, lagi disorot nih! |
| Daftar booth | Semua booth | Cobain jelajahi semuanya |
| Tombol di sorotan | Lihat booth & beri nilai | Yuk, mampir & kasih bintang |
| Judul form | Beri penilaian | Yuk, kasih bintang! |
| Petunjuk form | Untuk {booth}. Cukup bintang saja sudah cukup. | Gimana kesanmu di {booth}? Ketuk bintangnya, 10 detik aja kok. |
| Tombol kirim / sedang kirim / ulang | Kirim penilaian / Mengirim… / Coba lagi | Kirim bintangku! / Lagi dikirim… / Yuk, coba lagi |
| Sukses | Terima kasih. | Yeay, makasih ya! |
| Setelah kirim | Booth lain yang belum kamu nilai | Yuk, mampir juga ke booth ini |
| Belum ada ulasan pilihan | Belum ada ulasan pilihan. | Belum ada ulasan pilihan. Jadi yang pertama, yuk! |
| Event selesai | Event telah berakhir. Tampilan hanya-baca. | Event-nya udah selesai, makasih udah mampir! Sekarang tinggal dilihat-lihat aja. |

### Arah "Profesional": "Editorial"

| Aspek | Keputusan |
|---|---|
| **Pusat perhatian** | **Foto booth** (asli). Antarmuka mundur ke belakang |
| **Tipografi** | Font **dipilih dari 4 opsi** di bawah (Fraunces dan Inter ditinggalkan). Berkas font di-*self-host* (WOFF2, subset Latin) agar cepat dan tidak bergantung layanan luar |
| **Warna** | Kertas putih hangat + tinta hijau-hitam. **Hijau UNIMED hanya aksen** (tombol, garis kutipan, penanda); **oranye UNIMED hanya untuk bintang** |
| **Bentuk** | Sudut hampir tegak (±3 px), garis tipis sebagai pemisah. **Tanpa** bayangan, kaca, gradasi, dan emoji (ikon SVG sederhana) |
| **Struktur** | Bagian bernomor `01 / 02 / 03`, garis tebal di atas tiap bagian, label huruf kapital kecil |
| **Tema** | **Kertas** (terang, default) dan **Panggung** (gelap; untuk layar besar atau pilihan pengguna). Keduanya hanya menimpa variabel (B4) |

### Gaya gerak (jauh lebih halus)

Dua gaya tetap ada sebagai pilihan: **Glide** (default; meluncur 10 px + memudar, ±480 ms) dan **Pop** (pegas ringan, skala 0,96 → 1,015 → 1, ±380 ms), ditambah **Mati**. **Tidak ada confetti dan tidak ada mahkota**.

| Elemen | Gerak |
|---|---|
| Ulasan baru di feed | Masuk dari atas; ulasan lain bergeser mulus |
| Peringkat berubah | Baris berpindah mulus + berkedip hijau tipis; skor menghitung naik |
| Peringkat 1 berganti | Toast singkat "X naik ke peringkat 1" |
| Sorotan berganti | Teks dan foto masuk halus; garis waktu tipis berjalan |
| Foto di galeri | Bergeser horizontal; segmen penanda |
| Bintang diketuk | Bintang terisi berurutan |
| Kirim review | Panel berganti menjadi "Terima kasih." (tanpa confetti) |
| Reveal pemenang | Juara 3, 2, 1 muncul berurutan; suara mati secara default |

**Aksesibilitas & kontrol:** hormati `prefers-reduced-motion`; pilihan *Penuh · Hemat · Mati* diingat di browser (default otomatis Hemat di perangkat lemah, layar besar selalu Penuh); tidak ada kedipan cepat; informasi penting tidak pernah hanya lewat animasi; kontras lulus WCAG AA di kedua tema.

### Font: yang sekarang disetujui, dan mudah diganti lewat variabel

**Font saat ini (disetujui):** **Bricolage Grotesque** (judul), **DM Sans** (teks), **Caveat** (tulisan tangan). Catatan koreksi: pada gaya Seru font inilah yang dipakai; pilihan A/C/D di bawah hanya untuk perbandingan.

**Semua font dipanggil lewat nama variabel** (`--font-ui`, `--font-display`, `--font-hand`, `--weight-display`, `--tracking-display`). Nama font hanya ada di satu tempat (`theme.css` + `fonts.css`), jadi bila nanti tidak suka, mengganti font cukup mengubah variabel dan berkasnya (B20). Di demo, grup tombol **FONT** menunjukkan persis mekanisme ini: satu blok `TOKEN FONT` di bagian atas CSS.

### Pilihan font lain untuk perbandingan (semua berlisensi SIL OFL, boleh di-*self-host*)

Bandingkan langsung di `demo-event.html` (grup tombol **FONT**).

| Opsi | Judul / teks | Kesan |
|---|---|---|
| **A** | Plus Jakarta Sans (semua) | Sans modern buatan perancang Indonesia; netral, ramah, sangat terbaca di HP. Pilihan paling aman |
| **B** | Bricolage Grotesque + DM Sans | Judul grotesk yang berkarakter (hangat, sedikit tidak simetris), teks bersih; terasa kontemporer dan kreatif |
| **C** | Newsreader + Public Sans | Serif editorial untuk judul, sans tenang untuk teks; terasa akademis/majalah (paling dekat ke Fraunces, jadi kurang cocok bila serif memang tidak disukai) |
| **D** | Archivo (semua) | Grotesk tebal bergaya poster; tegas dan ringkas |

**Dipilih: B (Bricolage Grotesque + DM Sans), ditambah Caveat untuk tulisan tangan.** A, C, dan D tersedia di demo bila kelak ingin berganti.

### Referensi tampilan (saran)

Deskripsi berikut dari pengetahuan umum saya tentang situs-situs itu, **bukan hasil membukanya hari ini**; silakan dicek langsung.

| Situs | Yang diambil | Yang tidak diambil |
|---|---|---|
| **Google Maps / Airbnb** | Kartu *foto dulu*, baris rating `4,7 ★ (24)`; sudah jadi acuan kartu booth | Peringkat/urutan "terbaik" di atas (bertentangan dengan keadilan) |
| **Letterboxd** | Grid poster/foto rapat, bintang kecil, ulasan pendek, tema gelap yang tenang; cocok untuk tema *Panggung* dan daftar ulasan | Statistik sosial berlebihan |
| **Situs berita besar (mis. NYT) dan Apple Newsroom** | Hierarki tipografi tegas, bagian bernomor, banyak ruang kosong; arah *Editorial* | Paywall/kepadatan iklan, tentu saja |
| **Pengumuman penghargaan (mis. Eurovision, Oscar)** dan **Spotify Wrapped** | Pengungkapan bertahap dari urutan terbawah ke juara, satu layar satu pesan; untuk animasi pemenang | Efek berlebihan seperti confetti |
| **Product Hunt** | Hanya tata letak baris daftar peringkat (nomor besar, nama, angka) | Menaruh peringkat di puncak halaman |
| **unimed.ac.id** | Palet hijau-oranye dan citra institusi | Tata letak berita yang padat |

Pertanyaan pilihan: Keputusan Terbuka nomor 17, 21, dan 22. Implementasi teknis gerak: B19.

## A13. Desain responsif (mobile-first)

**Prinsip:** sebagian besar pengunjung memakai HP (lebar 360 sampai 430 px) sambil berdiri di booth, jadi desain dibuat **dari layar kecil dulu**, lalu diperlebar. Titik beralih tata letak utama (900 px) dijadikan token breakpoint, bukan angka yang tertanam.

| Bagian | Desktop | Tablet / HP |
|---|---|---|
| Hero | judul dua baris selebar kontainer; kiri sapaan + tombol, kanan kipas 3 foto | satu kolom; tombol selebar layar; foto polaroid digeser menyamping |
| Sorotan | foto besar kiri, teks kanan | satu kolom; foto di atas, teks di bawah |
| Semua booth | grid 4 kolom | 3 kolom (tablet), 2 kolom (HP) |
| Peringkat dan ulasan terbaru | dua kolom | satu kolom bertumpuk |
| Halaman booth | konten kiri, kotak "Beri penilaian" menempel di kanan | satu kolom; **tombol "Kasih bintang" melayang di bawah** yang menggulir ke form |
| Hasil akhir (animasi) | juara 1 besar, juara 2 dan 3 berdampingan, lalu daftar | semua satu kolom; tombol Lewati besar dan mudah dijangkau |
| Kaki halaman | teks dan tombol sejajar | bertumpuk |

**Aturan wajib**
- **Tidak ada guliran horizontal pada halaman** (kecuali carousel foto yang disengaja); diuji otomatis.
- **Target sentuh ≥ 44×44 px**; teks isian ≥ 16 px agar iPhone tidak memperbesar layar saat mengetik.
- Ukuran judul memakai `clamp()`; gambar memakai thumb responsif (`srcset`/`sizes`: thumb 480 px, full 1280 px) dan `loading="lazy"`; `aspect-ratio` tetap agar tidak ada loncatan tata letak.
- **Area aman** (`env(safe-area-inset-*)`) untuk tombol melayang dan CTA di bawah; mendukung mode lanskap, zoom 200%, dan ukuran teks besar.
- **Efek hover hanya pada perangkat yang punya hover** (`@media (hover: hover)`); kursor kustom hanya untuk mouse; tombol suara dibuat kecil di HP agar tidak menutupi konten.
- Mode Layar Besar punya tata letak sendiri (16:9, huruf besar). Area admin desktop-first namun tetap dapat dipakai di tablet; Data Grid boleh digeser horizontal.

**Pengujian**: Playwright pada viewport 360×800, 390×844, 768×1024, 1280×800, dan 1920×1080 dengan tangkapan layar dan pemeriksaan "tidak ada overflow horizontal"; ditambah uji di perangkat nyata (HP Android kelas menengah dan iPhone) dengan jaringan dibatasi, sebelum hari-H. Demo `demo-event.html` sudah diperiksa pada lebar 390, 768, dan 1440 px (bar pengaturan demo dapat dilipat di layar kecil).

---

## A14. Produk & promosi booth

**Tujuan:** pengunjung yang awalnya hanya melihat foto booth jadi tertarik datang dan membeli. Web ini **etalase**, bukan toko online: **tidak ada keranjang bayar dan tidak ada pembayaran di web**. Transaksi terjadi di booth, dan semua ajakan mengarah ke "mampir ke booth". Contoh interaktif: `demo-event.html` (saklar **PRODUK & HARGA** membandingkan tampilan dengan dan tanpa produk; produk, harga, dan foto di sana hanya contoh).

### Aturan (disetujui)

| Aturan | Nilai |
|---|---|
| **Jumlah produk per booth** | **Maksimal 24 sebagai bawaan** (`CONFIG.booth.maxProducts`). **Admin dapat mengubah angkanya per event** di pengaturan event ("Batas produk per booth", `settings_json.maxProducts`), dalam rentang 1 sampai `maxProductsHardCap` (100, pagar pengaman performa). Angkanya **sama untuk semua booth** dalam satu event agar tidak ada booth yang mendominasi halaman. Bila admin menurunkannya di bawah jumlah produk sebuah booth, **produk yang sudah ada tidak dihapus**: booth itu hanya tidak bisa menambah sampai jumlahnya di bawah batas. |
| **Produk andalan** | **Tepat satu per booth, dipilih oleh pemilik booth** di portal dan boleh diganti kapan saja selama event belum selesai. Tidak dipilih otomatis oleh sistem berdasarkan penjualan atau rating. Bila belum dipilih, produk pertama yang dibuat menjadi andalan sementara. Bila andalan disembunyikan atau dihapus, andalan pindah ke produk aktif berikutnya menurut urutan. |
| **Booth tanpa produk** | **Mengisi produk sepenuhnya opsional (keputusan)**: tidak ada syarat minimal untuk disetujui admin, dan bagian produk tidak muncul bila kosong. Booth non-jualan (demo, workshop, layanan) memakai bentuk yang sama; harga boleh **Gratis**. |
| **Bentuk produk** | nama (maks. 60 karakter), deskripsi (maks. 300; andalan tampil penuh, kartu biasa dipotong 2 baris), **harga rupiah bulat** (0 = Gratis), **harga normal** opsional (hanya bila lebih besar dari harga; tampil dicoret dengan penanda "Harga expo"), kategori (teks pendek buatan pemilik, maks. 8 kategori per booth), penanda opsional dari daftar tetap (*Stok terbatas*, *Baru*), satu foto, urutan, dan saklar tampil/sembunyi (mis. saat habis). |
| **Foto produk** | Satu per produk, dikonversi WebP di browser (B15). **Opsional untuk semua produk, termasuk andalan**; produk tanpa foto tampil dalam versi hanya-teks (A16). |

### Tampilan di halaman booth (`/b/:boothId`)

Urutan di kolom kiri (form penilaian tetap di kolom kanan pada desktop):
1. **Produk andalan**: blok berwarna oranye dengan foto polaroid besar, **stiker harga**, nama, alasan singkat, tulisan tangan ajakan, tombol **"Simpan ke incaran"**, dan chip "Beli langsung di Booth {no}". Promo (harga normal dicoret + "Harga expo") tampil di sini bila diisi pemilik.
2. **"Yang bisa kamu bawa pulang"**: kartu produk lain (foto persegi, stiker harga, nama, catatan, tombol Simpan). **Menampilkan 6 dulu**, lalu tombol **"Tampilkan lebih banyak (n)"** menambah 6 setiap kali, dengan keterangan "Menampilkan 11 dari 11 produk". Bila produk **lebih dari 8**, muncul **chip kategori** (Semua · Minuman · Kudapan · …); mengganti kategori mengembalikan tampilan ke 6 pertama. Chip tidak muncul untuk booth kecil.
3. Lalu blok yang sudah ada: Kenalan sama booth ini, Kata pengunjung lain, Ulasan pilihan, Semua cerita.

Di bagian atas (hero booth): **chip harga** ("mulai Rp 14rb" / "Gratis") dan tombol **"Lihat yang andalan"** yang menggulir ke blok andalan. Di HP, bar bawah berisi **"Produk"** di samping **"Yuk, kasih bintang!"**; tombol suara dan tombol incaran naik di atas bar itu agar tidak saling menutupi.

### Di halaman event (beranda)
- **Sorotan (01)**: kartu mini produk andalan booth yang sedang disorot (foto kecil, nama, harga).
- **Kartu booth (02)**: stiker harga di pojok foto. Tidak ada urutan atau filter berdasarkan harga, penanda "terlaris", atau lencana promo, supaya keadilan urutan acak (A8) tidak rusak.

### Pesan lewat WhatsApp (opsional per booth)
- Pemilik booth **boleh** mengisi **nomor WhatsApp** di portal (kosong = fitur ini tidak muncul untuk booth itu; di demo dua booth sengaja tanpa nomor). Disarankan memakai **nomor khusus usaha**, bukan nomor pribadi.
- Bila terisi, muncul tombol **"Pesan dulu lewat WA"** di produk andalan dan ikon pesan kecil di tiap kartu produk. Menekannya membuka chat WhatsApp ke pemilik booth dengan **pesan sudah terisi**, mis. *"Halo kak, aku lihat Kopi Rempah Susu (Rp 18.000) di Kopi Rempah Nusantara, Penilaian Booth Terfavorit LPPM Expo Tahun 2026. Masih ada, kak?"* Pengunjung tinggal menekan kirim.
- **Nomor tidak ditampilkan sebagai teks** di halaman dan **tidak ada di data daftar booth** (hanya tombolnya). Cara kerjanya dan batas privasinya di B24; pemilik harus **menyetujui secara eksplisit** bahwa nomornya bisa dihubungi pengunjung sebelum menyimpan.
- Pesan dan pembayaran terjadi di luar web ini; panitia tidak menjamin transaksi (catatan singkat di bawah etalase).
- Setelah event selesai tombolnya hilang.

### Bagikan (pengunjung dan pemilik booth)
- Tombol **"Bagikan"** ada di hero booth (membagikan halaman booth) dan di produk andalan (membagikan **tautan langsung ke produk itu**). Membuka panel kecil berisi **tautan**, **Salin tautan**, **Kirim lewat WhatsApp**, dan **"Bagikan lewat…"** (menu bagikan bawaan HP bila perangkat mendukung, Web Share API).
- **Tautan produk** (`/b/:boothId?p=:productId`) membuka halaman booth, menampilkan produknya (membuka "lebih banyak" bila perlu), menggulir ke sana, dan menyorotnya sebentar. **Pratinjau tautan** di WhatsApp/media sosial memakai **foto produk dan namanya** (B20).
- **Pemilik booth** punya panel **Bagikan** di portal: tautan booth dan tiap produk, teks siap kirim yang bisa diedit, dan **QR booth** yang sudah ada. **Teks bawaan tidak pernah meminta bintang atau ulasan.**
- **Penjagaan keadilan**: tautan bagikan membuka halaman yang sama dan penilaian tetap lewat verifikasi, Turnstile, dan deteksi anomali (A6, B9). Tautan memakai `?src=share` agar lonjakan ulasan dari satu booth lewat tautan bagikan masuk ke skor risiko. Aturan "dilarang menawarkan imbalan untuk bintang" (di bawah) berlaku juga untuk pesan yang dibagikan pemilik.
- Statistik untuk pemilik (v1): berapa kali tombol Pesan dan Bagikan ditekan, dari agregat Analytics Engine (B13), bukan data pribadi.

### Daftar incaran (tanpa akun)
- Tombol "Simpan ke incaran" di setiap produk; muncul tombol melayang **"Incaranku (n)"** yang membuka panel berisi produk yang disimpan, **dikelompokkan per booth dan diurutkan menurut nomor booth** (sebagai rute keliling), plus **perkiraan total** dan catatan "bayarnya langsung di tiap booth".
- **Disimpan hanya di browser pengunjung** (`localStorage`, cadangan: memori), tidak dikirim ke server dan tidak berkaitan dengan akun atau review. Produk yang kemudian dihapus atau disembunyikan pemilik otomatis disaring dari daftar.
- Ini aksi lokal, jadi tidak memakai `ActionButton`/Idempotency-Key (B21).

### Setelah event selesai
Produk dan harga tetap terlihat (hanya-baca), tetapi **promo, penanda, tombol simpan, tombol pesan WhatsApp, dan daftar incaran disembunyikan**, dan tidak ada lagi ajakan membeli. Tombol **Bagikan tetap ada**.

### Keadilan & etika (wajib)
1. **Template dan batas sama untuk semua booth** (satu andalan, maks. 24 produk); **tidak ada penempatan berbayar atau "diunggulkan"**, dan urutan booth tetap acak per pengunjung.
2. **Dilarang menawarkan diskon, hadiah, atau imbalan untuk bintang atau ulasan** ("kasih bintang 5 dapat diskon"). Larangan ini tertulis di portal booth dan **harus dicentang pemilik** saat mengisi produk pertama; admin dapat menyembunyikan produk/promo yang melanggar (Data Grid, tab Produk) dan kejadiannya tercatat.
3. **Rating tetap per booth, bukan per produk**, dan data produk **tidak ikut** dalam skor atau peringkat.
4. Halaman menyatakan di etalase: *"Beli atau nggak, bintangmu tetap bebas. Nggak ada hubungannya sama promo."*
5. **Klaim harus bisa dipercaya**: harga dan promo diisi pemilik booth dan panitia tidak menjamin; penanda "Stok terbatas" hanya muncul bila pemilik menyalakannya; **tanpa hitung mundur otomatis dan tanpa kelangkaan palsu**.
6. Harga selalu rupiah bulat dengan format `Rp 18.000` (pengunjung membaca `Intl.NumberFormat('id-ID')`); stiker di kartu booth memakai bentuk ringkas ("Rp 14rb").

Rincian teknis: B24.

## A15. Moderasi kata & komentar

**Keputusan:** kata terlarang ditangani oleh **sistem dan admin**, bukan booth. **Booth tidak bisa menyembunyikan atau menghapus komentar**, karena itu membuka jalan curang (menghilangkan semua komentar jelek). Booth hanya bisa **melaporkan**. Ide "booth menyembunyikan komentarnya sendiri" dipertimbangkan dan dibuang.

### Lima lapis (dari otomatis ke manual)
1. **Filter kata otomatis sebelum tayang** (server, B25): memeriksa komentar dalam bahasa **Indonesia dan Inggris** (juga kata daerah yang umum), termasuk akal-akalan penulisan (`4njing`, `a.n.j.i.n.g`, huruf berulang).
2. **Tindakan menurut tingkat keparahan** (bisa diatur admin, default di bawah).
3. **Laporan** dari booth dan pengunjung masuk antrean admin; **laporan tidak menyembunyikan apa pun** sampai admin memutuskan.
4. **Admin memutuskan**: sembunyikan komentar saja, sembunyikan seluruh review, pulihkan, sunting, atau blokir pengunjung (A3, B18; alasan wajib, nilai asli tersimpan).
5. **Daftar kata hidup**: admin menambah kata baru, mengubah tingkatnya, dan membuat **daftar pengecualian** (kata biasa yang salah tangkap, mis. kata yang mengandung potongan kata kasar).

### Tindakan filter (default, diatur admin)
| Temuan | Tindakan | Yang dilihat pengunjung pengirim |
|---|---|---|
| **Berat**: hinaan berat, SARA/ujaran kebencian, seksual eksplisit, ancaman | **Komentar ditahan** (`held`) sampai admin menyetujui; **bintang tetap dihitung** | "Bintangmu sudah masuk. Komentarnya kami periksa dulu sebelum tampil." |
| **Ringan**: umpatan ringan | Komentar **tayang dengan kata disamarkan** (`b***t`) dan ditandai untuk admin | Tidak ada pesan khusus |
| **Data kontak / tautan / iklan** (nomor telepon, URL, email, "DM/WA saya", "follow") | **Ditahan** | Sama seperti berat |
| Lolos | Tayang | – |

Pesan ke pengirim **tidak menyebut kata mana yang tertangkap**, supaya daftar kata tidak mudah diakali. Menahan komentar **tidak mengubah bintang**: nilai tetap dihitung karena komentar kasar tidak membatalkan penilaiannya. Penahanan **seluruh review** (`held`, lonjakan atau pola sabotase, A6) tetap berjalan terpisah dan diam-diam seperti sebelumnya.

### Laporan
- Tombol **"Laporkan"** di setiap komentar: untuk **booth** (di portal) dan **pengunjung** (di halaman booth). Alasan: kata kasar/tidak pantas · SARA/ujaran kebencian · data pribadi · spam/iklan · lainnya (catatan singkat).
- Laporan masuk **antrean admin** yang diurutkan menurut alasan (SARA dan data pribadi paling atas) dan jumlah pelapor. Identitas pelapor hanya terlihat admin.
- **Penjagaan agar pelaporan tidak jadi akal-akalan**: booth dibatasi jumlah laporan per jam; booth yang **melaporkan sebagian besar komentar berbintang rendah tanpa temuan filter** ditandai "pelaporan mencurigakan" di antrean admin. Karena laporan tidak menyembunyikan apa pun, pelaporan massal tidak merugikan siapa pun selain membebani admin.
- Admin memutuskan dan hasilnya tercatat; komentar yang dipulihkan admin dapat **dikunci** supaya laporan berikutnya tidak memunculkannya lagi di antrean.

### Sumber daftar kata (hasil pengecekan; semua perlu ditinjau manusia)
Tidak ada daftar yang lengkap: bahasa gaul berubah terus, jadi **filter pasti ada yang lolos dan ada yang salah tangkap**. Daftar awal disusun dari beberapa sumber lalu **ditinjau panitia** sebelum dipakai.

| Sumber | Bahasa | Lisensi | Catatan |
|---|---|---|---|
| [drizki/indonesian-badwords](https://github.com/drizki/indonesian-badwords) | Indonesia (termasuk Jawa dan Sunda) | MIT | Paket npm TypeScript tanpa dependensi; ada kategori, tingkat keparahan, dan wilayah; leetspeak ditangani bawaan, pemisah huruf dan typo opsional (peringatan: pencocokan fuzzy bisa salah tangkap). Proyek kecil (puluhan bintang): **tinjau dan simpan salinan sendiri**. Butuh Node 22+; kecocokan dengan Workers **harus diuji**. |
| [abaron/bad-words](https://github.com/abaron/bad-words) | Indonesia (`/id`) dan Inggris (`/en`) | MIT | Daftar mentah tanpa varian leetspeak; hanya 2 commit, jadi dipakai sebagai **pembanding/pelengkap**, bukan satu-satunya sumber. |
| [obscenity](https://github.com/jo3-l/obscenity) (jo3-l) | Inggris (mesin pencocok + dataset; dataset kustom bisa dibuat) | MIT | Menangani huruf berulang dan karakter Unicode mirip, ada daftar pengecualian dan batas kata. README hanya menyebut Node.js; **kecocokan dengan Workers belum terverifikasi**. Cadangan: pencocok buatan sendiri (sederhana). |
| [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) | 28 bahasa termasuk Inggris, **tanpa Indonesia** | CC BY 4.0 | Hanya untuk Inggris sebagai pelengkap; wajib mencantumkan atribusi. |
| [words/cuss](https://github.com/words/cuss) | Inggris dan beberapa bahasa Eropa/Arab, **tanpa Indonesia** | MIT | Penulisnya sendiri menyatakan data ini **bukan untuk membuat filter** (nilainya peluang dipakai sebagai kata kasar). Tidak dipakai. |
| [Dataset Ibrohim & Budi 2019](https://github.com/okkyibrohim/id-multi-label-hate-speech-and-abusive-language-detection) | Tweet Indonesia berlabel ujaran kebencian/kasar, plus daftar kata kasar dan kamus normalisasi kata gaul | **CC BY-NC-SA 4.0** (non-komersial, turunan wajib lisensi sama) | **Tidak dibundel ke aplikasi.** Boleh dipakai sebagai bahan **uji/evaluasi internal** bila syaratnya dipenuhi (nonkomersial, sitasi). |

Lisensi MIT dan CC BY mewajibkan **mencantumkan pemberitahuan lisensi**; berkas `THIRD_PARTY_NOTICES` disertakan di repo (B25).

### Layanan klasifikasi AI (opsional, **bukan MVP**)
| Layanan | Catatan |
|---|---|
| [Perspective API](https://www.perspectiveapi.com/) (Google/Jigsaw) | **Ditutup 31 Desember 2026**, tanpa bantuan migrasi. **Jangan dipakai.** |
| [OpenAI Moderation (`omni-moderation-latest`)](https://developers.openai.com/api/docs/models/omni-moderation-latest.md) | Gratis; tingkat gratis dibatasi (±250 permintaan/menit, 5.000/hari). Dukungan **bahasa Indonesia tidak disebut** di dokumentasi, jadi akurasinya harus diuji sendiri. **Teks komentar dikirim ke pihak ketiga** (perlu pemberitahuan privasi). |
| [Cloudflare Workers AI `llama-guard-3-8b`](https://developers.cloudflare.com/workers-ai/models/llama-guard-3-8b/) | Berbayar per token (dokumentasi menyebut ±$0,48 per juta token masukan); **bahasa yang didukung tidak disebut**; mengklasifikasikan keamanan, bukan umpatan bahasa Indonesia secara khusus. |
Bila kelak dipakai, posisinya **lapis kedua**: hanya untuk komentar yang lolos filter kata, hasilnya hanya menahan komentar (`held`) untuk diperiksa admin, tidak pernah menolak otomatis, dan harus diuji dengan contoh komentar Indonesia asli dulu.

Rincian teknis: B25.

## A16. Booth tanpa pemilik & data tidak lengkap

Dua kenyataan lapangan yang didukung sejak MVP:

1. **Panitia sering perlu menambah booth sendiri**, dan booth itu **bisa saja tidak punya pemilik** yang login.
2. **Data sebuah booth bisa hanya berupa nama**: tanpa foto, deskripsi, nomor, atau produk.

Keduanya harus bekerja tanpa layar rusak, tanpa kotak kosong, dan tanpa membuat booth itu dirugikan atau diuntungkan di peringkat.

### Booth dibuat admin, pemilik boleh tidak ada

**Data minimal sebuah booth hanya satu: nama.** Nomor booth, tagline, deskripsi, "tentang", logo, foto, anggota tim, produk, nomor WhatsApp, dan email pemilik semuanya **opsional**.

**Email benar-benar opsional: booth berjalan penuh tanpa email.** Tanpa email tidak ada pemilik, sehingga **semua keputusan ada di tangan admin** (isi profil, foto, produk, status, moderasi). Email hanya diperlukan bila admin ingin pemilik ikut mengelola booth lewat portal. Satu-satunya jalur yang tetap mewajibkan email adalah **pendaftaran mandiri** lewat `/register`, karena OTP ke email adalah satu-satunya cara pemilik membuktikan dirinya; jalur admin dan impor CSV tidak memintanya.

| Keadaan | Ciri di data | Yang mengelola | Portal booth |
|---|---|---|---|
| **Tanpa pemilik** | dibuat admin, email kosong | **Admin saja** | tidak ada (tak seorang pun bisa login) |
| **Pemilik diundang** | admin mengisi email, pemilik belum pernah login | Admin; pemilik setelah login | bisa login lewat OTP |
| **Pemilik aktif** | pemilik pernah login (mendaftar sendiri atau diundang) | Pemilik; admin tetap bisa mengubah apa pun | ada |

**Yang bisa dilakukan admin**
- **Menambah booth**: tombol "Tambah booth" di halaman booth (form pendek: nama wajib, sisanya opsional) atau **baris baru di Data Grid** tab Booth (ketik nama, Enter). Booth buatan admin **selalu langsung tayang** (`approved`, admin sendiri verifikatornya); tidak ada opsi draf. Bila perlu menyembunyikannya, admin memakai status `suspended` seperti booth lain.
- **Impor CSV (MVP)**: halaman `/admin/e/:id/booths/import`. Admin mengunggah CSV (atau menempel dari spreadsheet), melihat **pratinjau** tiap baris (OK / peringatan / galat), lalu menekan "Impor". Kolom: **`nama` (wajib)**; opsional `nomor_booth`, `email`, `tagline`, `deskripsi`. **Kolom email boleh kosong atau tidak ada sama sekali.** Tersedia **templat CSV** untuk diunduh. Semua baris yang lolos langsung tayang, tanpa pemilik bila email kosong. Baris bermasalah tidak diimpor dan bisa diunduh kembali sebagai CSV untuk diperbaiki. Rincian: B26.
- Booth buatan admin **tidak terkena** penutupan pendaftaran, tidak ditandai *Susulan*, tidak butuh OTP atau antrean verifikasi, dan **tidak terkena syarat foto minimum**. Bisa ditambah kapan pun, termasuk setelah event selesai (A2: admin boleh mengubah apa pun).
- **Mengelola atas nama booth** di `/admin/e/:id/booths/:bid`: profil, foto, produk (termasuk pilihan andalan), nomor WhatsApp. Halaman ini memakai **komponen yang sama dengan portal booth** (B26), jadi tampilannya serupa dan tidak ada kode ganda. Untuk booth **tanpa pemilik**, alasan perubahan tidak diminta (tidak ada pihak yang dirugikan) tetapi tetap tercatat di log; untuk booth **berpemilik aktif**, aturan alasan wajib (A3) tetap berlaku.
- **Menambah pemilik belakangan**: isi **email pemilik** (halaman booth atau sel Data Grid). Mengisi email **tidak mengirim apa pun**; pemilik langsung bisa masuk lewat `/booth` dengan OTP ke email itu. Tombol **"Kirim undangan"** (opsional) mengirim email berisi tautan ke `/booth`.
- **Melepas atau mengganti pemilik**: kosongkan atau ganti email. **Sesi login lama otomatis tidak sah** (B7) dan booth kembali dikelola admin.

**Yang berbeda untuk booth tanpa pemilik**
- Tidak ada email notifikasi (setujui/tolak/revisi dilewati dan dicatat sebagai "tanpa pemilik").
- Tidak ada tombol "Laporkan" dari sisi booth (pengunjung tetap bisa melaporkan komentar, A15).
- Nomor WhatsApp **hanya bila admin mengisinya**, dengan kotak konfirmasi "pemilik sudah menyetujui nomornya dihubungi pengunjung" (disimpan sebagai persetujuan atas nama pemilik, B26). Aturan "dilarang menawarkan imbalan untuk bintang" (A14) dicentang admin saat menambah produk pertama atas nama booth.
- Pemilik yang kemudian mendaftar lewat `/register` dengan email yang **sudah dipakai** oleh sebuah booth di event ini tidak membuat booth ganda: halaman menjawab "Email ini sudah terdaftar, silakan masuk" dan mengarahkan ke `/booth`.

**Bagi pengunjung, booth tanpa pemilik tampil sama dengan booth lain**: tidak ada penanda "dikelola panitia", urutan acak dan bobot sorotan sama, dinilai dan diperingkat dengan aturan yang sama.

### Komponen tahan data kosong (tidak ada "gambar tidak ditemukan")

**Prinsip:** setiap komponen **tetap bekerja** bila data yang tidak wajib kosong. Di halaman pengunjung **tidak pernah** muncul ikon gambar rusak, kotak abu-abu dengan tulisan "foto tidak tersedia", atau bagian yang judulnya ada tetapi isinya kosong.

Setiap komponen yang memuat gambar memakai **tepat satu dari tiga strategi**, yang ditetapkan di tabel di bawah (bukan dipilih ulang di tiap halaman):

| Strategi | Artinya | Dipakai bila |
|---|---|---|
| **Bingkai** (`frame`) | Tempat gambar dipertahankan sebagai **bingkai yang memang dirancang**: polaroid krem bergaris dengan selotip, **inisial nama booth** besar di tengah (mis. "KR" untuk Kopi Rempah), nomor booth kecil di pojok, warna latar dari palet hijau/oranye/krem yang bergilir menurut hash id (tetap sama tiap dimuat). Tanpa ikon, tanpa teks keterangan. | ukuran harus **sama untuk semua booth** (keadilan, A8) atau tata letak tidak boleh melompat |
| **Hanya teks** (`text-only`) | **Tata letaknya berganti**: kolom gambar dibuang dan teks melebar, mis. nama booth sebagai tipografi besar di blok warna. | gambar adalah salah satu kolom dari tata letak dua kolom |
| **Hilang** (`collapse`) | Komponen **tidak dirender sama sekali**, tidak menyisakan ruang, garis, bayangan, atau judul kosong. | gambar hanya pelengkap |

Bingkai yang muncul karena data kosong **terlihat sama dengan bingkai biasa**: ia bagian desain, bukan pesan kesalahan.

**Gambar yang gagal dimuat** (kunci ada, tetapi berkas 404 atau jaringan putus) diperlakukan **persis sama dengan tidak ada gambar**. Satu komponen `SafeImage` menangani keduanya (B26), sehingga tidak ada halaman yang bisa menampilkan ikon rusak bawaan browser.

**Satu keputusan untuk seluruh daftar, bukan per kartu.** Bila di sebuah grid **tidak ada satu pun** item yang punya foto (mis. event baru dengan semua booth hanya nama), grid beralih ke **mode hanya-teks** untuk semua kartu (nomor besar + nama + rating, tanpa bingkai raksasa yang identik). Bila **sebagian** punya foto, item tanpa foto memakai **bingkai** agar ukuran kartu seragam. Berlaku untuk grid booth maupun grid produk.

| Komponen | Data yang kosong | Yang tampil | Strategi |
|---|---|---|---|
| `BoothCard` `card` (02 Semua booth) | foto sampul | bingkai 4:3 berinisial (atau kartu hanya-teks bila tak ada foto sama sekali di grid), ukuran sama dengan kartu berfoto | **bingkai** |
| `BoothCard` `spotlight` (01 Sorotan) | foto | kolom foto dibuang; nama booth sebagai tipografi besar pada blok hijau/oranye selebar penuh; tinggi minimum dijaga | **hanya teks** |
| `BoothCard` `row` / `compact` / baris peringkat / baris hasil 4 dst. | foto | bingkai persegi kecil berinisial agar kolom tetap sejajar | **bingkai** |
| `ResultsList` juara 1, 2, 3 | foto | bingkai juara (ukuran dan garis khas juara) berinisial | **bingkai** |
| `BoothCard` `admin` | foto | bingkai kecil **dengan chip "Tanpa foto"**. Admin adalah satu-satunya tempat yang boleh diberi label, karena ia perlu tahu | **bingkai** |
| `PhotoSlideshow` (hero halaman booth) | 0 foto | hero **satu kolom**: stiker nomor, nama besar, rating, CTA; tanpa panah, penghitung, segmen, thumbnail, dan pewaktu | **hanya teks** |
| `PhotoSlideshow` | 1 foto | satu foto tanpa kontrol dan tanpa pewaktu (sudah diatur di B20) | – |
| Logo booth | logo | nama rata kiri, tanpa ruang avatar | **hilang** |
| `FeaturedProduct` | foto produk | blok oranye tanpa polaroid: stiker harga besar, nama, deskripsi, tombol | **hanya teks** |
| `ProductCard` / `ProductGrid` | foto produk | bingkai persegi berinisial produk bila sebagian produk berfoto; seluruh grid beralih ke daftar kompak tanpa kotak foto bila tak ada satu pun | **bingkai / hanya teks** |
| Kartu mini produk andalan (sorotan) | foto produk | tanpa thumbnail, hanya nama dan harga | **hilang** |
| Panel Incaranku | foto produk | baris tanpa thumbnail | **hilang** |
| `Hero` `PolaroidCollage` (foto suasana acara) | 0 foto | hero satu kolom berisi teks | **hilang** |
| `PolaroidCollage` | 1 atau 2 foto | jumlah bingkai mengikuti jumlah foto | – |
| Logo event, kaki halaman | logo, kontak, sosial | bagian yang kosong tidak dirender | **hilang** |
| Pratinjau tautan `og:image` | foto booth | pakai gambar OG event; bila juga kosong, tag `og:image` tidak dikirim | **hilang** |
| Poster QR | logo, nomor | hanya nama + QR | **hilang** |

**Data teks yang kosong** mengikuti aturan yang sama: **bagian kosong hilang beserta judulnya.**

| Data | Bila kosong |
|---|---|
| Tagline, deskripsi | barisnya tidak dirender |
| "Tentang" / anggota tim | kartu "Kenalan sama booth ini" tidak dirender |
| Nomor booth | stiker nomor hilang; "Beli langsung di Booth 12" menjadi "Beli langsung di booth ini"; di Incaranku booth tanpa nomor masuk kelompok terakhir "Tanpa nomor" |
| Produk | bagian "Yang bisa kamu bawa pulang", andalan, chip harga, dan tombol "Lihat yang andalan" tidak dirender (sudah diputuskan: produk opsional, A14) |
| Nomor WhatsApp | tombol "Pesan dulu" tidak dirender (sudah ada, A14) |
| Ulasan belum ada | tampilan kosong yang ramah ("Belum ada yang nilai, jadi yang pertama dong"); rating tampil "Belum ada ulasan", bukan `0,0 ★` |

**Contoh: tiga booth dalam satu event**

| | Hanya nama | Nama + nomor | Lengkap |
|---|---|---|---|
| Kartu di grid | bingkai berinisial + nama + rating | bingkai berinisial + stiker nomor + nama + rating | foto + stiker nomor + nama + rating + stiker harga |
| Sorotan 01 | tipografi nama besar + rating + tombol | idem + stiker nomor | foto + deskripsi + produk andalan + ulasan pilihan |
| Halaman booth | hero satu kolom (nama, rating, CTA); **kartu penilaian dan ulasan tetap ada**, bagian lain tidak dirender | idem + stiker nomor | lengkap |
| Hasil akhir (juara 1–3) | bingkai juara berinisial | idem | foto |
| Poster QR | nama + QR | + nomor | + logo |

**Booth hanya nama tetap bisa dinilai** dan ikut peringkat dengan rumus yang sama (A7). Kelengkapan profil **tidak memengaruhi** skor, urutan acak, maupun bobot sorotan.

**Kelengkapan profil** (dihitung, tidak disimpan): *Hanya nama*, *Sebagian*, atau *Lengkap*. Tampil sebagai chip di admin (kolom Data Grid, antrean booth) dan sebagai saran lembut di portal booth ("Tambahkan foto supaya kartu kamu lebih menarik"). **Tidak pernah** tampil ke pengunjung dan tidak pernah memblokir apa pun.

Rincian teknis: B26.

# Bagian B — Plan Tech

## B1. Stack & jawaban "React cocok?"

**Ya, React sangat cocok di Cloudflare.** Cara termudahnya: aplikasi React (Vite) dibangun jadi file statis, lalu disajikan oleh **Cloudflare Workers (Static Assets)**; API ditulis di Worker yang sama. SSR tidak diperlukan karena ini aplikasi interaktif (dashboard), bukan situs konten yang butuh SEO berat.

| Lapisan | Pilihan | Alasan |
|---|---|---|
| UI | **React + TypeScript + Vite** | Kamu sudah familiar; build statis, cepat |
| Routing | React Router (atau TanStack Router) | SPA, rute `/`, `/b/:id`, `/register`, `/booth/*`, `/admin/*` |
| Data fetching | **TanStack Query** | Cache, refetch, kombinasi mudah dengan realtime |
| Styling | **Tailwind CSS v4** (wajib) + variabel token | Tema lewat CSS variable (B4) |
| Animasi | **Motion** (`motion/react`, dulu Framer Motion) | Animasi layout leaderboard, feed, spotlight |
| Komponen | shadcn/ui (Radix) *opsional* | Aksesibel; tapi harus dipetakan ke token tema kita |
| Runtime & hosting | **Cloudflare Workers + Static Assets** | Satu deploy: frontend + API. Pages sudah bukan jalur utama untuk proyek baru |
| API framework | **Hono** | Ringan, native Workers, middleware lengkap |
| Validasi | **Zod** (dipakai bersama client & server) | Satu skema untuk form & API |
| Database | **D1** (SQLite) + **Drizzle ORM** | Relasional, murah, migrasi jelas |
| Realtime | **Durable Objects** (WebSocket Hibernation) | Satu "ruang" per event, bisa batching (B8) |
| File/gambar | **R2** + **konversi WebP di sisi client** (tanpa Image Resizing/Cloudflare Images) | Logo & foto booth; server hanya memvalidasi (B15) |
| Pemisahan kode | `React Router lazy` per **area** (home / event / admin / booth / screen) + `import()` untuk library berat | SPA tidak mengirim semua kode ke semua orang (B16) |
| Anti-bot | **Turnstile** | Gratis, tak terlihat |
| Login admin | **Cloudflare Access** (Zero Trust) | Tanpa bikin login admin sendiri (gratis sampai 50 user) |
| Email | Cloudflare Email Service *(cek ketersediaan/status saat implementasi)* atau Resend/Brevo | OTP & notifikasi; ada penyedia cadangan |
| Cron | **Cron Triggers** | Bersihkan OTP dan kunci idempotensi yang kedaluwarsa, serta tugas rutin. **Bukan** untuk mengganti fase event: fase dihitung dari tanggal (B17) |
| Rate limit | Workers Rate Limiting binding + counter di DO | Lihat B9 |
| Observabilitas & log | **Workers Logs** (debug teknis) + **Workers Analytics Engine** (log aktivitas yang tampil di admin) + R2 (arsip opsional) | **Tanpa database** untuk log; lihat B13 |
| Pola komponen | `cva` (class-variance-authority) + token Tailwind | Satu komponen banyak varian; lihat B14 |
| Tooling | **Wrangler** + **@cloudflare/vite-plugin** | Dev lokal mensimulasikan D1/DO/R2 |

Yang **tidak** disarankan: Next.js (bisa di Cloudflare lewat adapter, tapi lebih berat dan rumit untuk kebutuhan ini), serta layanan realtime pihak ketiga (menambah biaya & vendor tanpa perlu).

> Catatan: harga, kuota, dan status fitur Cloudflare berubah. Semua angka di dokumen ini adalah gambaran; **verifikasi di halaman pricing/docs resmi** sebelum hari-H.

## B2. Arsitektur

```
                    ┌──────────────────────── Cloudflare ────────────────────────┐
 Browser (React) ──►│  Worker (Hono)                                              │
  - HTTP  /api/*    │   ├─ Static Assets (hasil build Vite, SPA fallback)         │
  - WS    /ws/*     │   ├─ Auth (OTP, Google, sesi cookie), Turnstile verify      │
                    │   ├─ Rate limit, validasi Zod                               │
                    │   └─ Cache API (snapshot dashboard, TTL pendek)             │
                    │        │ tulis (batch atomik)          │ notifikasi (RPC)    │
                    │        ▼                               ▼                     │
                    │   D1  ← sumber kebenaran        Durable Object "LiveHub"     │
                    │   (events, booths, reviews,     (1 per event: state agregat  │
                    │    booth_stats, …)               di memori, batching tick,   │
                    │   R2 (logo/foto)                 broadcast WebSocket)        │
                    │   Cron Trigger (bersihkan OTP lama)                          │
                    └──────────────────────────────────────────────────────────────┘
 Admin ──► Cloudflare Access ──► /admin, /api/admin/*
```

Prinsip: **D1 = sumber kebenaran**; **Durable Object = lapisan "siaran" yang boleh hilang**. Jika DO restart, ia membangun ulang state dari D1 (satu query kecil), tidak ada data hilang.

Alur submit review:
1. Client POST `/api/reviews` (+ token Turnstile).
2. Worker: cek sesi, jadwal event (`getEventState`, B17), rate limit, validasi, risiko spam.
3. Worker: **D1 `batch()` atomik** → simpan/update review + update `booth_stats`.
4. Worker memanggil DO (`waitUntil`, tidak menahan respons) → DO mencatat ke buffer.
5. Client dapat respons sukses segera; DO menyiarkan ke penonton pada tick berikutnya.

## B3. Struktur repo

Satu proyek satu `package.json` (cukup untuk solo developer), dibangun dengan `@cloudflare/vite-plugin`:

```
boot-favorit/
├─ wrangler.jsonc
├─ vite.config.ts
├─ drizzle/                  migrasi SQL
├─ src/
│  ├─ shared/                dipakai client & server
│  │   ├─ config.ts          ← SEMUA nilai tunable (B5)
│  │   ├─ schemas.ts         skema Zod
│  │   ├─ log-events.ts      ← daftar kategori/aksi/level log (B13), dipakai logger & dropdown filter UI
│  │   └─ scoring.ts         rumus Bayesian (dipakai UI & server)
│  ├─ worker/
│  │   ├─ index.ts           Hono app + export DO
│  │   ├─ routes/            auth, events, booths, reviews, admin
│  │   ├─ middleware/        requireSession, requireEvent, rateLimit, turnstile (dipakai ulang di banyak route)
│  │   ├─ live-hub.ts        Durable Object
│  │   ├─ db/                skema Drizzle, query
│  │   └─ lib/               logger (B13), otp, turnstile, ratelimit, risk, email
│  └─ web/
│      ├─ styles/theme.css   ← SATU-SATUNYA tempat warna (B4)
│      ├─ components/        ← lapisan komponen (B14)
│      │   ├─ ui/            primitif: Button, Badge, Chip, Card, Modal, Toast, Skeleton, EmptyState, DataTable, FormField
│      │   └─ shared/        komponen domain yang dipakai ≥ 2 area: RatingStars, BoothCard, ReviewItem, LeaderboardRow, StatTile, ImageUploader, SafeImage, PhotoFrame, BoothProfileForm, ProductEditor (B26)
│      ├─ areas/             ← 4 area, masing-masing jadi chunk terpisah (B16). Antar-area DILARANG saling impor.
│      │   ├─ event/         "tampilan all toko": halaman event = dashboard live + daftar semua booth, profil booth, alur review, hasil
│      │   ├─ booth/         portal pemilik booth: pendaftaran, login, portal
│      │   ├─ admin/         "tampilan admin": layout + routes + features + pages (event, antrean, moderasi, LogViewer, QR/poster, hasil)
│      │   └─ screen/        mode layar besar: layout minimal tanpa navigasi
│      ├─ features/live/     klien realtime (useLive, WebSocket, polling) — hanya diimpor public & screen
│      ├─ dev/               galeri komponen (hanya dev)
│      └─ lib/               api client, theme-loader, copy.ts (teks UI), image/ (konversi WebP, B15)
└─ scripts/lint-tokens.mjs   penjaga aturan token
```

Catatan `wrangler.jsonc` (ringkas):

```jsonc
{
  "name": "booth-favorit",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-01-01",
  "assets": {
    "directory": "./dist/client",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/ws/*"]
  },
  "d1_databases":     [{ "binding": "DB",   "database_name": "booth-favorit" }],
  "r2_buckets":       [{ "binding": "MEDIA", "bucket_name": "booth-media" }],
  "durable_objects":  { "bindings": [{ "name": "LIVE_HUB", "class_name": "LiveHub" }] },
  "triggers":         { "crons": ["* * * * *"] },
  "vars":             { "APP_ENV": "production" }   // non-rahasia; rahasia pakai `wrangler secret`
}
```

## B4. Theming Tailwind + variabel (WAJIB)

Aturan wajib:

1. **Semua warna didefinisikan hanya di `src/web/styles/theme.css`** sebagai CSS variable bermakna (*semantic token*), lalu dipetakan ke Tailwind lewat `@theme inline`.
2. **Komponen dilarang** memakai warna literal (`#fff`, `rgb()`, `oklch()`) maupun palet bawaan Tailwind (`bg-blue-500`, `text-gray-700`). Hanya boleh `bg-primary`, `text-muted`, `border-line`, `text-star`, dst.
3. Ganti tema = ubah nilai variabel di satu tempat (atau lewat panel admin per event). Tidak ada komponen yang diubah.
4. Aturan ditegakkan otomatis: skrip `lint-tokens` gagal di CI/pre-commit jika menemukan warna literal atau kelas palet di luar `theme.css`.
5. **Font mengikuti aturan yang sama**: nama font **hanya** ditulis di `theme.css` (token) dan `fonts.css` (`@font-face`). Komponen memakai `font-ui`, `font-display`, `font-hand`; `lint-tokens` juga menolak `font-family:` literal, nama font pada kelas arbitrer (`font-[...]`), dan nama font di berkas komponen.

> **Catatan (A12):** arah visual "Editorial" memakai nama token yang berbeda dari contoh di bawah: `--paper`, `--paper-2`, `--ink`, `--muted`, `--line`, `--green`, `--green-strong`, `--on-green`, `--star`, `--star-off`, `--r` (radius), `--font-ui`, `--font-display`, dengan tema `kertas` dan `panggung`. Daftar token final mengikuti `demo-event.html`; aturan "warna hanya di `theme.css`" tidak berubah. **Palet UNIMED** (hijau `#1EB05F`, oranye `#FDA31B`, gelap `#19232B`, plus nada krem/hijau muda turunannya) menjadi **nilai token bawaan**; yang ditiru dari UNIMED hanya warna, bukan tata letak. Oranye untuk teks di latar terang memakai varian lebih gelap (`#B96A00`) agar terbaca. Ada **dua sumbu tema**: `data-theme` (`kertas` / `panggung`) dan `data-vibe` (`seru` / `pro`). Gaya *Seru* menambah token `--c1…--c5` (warna stiker; ada dua palet lewat `data-stk`: *dengan warna tambahan* kuning/merah muda/biru muda, atau *hanya hijau-oranye-krem*), `--hand` (font tulisan tangan), serta teks UI (`copy.ts` memiliki satu set teks per gaya, mis. "Kasih bintang!" vs "Beri penilaian"). Tema gelap *Panggung* berlaku untuk gaya Profesional dan Layar Besar. Contoh di bawah menunjukkan **mekanismenya** (variabel → `@theme inline` → utilitas), bukan nama final.

Contoh `theme.css` (Tailwind v4, konfigurasi berbasis CSS):

```css
@import "tailwindcss";

/* 1) NILAI TEMA — satu-satunya tempat angka warna hidup.
      Default = palet UNIMED (diambil dari tangkapan layar situs unimed.ac.id, lihat tabel di bawah). */
:root {
  /* Hijau UNIMED #1EB05F */
  --primary:        oklch(0.667 0.166 152); /* isian: top bar, badge, tombol */
  --primary-fg:     oklch(0.250 0.021 243); /* teks di atas primary (gelap, AA 5.6:1) */
  --primary-strong: oklch(0.527 0.136 151); /* teks/tautan hijau di latar putih & tombol berteks putih (≈#13803F, AA 5.0:1) */
  --primary-soft:   oklch(0.970 0.030 152); /* latar tint hijau sangat muda */

  /* Oranye UNIMED #FDA31B */
  --accent:         oklch(0.787 0.166 69);  /* label "BERITA", kata ber-outline, sorotan */
  --accent-fg:      oklch(0.250 0.021 243); /* teks di atas accent (AA 7.9:1) */
  --accent-strong:  oklch(0.529 0.119 64);  /* teks oranye di latar putih (≈#9A5A00, AA 5.5:1) */

  /* Netral (biru-kelabu gelap UNIMED #19232B) */
  --surface:        oklch(1 0 0);           /* latar halaman: putih */
  --surface-raised: oklch(1 0 0);           /* kartu */
  --surface-tint:   oklch(0.985 0.008 152); /* seksi berselang-seling */
  --text:           oklch(0.250 0.021 243);
  --muted:          oklch(0.550 0.020 243);
  --line:           oklch(0.920 0.008 243);

  --star:           var(--accent);          /* bintang rating */
  --success:        oklch(0.650 0.170 150);
  --warning:        oklch(0.780 0.150 75);
  --danger:         oklch(0.600 0.220 25);

  --radius-card:    1rem;
  --radius-chip:    9999px;
  --shadow-card:    0 4px 24px oklch(0.2 0.05 275 / 0.08);

  /* FONT: lihat blok @theme di bawah; nama font hanya ditulis di theme.css / fonts.css */

  --motion-fast:    150ms;
  --motion-base:    300ms;
  --motion-slow:    700ms;
  --ease-pop:       cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 2) VARIAN TEMA — hanya menimpa variabel. */
[data-theme="dark"] {
  --surface:        oklch(0.200 0.020 243);
  --surface-raised: oklch(0.250 0.021 243);
  --surface-tint:   oklch(0.225 0.025 200);
  --text:           oklch(0.960 0.010 243);
  --muted:          oklch(0.720 0.020 243);
  --line:           oklch(0.340 0.020 243);
  --primary-strong: oklch(0.750 0.160 152);  /* di latar gelap, hijau perlu lebih terang */
  --accent-strong:  oklch(0.830 0.150 72);
  --primary-soft:   oklch(0.300 0.050 152);
}
/* Contoh tema alternatif, membuktikan ganti tema = timpa variabel saja. */
[data-theme="festival"] {
  --primary: oklch(0.62 0.25 20);
  --accent:  oklch(0.85 0.18 110);
}

/* 3) PEMETAAN KE TAILWIND — "inline" agar nilai dibaca saat runtime,
      sehingga override via data-theme / style inline langsung berlaku. */
@theme inline {
  --color-primary:        var(--primary);
  --color-primary-fg:     var(--primary-fg);
  --color-primary-strong: var(--primary-strong);
  --color-primary-soft:   var(--primary-soft);
  --color-accent:         var(--accent);
  --color-accent-fg:      var(--accent-fg);
  --color-accent-strong:  var(--accent-strong);
  --color-surface:        var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-surface-tint:   var(--surface-tint);
  --color-text:           var(--text);
  --color-muted:          var(--muted);
  --color-line:           var(--line);
  --color-star:           var(--star);
  --color-success:        var(--success);
  --color-warning:        var(--warning);
  --color-danger:         var(--danger);

  --radius-card:  var(--radius-card);
  --radius-chip:  var(--radius-chip);
  --shadow-card:  var(--shadow-card);
}

/* TOKEN FONT (satu-satunya tempat nama font). Dibaca komponen lewat utilitas font-ui / font-display / font-hand. */
@theme {
  --font-ui:           "DM Sans", system-ui, sans-serif;
  --font-display:      "Bricolage Grotesque", system-ui, sans-serif;
  --font-hand:         "Caveat", "Comic Sans MS", cursive;
  --weight-display:    800;
  --tracking-display:  -0.03em;
}
/* Mengganti font untuk seluruh situs = ubah nilai di atas (atau timpa di [data-font="..."]) + ganti berkas di fonts.css. */
```

Pemakaian di komponen:

```tsx
<article className="rounded-card bg-surface-raised shadow-card border border-line p-4">
  <h3 className="font-display text-text">{booth.name}</h3>
  <Star className="text-star" />
  <button className="bg-primary text-primary-fg rounded-chip px-4 py-2">Beri Nilai</button>
  <a className="text-primary-strong underline">Lihat profil</a>   {/* teks hijau di latar putih → pakai -strong */}
</article>
```

**Palet default: diambil dari situs UNIMED.** Nilai diukur langsung dari piksel tangkapan layar (warna dominan per area), bukan ditebak:

| Peran | Hex terukur | Dipakai di situs UNIMED | Token |
|---|---|---|---|
| Hijau utama | `#1EB05F` | top bar, badge tanggal, kata "UNIMED" di judul | `--primary` |
| Oranye | `#FDA31B` | label "SELAMAT DATANG…", "BERITA", kata ber-outline "Building" | `--accent` |
| Gelap | `#19232B` | judul "Berita", teks menu | `--text`, `--primary-fg`, `--accent-fg` |
| Putih | `#FFFFFF` | navbar, latar halaman | `--surface` |

Catatan kontras (WCAG AA butuh 4,5:1 untuk teks normal):

| Kombinasi | Rasio | Keputusan |
|---|---|---|
| Putih di atas hijau `#1EB05F` | 2,83 ❌ | Situs UNIMED memakainya (teks besar/tebal), tapi untuk aplikasi kita **teks di atas `--primary` dibuat gelap** (5,64 ✅) |
| Gelap di atas oranye | 7,92 ✅ | `--accent-fg` gelap |
| Hijau/oranye murni sebagai **teks di latar putih** | 2,83 / 2,01 ❌ | Pakai varian `--primary-strong` (≈`#13803F`, 5,0 ✅) dan `--accent-strong` (≈`#9A5A00`, 5,5 ✅) |
| Gelap di atas putih | 15,95 ✅ | teks utama |

Jika ingin tampilan persis situs UNIMED (teks putih di atas hijau), cukup ganti satu baris `--primary-fg` menjadi putih; konsekuensi kontras ditanggung di tombol/teks kecil. Aturan: **hijau & oranye murni untuk isian/dekorasi, varian `-strong` untuk teks.** Logo/aset resmi UNIMED hanya dipakai jika sudah ada izin dari LPPM; warna saja tidak masalah.

**Tema per event** (diatur admin): server menyimpan `theme_json` (mis. `{ primary: "#1EB05F", accent: "#FDA31B", mode: "light" }`) di tabel `events`; client menerapkannya saat load:

```ts
const root = document.documentElement;
root.dataset.theme = theme.mode;
root.style.setProperty("--primary", theme.primary);
root.style.setProperty("--accent", theme.accent);
```

Panel admin harus **memvalidasi kontras** (mis. teks `--primary-fg` di atas `--primary` ≥ 4.5:1) sebelum menyimpan. Nilai hex yang disimpan di database adalah *data*, bukan kode, jadi tidak melanggar aturan "tanpa warna literal di komponen".

Penegakan (`scripts/lint-tokens.mjs`, contoh ide): cari di `src/web/**` selain `theme.css` pola `#[0-9a-fA-F]{3,8}\b`, `rgb(`, `hsl(`, `oklch(`, dan kelas `(bg|text|border|ring|fill|stroke|from|via|to)-(red|blue|gray|slate|…)-\d{2,3}`; keluar dengan error bila ketemu.

## B5. Variabel nilai selain warna (WAJIB)

Nilai yang kemungkinan diubah **tidak boleh tertanam** di logika. Dua tempat:

**1) `src/shared/config.ts` — nilai tunable aplikasi (client & server):**

```ts
export const CONFIG = {
  live: {
    tickMs: 2500,             // jeda broadcast ke penonton
    maxFeedItemsPerTick: 5,   // sisanya diringkas "+N ulasan baru"
    maxLiveViewers: 400,      // di atas ini → mode polling
    reservedScreenSlots: 5,   // slot WebSocket yang selalu tersedia untuk Mode Layar Besar
    pollIntervalMs: 15000,    // interval polling (opsi A)
    pollJitterRatio: 0.2,     // ±20% acak agar klien tidak serentak
    snapshotTtlSec: 5,        // s-maxage cache edge saat event berlangsung
    snapshotTtlSecAfterEnd: 60, // setelah event selesai data beku; polling jarang (perubahan admin memutus cache lewat stats_version)
    spotlightMs: 8000,        // ganti spotlight
  },
  booth: {
    aboutMaxLength: 2000,     // panjang maksimum teks "Kenalan" (portal booth + validasi server)
    aboutCollapsedLines: 4,   // jumlah baris sebelum "Baca selengkapnya"
    maxProducts: 24,          // BAWAAN batas produk per booth (disetujui); admin menimpanya per event lewat settings_json.maxProducts; sama untuk semua booth di event itu (A14)
    maxProductsHardCap: 100,  // pagar atas yang boleh diatur admin (menjaga ukuran respons & performa halaman)
    whatsapp: {
      messageMaxLength: 300,        // panjang pesan awal yang diisi otomatis (dipotong bila lebih)
      redirectRatePerMinute: 20,    // batas /go/wa per alamat IP (anti pemanenan nomor)
      deleteDaysAfterEventEnd: 30,  // nomor dihapus dari database sekian hari setelah event selesai
    },
    share: { appendSrcParam: "share" },  // tautan bagikan memakai ?src=share (statistik & skor risiko)
    productPageSize: 6,       // etalase menampilkan segini dulu, lalu "Tampilkan lebih banyak"
    productFilterMinProducts: 8, // chip kategori hanya muncul bila produk > angka ini
    maxProductCategories: 8,  // jumlah kategori berbeda per booth
    productNameMax: 60,
    productDescMax: 300,
    maxPriceIdr: 99_999_999,  // harga rupiah bulat, 0 = Gratis
    productBadges: ["limited", "new"],  // penanda tetap (Stok terbatas, Baru); sengaja tanpa "terlaris"/"favorit" karena menggiring
    wishlistMax: 50,          // batas daftar incaran di browser pengunjung
  },
  gallery: {
    intervalMs: 3500,         // jeda pergantian foto otomatis (slideshow halaman booth)
    resumeAfterTouchMs: 4000, // setelah disentuh/digeser di HP, slideshow lanjut lagi setelah jeda ini
  },
  moderation: {
    severeAction: "hold",             // hold | mask  (komentar berat ditahan; bintang tetap dihitung)
    mildAction: "mask",               // mask | hold | allow
    holdContactInfo: true,            // nomor telepon / URL / email / ajakan "DM/WA" ditahan
    maxReportsPerBoothPerHour: 20,
    suspiciousReportRatio: 0.6,       // sebagian besar laporan booth tertuju ke komentar berbintang ≤ 3 tanpa temuan filter → ditandai untuk admin
    suspiciousReportMin: 5,
    fuzzyMatching: false,             // pencocokan typo (edit distance) mati: terlalu sering salah tangkap
  },
  review: {
    maxCommentLength: 280,
    editableUntilVotingEnds: true,
    defaultCategories: ["Inovatif", "Ramah", "Seru", "Bermanfaat", "Kreatif", "Rapi"],  // daftar awal kategori ulasan; admin mengubahnya per event
    maxCategoriesPerReview: 3,
  },
  ranking: {
    bayesPriorWeight: 5,      // m
    minReviewsToRank: 3,
  },
  auth: {
    otpTtlMinutes: 10,
    otpMaxAttempts: 5,
    otpRequestsPerEmailPerHour: 5,
    sessionDays: 3,
  },
  spam: {
    maxReviewsPerVisitorPerMinute: 4,
    burstThresholdPerBoothPerMin: 12,   // memicu flagging
  },
  registration: {
    allowLateRegistrationDefault: true, // default pengaturan per-event `allowLateRegistration`: link /register tetap hidup sesudah "ditutup" sampai event selesai
    adminReasonMinLength: 5,            // alasan wajib untuk perubahan admin pada review/booth/event
    countdownShowWithinHours: 72,    // hitung mundur "ditutup dalam …" mulai tampil H-72 jam
  },
  net: {
    requestTimeoutMs: 15000,  // batas tunggu aksi sebelum tombol menawarkan "Coba lagi"
    otpCooldownSec: 45,       // jeda sebelum OTP boleh dikirim ulang
    idempotencyTtlHours: 24,
  },
  media: {
    maxRawFileMB: 15,         // batas file asli sebelum dikonversi di browser
    quality: 0.82,            // kualitas awal WebP (turun bertahap bila melebihi batas byte)
    logo:  { fullPx: 512,  thumbPx: 128, maxBytesFull: 120_000, maxBytesThumb: 20_000 },
    photo: { fullPx: 1280, thumbPx: 480, maxBytesFull: 400_000, maxBytesThumb: 60_000 },
    product: { fullPx: 960, thumbPx: 400, maxBytesFull: 250_000, maxBytesThumb: 40_000 },  // satu foto per produk, persegi (dipotong di browser)
    maxPhotosPerBooth: 6,
    // foto OPSIONAL (A16): tidak ada batas minimum dan tidak ada pengaturan untuk mewajibkannya; tanpa foto, komponen beralih ke bingkai/hanya-teks/hilang
  },
  spotlight: {
    topReviewsCount: 2,
    minStars: 4,              // ulasan pilihan hanya ★4–5
    minCommentLength: 30,     // dan komentar ≥ 30 karakter
    photoIntervalMs: 2600,    // geser foto otomatis di galeri spotlight
    // giliran booth memakai live.spotlightMs
  },
  profile: {                  // kelengkapan profil (A16): hanya untuk chip admin dan saran di portal; TIDAK memengaruhi tampilan publik, skor, atau urutan
    fullNeeds: ["cover", "description", "tagline", "boothNo"],   // semua terpenuhi = "Lengkap"; tak satu pun = "Hanya nama"
    nameMaxLength: 60,
  },
  booths: {
    csvMaxRows: 500,          // batas baris per impor CSV (A16); file lebih besar dipecah admin
    csvChunkSize: 50,         // baris per batch() D1 saat impor
  },
} as const;
```

**2) Per-event di database (`events.settings_json`)** — dapat diubah admin tanpa deploy: `reviewer_auth_mode`, `m` Bayesian, **kategori ulasan**, tema. Nilai di `config.ts` menjadi **default**; pengaturan event menimpanya.

Rahasia (kunci Turnstile, API email, secret JWT/HMAC) → `wrangler secret`, tidak pernah di repo atau `vars`.

## B6. Model data (D1)

Semua tabel yang relevan membawa `event_id` (isolasi per-event).

```sql
events(
  id, slug UNIQUE,                                -- slug hanya pengenal arsip/admin, TIDAK dipakai di URL publik
  name,                                          -- nama resmi acara = judul utama di halaman
  is_active INTEGER DEFAULT 0,                   -- tepat satu event aktif (indeks unik parsial: CREATE UNIQUE INDEX one_active ON events(is_active) WHERE is_active = 1)
  hidden_from_public INTEGER DEFAULT 0,          -- 1 = event aktif disembunyikan (halaman utama tampil "Segera hadir")
  active_version INTEGER DEFAULT 0,              -- naik tiap event aktif berganti → kunci cache event aktif
  visibility,                                    -- draft | published  (draft = tidak tampil di publik)
  timezone DEFAULT 'Asia/Jakarta',               -- zona waktu tampilan & input admin
  -- JADWAL (epoch ms UTC, semuanya bisa diedit admin; status dihitung dari sini, tidak disimpan)
  registration_open_at,                          -- NULL = terbuka sejak dipublikasikan
  registration_close_at,                         -- setelah ini tombol "Daftar Toko" hilang & API menolak
  event_start_at, event_end_at,                  -- review/voting terbuka tepat di jendela ini
  results_published_at,                          -- diisi saat admin menekan "Umumkan hasil"
  ratings_mode TEXT DEFAULT 'visible',           -- visible | hidden | on_results (moderasi admin; peringkat butuh rating tampil)
  results_json,                                  -- SELURUH peringkat akhir (urut, nama, nomor booth, foto sampul (`null` bila booth tanpa foto, A16), rata-rata, jumlah, skor, tag ulasan teratas beserta jumlah dan labelnya), DIBEKUKAN saat "Umumkan hasil" / "Perbarui hasil"
  results_version INTEGER DEFAULT 0,             -- naik tiap hasil diumumkan/diperbarui; dipakai untuk mereset opsi "jangan putar lagi"
  ranking_mode TEXT DEFAULT 'visible',           -- visible | hidden | on_results (komponen peringkat opsional, B20)
  reveal_seq INTEGER DEFAULT 0,                  -- naik 1 setiap admin memutar animasi pemenang
  reveal_started_at, reveal_json,                -- peringkat dibekukan saat animasi live dimulai
  reveal_target TEXT DEFAULT 'screen',           -- screen | everyone
  stats_version INTEGER DEFAULT 0,               -- dinaikkan tiap perubahan admin pada review/booth → kunci cache snapshot ikut berganti
  title_highlight,                               -- kata pada nama acara yang diberi garis oranye di hero (mis. "Terfavorit")
  logo_key, og_image_key,                        -- logo kecil (opsional, kaki halaman) dan gambar pratinjau tautan (R2, WebP, B15)
  hero_keys_json,                                -- 3 foto suasana acara untuk kolase hero (R2, WebP; diunggah admin, bukan foto booth tertentu)
  contact_json, social_json,                     -- kontak dan media sosial LPPM untuk kaki halaman (opsional, diatur admin)
  theme_json, settings_json, created_at, updated_at,
  CHECK (event_start_at < event_end_at),
  CHECK (registration_open_at IS NULL OR registration_open_at < registration_close_at)
)

booths(
  id, event_id,
  email,                                         -- NULL = booth TANPA PEMILIK (dibuat admin, A16): tidak ada login dan tidak ada email notifikasi. Bila terisi: huruf kecil + trim
  name NOT NULL,                                 -- satu-satunya data wajib (1–60 karakter, di-trim)
  description, tagline, logo_key, booth_no,      -- semuanya boleh NULL; komponen menyesuaikan tampilannya (A16, B26)
  about,                                         -- teks "Kenalan" panjang (CONFIG.booth.aboutMaxLength); sebelumnya hanya disebut di B20, belum ada kolomnya
  team_name,                                     -- nama tim/prodi (chip di halaman booth, B20); opsional
  status,                                        -- pending | approved | rejected | revision | suspended
  reject_reason, approved_by, approved_at, created_at, updated_at,   -- updated_at = token versi untuk Data Grid (B18)
  is_late INTEGER DEFAULT 0,                     -- 1 = mendaftar sesudah registration_close_at (pendaftaran susulan)
  created_by,                                    -- self | admin (booth yang ditambahkan manual oleh admin; admin: is_late = 0, status selalu langsung approved)
  owner_invited_at, owner_last_login_at,         -- status pemilik DIHITUNG: email NULL = tanpa pemilik; email terisi + owner_last_login_at NULL = diundang; sudah terisi = aktif
  product_terms_accepted_at,                     -- pemilik mencentang aturan "dilarang menawarkan imbalan untuk bintang/ulasan" (A14); wajib sebelum produk pertama tersimpan
  whatsapp_e164,                                 -- OPSIONAL, digit tanpa "+" (mis. 6281234567890); NULL = tanpa tombol Pesan. Tidak pernah ada di respons daftar/snapshot (B24)
  whatsapp_consent_at,                           -- persetujuan eksplisit bahwa nomor bisa dihubungi pengunjung; wajib bila whatsapp_e164 terisi
  whatsapp_consent_by,                           -- owner | admin (admin mengisi atas nama pemilik hanya setelah mencentang konfirmasi persetujuan, A16)
  UNIQUE(event_id, email)                        -- ← "akun per-event" ditegakkan di sini. Booth tanpa pemilik (email NULL) boleh banyak: SQLite menganggap tiap NULL berbeda
)

review_categories(                               -- kategori ulasan, DIATUR ADMIN per event
  id, event_id, label, position INTEGER,
  active INTEGER DEFAULT 1,                      -- nonaktif (bukan hapus) agar data lama tetap terbaca
  created_at, updated_at
)

booth_photos(                                    -- galeri foto booth (hasil konversi WebP di client, B15)
  id, event_id, booth_id,
  key_full, key_thumb,                           -- kunci objek R2 (full ~1280px, thumb ~480px)
  position INTEGER,                              -- urutan; position 0 = foto sampul
  created_at,
  UNIQUE(booth_id, position)
)

products(                                        -- produk & layanan booth (A14, B24); maks. CONFIG.booth.maxProducts per booth
  id, event_id, booth_id,
  name, description, category,                   -- category = teks pendek buatan pemilik (maks. 8 berbeda per booth)
  price_idr INTEGER NOT NULL CHECK (price_idr BETWEEN 0 AND 99999999),   -- rupiah bulat; 0 = Gratis
  compare_price_idr INTEGER CHECK (compare_price_idr IS NULL OR compare_price_idr > price_idr),  -- harga normal (dicoret)
  badge TEXT,                                    -- NULL | limited | new
  is_featured INTEGER DEFAULT 0,                 -- produk andalan pilihan pemilik; tepat satu per booth (indeks unik parsial di bawah)
  status TEXT DEFAULT 'active',                  -- active | hidden (disembunyikan/habis oleh pemilik) | removed_by_admin
  key_full, key_thumb, position INTEGER,         -- foto (R2, B15) dan urutan tampil
  created_at, updated_at
)
-- CREATE UNIQUE INDEX one_featured ON products(booth_id) WHERE is_featured = 1 AND status = 'active';
-- CREATE INDEX products_booth ON products(booth_id, position);

visitors(
  id, event_id, provider,                        -- google | email | ticket
  identity_hash,                                 -- HMAC(email/sub/kode); email asli tidak disimpan
  display_name, blocked, created_at, updated_at,
  UNIQUE(event_id, identity_hash)
)

reviews(
  id, event_id, booth_id, visitor_id,
  stars INTEGER CHECK (stars BETWEEN 1 AND 5),
  comment, category_ids_json,                    -- id kategori ulasan yang dipilih (maks. 3)
  status,                                        -- visible | held | hidden   (menyangkut SELURUH review; bintang ikut tidak dihitung bila bukan visible)
  comment_status TEXT DEFAULT 'visible',         -- visible | masked | held | hidden : hanya TEKS komentar (A15); bintang tetap dihitung. Hanya sistem (filter) dan admin yang mengubahnya, TIDAK PERNAH booth
  comment_masked,                                -- teks tayang dengan kata disamarkan (bila comment_status = masked); teks asli tetap di `comment`
  filter_hits_json, filter_version,              -- id istilah yang tertangkap + versi daftar kata saat diperiksa (bukan salinan kata)
  comment_locked INTEGER DEFAULT 0,              -- 1 = admin sudah memulihkan; laporan berikutnya tidak memunculkannya lagi di antrean
  pinned INTEGER DEFAULT 0,                      -- 1 = disematkan admin di "Ulasan pilihan" (spotlight)
  risk_score, flags_json, ip_hash, ua_hash,
  created_at, updated_at,
  -- jejak perubahan oleh admin (data, bukan log):
  moderated_by, moderated_at, moderation_reason,
  original_stars, original_comment,              -- diisi SEKALI saat admin pertama kali menyunting; tidak pernah ditimpa
  UNIQUE(booth_id, visitor_id)                   -- ← 1 review per orang per booth
)

moderation_terms(                                -- daftar kata, DIATUR ADMIN per event (A15, B25); daftar awal dikompilasi dari sumber berlisensi lalu ditinjau panitia
  id, event_id, term,                            -- kata/frasa sudah dinormalisasi
  lang,                                          -- id | en | regional
  severity TEXT,                                 -- severe | mild
  kind TEXT DEFAULT 'block',                     -- block (kata terlarang) | allow (pengecualian/whitelist)
  match TEXT DEFAULT 'word',                     -- word (batas kata) | contains (hanya untuk istilah panjang)
  enabled INTEGER DEFAULT 1, source,             -- asal daftar (mis. drizki, abaron, obscenity, admin)
  created_by, created_at, updated_at,
  UNIQUE(event_id, term, kind)
)

review_reports(                                  -- laporan komentar dari booth atau pengunjung; TIDAK menyembunyikan apa pun
  id, event_id, review_id, reporter_role,        -- booth | visitor
  reporter_booth_id, reporter_visitor_id,        -- hanya terlihat admin
  reason TEXT,                                   -- profanity | hate | personal_data | spam | other
  note, status TEXT DEFAULT 'open',              -- open | upheld | dismissed
  decided_by, decided_at, decision_reason,
  created_at,
  -- Satu laporan per pelapor per komentar: DUA indeks unik parsial (drizzle-kit merusak indeks ber-COALESCE):
  --   UNIQUE(review_id, reporter_booth_id)   WHERE reporter_role = 'booth'
  --   UNIQUE(review_id, reporter_visitor_id) WHERE reporter_role = 'visitor'
  -- ditambah CHECK: pelapor harus sesuai perannya (booth → reporter_booth_id terisi; visitor → reporter_visitor_id terisi)
)

booth_stats(                                     -- agregat, diperbarui saat tiap review (tanpa SUM() mahal)
  booth_id PRIMARY KEY, event_id,
  review_count, star_sum, s1, s2, s3, s4, s5, category_counts_json, updated_at,
  last_review_at,                                -- waktu review terakhir; pemutus seri peringkat (A7), sebelumnya belum ada kolomnya
  product_count, price_from,                     -- harga terendah > 0 dari produk aktif (NULL bila semua gratis); untuk stiker harga di kartu (B24)
  featured_product_id                            -- andalan aktif; dipakai kartu mini di sorotan
)

auth_otps(id, event_id, purpose, email_hash, code_hash, expires_at, attempts, created_at)
ticket_codes(event_id, code_hash, visitor_id, used_at)        -- mode ticket_code
invited_emails(event_id, email_hash)                          -- auto-approve (v2)
idempotency_keys(actor, key, route, body_hash, status, response_status, response_body, created_at, updated_at, PRIMARY KEY(actor, key))
                                                              -- updated_at dipakai mengambil alih "processing" yang menggantung > 60 dtk (B21)
                                                              -- data operasional sementara (TTL 24 jam), bukan log; lihat B21
-- TIDAK ada tabel log. Log aktivitas/audit → Workers Logs + Analytics Engine (B13).
-- Keputusan admin yang bersifat DATA (bukan log) disimpan sebagai kolom di entitasnya:
--   booths.reject_reason / approved_by / approved_at
--   reviews.moderated_by / moderated_at / moderation_reason / original_stars / original_comment
--   → nilai asli review tetap tersimpan walau admin menyuntingnya, jadi ada jejak "sebelum → sesudah"
--     yang tidak bergantung pada retensi log.
```

Catatan penting:
- Skor Bayesian **tidak disimpan**; dihitung dari `booth_stats` (murah) di server/DO.
- Edit review = hitung selisih bintang lama→baru lalu update `booth_stats` **dalam satu `batch()`** supaya konsisten.
- Review `held`/`hidden` **tidak dihitung** di `booth_stats` (saat dipulihkan/disembunyikan admin, statistik disesuaikan).
- Index: `reviews(event_id, created_at)`, `reviews(booth_id, status)`, `booths(event_id, status)`.
- Email booth disimpan asli (perlu untuk notifikasi) dan **boleh kosong** (booth tanpa pemilik, A16); email reviewer **hanya hash** (privasi + tetap bisa memeriksa "reviewer = akun booth").

## B7. Auth & akun per-event

**Booth** (passwordless):
- `POST /api/booth/otp/request` → kirim OTP 6 digit ke email → `.../verify`.
- Sesi = cookie `HttpOnly; Secure; SameSite=Lax` berisi token bertanda tangan dengan klaim `{ sub: boothId, eventId, role: "booth" }`. Karena `eventId` ada di klaim dan `UNIQUE(event_id, email)` di database, **akun tidak bisa dipakai di event lain**.
- *(Tahap 8) Sesi booth diimplementasikan sebagai cookie `booth_session` (`{sub, eid, eh, exp}`); `eh` dicocokkan dengan HMAC(`booths.email`) di D1 pada **setiap** permintaan (`owner_changed`). OTP login booth menjawab sama untuk email terdaftar atau tidak. Pendaftaran memakai cookie bukti email `booth_register` (30 menit) yang harus cocok dengan email di `POST /api/booth/register`. OTP booth lewat `/api/booth/otp/request|verify` dengan body `{ email, purpose: register|login }` (bukan dua rute terpisah).*
- *(Tahap 6) Sesi pengunjung diimplementasikan sebagai cookie `visitor_session` bertanda tangan HMAC (`{sub, eid, exp}`); identitas Google dan OTP sama-sama `HMAC(email terverifikasi)` (bukan `sub`) agar satu orang satu identitas lintas penyedia dan bisa dicocokkan dengan email booth. Sesi booth (portal) baru di Tahap 8.*
- Tidak ada password → tidak perlu hashing password, tidak ada reset password.
- Tindakan sensitif memeriksa status booth di D1 (mis. `suspended` langsung ditolak walau token masih berlaku).
- **Booth tanpa pemilik tidak punya login sama sekali**: OTP booth hanya dikirim ke email yang tercatat pada booth event aktif (`booths.email`); booth dengan `email NULL` tidak bisa dicapai lewat jalur ini. Admin mengelolanya lewat Cloudflare Access (di bawah).
- **Sesi booth terikat ke email saat login**: klaim token memuat `eh = HMAC(email)`. Setiap aksi tulis membandingkannya dengan `booths.email` di D1; bila admin melepas atau mengganti pemilik (email kosong atau berbeda), aksi ditolak `401 owner_changed` dan portal meminta login ulang. Isian yang belum tersimpan tetap ada di `localStorage`.

**Reviewer**:
- Google: Google Identity Services (One Tap) → verifikasi ID token di Worker → buat `visitor` dengan `identity_hash = HMAC(sub)`.
- Email OTP: sama dengan booth tetapi `purpose = "visitor"`.
- `ticket_code`: validasi kode, tandai terpakai, buat `visitor`.
- Sesi per-event, berlaku beberapa hari (`CONFIG.auth.sessionDays`).

**Admin**:
- Dilindungi **Cloudflare Access** pada `/admin/*` dan `/api/admin/*`. Worker memverifikasi header `Cf-Access-Jwt-Assertion` dan mencocokkan email dengan daftar admin. Tidak ada form login admin buatan sendiri = lebih sedikit celah.
  - **Konfigurasi** (rahasia/variabel, bukan di repo): `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` (dipisah koma). Verifikasi RS256 lewat Web Crypto: tanda tangan, `iss`, `aud`, `exp`/`nbf`; kunci publik dari `https://<tim>.cloudflareaccess.com/cdn-cgi/access/certs` (di-cache 1 jam, diambil ulang sekali bila `kid` tak dikenal = rotasi kunci).
  - **Gagal tertutup**: Access belum dikonfigurasi, token hilang/rusak, atau email tidak di daftar → `401`.
  - **Jalur pengembangan lokal** (`DEV_ADMIN_EMAIL` di `.dev.vars`) hanya aktif bila `APP_ENV = "development"` **dan** permintaan datang ke `localhost`/`127.0.0.1`; di host publik tidak pernah aktif walau variabelnya terisi. **Sebelum deploy, `APP_ENV` produksi harus bukan "development"** (Tahap 10).

## B8. Realtime yang hemat (jawaban pertanyaan 4)

**Kekhawatiran valid, tapi sumber masalah sebenarnya bukan "harga Cloudflare", melainkan *fan-out*:**
`N review × M penonton = N×M pesan`. Contoh: 60 review/menit × 500 penonton = 30.000 pesan/menit, dan makin parah saat lonjakan. Solusinya bukan membuang realtime, tapi **mengubah rumus jadi `tick × M`**: jumlah siaran ditentukan jam (mis. 1 siaran per 2,5 detik), **bukan jumlah review**.

### Opsi yang dipertimbangkan

| Opsi | Cara | Hemat | Terasa live | Kompleksitas |
|---|---|---|---|---|
| A. Polling + cache edge | Client `GET /api/snapshot` tiap 10–15 dtk; Worker cache respons 3–5 dtk (`s-maxage`) | ★★★★★ | Cukup | Rendah |
| B. SSE | Worker stream satu arah | ★★★ | Baik | Sedang (koneksi panjang di Worker) |
| C. **WebSocket di Durable Object + batching** | 1 DO per event, tick terkumpul | ★★★★ | **Terbaik** | Sedang |
| D. Layanan pihak ketiga (Pusher/Ably) | – | ★★ | Baik | Rendah, tapi vendor & biaya baru |

### Keputusan: **Hibrida A + C** (disetujui)

Opsi A (polling + cache edge) menjadi dasar untuk semua klien, dan opsi C (WebSocket di Durable Object) ditambahkan hanya untuk yang benar-benar butuh live.

- **Semua klien** memuat *snapshot* lewat HTTP (cache edge) → murah dan cepat.
- **Hanya klien yang butuh live** (halaman dashboard yang sedang terbuka & Mode Layar Besar) menyambung WebSocket ke DO.
- **Pengunjung yang hanya mengisi review tidak membuka WebSocket sama sekali.**
- Jika penonton melebihi `maxLiveViewers`, klien baru otomatis memakai polling (A) → degradasi halus, biaya terbatas.

### Detail opsi A: polling + cache edge

- Endpoint `GET /api/snapshot?since=<cursor>`.
- Worker memeriksa **Cache API** (`caches.default`) dulu. Saat *miss*, ia bertanya ke `LiveHub.snapshot()` (**memori DO, bukan D1**), lalu menyimpan hasilnya dengan `Cache-Control: public, s-maxage=5, stale-while-revalidate=10`.
- Cache bersifat **per lokasi edge**, jadi beban ke DO ≈ (jumlah lokasi aktif) × 1 permintaan per 5 detik, **tidak bergantung pada jumlah pengunjung**.
- Klien: interval `pollIntervalMs` (15 dtk) + *jitter* ±20% supaya tidak serentak; **berhenti saat tab tersembunyi**; memakai `ETag`/`If-None-Match` (balasan `304` sangat kecil); `since` = id review terakhir sehingga feed hanya membawa item baru; *backoff* saat error.

Pembagian mode per halaman:

| Halaman | Mode |
|---|---|
| Mode Layar Besar | WebSocket (**slot dijamin** lewat `reservedScreenSlots`) |
| Dashboard publik (tab aktif) | WebSocket bila slot tersedia, jika tidak → polling |
| Daftar booth, profil booth, hasil | Polling |
| Form review / tujuan QR | Tanpa realtime (ambil data sekali) |
| Portal booth, halaman admin | Polling 10–30 dtk |

**Setelah event selesai:** DO berhenti menjalankan tick dan menutup semua WebSocket (`event_ended`); snapshot di-cache lebih lama (`snapshotTtlSecAfterEnd`) dan klien polling jarang. Perubahan oleh admin tetap tampil segera karena kunci cache memuat `stats_version` (B17).

Kode klien realtime (`features/live`) hanya diimpor oleh area `event` dan `screen`, tidak ikut terkirim ke area booth/admin (B16).

### Status implementasi (Tahap 7, menyimpang dari sketsa di bawah)

Hal-hal berikut berbeda dari rancangan awal dan **berlaku** (alasan di `docs/DECISIONS.md`):

- **Snapshot dilayani dari cache edge + D1, bukan dari memori DO.** Semua rute publik lewat `edgeJson` (Cache API; kunci memuat `activeVersion/statsVersion/resultsVersion`; ETag/304; TTL 5 dtk saat live, 60 dtk setelah selesai). DO hanya menyiarkan delta.
- **`hello` tanpa snapshot**: klien mengambil snapshot lewat HTTP (cache), lalu WebSocket hanya membawa tick delta. Tidak ada pesan `leader_changed` terpisah: pergantian pemimpin ikut di dalam tick.
- **Satu pembacaan D1 per tick** (`services/live.ts: loadLiveInput`) untuk seluruh penonton; `LiveCore` (murni) menghitung delta.
- **Refresh langsung**: aksi admin (jadwal, mode, hasil, reveal) memanggil `notifyLive(…, fresh)`; DO membaca ulang segera dengan throttle 1 dtk (bukan menunggu tick).
- **Setelah event selesai**: soket `viewer` ditutup (alarm akhir event) dan penonton biasa ditolak `event_ended`; **soket `screen` tetap tersambung** agar Layar Besar menerima animasi pemenang yang diputar admin.
- **Animasi pemenang** membaca hasil beku (`results_json`, `results_version`), bukan `reveal_json`; pemicu = `reveal_seq`/`reveal_started_at` + target `screen|everyone`.
- `GET /spotlight` (ulasan pilihan) **belum dibuat**; Layar Besar memakai Sorotan dari snapshot.

### Data spotlight (foto & ulasan pilihan)

Snapshot yang di-poll tetap **kecil**: per booth hanya `id`, nama, rating, jumlah ulasan, peringkat, dan **kunci foto sampul (thumb)**. Detail spotlight (semua foto `full` + 1–2 ulasan pilihan) diambil lewat `GET /api/booths/:id/spotlight`, di-cache edge (±30 detik, kunci memuat `stats_version`) dan di-**prefetch untuk giliran berikutnya**, jadi tidak membebani snapshot dan tidak mengunduh foto booth yang tak sedang disorot. Ulasan pilihan dihitung dari aturan `CONFIG.spotlight` (hanya ★4–5, komentar ≥ 30 karakter, `visible`, `pinned` dulu); fotonya dimuat dari `MEDIA_BASE_URL` (CDN, B15) dengan `loading="lazy"`.

### Mekanisme hemat di Durable Object

1. **Batching per tick.** Review masuk hanya menandai state "kotor"; `alarm()` berjalan tiap `tickMs` (2,5 dtk), menyusun **satu** pesan delta, dan menyiarkannya. Tidak ada review → tidak ada alarm → DO bisa tidur.
2. **Kirim delta, bukan seluruh data.** Pesan berisi: booth yang statistiknya berubah (id + count + avg), perubahan peringkat, hingga `maxFeedItemsPerTick` review (komentar dipotong ±140 karakter), dan ringkasan `+N ulasan lagi`.
3. **Kejadian langka disiarkan segera**: pergantian peringkat #1 (`leader_changed`) langsung dikirim, tidak menunggu tick.
4. **WebSocket Hibernation API** (`ctx.acceptWebSocket`) + `setWebSocketAutoResponse` untuk ping/pong → DO tidak terbangun hanya untuk keep-alive, dan tidak ditagih durasi saat idle.
5. **Spotlight & rotasi = 0 beban server** (lihat bawah).
6. **Tab tersembunyi = putuskan koneksi** (`visibilitychange`), sambung ulang + ambil snapshot saat kembali.
7. **State DO bisa dibangun ulang** dari `booth_stats` + beberapa review terakhir di D1 pada saat bangun (`blockConcurrencyWhile`), sehingga hibernasi/restart aman.
8. **Pembacaan D1 tidak dikalikan jumlah penonton**: penonton dilayani dari memori DO atau cache edge, bukan query D1 per klien.

Sketsa DO:

```ts
export class LiveHub extends DurableObject<Env> {
  private dirtyBooths = new Set<string>();
  private feedBuffer: ReviewPreview[] = [];

  async ingest(evt: ReviewEvent) {              // dipanggil Worker setelah D1 sukses
    this.applyToMemory(evt);                    // update agregat & peringkat di memori
    this.dirtyBooths.add(evt.boothId);
    this.feedBuffer.push(evt.preview);
    if (this.leaderChanged()) this.broadcast({ t: "leader_changed", ...this.leader() });
    if (!(await this.ctx.storage.getAlarm())) {
      await this.ctx.storage.setAlarm(Date.now() + CONFIG.live.tickMs);
    }
  }

  async alarm() {
    const delta = this.buildDelta();            // booth berubah + peringkat + feed (dipotong) + "+N"
    if (delta) this.broadcast({ t: "tick", ...delta });
    this.dirtyBooths.clear(); this.feedBuffer = [];
  }
}
```

Protokol pesan (kecil dan ringkas):

```
server → client:  hello{snapshot} | tick{boothDeltas, ranks, feed[], more} | leader_changed{boothId,...} | event_status{...}
client → server:  (hampir tidak ada; hanya ping otomatis)
```

### Spotlight bergantian tanpa beban server

Rotasi ditentukan **deterministik di client** dari waktu server + seed event, sehingga semua layar menyorot booth yang sama pada saat yang sama, tanpa satu pesan pun dari server:

```ts
const slot  = Math.floor((serverNow() - event.votingStartMs) / CONFIG.live.spotlightMs);
const round = Math.floor(slot / booths.length);
const order = seededShuffle(boothIds, hash(event.seed, round));   // adil: semua dapat giliran per putaran
const spotlight = order[slot % booths.length];
```

`serverNow()` = waktu lokal + selisih dari header `Date` respons snapshot. Opsi pembobotan (booth yang review-nya sedikit lebih sering) dapat dihitung dari snapshot yang sama.

### Perkiraan beban (patokan kasar, **verifikasi dengan pricing terbaru**)

- Pesan keluar WebSocket dari DO tidak ditagih per pesan; yang ditagih adalah request masuk (WebSocket masuk dihitung dengan rasio besar) dan **durasi aktif DO**.
- Acara 8 jam dengan 1 DO aktif terus ≈ 3.600 GB-detik (128 MB) → ordenya sen/dolar kecil per event.
- Beban nyata ada di **Worker requests & D1 writes**. Satu review ≈ 3–4 row writes → 5.000 review ≈ 15–20 ribu row writes (kecil).
- Kuota gratis Workers (request/hari) bisa **terlewati oleh polling pengunjung** → disarankan **Workers Paid (±$5/bulan)** selama periode event sebagai asuransi.

**Wajib dilakukan sebelum hari-H:** uji beban (k6/skrip) dengan simulasi ±500 WebSocket + lonjakan 100 review/menit untuk memastikan `tick` dan batas viewer bekerja.

## B9. Implementasi anti-spam

Berlapis (implementasi dari A6):

| Lapis | Implementasi |
|---|---|
| Bot | **Turnstile** pada submit review & request OTP; token diverifikasi di Worker (`siteverify`) |
| Identitas | Sesi per-event: Google / OTP / `ticket_code` sesuai `reviewer_auth_mode` |
| Duplikasi | `UNIQUE(booth_id, visitor_id)`; submit ke-2 = **update**, bukan insert |
| Booth menilai diri | Saat membuat sesi visitor, bandingkan `identity_hash` dengan `booths.email` yang di-hash (HMAC yang sama) di event itu → tolak/tandai. Booth dengan `email NULL` (tanpa pemilik) dilewati: tidak ada identitas yang dibandingkan |
| Akses langsung | Link review memuat `?k=<HMAC(boothId,eventId)>` yang dicetak di QR; tanpa `k` valid, review via URL tebakan ditolak (mode `qr_required`) |
| Rate limit | Per visitor (counter di DO/D1) + per IP-hash + **Workers Rate Limiting binding**. OTP: batasi per email & per IP (cegah *email-bombing* sekaligus biaya email) |
| Jangan andalkan IP | WiFi kampus = satu IP bersama. IP/UA hanya dipakai sebagai **sinyal** (hash), bukan pemblokir mutlak |
| Anomali | Skor risiko per review (di bawah) → status `held` + masuk antrean moderasi |
| Peringkat | Bayesian (A7) meredam efek review sedikit tapi ekstrem |
| QR dinamis (v2) | Token `HMAC(boothId, floor(now/60s))` ditampilkan sebagai QR di layar portal booth; server menerima token jendela waktu saat ini ±1 |

Sinyal risiko (contoh, dijumlah jadi `risk_score`; ambang di `config.ts`):
- Lonjakan: > `burstThresholdPerBoothPerMin` review untuk satu booth per menit.
- Banyak review dari `ip_hash`/`ua_hash` yang sama ke booth yang sama.
- Akun visitor baru (< beberapa detik sejak dibuat) langsung memberi bintang 5 tanpa komentar.
- Pola sabotase: bintang 1 ke satu booth dan bintang 5 ke booth tertentu secara konsisten dari identitas yang sama.
- Komentar mengandung kata terlarang: ditangani **filter kata** terpisah (A15, B25) yang menahan **teks komentar** saja (`comment_status`), tanpa membuang bintang. Hasil filter hanya menambah sedikit skor risiko; tidak menahan seluruh review.

*(Status Tahap 6: terimplementasi Turnstile, identitas, `UNIQUE(booth_id, visitor_id)`, cek booth menilai diri, rate limit per visitor (memori), skor risiko (lonjakan, IP sama, akun baru bintang 5, pola sabotase, filter) → `held`. **Belum**: tautan `?k=` (`qr_required`), Workers Rate Limiting binding/DO yang tegas, QR dinamis.)*

Review `held` **tidak muncul di feed dan tidak dihitung** sampai admin menyetujui; reviewer tetap melihat "review kamu terkirim" (tanpa memberi tahu bahwa ia ditahan, supaya pelaku tidak mudah mengakali).

## B10. Daftar API

```
# Semua POST/PUT/PATCH/DELETE menerima header Idempotency-Key (B21)

Publik
GET  /api/event                       info event + tema + jadwal + kategori ulasan aktif + serverNow (cache edge singkat)
GET  /api/snapshot              leaderboard, statistik, feed terakhir (cache edge 3–5 dtk)
GET  /api/booths                daftar booth (filter/urut)
GET  /api/booths/:id            profil booth + galeri foto + distribusi bintang + review (paginasi)
GET  /api/booths/:id/spotlight  foto full (`[]` bila tanpa foto; prefetch gambar dilewati) + ulasan pilihan + produk andalan (`null` bila tidak ada) (cache edge, prefetch giliran berikutnya)
GET  /api/booths/:id/products   semua produk aktif booth (maks. sesuai batas event, bawaan 24, ±6 KB; satu respons, "tampilkan lebih banyak" dilakukan di client; menyertakan `hasWhatsapp: true|false`, TANPA nomor); cache edge
GET  /go/wa/:boothId?p=:pid     pengalihan 302 ke https://wa.me/<nomor>?text=<pesan terisi>; nomor hanya diketahui server (B24); dibatasi laju, tidak di-cache, ditolak setelah event selesai
GET  /ws                        upgrade WebSocket → LiveHub

# Status implementasi Tahap 5: sudah ada /api/event, /api/snapshot (booth tayang + statistik; sementara dibaca dari D1, cache edge/LiveHub di
# Tahap 7), /api/booths/:id (tanpa daftar ulasan; ulasan menyusul di Tahap 6), /api/booths/:id/products, dan /go/wa. Sorotan memakai
# `coverKey` + andalan ringkas dari snapshot, jadi /api/booths dan /api/booths/:id/spotlight belum dibuat (spotlight baru perlu bila ulasan
# pilihan ikut ditampilkan). Halaman `/` dan `/b/:id` dilayani Worker (pratinjau tautan), bukan langsung oleh aset statis.

Auth
POST /api/booth/otp/request     | /verify | /logout
POST /api/visitor/google        | /otp/request | /otp/verify | /ticket
POST /api/booth/register        (setelah OTP valid) simpan profil → status pending; 403 `registration_closed` bila sudah ditutup

Reviewer
POST /api/booths/:id/review     upsert review (Turnstile + sesi)
GET  /api/me/reviews            booth yang sudah kubuat nilai
POST /api/reviews/:id/report    pengunjung melaporkan komentar (sesi + Turnstile; satu laporan per komentar)

# Status implementasi Tahap 8: semua rute Booth di bawah sudah ada, dengan penyesuaian: GET /api/booth/me mengembalikan { me | null, turnstileSiteKey }
# (null = belum masuk); PUT /api/booth/me skema strict; tambahan POST /api/booth/resubmit, GET /api/booth/reviews, GET/DELETE /api/booth/photos[/:pid],
# PUT /api/booth/photos/order, DELETE /api/booth/logo, POST /api/booth/media, DELETE /api/booth/products/:pid/photo, POST /api/admin/e/:id/booths/:bid/invite.

Booth
GET  /api/booth/me              profil + statistik + review
PUT  /api/booth/me              edit profil
PUT  /api/booth/media?kind=logo|photo|product&size=full|thumb    unggah gambar WebP hasil konversi client (→ R2), lihat B15
GET  /api/booth/products                 produk milik booth (termasuk yang disembunyikan)
POST /api/booth/products                 tambah (409 `product_limit` bila sudah 24; pengecekan atomik, B24)
PATCH/DELETE /api/booth/products/:pid    ubah / hapus
PUT  /api/booth/products/order           urutan: [pid, …]
PUT  /api/booth/products/:pid/featured   jadikan andalan (andalan lama otomatis dilepas dalam satu batch)
PUT  /api/booth/whatsapp                 isi/ubah/hapus nomor WhatsApp (body: { number, consent }); dinormalisasi ke format 62…; hapus = whatsapp_e164 NULL
POST /api/booth/reviews/:id/report      booth melaporkan komentar (alasan + catatan); dibatasi laju per booth; TIDAK menyembunyikan apa pun (A15)

Admin (di balik Cloudflare Access)
POST/PUT /api/admin/events              buat/ubah event, tema, pengaturan (termasuk `maxProducts`, 1–`maxProductsHardCap`), jadwal (divalidasi Zod + aturan B17)
POST /api/admin/events/:id/close-registration   pintasan: set registration_close_at = sekarang
POST /api/admin/events/:id/publish-results      set results_published_at, ranking tampil, putar animasi pemenang
PUT  /api/admin/events/:id/ranking-mode         visible | hidden | on_results
PUT  /api/admin/events/:id/ratings-mode         visible | hidden | on_results (moderasi rating)
POST /api/admin/events/:id/refresh-results      bekukan ulang hasil akhir setelah admin menyunting review
POST /api/admin/events/:id/reveal               putar (ulang) animasi pemenang; body { target: "screen" | "everyone" }
GET  /api/admin/e/:id/booths            antrean + aksi approve/reject/revision/suspend
GET  /api/admin/e/:id/data/:entity      Data Grid: entity = booths | products | reviews | visitors | ranking; query: cursor, limit, sort, filters, q (semua divalidasi whitelist kolom/operator)
PATCH /api/admin/e/:id/data/bulk        simpan banyak perubahan sekaligus: [{ entity, id, field, value, version }] + SATU `reason`; maks. 100 perubahan; konflik versi → 409 per baris
GET  /api/admin/e/:id/data/:entity/export?format=csv|xlsx   ekspor (CSV di-stream dengan cursor)
GET  /api/admin/e/:id/history/:entity/:id   riwayat satu baris (original_* + entri log)
GET  /api/admin/e/:id/moderation/reports        antrean laporan + komentar ditahan filter (urut: SARA/data pribadi, jumlah pelapor); termasuk tanda "pelaporan mencurigakan"
POST /api/admin/e/:id/moderation/reports/:rid   putuskan: upheld | dismissed (+ tindakan: hide_comment | hide_review | restore | lock); wajib `reason`
PATCH /api/admin/e/:id/reviews/:rid/comment     ubah comment_status (visible | masked | held | hidden); wajib `reason`; bintang tidak berubah
GET/PUT /api/admin/e/:id/moderation/terms       daftar kata: lihat, tambah/ubah/nonaktifkan istilah (block/allow, tingkat); menaikkan filter_version; ada pengujian cepat ("uji kalimat ini")
GET  /api/admin/e/:id/reviews           SEMUA review (filter booth/bintang/status/pengunjung; termasuk held/hidden)
PATCH /api/admin/e/:id/reviews/:rid     sunting bintang/komentar/status — wajib `reason`; simpan original_*; hitung ulang booth_stats (batch D1)
DELETE /api/admin/e/:id/reviews/:rid    hapus (wajib `reason`)
POST /api/admin/e/:id/reviews/:rid/restore   pulihkan yang disembunyikan/ditahan
POST /api/admin/e/:id/booths            buat booth (A16): { name (wajib), boothNo?, email?, tagline?, description? }; selalu langsung `approved`; created_by = admin, is_late = 0; 409 `email_in_use`; tidak terkena penutupan pendaftaran maupun `eventWriteGate`
POST /api/admin/e/:id/booths/import     impor massal (MVP): body JSON { rows: [{ name, boothNo?, email?, tagline?, description? }] } hasil parsing CSV di client; maks. `CONFIG.booths.csvMaxRows`; validasi ulang di server; hasil per baris (created | skipped | error); Idempotency-Key (B26)
PATCH /api/admin/e/:id/booths/:bid      sunting profil/status booth (alasan wajib bila booth berpemilik aktif)
PUT  /api/admin/e/:id/booths/:bid/owner  { email | null }: tambah, ganti, atau lepas pemilik; mengganti/melepas membuat sesi lama tidak sah (B7)
POST /api/admin/e/:id/booths/:bid/invite kirim email undangan ke /booth (opsional, dibatasi laju); mengisi email saja tidak mengirim apa pun
POST /api/admin/e/:id/booths/:bid/media?kind=photo|logo|product[&productId=]   unggah gambar atas nama booth. **Satu permintaan multipart berisi `full` dan `thumb`** (bukan dua PUT terpisah seperti rancangan awal B15): atomik, satu Idempotency-Key, satu validasi. Aturan B15 sama. Batas isi diterapkan saat membaca (bodyLimit), bukan hanya dari header
GET  /api/admin/e/:id/booths/:bid/photos                    daftar foto galeri (posisi 0 = sampul)
DELETE /api/admin/e/:id/booths/:bid/photos/:pid             hapus foto + kedua objek R2, nomor ulang
PUT  /api/admin/e/:id/booths/:bid/photos/order              { ids: [...] } urutan lengkap; yang pertama menjadi sampul
DELETE /api/admin/e/:id/booths/:bid/logo                    hapus logo
DELETE /api/admin/e/:id/booths/:bid/products/:pid/photo     hapus foto produk
GET  /media/*                                               penyaji gambar cadangan dari R2 (dev lokal atau bila domain kustom bermasalah); hanya ruang nama `events/`, 404 polos bila tak ada
GET/POST/PATCH/DELETE/PUT /api/admin/e/:id/booths/:bid/products[...]   kelola produk atas nama booth; handler yang sama dengan /api/booth/products, hanya `boothId` diambil dari path (dan peran admin), bukan dari sesi
PUT  /api/admin/e/:id/booths/:bid/whatsapp   { number, consentConfirmedByAdmin: true }; disimpan dengan whatsapp_consent_by = admin
GET  /api/admin/e/:id/visitors          pengunjung (hash) + blokir/buka blokir
POST /api/admin/events/:id/archive      arsipkan event
# (Poster QR di /admin/e/:id/posters dibuat murni di klien; rute GET /api/admin/e/:id/qr tidak dibuat)
GET  /api/admin/e/:id/results           hasil + export CSV
PUT  /api/admin/e/:id/review-categories   kelola kategori ulasan (tambah/ganti nama/urut/nonaktifkan)
PUT  /api/admin/e/:id/media             unggah banner/logo event (WebP, aturan sama dengan B15)
GET  /api/admin/e/:id/logs              log aktivitas (query Analytics Engine, tanpa D1) — filter: rentang, kategori, level, actor
```

## B11. Keamanan & privasi

- **Validasi Zod** di setiap endpoint; sanitasi teks komentar (render sebagai teks, bukan HTML) → cegah XSS.
- **CSRF**: cookie `SameSite=Lax` + cek `Origin` pada request mutasi.
- **Upload gambar**: client mengonversi ke WebP, **server tetap memvalidasi** (hanya `image/webp`, cek magic bytes `RIFF…WEBP`, batas byte & dimensi, nama acak di R2). Rinciannya di B15.
- **Isolasi event**: setiap query wajib menyertakan `event_id`; middleware mengambil `eventId` dari klaim sesi, bukan dari input klien.
- **Privasi (UU PDP)**: kumpulkan seminimal mungkin; email reviewer hanya hash; tampilkan alias/nama depan; teks persetujuan singkat saat login; kebijakan retensi (mis. anonimkan data visitor N hari setelah event ditutup); admin dapat menghapus data.
- **Aksi ganda** (klik dua kali, jaringan buruk, dua tab) dicegah di tiga lapis: tombol ber-loader, `Idempotency-Key`, dan batasan unik di database (B21).
- **Rahasia** hanya di `wrangler secret`; rotasi kunci HMAC didukung dengan menyimpan `kid`.
- **Log aktivitas** untuk semua aksi admin dan kejadian keamanan (B13), tanpa menyimpan data pribadi mentah (email/IP) di log.
- **Header keamanan** (CSP yang mengizinkan Turnstile/Google, `X-Content-Type-Options`, `Referrer-Policy`).

## B12. Biaya, deploy, observability, testing

**Biaya:** skala khas (±30–100 booth, ratusan–ribuan pengunjung) sangat kecil di Cloudflare. Satu-satunya risiko kuota adalah request Worker dari polling di paket gratis → gunakan **Workers Paid** selama event. Tetapkan alarm penggunaan/anggaran di dashboard Cloudflare.

**Deploy:**
- Dua lingkungan: `staging` dan `production` (D1, R2, DO terpisah).
- Migrasi D1 via Drizzle + `wrangler d1 migrations apply`.
- CI (GitHub Actions): typecheck → lint (termasuk `lint-tokens`) → test → `wrangler deploy`.
- **Domain: `eventunimed.id`** (sudah di Cloudflare, tidak perlu pindah DNS):

  | Host | Untuk apa |
  |---|---|
  | `eventunimed.id` (atau `expo.eventunimed.id`) | Aplikasi: Worker (SPA + `/api/*` + `/ws/*`), satu host agar cookie & CSRF sederhana |
  | `media.eventunimed.id` | **Custom Domain bucket R2** untuk gambar (B15), tanpa cookie |

  Hostname yang sama juga harus didaftarkan di Turnstile, Google Identity (authorized origins), Cloudflare Access (`/admin/*`), dan sebagai domain pengirim email (SPF/DKIM) bila memakai penyedia email.

**Observability hari-H:** Workers Logs, grafik request/error, dan satu halaman admin "kesehatan" (jumlah WebSocket aktif, review/menit, jumlah `held`). Siapkan *runbook* singkat: mematikan WebSocket (paksa polling), menutup voting darurat, memblokir visitor.

**Testing:**
- Unit: `scoring.ts` (Bayesian, tie-break), skor risiko, validasi.
- Integrasi Worker/D1/DO: `vitest` + `@cloudflare/vitest-pool-workers`.
- E2E alur utama (daftar booth → approve → review → tampil di dashboard): Playwright.
- **Gladi resik beban** 1–2 minggu sebelum acara (lihat B8).

## B13. Sistem log tanpa database

**Jawaban singkat: ya, Cloudflare punya, dan tidak ada yang memakai D1.** Ada beberapa lapisan, masing-masing cocok untuk kebutuhan berbeda:

| Lapisan | Cara menulis | Cara membaca | Retensi | Cocok untuk |
|---|---|---|---|---|
| **Workers Logs** | Otomatis untuk tiap request + `console.log()` | Dashboard Cloudflare (Observability): filter & cari | 3 hari (Free) / 7 hari (Paid) | Debug teknis, error, stack trace |
| **Workers Analytics Engine (AE)** | `env.LOG.writeDataPoint(...)` (binding, tanpa skema/migrasi) | **SQL API (HTTP)** → dipanggil Worker kita → **tampil di halaman admin** | 3 bulan | **Log aktivitas di admin**, kejadian spam, statistik |
| **Tail Worker / Logpush → R2** | Otomatis meneruskan log ke bucket R2 (file NDJSON) | Unduh/baca file dari R2 | Selama kamu simpan | Arsip jangka panjang / bukti, opsional |
| **Cloudflare Access logs** | Otomatis | Dashboard Zero Trust | Cek di docs (sekitar 30 hari) | "Siapa yang masuk ke /admin" |

### Rekomendasi: satu pintu, dua tujuan

Semua kode memanggil **satu fungsi `logEvent()`**. Fungsi itu menulis ke dua tempat sekaligus: `console.log(JSON)` → Workers Logs (untuk debug di dashboard Cloudflare) dan `writeDataPoint` → AE (untuk halaman admin kita). Tidak ada kode lain yang boleh memanggil `console.log`/`writeDataPoint` langsung, sehingga format selalu seragam dan mudah diubah di satu tempat.

```jsonc
// wrangler.jsonc
"analytics_engine_datasets": [{ "binding": "LOG", "dataset": "booth_favorit_logs" }],
"observability": { "enabled": true, "head_sampling_rate": 1 }
```

```ts
// src/shared/log-events.ts — SATU sumber daftar; dipakai logger DAN dropdown filter di UI
export const LOG_CATEGORIES = ["auth", "booth", "review", "spam", "admin", "system"] as const;
export const LOG_LEVELS = ["info", "warn", "error"] as const;
export const LOG_ACTIONS = [
  "auth.otp_requested", "auth.otp_failed", "auth.login",
  "booth.registered", "booth.approved", "booth.rejected", "booth.suspended",
  "review.created", "review.updated", "review.held", "review.hidden", "review.restored",
  "review.comment_held", "review.comment_masked", "review.reported", "moderation.report_decided", "moderation.terms_changed",
  "spam.turnstile_failed", "spam.rate_limited", "spam.burst_detected",
  "admin.schedule_changed", "admin.results_published", "admin.visitor_blocked",
  "admin.review_edited", "admin.review_deleted", "admin.booth_edited", "admin.event_archived", "admin.data_exported", "admin.visitor_edited", "admin.ranking_mode_changed", "admin.ratings_mode_changed", "admin.reveal_played", "admin.results_refreshed",
  "booth.registered_late", "event.write_blocked_ended", "system.idempotent_replay", "system.request_in_progress",
  "system.error", "live.viewer_limit_reached",
] as const;

// src/worker/lib/logger.ts
export function logEvent(c: Context, e: LogEvent) {
  const level = e.level ?? "info";
  console.log(JSON.stringify({ ...e, level, requestId: c.get("requestId") }));      // → Workers Logs
  c.env.LOG.writeDataPoint({                                                          // → Analytics Engine
    indexes: [e.eventId],                                                             // index1 = event (kunci sampling & filter)
    blobs:   [e.category, e.action, level, e.actor?.type ?? "", e.actor?.id ?? "",
              e.target?.type ?? "", e.target?.id ?? "", (e.msg ?? "").slice(0, 200),
              JSON.stringify(e.meta ?? {}).slice(0, 2000), c.get("requestId")],
    doubles: [e.num?.latencyMs ?? 0, e.num?.risk ?? 0],
  });
}
// pemakaian:  logEvent(c, { eventId, category: "booth", action: "booth.rejected",
//                           actor: { type: "admin", id: adminId }, target: { type: "booth", id }, msg: reason });
```

Pemetaan kolom AE (tetap, didokumentasikan di satu tempat):

| Kolom | Isi |
|---|---|
| `index1` | `event_id` |
| `blob1`–`blob3` | category · action · level |
| `blob4`–`blob5` | actor type · actor id (admin / booth / visitor / system) |
| `blob6`–`blob7` | target type · target id |
| `blob8` | pesan singkat (≤ 200 karakter) |
| `blob9` | `meta` JSON kecil (mis. `{ risk, flags }`) |
| `blob10` | request id |
| `double1`–`double2` | latensi (ms) · skor risiko |
| `timestamp` | otomatis oleh AE |

### Menampilkan di admin

`GET /api/admin/e/:id/logs` → Worker memanggil **AE SQL API** (token API read-only + account id disimpan sebagai `wrangler secret`) lalu mengembalikan JSON ke UI.

```sql
SELECT timestamp, blob1 AS category, blob2 AS action, blob3 AS level,
       blob4 AS actor_type, blob5 AS actor_id, blob6 AS target_type, blob7 AS target_id, blob8 AS msg
FROM booth_favorit_logs
WHERE index1 = '<eventId>'
  AND timestamp > NOW() - INTERVAL '1' DAY      -- batas bawah waktu wajib
  AND blob3 IN ('warn','error')
ORDER BY timestamp DESC
LIMIT 100
```

Aturan:
- **Query dibangun hanya dari nilai yang sudah divalidasi whitelist** (UUID `eventId`, kategori/level dari `log-events.ts`, rentang waktu dari pilihan tetap). Jangan pernah menyambung input mentah ke string SQL.
- Hasil di-cache singkat (`Cache-Control: private, max-age=10` pada respons Worker) agar admin yang menyegarkan berkali-kali tidak menghabiskan kuota baca; bila secret AE belum diatur, server menjawab `{ configured: false, entries: [] }`.
- UI halaman Log (`/admin/e/:id/logs`, B14): filter rentang waktu/kategori/level/aksi/aktor/target, tabel, badge level, auto-refresh **polling 15 detik** (tidak perlu WebSocket), dan tombol ekspor CSV untuk tampilan saat ini.
- Siapa yang bisa melihat: hanya admin (di balik Cloudflare Access).

### Keterbatasan yang perlu diketahui

- **Retensi terbatas**: AE ±3 bulan, Workers Logs 3/7 hari. Kalau LPPM butuh bukti yang disimpan lebih lama, tambahkan **Tail Worker → R2** (arsip NDJSON per hari). Ini tetap bukan database.
- **AE bukan penghitung akurat**: data bisa muncul beberapa detik terlambat dan pada volume besar dapat di-*sampling*. Angka yang harus tepat (jumlah review, skor) tetap dari `booth_stats` di D1; AE hanya untuk jejak aktivitas dan tren.
- **Append-only**: entri tidak bisa diedit atau dihapus satu per satu. Karena itu **jangan menulis data pribadi** (email, IP mentah) ke log; cukup ID dan hash.
- **Harga/kuota**: Workers Logs ada kuota harian/bulanan (Free 200 ribu event/hari; Paid 20 juta/bulan, per laman docs saat ini). Halaman harga AE menyatakan saat ini belum ditagih tapi akan ditagih, dan angkanya berbeda di antara salinan docs, jadi **cek pricing resmi sebelum event**. Turunkan `head_sampling_rate` jika log otomatis terlalu ramai.
- **Detail endpoint** untuk membaca Workers Logs lewat API belum saya verifikasi; rencana ini tidak bergantung padanya (log teknis dilihat di dashboard Cloudflare, log aktivitas lewat AE).

## B14. Arsitektur berbasis komponen

Tujuan: ubah satu komponen → semua tempat yang memakainya ikut berubah; tema dan teks bisa diganti tanpa berburu salinan markup.

### Lapisan (satu arah: bawah tidak boleh mengimpor atas)

```
tokens (theme.css, config.ts)
   └─► ui/        primitif generik, tanpa pengetahuan domain      (Button, Badge, Chip, Card, Modal, Toast, DataTable, FormField, Skeleton, EmptyState)
        └─► shared/   komponen domain dipakai banyak fitur         (RatingStars, BoothCard, ReviewItem, LeaderboardRow, StatTile, ImageUploader) — hanya yang dipakai ≥ 2 area
             └─► areas/<area>/features/   rakitan + hook data per fitur   (dashboard, review-flow, booth-portal, admin-*)
                  └─► pages/   tipis: hanya menyusun feature + routing   ← semuanya hidup di areas/<home|event|admin|booth|screen> (B16)
```

### Aturan wajib

1. **Komponen tampilan murni**: hanya menerima props, tidak `fetch` sendiri. Data diambil di hook (`useLeaderboard`, `useLogs`) atau container di `features/`.
2. **Variasi lewat prop, bukan salin-tempel**: `variant`/`size`/`tone` memakai `cva`, kelasnya hanya token (B4). Bagian yang berubah-ubah dibuka lewat *slot* (`actions`, `header`, `footer`).
3. **Aturan dua**: markup yang muncul di ≥ 2 tempat wajib diekstrak ke `components/`.
4. **Tiga keadaan selalu ditangani** di dalam komponen/wrapper: loading (`Skeleton`), kosong (`EmptyState`), error (`ErrorState`).
5. **Aksesibilitas ditanam sekali** di komponen (mis. `RatingStars` = radiogroup yang bisa dioperasikan keyboard), bukan diulang di tiap halaman.
6. **Teks UI di satu tempat** (`lib/copy.ts`) → mudah diubah/di-i18n.
7. **Satu sumber definisi**: `config.ts`, `schemas.ts`, `log-events.ts` dipakai UI dan server, sehingga dropdown filter, validasi, dan logger tidak bisa berselisih.
8. **Galeri komponen** `/dev/components` (hanya mode dev) memajang tiap komponen × semua varian × tema (light / dark / festival). Mengubah satu komponen langsung terlihat dampaknya di semua varian.

### Katalog komponen & tempat pakainya

| Komponen | Varian utama | Dipakai di |
|---|---|---|
| `RatingStars` | `mode: input \| display`, `size` | form review, kartu booth, profil booth, live feed, moderasi |
| `BoothCard` | `hero \| spotlight \| card \| row \| compact \| admin` (`card` = kartu ala Google Maps untuk daftar semua booth). **Semua varian tahan data kosong** (foto, nomor, teks): bingkai, hanya-teks, atau hilang sesuai tabel A16 | dashboard (hero/spotlight), daftar booth, leaderboard, antrean verifikasi admin, layar besar |
| `PhotoGallery` | `autoplay`, `dots`, `swipe` | spotlight, profil booth, dialog review (sampul), pratinjau di antrean admin |
| `RatingSummary` | `4,7 ★★★★★ (24)`, bintang terisi sebagian; menampilkan "Rating disembunyikan" bila bidang rating tidak ada (`ratings_mode`) | semua kartu booth, spotlight, hero, profil, leaderboard |
| `TopReviews` | `count`, aturan dari `CONFIG.spotlight` | spotlight, kartu booth (kutipan 2 baris), profil booth |
| `ReviewItem` | `feed \| profile \| moderation` | live feed, profil booth, portal booth, antrean moderasi |
| `LeaderboardRow` | `size`, `showDelta` | bagian 03 halaman event (peringkat saat event berlangsung), layar besar (panel terakhir) |
| `ResultsList` | juara **1, 2, 3 masing-masing berbingkai berbeda** (1 terbesar dengan garis hijau tebal, 2 dan 3 sedang dengan garis berbeda nada); peringkat 4 dan seterusnya baris **seragam**; **semua baris menampilkan rata-rata ★ (jumlah ulasan), skor, dan tag ulasan teratas dengan jumlahnya** | layar akhir `WinnerReveal`, bagian hasil di halaman hanya-baca, `/results` |
| `RankingSection` | merender `null` bila `ranking_mode` menyembunyikan / data peringkat tidak ada | halaman event (bagian 03), layar besar |
| `WinnerReveal` | `mode: live \| replay` (replay = otomatis tiap halaman event dibuka setelah hasil diumumkan; ada Lewati, "Lihat halaman", dan opsi "jangan putar lagi di perangkat ini"); lapisan layar penuh: 3-2-1 → juara 3, 2, 1 → `ResultsList` (seluruh booth); patuh pada gaya gerak | layar besar, halaman event (bila `target = everyone`), pratinjau di panel admin |
| `StatTile` / `Sparkline` | `tone` | dashboard, layar besar, portal booth, admin |
| `Badge` / `Chip` | `tone: primary \| accent \| muted \| danger` | lencana booth, status booth/review, tag cepat, level log |
| `DataTable` (generik) | kolom didefinisikan per pemakaian | antrean booth, moderasi review, **LogViewer**, hasil/ekspor |
| `DataGrid` *(khusus `areas/admin`)* | `entity: booths \| products \| reviews \| visitors \| ranking`; kolom + editor sel dari definisi | halaman Data ala Excel (B18) |
| `WriteAction` + `ReadOnlyBanner` | – | membungkus setiap tombol/form yang mengubah data; otomatis menonaktifkan saat event selesai (portal booth, form review, uploader) |
| `LogViewer` *(khusus `areas/admin`, bukan shared)* | = `FilterBar` + `DataTable` + `Badge` | halaman log admin |
| `Hero` | judul nama acara + lencana tahun + sapaan + deskripsi + baris sorotan + `CtaButton` (hitam, panah, efek tekan) + `PolaroidCollage` (3 foto suasana acara); teks mengikuti status event | halaman utama |
| `SectionHeading` | lingkaran bernomor + judul dengan satu kata bergaris-bawah spidol (`accent`) | tiap bagian halaman event dan booth |
| `SiteFooter` | pita bendera + pita gelap: tulisan tangan, nama acara, penyelenggara, tombol "Balik ke atas" | semua halaman pengunjung |
| `ClickFx` | pendengar global: cincin saat tekan, percikan bintang pada tombol utama/bintang, getar pada tombol nonaktif | halaman pengunjung (tidak di admin) |
| `SoundProvider` + `useSfx()` + `SoundToggle` | `sfx.play('ok' \| 'err' \| 'star', n …)`; tombol mengambang nyala/mati | halaman pengunjung (B23) |
| `ActionButton` + `useAction` | `status: idle \| pending \| success \| error`; penjaga klik ganda, loader, "Coba lagi" (B21) | **semua** tombol yang mengubah data: kirim, simpan, setujui, tolak, hapus, unggah, umumkan, putar animasi, minta OTP, login, ekspor |
| `PhotoSlideshow` | slideshow foto booth otomatis (`CONFIG.gallery.intervalMs`), segmen progres, jeda saat hover/fokus/sentuh/tab tersembunyi, panah, thumbnail, geser, keyboard; mulai dijeda bila gerak minimal; **0 foto = tidak dirender** dan hero beralih ke satu kolom (A16) | halaman booth |
| `ReportButton` + `ReportDialog` | alasan (kata kasar · SARA · data pribadi · spam · lainnya) + catatan; memakai `ActionButton` (B21); tampil untuk booth dan pengunjung, **tidak ada tombol sembunyikan/hapus untuk booth** | `ReviewItem` di halaman booth dan portal booth |
| `ModerationQueue` + `TermsEditor` *(khusus `areas/admin`)* | antrean laporan/komentar ditahan dengan aksi sembunyikan komentar / sembunyikan review / pulihkan / kunci; editor daftar kata (block/allow, tingkat) dengan kotak "uji kalimat" | halaman moderasi admin |
| `FeaturedProduct` | blok produk andalan (foto polaroid + `PriceTag` + alasan + `SaveButton` + chip lokasi booth); promo disembunyikan setelah event selesai | halaman booth |
| `ProductGrid` + `ProductCard` | `pageSize` (6) + "Tampilkan lebih banyak"; `ProductCategoryFilter` (chip `aria-pressed`, hanya bila produk > `productFilterMinProducts`); keterangan jumlah `aria-live="polite"` | halaman booth |
| `PriceTag` | `size: sticker \| inline \| short` (`Rp 18.000` / `Rp 14rb` / `Gratis`), memakai `Intl.NumberFormat('id-ID')`; menampilkan harga normal dicoret bila ada | andalan, kartu produk, kartu mini sorotan, stiker kartu booth, panel incaran |
| `WishlistProvider` + `useWishlist()` + `SaveButton` + `WishlistPanel` | tombol melayang "Incaranku (n)", panel dikelompokkan per booth menurut nomor booth + perkiraan total; disimpan di browser, produk yang sudah hilang disaring (A14) | halaman booth dan halaman event (tidak di admin/portal) |
| `WhatsAppOrderButton` | `variant: full \| icon`; tautan ke `/go/wa/:boothId?p=…` (`target="_blank" rel="noopener noreferrer"`); tidak dirender bila booth tanpa nomor atau event selesai | produk andalan, kartu produk |
| `ShareButton` + `SharePanel` | `scope: booth \| product`; salin tautan, WhatsApp, Web Share API bila ada; teks bawaan tanpa permintaan bintang; Esc menutup | hero booth, produk andalan, portal booth (panel Bagikan) |
| `ProductEditor` *(`shared/`, bukan lagi khusus `areas/booth`)* | daftar produk seret-untuk-urutkan, formulir, `ImageUploader` mode `product`, pilihan andalan, penghitung "7 dari 24"; menerima `boothId` dan `actor: owner \| admin` | portal booth **dan editor booth di admin** (A16). Dipindah ke `shared/` karena dipakai ≥ 2 area dan antar-area dilarang saling impor (B16) |
| `BoothProfileForm` *(`shared/`)* | satu isian wajib (nama), sisanya opsional; `ImageUploader` mode `gallery`/`logo`; nomor WhatsApp + persetujuan | portal booth, **editor booth di admin**, formulir "Tambah booth" |
| `BackButton` | tombol kembali pil tebal (ikon panah, bayangan keras, efek tekan) | halaman booth |
| `ImageUploader` | `logo \| photo \| banner` | daftar booth, portal booth, pengaturan event admin (B15) |
| `SafeImage` | `src: string \| null`, `aspect`, `fallback: ReactNode \| null`, `onFail?`; menangani **tidak ada gambar** dan **gambar gagal dimuat** dengan cara yang sama; menahan rasio agar tidak melompat; `onFail` memberi tahu induk (mis. Sorotan beralih ke hanya-teks); **satu-satunya tempat `<img>` boleh ditulis** (dijaga lint, B26) | **semua** gambar di halaman pengunjung |
| `BoothGrid` | menghitung `gridVisualMode` **sekali** untuk seluruh daftar lalu meneruskannya ke tiap `BoothCard`; daftar kosong → `EmptyState`; tidak mengacak (urutan dari pemanggil) | "02 Semua booth" (A8) |
| `ProductGrid` / `ProductCard` / `FeaturedProduct` | mode **satu keputusan untuk seluruh etalase** (`productGridMode`): sebagian berfoto → bingkai untuk yang kosong; tak ada foto → daftar kompak; andalan tanpa foto → hanya teks; tanpa produk → tidak dirender | halaman booth (A14) |
| `MediaUrlProvider` + `useMediaUrl()` | konteks pemetaan kunci gambar → URL (bawaan `MEDIA_BASE_URL + kunci`). Komponen tampilan tetap murni: galeri dan tes memasok pemetaan sendiri (gambar contoh, 404 simulasi) tanpa server | semua komponen bergambar |
| `Modal` / `ConfirmDialog` / `ToastProvider` + `useToast()` / `EmptyState` / `ErrorState` / `Skeleton` | `<dialog>` bawaan (Esc menutup, **dikunci selama aksi pending**); toast `aria-live="polite"` maks. 3, hilang 5 dtk; `Skeleton` hanya untuk data yang SEDANG dimuat, bukan data kosong | semua tempat |
| `PhotoFrame` | `size: xs \| sm \| md \| lg \| winner`; inisial nama + nomor booth, warna dari hash id; selotip dan kemiringan hanya pada `md`+ | `fallback` untuk strategi **bingkai** (A16) |
| `Present` | `when={nilai}`; menganggap `null`, `""`, spasi saja, dan `[]` sebagai kosong; mengembalikan `null` sehingga `gap` induk tidak menyisakan celah | semua bagian opsional: tagline, deskripsi, "Kenalan", produk, stiker nomor (A16) |
| `ProfileCompleteness` | `level: name_only \| partial \| full`, `variant: chip \| hint` | kolom Data Grid, antrean booth, saran di portal booth; **tidak pernah** di halaman pengunjung |
| `OwnerPanel` *(khusus `areas/admin`)* | status pemilik (Tanpa pemilik / Diundang / Aktif), isi/ganti/lepas email, "Kirim undangan" | editor booth di admin (A16) |
| `RegisterBoothCTA` | `size`, tampil/hilang otomatis | hero halaman utama, daftar booth kosong (B17) |
| `EventStatusBanner` / `Countdown` | `kind: registration \| event` | halaman utama, halaman daftar, layar besar (B17) |
| `ScheduleForm` + `SchedulePreview` *(khusus `areas/admin`)* | – | pengaturan jadwal event admin (B17) |
| `FormField`, `OtpInput`, `TurnstileWidget` | – | daftar booth, login booth/reviewer, form review |
| `ConfirmDialog`, `Toast`, `EmptyState`, `Skeleton` | – | semua tempat |
| `LivePanel` + `useLive()` | – | dashboard, layar besar (satu koneksi WebSocket dibagi lewat provider) |

Contoh pola:

```tsx
// components/ui/Badge.tsx — satu definisi, banyak tempat
const badge = cva("inline-flex items-center rounded-chip px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      primary: "bg-primary text-primary-fg",
      accent:  "bg-accent text-accent-fg",
      muted:   "bg-surface-tint text-muted",
      danger:  "bg-danger/10 text-danger",
    },
  },
  defaultVariants: { tone: "muted" },
});
export const Badge = ({ tone, className, ...p }: BadgeProps) => <span className={cn(badge({ tone }), className)} {...p} />;

// Pemakaian di banyak tempat
<BoothCard variant="spotlight" booth={b} />
<BoothCard variant="row" booth={b} rank={3} />
<BoothCard variant="admin" booth={b} actions={<ApproveRejectButtons id={b.id} />} />

<DataTable columns={logColumns} rows={logs} empty={<EmptyState title={copy.logs.empty} />} />
<DataTable columns={boothQueueColumns} rows={pendingBooths} />
```

### Sisi server: modular dengan cara yang sama

- **Middleware yang dipakai ulang** di banyak route: `requireSession`, `requireEvent` (menetapkan `eventId` dari klaim sesi), `rateLimit(key, limit)`, `verifyTurnstile`, `requireAdmin`.
- **Modul layanan** kecil dan terpisah: `scoring`, `risk`, `otp`, `email`, `logger`, `live-hub`. Route hanya merakit mereka. Mengganti penyedia email atau aturan risiko = mengubah satu modul.

### Pengujian

Tiap komponen di `shared/` punya uji ringan (Testing Library) untuk keadaan loading/kosong/error dan aksesibilitas dasar; galeri `/dev/components` dipakai untuk pemeriksaan visual cepat sebelum rilis.

## B15. Upload gambar: konversi WebP di client

Keputusan: **semua gambar dikonversi ke WebP di browser (frontend saja)**. Cloudflare tidak melakukan konversi (tanpa Image Resizing/Cloudflare Images), jadi tidak ada biaya transformasi dan Worker tidak terbebani.

### Alur di client

```
pilih file (accept="image/*", drag & drop)
  → cek tipe + ukuran asli (≤ media.maxRawFileMB)
  → decode:  createImageBitmap(file, { imageOrientation: "from-image" })   // putaran EXIF otomatis benar
  → resize proporsional ke dua ukuran: full dan thumb (angka di CONFIG.media)
  → encode:  OffscreenCanvas.convertToBlob({ type: "image/webp", quality })   // idealnya di Web Worker agar UI tidak macet
  → jika ukuran > batas byte: turunkan quality bertahap (0.82 → 0.7 → 0.6) sampai muat
  → pratinjau (URL.createObjectURL, di-revoke setelah dipakai)
  → unggah SATU permintaan multipart berisi `full` dan `thumb`: POST .../media?kind=photo   (diubah di Tahap 3)
```

> **Perubahan dari rancangan awal (Tahap 3):** dua PUT terpisah (`size=full` lalu `size=thumb`) diganti satu POST multipart. Alasannya: satu Idempotency-Key, satu validasi, dan **atomik** (tidak mungkin ada foto yang baru setengah masuk). Batas ukuran badan ditegakkan saat membaca aliran. Penyesuaian untuk "Coba lagi": browser membuat batas multipart baru di tiap pengiriman, jadi middleware idempotensi menormalkan batas itu sebelum menghitung hash badan (tanpa ini, percobaan ulang dengan kunci yang sama ditolak `422`).
>
> **Dikerjakan di Tahap 3:** konversi di thread utama (belum di Web Worker) dan tanpa encoder WASM cadangan; browser tanpa encoder WebP mendapat pesan jelas. Keduanya bisa ditambah bila uji lapangan menunjukkan perlu.

Detail penting:
- **Pastikan hasilnya benar-benar WebP**: periksa `blob.type === "image/webp"`. Sebagian browser (terutama Safari versi lama) tidak bisa meng-*encode* WebP dan diam-diam mengembalikan PNG. Cadangan: encoder WASM (mis. `@jsquash/webp`) yang **dimuat lazy hanya bila diperlukan**; kalau tetap gagal, tampilkan pesan jelas.
- **Galeri booth**: satu booth boleh mengunggah beberapa foto (`maxPhotosPerBooth`); **foto opsional, tanpa batas minimum** (A16). Booth tanpa foto ditangani komponen, bukan unggahan pengganti: server **tidak pernah** menyimpan atau mengirim gambar placeholder. `ImageUploader` mode `gallery`: unggah banyak file sekaligus (diproses berurutan di Web Worker), urutkan dengan seret-dan-lepas, tandai foto sampul (posisi 0), hapus. Disimpan di tabel `booth_photos` (B6).
- **Foto produk** (`kind=product`): satu foto per produk, dipotong persegi di browser (`CONFIG.media.product`), disimpan di `products.key_full`/`key_thumb`; etalase memakai `thumb`, hanya produk andalan memakai `full`. Aturan validasi server sama seperti foto lain.
- **Dua ukuran per gambar** (`full` dan `thumb`): kartu booth dan leaderboard memakai `thumb` (puluhan KB), halaman profil memakai `full`. Ini penghematan bandwidth terbesar di jaringan expo.
- **Bonus privasi**: re-encode lewat canvas membuang EXIF/GPS dari foto.
- GIF animasi hanya diambil frame pertama; file HEIC yang tidak bisa di-decode browser → pesan "format tidak didukung, coba JPG/PNG".
- Kode konversi ada di `lib/image/convertToWebp.ts` dan dibungkus hook `useImageUpload` + komponen `ImageUploader` (dipakai form daftar booth, portal booth, pengaturan event admin). Modul ini **di-`import()` saat file dipilih**, jadi tidak ikut bundle awal (B16).
- Semua angka (ukuran px, kualitas, batas byte) dari `CONFIG.media`, tidak tertanam di kode.

### Validasi di server (wajib, walau client sudah mengonversi)

Client tidak bisa dipercaya: orang bisa memanggil API langsung. Server **tidak mengonversi**, hanya menolak yang tidak sesuai:

1. Sesi valid, peran booth/admin, status event & booth mengizinkan upload.
2. `Content-Type: image/webp` dan `Content-Length` ≤ batas (`maxBytesFull`/`maxBytesThumb`); pembacaan body dibatasi streaming.
3. **Magic bytes**: byte 0–3 = `RIFF`, byte 8–11 = `WEBP`. Baca header (VP8/VP8L/VP8X) untuk mengambil **dimensi** dan tolak jika melebihi `fullPx` (mencegah gambar raksasa).
4. Kunci objek acak: `events/{eventId}/booths/{boothId}/{uuid}-{full|thumb}.webp`; database hanya menyimpan kunci. Upload baru menghapus objek lama; batas `maxPhotosPerBooth`.
5. Rate limit upload per booth; log `booth.media_uploaded` (B13).

### Menyajikan gambar

- Gambar hanya berubah dengan kunci baru → aman diberi `Cache-Control: public, max-age=31536000, immutable`.
- **Penyimpanan: Cloudflare R2** (keputusan). Cara menyajikannya ada dua, dan **bisa ditukar lewat satu variabel `MEDIA_BASE_URL`** tanpa mengubah kode (UI selalu membangun URL gambar dari `MEDIA_BASE_URL + key`):
  1. **Domain kustom pada bucket R2 → `media.eventunimed.id`** (dipilih, karena `eventunimed.id` sudah di Cloudflare): gambar dilayani langsung oleh CDN dan cache Cloudflare **tanpa memanggil Worker**. Cara pasang: R2 → bucket → Settings → *Custom Domains* → tambah `media.eventunimed.id` (DNS dibuat otomatis); lalu `MEDIA_BASE_URL=https://media.eventunimed.id`.
  2. **Route Worker `GET /media/*`** (+ Cache API): cadangan saja, bila domain kustom bermasalah.
  - **Perlu diingat: domain tidak dibutuhkan untuk *upload*, hanya untuk *menampilkan* gambar.** Upload tetap lewat API Worker yang menulis ke R2 (`env.MEDIA.put(key, body, { httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" } })`), siapa pun domainnya. Domain hanya menentukan URL tempat browser mengambil gambar dan apakah Worker ikut terpanggil.
  - Jangan pakai URL publik `r2.dev` untuk produksi: itu ditujukan untuk pengembangan dan dibatasi lajunya.
- Header `X-Content-Type-Options: nosniff` dan `Content-Type: image/webp` dipaksa.
- Moderasi: admin dapat menghapus/mengganti gambar booth yang tidak pantas (tercatat di log).

Keterbatasan jujur: karena konversi hanya di client, server tidak bisa *memaksa* isi gambar benar-benar hasil konversi. Yang dijamin hanyalah format WebP yang valid secara struktur header, batas ukuran, dan dimensi. Itu cukup untuk keamanan dasar; kepatutan isi gambar tetap lewat moderasi admin.

## B16. Pemisahan kode per area (SPA hemat resource)

Masalah: SPA dengan satu layout dan satu bundle akan mengirim kode admin dan portal booth ke ratusan pengunjung yang hanya ingin menilai booth. Solusi: **satu SPA, beberapa area, masing-masing dimuat hanya saat dibutuhkan.**

| Area | Rute | Layout | Library khusus yang hanya dimuat di sini |
|---|---|---|---|
| **event** (tampilan all toko = halaman event) | `/`, `/b/*`, `/results` | Header event + banner jadwal | Chunk **halaman event** (sorotan, grid, peringkat, klien realtime) dan chunk **halaman booth** (galeri penuh, form review, Turnstile, Google login) dipisah |
| **admin** | `/admin/*` | Sidebar admin | `DataGrid` (TanStack Table + Virtual), `LogViewer`, generator poster QR, penulis CSV/XLSX, color picker |
| *booth* (portal pemilik booth) | `/register`, `/booth/*` | Sidebar/tab portal | `ImageUploader` + konverter WebP, generator QR |
| *screen* (layar besar) | `/screen` | Tanpa navigasi | Motion, klien realtime |

> Tidak ada area `home` karena hanya ada satu event aktif yang langsung tampil di halaman utama. Area: `event` (halaman utama + halaman booth + hasil), `admin`, `booth` (portal pemilik booth, dipisah supaya pengunjung biasa tidak mengunduh `ImageUploader`/konverter gambar), dan `screen` (layar besar tanpa navigasi). Area `booth` dan `screen` bisa digabung ke area lain bila ingin lebih sederhana, tetapi bundle `event` akan bertambah besar.

### Cara kerja

```tsx
// src/web/router.tsx — file ini sengaja KECIL: hanya peta rute, tanpa isi halaman
export const router = createBrowserRouter([
  { path: "/",            lazy: () => import("./areas/event/routes") },    // halaman event (event aktif)
  { path: "/b/:boothId",  lazy: () => import("./areas/event/routes") },    // halaman booth (tujuan QR)
  { path: "/results",     lazy: () => import("./areas/event/routes") },
  { path: "/register",    lazy: () => import("./areas/booth/routes") },
  { path: "/booth/*",     lazy: () => import("./areas/booth/routes") },
  { path: "/screen",      lazy: () => import("./areas/screen/routes") },
  { path: "/admin/*",     lazy: () => import("./areas/admin/routes") },
]);
```

Aturan:

1. **Bundle awal hanya berisi**: React, React Router, TanStack Query, `theme-loader`, dan peta rute di atas. Tidak ada kode area manapun.
2. **Satu layout per area**, dimuat bersama area itu. Layout admin tidak pernah diunduh pengunjung.
3. **Library berat di-`import()` saat dipakai**: konverter WebP + fallback WASM (saat file dipilih), generator QR/PDF/CSV (saat tombol ditekan), skrip Turnstile dan Google Identity (disisipkan hanya saat form login/review tampil).
4. **Halaman booth terpisah dari halaman event**: rute `/b/:id` adalah chunk sendiri (galeri penuh, form review, skrip Turnstile/Google). Pengunjung dari QR tidak memuat dashboard, dan pengunjung dashboard tidak memuat form maupun foto ukuran penuh.
5. **Batas impor antar-area ditegakkan lint** (`eslint-plugin-boundaries`, atau `dependency-cruiser` di CI): `areas/event`, `areas/booth`, `areas/admin`, `areas/screen` tidak boleh saling mengimpor. Yang dibagi hanya lewat `components/`, `lib/`, `shared/`.
6. **Aturan dua (B14) berlaku ke area**: komponen yang dipakai satu area tinggal di area itu; baru dipindah ke `components/shared` jika dipakai ≥ 2 area. Ini yang menjaga chunk admin tidak "bocor" ke bundle publik.
7. **`manualChunks` hanya untuk library yang selalu dipakai** (mis. `react-vendor`) supaya ter-cache lintas deploy; library satu-area dibiarkan Vite memecah otomatis. Set `"sideEffects": false` di `package.json` agar tree-shaking efektif dan hindari barrel file yang menarik modul tak terpakai.
8. **Prefetch seperlunya**: saat dashboard idle, `modulepreload` chunk alur review (kemungkinan langkah berikutnya). Area admin dan booth tidak di-prefetch dari area publik.
9. **Anggaran ukuran di CI** (`size-limit` atau `rollup-plugin-visualizer`): target awal ±150 KB gzip untuk JS awal area event (halaman utama pengunjung; area home jauh lebih kecil) dan ±40 KB untuk chunk alur review; **angka ini tebakan awal, ukur dulu lalu tetapkan**. Build gagal bila entri publik ternyata menarik modul admin.
10. **Cache aset**: file ber-hash diberi `Cache-Control: public, max-age=31536000, immutable` lewat file `public/_headers` (cek docs Workers Static Assets). Kunjungan kedua tidak mengunduh ulang.
11. **Keamanan**: kode klien tidak pernah dianggap rahasia. Hak akses admin dijaga di API dan Cloudflare Access, bukan dengan "menyembunyikan" chunk. Opsional: letakkan chunk admin di prefix `/assets/admin/` agar bisa ikut dilindungi Access.
12. **CSS**: Tailwind v4 hanya menghasilkan kelas yang dipakai sehingga CSS tunggal biasanya kecil. Pisahkan per area (`@source` per entri CSS) **hanya jika hasil ukur menunjukkan perlu**.

### Alternatif: banyak entri HTML (MPA)

Vite bisa membuat tiga halaman (`index.html`, `admin/index.html`, `booth/index.html`) sehingga isolasinya total (bahkan router tidak dibagi, CSP admin bisa lebih ketat). Harganya: pindah antar-area = muat ulang halaman penuh, dan routing Static Assets perlu disetel manual. **Rekomendasi tetap: satu SPA + `lazy` per area**, karena isolasinya sudah cukup dan lebih sederhana. MPA bisa dipertimbangkan nanti hanya untuk admin bila diperlukan.

## B17. Jadwal event dinamis & pendaftaran booth

Prinsip: **tanggal di tabel `events` adalah satu-satunya sumber kebenaran; status tidak disimpan, tetapi dihitung.** Dengan begitu tidak ada status yang bisa "tertinggal" dan tidak perlu cron untuk berganti fase. Kolom jadwal ada di B6.

### Satu fungsi murni, dipakai client dan server

```ts
// src/shared/event-state.ts  (tanpa efek samping, mudah diuji)
export function getEventState(s: EventSchedule, now: number) {
  const phase  = now < s.eventStartAt ? "upcoming" : now < s.eventEndAt ? "live" : "ended";
  const frozen = phase === "ended";                       // event selesai → hanya admin yang boleh mengubah data
  const regStarted = now >= (s.registrationOpenAt ?? -Infinity);

  // Tombol "Daftar Toko" di halaman publik: hanya selama pendaftaran reguler
  const registrationButtonVisible = !frozen && regStarted && now < s.registrationCloseAt;
  // Form /register menerima kiriman: reguler, ATAU susulan via link bila diizinkan, sampai event selesai
  const registrationAccepting =
    !frozen && regStarted && (now < s.registrationCloseAt || s.allowLateRegistration);
  const registrationIsLate = registrationAccepting && !registrationButtonVisible;

  const votingOpen = phase === "live";                    // review hanya dibuka selama event berlangsung

  const nextChangeAt = [s.registrationOpenAt, s.registrationCloseAt, s.eventStartAt, s.eventEndAt]
    .filter((t): t is number => t != null && t > now)
    .sort((a, b) => a - b)[0] ?? null;

  return { phase, frozen, registrationButtonVisible, registrationAccepting, registrationIsLate,
           votingOpen, resultsPublished: s.resultsPublishedAt != null, nextChangeAt };
}
```

- **Server** memakai fungsi ini di middleware: `requireRegistrationAccepting` (pendaftaran booth) dan `requireVotingOpen` (submit review). Jika tidak terpenuhi → `403 { code: "registration_closed" | "voting_closed" | "event_ended" }`. **Menyembunyikan tombol hanyalah tampilan; penegakan sebenarnya di API.**
- Booth yang masuk saat `registrationIsLate` disimpan dengan `is_late = 1` dan dicatat `booth.registered_late`.
- **Client** memakai fungsi yang sama untuk menentukan apa yang ditampilkan (`registrationButtonVisible` → tombol; `registrationAccepting` → apakah form bisa dikirim).

### Pembekuan setelah event selesai (default-deny)

Aturan "setelah event selesai tidak ada yang boleh terjadi selain admin" ditegakkan di **satu pintu**, bukan di tiap route, supaya tidak ada route baru yang terlupa:

```ts
// src/worker/middleware/event-gate.ts
export const eventWriteGate = createMiddleware(async (c, next) => {
  if (c.req.method === "GET" || c.req.method === "HEAD") return next();   // baca tetap boleh
  if (FROZEN_ALLOWLIST.has(`${c.req.method} ${c.req.routePath}`)) return next();   // daftar pengecualian eksplisit (di bawah)
  const state = getEventState(c.get("event"), Date.now());
  if (state.frozen) {
    logEvent(c, { eventId: c.get("event").id, category: "system", action: "event.write_blocked_ended", level: "warn" });
    return c.json({ code: "event_ended" }, 403);
  }
  return next();
});

app.use("/api/*", loadActiveEvent, eventWriteGate);   // semua rute non-admin; /api/admin/* dikecualikan
// /api/admin/* TIDAK memakai gate ini → admin tetap bisa mengubah apa pun, kapan pun
```

- Mencakup **pendaftaran, review, login/OTP pengunjung, edit profil booth, upload gambar, laporan review**: semua `POST/PUT/PATCH/DELETE` di bawah `/api/*` kecuali `/api/admin/*`.
- **Satu-satunya pengecualian (allowlist eksplisit)** agar portal booth bisa dibuka hanya-baca setelah event selesai: `POST /api/booth/otp/request` (hanya `purpose=login` untuk akun booth yang **sudah ada**; email baru ditolak), `POST …/booth/otp/verify`, dan `POST …/booth/logout`. Sesi yang terbentuk pada kondisi `frozen` tetap tidak bisa menulis apa pun karena semua rute tulis lain ditolak gate. Rate limit OTP tetap berlaku.
- **UI hanya-baca**: hook `useEventState().frozen` dipakai satu komponen pembungkus `WriteAction` (menyembunyikan/menonaktifkan tombol, formulir, uploader) plus `ReadOnlyBanner`, sehingga tampilan portal booth dan halaman publik konsisten hanya-baca setelah event selesai (B14).
- **WebSocket** ke LiveHub setelah event selesai ditolak (`410`); klien jatuh ke polling berfrekuensi rendah (`snapshotTtlSecAfterEnd`). DO berhenti menjalankan tick dan menutup koneksi dengan pesan `event_ended`.
- **Tes otomatis wajib**: dengan event berstatus `ended`, tes menelusuri *semua* rute non-GET di `/api/*` (di luar `/api/admin/*`) dan memastikan hasilnya `403 event_ended`, **kecuali** rute yang ada di `FROZEN_ALLOWLIST`. Rute baru yang lupa dilindungi akan menggagalkan CI, dan penambahan ke allowlist harus eksplisit dan terlihat di code review.
- Jika admin membuka kembali event (memundurkan `eventEnd`), `frozen` otomatis kembali `false`.

### Kemampuan admin pasca-event (tanpa batas waktu)

- Rute `/api/admin/*` hanya memakai `requireAdmin` (Cloudflare Access), **tidak** terkena `eventWriteGate`, dan membaca event apa pun statusnya.
- Menyunting review (`PATCH …/reviews/:rid`) dilakukan dalam **satu `batch()` D1**: simpan `original_stars`/`original_comment` bila masih kosong → ubah review → hitung ulang `booth_stats` (menyesuaikan selisih; review `held`/`hidden` tidak dihitung) → naikkan `events.stats_version`. Setelah itu LiveHub me-rebuild peringkat dan cache snapshot otomatis ganti kunci (`snapshot:{eventId}:v{stats_version}`) sehingga hasil baru terlihat segera, tanpa menunggu TTL.
- **Alasan wajib** (`adminReasonMinLength`) dan dialog konfirmasi yang menyebut dampak peringkat ("Booth X turun dari #2 ke #3"). Tiap review punya panel **Riwayat perubahan** (nilai asli dari kolom `original_*` + entri log `admin.review_edited`).
- **Tidak termasuk secara default: membuat review baru atas nama admin.** Itu sulit dipertanggungjawabkan; bila memang dibutuhkan, bisa ditambahkan sebagai fitur terpisah dengan penanda jelas "dibuat admin".
- **Risiko yang perlu disadari:** kuasa sunting penuh berarti hasil lomba bergantung pada integritas admin. Mitigasinya adalah jejak yang tidak bisa dihapus (nilai asli di D1 + log append-only). Untuk akuntabilitas pasca-event, arsipkan log ke R2 (pertanyaan terbuka nomor 9).

### Tombol hilang tepat waktu tanpa muat ulang

- `GET /api/event` mengembalikan jadwal + `serverNow`. Client menghitung `offset = serverNow − Date.now()` dan memakai waktu server, sehingga jam HP yang salah tidak membuat tombol muncul/hilang di waktu yang keliru.
- Hook `useEventState(schedule)` menghitung state lalu memasang **satu `setTimeout` ke `nextChangeAt`** (dibatasi maksimum ±24 jam lalu dihitung ulang, karena batas nilai timer). Saat pendaftaran melewati batas, `RegisterBoothCTA` otomatis merender `null`.
- Jika admin mengubah jadwal, klien mengikutinya dalam ±5–15 detik lewat cache edge `GET /api/event` (TTL pendek) dan polling snapshot; server langsung memakai jadwal baru.
- Komponen: `RegisterBoothCTA` (null saat ditutup), `EventStatusBanner`/`Countdown` ("Pendaftaran ditutup dalam 2 hari 3 jam" — tampil mulai `countdownShowWithinHours`), `LateRegistrationNotice` (catatan di form saat `registrationIsLate`), `EventEndedNotice` (menggantikan form saat `frozen`), dan di admin `ScheduleForm` + `SchedulePreview`.

### Admin mengedit jadwal

- Input memakai `datetime-local` yang **ditafsirkan di zona waktu event** (`events.timezone`, default `Asia/Jakarta`), disimpan sebagai epoch UTC, ditampilkan dengan `Intl.DateTimeFormat({ timeZone })`.
- Validasi Zod (client dan server memakai skema yang sama): `eventStart < eventEnd`, `registrationOpen < registrationClose`, `registrationClose ≤ eventEnd`. **Peringatan lunak** (tidak memblokir): penutupan pendaftaran setelah event mulai; tanggal tutup di masa lalu (akan menutup pendaftaran seketika); `eventEnd` dimajukan sampai sebelum sekarang (akan menutup voting seketika).
- Dialog konfirmasi menyebut dampaknya, mis. "Pendaftaran akan langsung ditutup. 3 booth berstatus pending tetap bisa Anda verifikasi."
- Pintasan: **Tutup pendaftaran sekarang** (`registration_close_at = now`), **Perpanjang +1 hari / +1 minggu**. Membuka kembali pendaftaran = memajukan tanggal tutup ke masa depan; tidak ada kolom override tambahan.
- Pengaturan per-event `allowLateRegistration` (default dari `CONFIG.registration.allowLateRegistrationDefault`) dapat diubah admin di form yang sama.
- Setiap perubahan dicatat `admin.schedule_changed` dengan nilai sebelum/sesudah di `meta` (B13).

### Kasus tepi

| Kasus | Perilaku |
|---|---|
| Booth membuka `/register` setelah tombol hilang / event sudah mulai | **Form tetap aktif** (susulan) dengan catatan; tersimpan `is_late = 1`; wajib verifikasi admin |
| Admin mematikan `allowLateRegistration` | Link `/register` setelah penutupan menampilkan "Pendaftaran ditutup" (`403 registration_closed`); booth terdaftar tetap bisa login & memperbaiki `revision` |
| Booth sedang mengisi form saat event selesai | Submit ditolak `event_ended`; isian tersimpan di `localStorage`; booth menghubungi panitia (admin bisa menambah booth manual) |
| Event selesai | **Semua** aksi tulis non-admin ditolak (pendaftaran, review, edit profil, upload). Halaman publik dan **portal booth tetap bisa dibaca** (login OTP booth yang sudah ada diizinkan, hanya-baca) |
| Sesi booth/reviewer yang masih berlaku saat event selesai | Tetap boleh membaca, tetapi setiap penulisan ditolak oleh `eventWriteGate` |
| Booth terdaftar (`pending`/`revision`/`approved`) sebelum event selesai | Boleh login & memperbaiki sampai event selesai; admin kapan pun tetap bisa menyetujui/menolak |
| Pendaftaran dibuka sesudah booth lama ditolak | Akun `(event, email)` yang sama tidak membuat baris baru; booth memakai alur `revision` |
| Booth `pending` | Tidak tampil publik, tidak bisa dinilai; QR/poster baru aktif setelah `approved` |
| Admin membuat booth saat pendaftaran sudah ditutup, event sudah berlangsung, atau sudah selesai | **Diizinkan.** Jalur admin tidak melewati penutupan pendaftaran maupun `eventWriteGate`; `is_late = 0`; tercatat `admin.booth_created` (A16) |
| Admin memundurkan `eventEnd` setelah event selesai | Event **dibuka kembali** (voting & semua aksi non-admin aktif lagi); dialog konfirmasi memperingatkan, tercatat di log |

### Verifikasi admin (tidak berubah)

Semua pendaftaran masuk antrean `pending`. Admin **Setujui / Tolak (alasan wajib) / Minta revisi**; status dan alasan disimpan di baris `booths` (`status`, `reject_reason`, `approved_by`, `approved_at`), jejak aksinya masuk log (B13). Booth baru muncul di daftar publik dan bisa menerima review hanya setelah `approved`.

## B18. Data Grid admin ala Excel

Tampilan dan perilakunya sudah dijelaskan di A3 (langkah 8). Di sini rancangan teknisnya.

### Frontend (hanya di chunk `areas/admin`)

- **Tanpa paket grid/tabel tambahan** (diubah saat pengerjaan dari rancangan awal TanStack Table/Virtual): sortir, filter, dan paginasi kursor berjalan di server sehingga baris yang dimuat tetap ringan; tampilan memakai token tema (B4).
- Satu komponen **`DataGrid`** generik; definisi kolom & validator per tab bersumber dari **satu tempat** di `src/shared/data-grid.ts` (`GRID_COLUMNS`, `EDIT_SCHEMAS`). Menambah kolom/tab = menambah definisi di sana dan peta SQL di Worker.
- **Editor sel** adalah komponen kecil yang dipakai ulang: `TextCell`, `NumberCell`, `SelectCell`, `StarsCell` (memakai `RatingStars` mode input), `BoolCell`.
- **Keyboard**: panah/Tab/Enter/Esc, `Ctrl+C` menyalin nilai sel; tempel (`Ctrl+V`) ke sel tunggal. Tempel banyak sel ditunda ke v2.
- **Hook `useGridEdits`** menyimpan perubahan tertunda sebagai peta `{ entity, id, field, oldValue, newValue, version }`. Sel yang diubah dikirim ke server hanya saat **Simpan**; sebelum itu semuanya hanya di memori.
- **Dialog "Simpan perubahan"** (`ChangeReviewDialog`): daftar sebelum → sesudah, **satu alasan wajib**, dan **pratinjau dampak peringkat** yang dihitung di browser memakai `shared/scoring.ts` (fungsi yang sama dengan server).
- Pilihan kolom, lebar, dan kerapatan diingat di `localStorage` (hanya kenyamanan; tidak penting bila hilang).
- **CSV saja di MVP** (XLSX dan tampilan tersimpan tetap v1): CSV Data Grid dialirkan dari server (`GET …/data/:entity/export`), ekspor hasil akhir (`ResultsCard`) dibuat di klien dan PDF lewat cetak browser; **poster QR** (`/admin/e/:id/posters`) dibuat murni di klien tanpa rute `/qr` di server.

### Backend

```
GET   /api/admin/e/:id/data/:entity?cursor=&limit=&sort=&filters=&q=
PATCH /api/admin/e/:id/data/bulk        { reason, changes: [{ entity, id, field, value, version }] }
GET   /api/admin/e/:id/data/:entity/export?format=csv|xlsx
# (Riwayat per baris memakai tautan ke halaman Log terfilter ?target=<id>; rute GET .../history/:entity/:id tidak dibuat di MVP)
```

- **Query aman**: `entity`, kolom sortir, kolom filter, dan operator (`eq`, `contains`, `gte`, `lte`, `in`) **hanya dari whitelist per entity**, dibangun dengan Drizzle (parameter terikat), tidak pernah dari string mentah. Semua parameter divalidasi Zod. Selalu menyertakan `event_id`.
- **Paginasi cursor** (keyset) berdasarkan kolom sortir + `id`, bukan `OFFSET`, agar tetap cepat di data besar. Indeks tambahan: `reviews(event_id, status)`, `reviews(event_id, stars)`, `reviews(event_id, created_at)`. Pencarian teks sederhana memakai `LIKE`; bila terasa lambat dapat beralih ke FTS5 (didukung D1).
- **Simpan massal (`PATCH …/bulk`)**:
  1. Validasi Zod: kolom harus *editable*, nilai sesuai tipe, `reason` ≥ `adminReasonMinLength`, maksimum **100 perubahan** per permintaan.
  2. **Kontrol konkurensi**: tiap perubahan membawa `version` (= `updated_at` baris). Bila baris sudah berubah oleh admin lain → `409` untuk baris itu (perubahan lain tetap diproses atau seluruhnya dibatalkan, mode `atomic: true` bisa dipilih); UI menandai sel konflik dan menawarkan muat ulang.
  3. Dalam **satu `batch()` D1**: untuk review, isi `original_stars`/`original_comment` bila masih kosong, ubah baris, isi `moderated_by/at/reason`; hitung ulang `booth_stats` dari selisih (hanya review berstatus `visible` yang dihitung); naikkan `events.stats_version`.
  4. Setelah sukses: LiveHub di-*rebuild* (peringkat baru), cache snapshot otomatis berganti kunci (B17), dan **satu entri log per perubahan** (`admin.review_edited`, `admin.booth_edited`, …) dengan nilai sebelum/sesudah di `meta` dan `reason`.
- **Aksi massal** (sembunyikan/pulihkan/hapus/setujui/tolak/blokir) memakai endpoint yang sama dengan perubahan kolom `status`/`blocked`, jadi aturan alasan, versi, dan log tidak berbeda.
- **Ekspor CSV**: respons di-*stream* per halaman cursor; kolom hash ditulis dalam bentuk singkat; ekspor mencatat `admin.data_exported` di log.
- **Hak akses**: hanya admin (Cloudflare Access). Rute ini **tidak** melewati `eventWriteGate`, sehingga berfungsi penuh setelah event selesai.
- **Biaya**: ini lalu lintas admin saja (jumlah pengguna sangat kecil), jadi tidak berpengaruh signifikan pada kuota D1/Worker.

### Riwayat per baris

Setiap baris Data Grid menautkan **Riwayat** ke halaman Log terfilter (`?target=<id>`). Untuk review, kolom `original_*`/`moderated_*` di D1 juga tampil langsung pada sel review lewat penanda `*` (tooltip) sehingga nilai asli **tidak hilang walau log kedaluwarsa**; rute `GET …/history/:entity/:id` terpisah tidak dibuat di MVP.

## B19. Implementasi animasi hemat resource

Prinsip: **CSS dulu, JavaScript hanya bila perlu**, dan semua nilai gerak (durasi, easing) berupa **token** seperti warna.

| Kebutuhan | Alat | Alasan |
|---|---|---|
| Mikro (tekan, hover, pop bintang, shimmer, pulse LIVE, feed masuk, crossfade spotlight) | **CSS** (`transition`/`@keyframes`) lewat utilitas Tailwind `animate-*` | Tanpa JS, ringan, berjalan di thread kompositor |
| Peringkat berpindah, daftar yang berubah, elemen masuk/keluar | **Motion** (`motion/react`) memakai `LazyMotion` + fitur seperlunya, **hanya di chunk area `event` dan `screen`** | Animasi layout (FLIP) tidak praktis dengan CSS murni. Fitur layout butuh paket fitur yang lebih besar, jadi ukurannya perlu diukur (B16) |
| Pindah halaman | View Transitions API lewat prop `viewTransition` React Router bila didukung | Hampir tanpa biaya bundle, otomatis tidak aktif bila tidak didukung |
| Count-up angka | Fungsi `requestAnimationFrame` kecil (atau Motion) | Hindari pustaka tambahan |
| Area `admin`, `booth` | **CSS saja**, tanpa Motion | Menjaga bundle tetap kecil |

**Aturan performa**
- Animasikan hanya `transform` dan `opacity`; hindari animasi `width/height/top/left` dan hindari layout shift (gambar punya rasio tetap).
- **Batasi per tick**: maksimal `maxFeedItemsPerTick` item yang dianimasikan; sisanya masuk "+N ulasan baru". Leaderboard hanya menganimasikan baris yang **benar-benar berubah**.
- Animasi berhenti saat tab tersembunyi (mengikuti jeda polling/WebSocket, B8).
- Spotlight memakai satu animasi CSS dengan durasi dari variabel yang diisi `CONFIG.live.spotlightMs`, bukan timer JS tambahan.

**Token gerak** (menyatu dengan `theme.css`, B4):

```css
@theme {
  --animate-pop:       pop var(--motion-base) var(--ease-pop) both;
  --animate-feed-in:   feed-in var(--motion-base) ease-out both;
  --animate-live-pulse: live-pulse 1.6s ease-in-out infinite;

  @keyframes pop        { 0% { transform: scale(.6); opacity: 0 } 100% { transform: none; opacity: 1 } }
  @keyframes feed-in    { from { transform: translateY(-12px); opacity: 0 } to { transform: none; opacity: 1 } }
  @keyframes live-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
}

/* Tingkat animasi: diatur lewat atribut di <html data-motion="full|lite|off"> */
:root[data-motion="lite"] { --motion-base: 150ms; --motion-slow: 250ms; }
:root[data-motion="off"]  { --motion-fast: 0ms; --motion-base: 0ms; --motion-slow: 0ms; }
@media (prefers-reduced-motion: reduce) {
  :root { --motion-fast: 0ms; --motion-base: 0ms; --motion-slow: 0ms; }
  [class*="animate-"] { animation: none !important; }
}
```

- **`MotionProvider`** (satu komponen, B14) membaca `data-motion` dan `prefers-reduced-motion`, lalu mengatur `MotionConfig` agar seluruh animasi Motion ikut patuh. Komponen lain **tidak** memeriksa preferensi sendiri-sendiri.
- **Penentuan otomatis**: `lite` bila `prefers-reduced-data`/mode hemat daya, `navigator.hardwareConcurrency` rendah, atau `deviceMemory` rendah (nilai ambang di `CONFIG`); pilihan manual pengguna menimpa otomatis; layar besar dipaksa `full`.
- **Komponen**: `<Pop>`, `<FeedItem>`, `<CountUp>`, `<RankRow>`, `<LiveDot>` di `components/ui` atau `shared`; halaman tidak menulis animasi sendiri. Mengganti gaya gerak = mengubah komponen/token di satu tempat.
- **Galeri** `/dev/components` (B14) memiliki saklar tingkat animasi dan tema (`light`, `arena`) untuk memeriksa semua varian.
- **Uji**: pantau dengan profil performa pada HP kelas menengah-bawah selama lonjakan 100 review/menit (bagian dari gladi beban, B8).

## B20. Keadilan tampilan & halaman booth

### Urutan acak per pengunjung (di client)

```ts
// src/shared/fair-order.ts
export function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }   // FNV-1a
  // Pengacak akhir (murmur3). WAJIB: FNV-1a saja bias untuk id yang hanya beda di karakter terakhir
  // (uji 10.000 seed: satu booth dari 8 hanya jadi pertama ±650 kali, bukan ±1250).
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
export const fairOrder = <T extends { id: string }>(items: T[], seed: string) =>
  [...items].sort((a, b) => hash32(seed + a.id) - hash32(seed + b.id));

// seed dibuat sekali per pengunjung dan disimpan: localStorage → sessionStorage → memori (fallback)
```

- **Mengapa di client, bukan server**: server mengirim daftar booth yang **sama untuk semua orang**, sehingga `GET /api/snapshot` tetap bisa di-cache edge (B8). Mengacak di server akan membuat respons berbeda per pengunjung dan merusak cache.
- **Stabil**: urutan berdasarkan `hash(seed + id)`, bukan pengacakan ulang. Booth baru yang disetujui tidak menggeser booth lain; urutan tidak melompat saat data berubah.
- **Sorotan**: per putaran, urutan = `hash(seed + putaran + id)`; indeks giliran dihitung dari waktu server (B8), sehingga tiap booth tampil tepat sekali per putaran.
- **Pemuatan bertahap**: grid dirender ±24 kartu per tahap (`IntersectionObserver`), gambar `loading="lazy"` memakai thumb (B15).
- **Bias posisi tidak bisa dihilangkan**, hanya dibuat merata antar pengunjung. Opsi lanjutan (mati secara default): pembobotan ringan agar booth yang jarang diulas lebih sering berada di baris awal.
- **Uji keadilan**: tes unit yang menghasilkan 10.000 seed dan memastikan tiap booth berada di posisi pertama kira-kira 1/N kali. Opsional: `booth.page_viewed` ber-*sampling* ke Analytics Engine (B13) agar admin dapat memeriksa sebaran kunjungan ke halaman booth.

### Peringkat dan ulasan terbaru di bagian bawah

- Hanya dirender di bagian 03. Kartu booth **tidak** memuat peringkat atau skor, jadi snapshot yang dipakai grid tidak perlu menyertakan peringkat (lebih kecil). Data peringkat dan feed dimuat setelah bagian atas (di bawah lipatan; boleh *lazy*).

### Halaman booth `/b/:boothId` (chunk terpisah)

**Tata letak (gaya Seru; versi Profesional memakai komponen yang sama dengan token berbeda)**

1. **Baris atas**: tombol **"Balik jelajah booth lain"** berbentuk pil tebal (ikon panah dalam lingkaran, border hitam, bayangan keras; hover bergeser, `:active` menekan; bukan lagi tautan teks biasa) di kiri, dan pil nama acara di kanan (tetap menjadi sorotan). Tombol kembali selalu menuju `/` dan tidak bergantung pada riwayat browser (QR membuka halaman ini langsung).
2. **Hero booth** (dua kolom di desktop, satu kolom di ≤ 940 px):
   - **Kiri: `PhotoSlideshow`**: bingkai polaroid miring dengan selotip, foto 4:3, tombol sebelumnya/berikutnya, penghitung `1/4`, tombol jeda/putar, **segmen progres** (satu per foto), dan deretan thumbnail di bawah bingkai.
   - **Kanan: info booth**: stiker nomor booth, **nama booth besar**, rating (angka + bintang + jumlah ulasan), satu kalimat tagline, chip (nama tim/prodi dan 2 kategori ulasan teratas), lalu tombol CTA hitam berpanah "Yuk, kasih bintang" yang menggulir ke form (disembunyikan di HP karena sudah ada tombol melayang, dan disembunyikan saat event selesai).
   - Tambahan produk (A14): di kanan juga ada **chip harga** ("mulai Rp 14rb"/"Gratis") dan tombol **"Lihat yang andalan"** di samping CTA; di HP bar bawah berisi **"Produk"** + **"Yuk, kasih bintang!"**.
3. **Isi halaman, tiap bagian dalam kartu berbingkai** (Seru: kartu putih, border hitam tebal, bayangan keras, judul bagian berupa stiker kuning yang menempel miring di tepi atas kartu; Profesional: kartu dengan garis tipis): **Produk andalan** (kartu oranye) dan **Yang bisa kamu bawa pulang** (etalase, A14) paling atas di kolom kiri, lalu *Kenalan sama booth ini*, *Kata pengunjung lain* (sebaran bintang + "yang sering disebut"), *Ulasan pilihan*, *Semua cerita pengunjung*. Kolom kanan memuat form penilaian (atau kartu "Penilaian udah ditutup" saat event selesai).

**Teks "Kenalan" yang panjang (`about`)**
- Pemilik booth bebas menulis panjang (portal booth: `textarea` dengan penghitung; batas `CONFIG.booth.aboutMaxLength` = 2000 karakter, dicek juga di server). Baris kosong dipertahankan sebagai paragraf (`white-space: pre-line`); teks selalu di-*escape*, tidak ada HTML/Markdown, tautan tidak dijadikan klik.
- Di halaman booth teks **dipotong 4 baris** (`CONFIG.booth.aboutCollapsedLines`) dan tombol **"Baca selengkapnya" / "Lipat lagi"** muncul **hanya bila teks benar-benar terpotong** (diukur dengan `ResizeObserver`, jadi tetap benar saat layar diputar, font selesai dimuat, atau halaman baru tampil). Tombol memakai `aria-expanded` + `aria-controls`; saat dilipat kembali, halaman digulir agar judul kartu tetap terlihat.
- Teks yang pendek tidak menampilkan tombol; pindah ke booth lain mereset keadaan ke terlipat. Teks tanpa spasi sangat panjang tidak merusak tata letak (`overflow-wrap: anywhere`).

**Slideshow foto otomatis (`PhotoSlideshow`)**
- **Ganti foto otomatis tiap `CONFIG.gallery.intervalMs` (3,5 detik)** dengan *crossfade* + zoom halus. Pewaktu = animasi CSS pada segmen progres (`animationend` memicu foto berikutnya), sehingga **ketika animasi dijeda, pergantian ikut berhenti** tanpa `setInterval` terpisah yang bisa tidak sinkron.
- **Berhenti sementara** saat: kursor di atas galeri, galeri menerima fokus keyboard, jari menyentuh/menggeser (lanjut setelah `resumeAfterTouchMs`), tab tidak terlihat (`visibilitychange`), atau pengguna menekan tombol jeda.
- **Kontrol manual**: tombol sebelumnya/berikutnya, klik segmen atau thumbnail, geser kiri/kanan di HP, tombol panah keyboard saat galeri difokuskan. Semua kontrol bisa dijangkau keyboard dan punya `aria-label`; galeri berperan `region` dengan `aria-roledescription="carousel"`.
- **Aksesibilitas gerak**: bila perangkat meminta gerak minimal (`prefers-reduced-motion`), slideshow **mulai dalam keadaan dijeda** (pengguna dapat menekan putar) dan zoom/crossfade dimatikan.
- **Satu foto saja**: segmen, panah, dan penghitung disembunyikan; tidak ada pewaktu.
- **Tanpa foto sama sekali**: kolom foto tidak dirender dan hero menjadi satu kolom berisi teks (stiker nomor bila ada, nama besar, rating, CTA). Tidak ada slideshow, bingkai kosong, atau pewaktu (A16, B26).
- **Performa**: hanya foto pertama yang `fetchpriority=high`; foto lain dimuat malas (`loading="lazy"`), memakai varian `full` (B15), bukan thumb. Saat pindah halaman, pendengar dan pewaktu dibersihkan.

**Data dan perilaku**
- Data: `GET /api/booths/:id` (profil, galeri `full`, sebaran bintang, "sering disebut" dari `category_counts_json`, ulasan dengan paginasi) + `GET …/spotlight` yang sama untuk ulasan pilihan. Cache edge singkat.
- Form review dan skrip **Turnstile/Google Identity hanya dimuat di sini**, dan paling baik dimuat saat form mulai berinteraksi, bukan saat halaman dibuka.
- **QR booth** mengarah ke URL ini (`?src=qr` opsional untuk statistik). Tombol melayang "Beri penilaian" di HP menggulir ke form.
- Setelah kirim: tampil "Terima kasih." dan 3 booth lain yang **belum dinilai pengunjung** (diambil dari daftar acak miliknya), supaya penilaian tersebar.
- Kategori ulasan dibaca dari `GET /api/event` (daftar aktif milik event); pilihan maksimal `CONFIG.review.maxCategoriesPerReview`.

### Kategori ulasan yang diatur admin

- Halaman pengaturan event memiliki editor kategori: tambah, ganti nama, ubah urutan (seret), aktif/nonaktif. Tidak ada penghapusan keras bila sudah dipakai.
- Review menyimpan `category_ids_json`; `booth_stats.category_counts_json` diperbarui dalam `batch()` yang sama dengan penyimpanan review (dan saat admin menyunting review, B18).
- Validasi server: hanya id yang aktif milik event itu, maksimal tiga, tanpa duplikat.

### Pratinjau tautan (WhatsApp, media sosial) dan judul tab

Tautan event dan booth sering dibagikan (juga lewat QR), padahal aplikasi ini SPA yang tidak menyajikan meta tag per halaman. Worker menyisipkan meta tag saat menyajikan `index.html` (diambil lewat binding `ASSETS`; **diimplementasikan dengan string replace dan nilai di-escape**, bukan `HTMLRewriter`, karena berkasnya kecil dan lebih mudah diuji; rute `/` dan `/b/*` memakai `run_worker_first`):
- Judul tab dan `og:title` = **nama resmi acara** ("Penilaian Booth Terfavorit LPPM Expo Tahun 2026"); untuk halaman booth: "{nama booth} · {nama acara}".
- `og:description` (kalimat mengajak singkat), `og:image` (gambar OG event yang diunggah admin, atau foto sampul booth untuk halaman booth; versi thumb; urutan cadangan bila foto kosong: B26), `og:url`.
- Data diambil dari snapshot di cache edge, tanpa memukul D1 per permintaan. *(Tahap 5: sementara dari D1; cache edge menyusul di Tahap 7.)*

### Peringkat opsional & animasi pemenang (kontrol admin)

- **`events.ranking_mode`**: `visible` (default) · `hidden` · `on_results` (tersembunyi sampai admin menekan "Umumkan hasil").
- **Ditegakkan di server, bukan hanya disembunyikan di UI**: bila peringkat tidak boleh tampil, `snapshot`, `spotlight`, dan endpoint booth **tidak menyertakan** peringkat/skor, dan LiveHub tidak menyiarkan pesan `leader_changed`. `RankingSection` merender `null` jika `snapshot.ranking` tidak ada. Panel admin dan Data Grid tab "Peringkat" tetap bisa melihatnya. Rating rata-rata tiap booth disembunyikan lewat `ratings_mode` yang terpisah (di bawah).
- **Animasi pemenang**: `POST /api/admin/events/:id/reveal` membekukan seluruh peringkat dari `booth_stats` saat itu ke `reveal_json`, menaikkan `reveal_seq`, mengisi `reveal_started_at`, dan menaikkan `stats_version`. LiveHub menyiarkan `{ t: "reveal", seq, startedAt, target, results }` (daftar lengkap, ±100 byte per booth); klien yang polling menerimanya lewat bidang `reveal` di snapshot dalam ±5–15 detik.
- **Pemutaran langsung (mode `live`)**: klien memutar sekali per `seq` (dibandingkan dengan `seq` terakhir yang dilihat, disimpan di browser) dan hanya bila `serverNow − startedAt < 90 detik`, jadi pengunjung yang datang terlambat tidak memutar ulang animasi lama. Untuk pemutaran saat halaman dibuka setelah event selesai, lihat mode `replay` di bawah.
- **Urutan**: 3-2-1 → juara 3 → juara 2 → juara 1 → daftar hasil akhir seluruh booth, ±12–14 detik sebelum daftar muncul, tanpa confetti; suara opsional dan mati secara default. `target = screen` hanya memutar di Layar Besar; `target = everyone` juga menampilkan lapisan yang bisa ditutup di halaman event.
- **"Umumkan hasil"** = mengisi `results_published_at`, membekukan `results_json`, mengatur rating dan peringkat menjadi tampil, dan memutar animasi. Memutar animasi saja **tidak** mengubah mode peringkat maupun rating.
- Komponen `WinnerReveal` dimuat lazy hanya di area `event`/`screen` (B16). Setiap pemutaran dicatat `admin.reveal_played` (B13).

### Animasi otomatis saat halaman dibuka setelah event selesai (mode `replay`)

- **Syarat**: fase `ended` **dan** `results_published_at` terisi. Setiap pengunjung yang baru membuka halaman, **menyegarkan (refresh)**, membuka ulang tab, atau saat versi hasil baru diterbitkan melihat `WinnerReveal` diputar otomatis dari `results_json`; sedangkan perpindahan halaman di dalam sesi SPA yang sama (`/b/:id` ↔ `/` ↔ `/results`) tidak memutarnya berulang kali setelah ditutup. Tidak ada penyimpanan "sudah dilihat" di server/localStorage untuk pemutaran pertama, jadi muat ulang halaman tetap memutar lagi kecuali dicentang opsi berhenti putar otomatis.
- **Bisa dilewati**: tombol *Lewati*, `Esc`, atau sentuh; di akhir ada tombol "Lihat halaman". Setelah ditutup, halaman tampil hanya-baca dengan alert "Event telah berakhir" dan tombol terbang ikon Play di pojok kanan bawah untuk memutar ulang animasi pemenang.
- **Opsi "jangan putar otomatis lagi di perangkat ini"**: kotak centang di bawah lapisan animasi (terlihat sejak awal, sehingga bisa dicentang bersamaan dengan Lewati). Disimpan **hanya di browser** (`localStorage`, cadangan: memori) dengan kunci `winnerAutoplayOff:{eventId}:{results_version}`, tanpa data pribadi dan tanpa penyimpanan di server. Karena kuncinya memuat `results_version`, **pemutaran otomatis menyala kembali** bila admin memperbarui hasil. Default **Nyala**. Pengunjung tetap bisa memutar manual lewat tombol terbang Play di kanan bawah dan menyalakan/mematikan opsi langsung dari lapisan animasi. Mode `live` (diputar admin) tidak terpengaruh opsi ini.
- **Hanya di halaman event** (dan `/results`). Halaman booth dan tautan QR tidak memutarnya.
- **Belum diumumkan** (event selesai, `results_published_at` kosong): tidak ada animasi; tampil "Hasil segera diumumkan", dan peringkat mengikuti `ranking_mode`/`ratings_mode`.
- **Ringan**: data animasi adalah `results_json` (nama, skor, kunci foto sampul thumb per booth atau `null` bila tanpa foto, lalu `ResultsList` memakai bingkai, A16; ±10 KB untuk 100 booth) di dalam snapshot pasca-event (cache lebih lama, `snapshotTtlSecAfterEnd`). Foto juara 1–3 dimuat saat lapisan mulai; foto booth lain (thumb) dimuat *lazy* saat daftar digulir. Dengan `prefers-reduced-motion` langsung menampilkan daftar akhir tanpa urutan.
- **Hasil dibekukan saat diumumkan.** Bila admin kemudian menyunting review (B18), hasil yang sudah diumumkan **tidak berubah otomatis**: admin menekan **"Perbarui hasil"** (`POST …/refresh-results`) yang membekukan ulang, menaikkan `stats_version` dan `results_version`, dan dicatat `admin.results_refreshed`. Panel admin memberi peringatan bila peringkat terkini berbeda dari hasil yang diumumkan.

### Rating disembunyikan (moderasi admin)

- **`events.ratings_mode`**: `visible` (default) · `hidden` · `on_results`. Admin dapat mengubahnya kapan saja sebagai alat moderasi; tercatat `admin.ratings_mode_changed`.
- **Yang disembunyikan, dan tidak dikirim server**: rata-rata bintang, jumlah ulasan, sebaran bintang, skor/peringkat, serta **bintang pada setiap ulasan publik** (teks ulasan tetap tampil). Hitungan pada "Sering disebut" disembunyikan, namanya tetap. Tempatnya diganti tulisan "Rating disembunyikan".
- **Tetap berjalan**: form review (pengunjung tetap bisa memberi bintang) dan aturan "Ulasan pilihan" di server. Admin tetap melihat semuanya (panel, Data Grid).
- **Peringkat bergantung pada rating**: bila rating disembunyikan, peringkat otomatis ikut tersembunyi; server memvalidasi aturan ini dan panel admin menonaktifkan saklar peringkat.
- **Portal booth**: selama mode ini berlaku, booth melihat "Rating disembunyikan oleh panitia".
- **Cache**: mengubah mode menaikkan `stats_version`, sehingga kunci cache snapshot berganti dan perubahan segera berlaku.
- **Per booth** (menyembunyikan rating satu booth saja) tidak disertakan; bisa ditambah bila diperlukan.
- **"Umumkan hasil"** mengatur rating dan peringkat menjadi tampil.

### Gaya Seru: elemen gerak tambahan (tetap hemat)

- **Pita teks berjalan** (*marquee*): murni CSS (`translateX`), konten digandakan agar mulus; berhenti pada `prefers-reduced-motion` dan mode gerak *Mati*.
- **Percikan bintang saat ketuk bintang**: 7 elemen `★` kecil (CSS `transform`/`opacity`, ±650 ms) yang dibuat saat klik dan langsung dihapus; **tanpa pustaka confetti**. Hanya aktif di gaya Seru dan bila gerak tidak *Mati*.
- **Kartu polaroid**: kemiringan dan bayangan hanya CSS; efek pegas saat disentuh memakai kurva `cubic-bezier` yang sama dengan gaya gerak *Pop*.

### Font di-host sendiri

- Pasang berkas **WOFF2 subset Latin** (mis. lewat paket `@fontsource/*` atau berkas manual di `src/web/assets/fonts`), deklarasikan dengan `@font-face` dan `font-display: swap`, serta *preload* hanya berat huruf judul yang dipakai di atas lipatan.
- Tidak memakai Google Fonts di produksi: lebih cepat (satu asal domain), tanpa pelacakan pihak ketiga, dan berkas ber-hash diberi cache `immutable` (B16). Semua font kandidat berlisensi SIL OFL.
- Gaya *Seru* memakai Bricolage Grotesque (judul), DM Sans (teks), dan Caveat (catatan tulisan tangan, dipakai sangat terbatas dan hanya satu berat) sehingga tambahan berkas font kecil.
- **Nama variabel (token) font**: `--font-ui` (teks), `--font-display` (judul), `--font-hand` (tulisan tangan), `--weight-display` (berat judul), `--tracking-display` (kerapatan huruf judul). Hanya didefinisikan di `theme.css` (B4); komponen memakai utilitas `font-ui`, `font-display`, `font-hand`.
- **Font saat ini (disetujui)**: Bricolage Grotesque (judul), DM Sans (teks), Caveat (tulisan tangan).
- **Mengganti font itu mudah, tiga langkah**: (1) taruh berkas WOFF2 font baru di `src/web/assets/fonts/`, (2) daftarkan di `fonts.css` (`@font-face`), (3) ubah nilai token di `theme.css`. Tidak ada komponen yang disentuh. Font alternatif bisa disiapkan sebagai set token (`[data-font="…"]`) untuk dibandingkan dulu, seperti pada demo.

## B21. Perlindungan aksi ganda & jaringan buruk (anti double-click)

**Prinsip:** setiap aksi yang mengubah data hanya boleh diproses **sekali**, apa pun kondisi jaringan pengguna. Perlindungannya tiga lapis, karena satu lapis saja tidak cukup (mis. klien bisa timeout padahal server sudah memproses).

### Lapis 1 · Tombol ber-loader (satu komponen untuk semua aksi)

**Aturan wajib:** semua tombol yang memicu aksi asinkron (kirim, simpan, setujui, tolak, hapus, unggah, umumkan, putar animasi, minta OTP, login, ekspor, dst.) **harus** memakai `ActionButton`. Tidak ada `<button onClick={async …}>` mentah; ditegakkan dengan ESLint (`no-restricted-syntax`) dan tes E2E "klik dua kali" di bawah.

- **Penjaga sinkron memakai `ref`, bukan state**: klik kedua yang datang sebelum React sempat me-render ulang tetap diabaikan. State yang diperbarui secara asinkron terlalu lambat untuk mencegah klik ganda.
- **Saat pending**: tombol `disabled` dengan `aria-busy="true"`, teks berubah ("Mengirim…") disertai spinner CSS kecil, **lebar tombol dikunci** (tanpa layout shift), fokus tetap di tempat. Tekan `Enter` pada form memakai handler yang sama.
- **Form**: seluruh isian dibungkus `<fieldset disabled>` selama pending agar data tidak berubah di tengah pengiriman.
- **Timeout klien** (`CONFIG.net.requestTimeoutMs`, `AbortController`): tombol kembali aktif dengan label **"Coba lagi"** dan pesan jelas di dekatnya (`role="alert"`). Offline (`navigator.onLine`): aksi tidak dikirim dan pesan "Tidak ada koneksi" tampil.
- **Timeout di klien ≠ gagal di server.** Permintaan bisa saja sudah diproses sedangkan balasannya tidak sampai. Karena itu "Coba lagi" selalu memakai **kunci idempotensi yang sama** (lapis 2), sehingga aman ditekan.
- **Dialog konfirmasi** (hapus, umumkan, putar animasi): tombol konfirmasi adalah `ActionButton`; dialog tidak tertutup oleh klik latar selama pending.
- **Peringatan `beforeunload`** bila ada aksi pending (terutama simpan massal Data Grid).
- **Tombol OTP** punya jeda kirim ulang (`otpCooldownSec`) dengan hitung mundur "Kirim ulang dalam 42 dtk".
- **Hook** `useAction(fn, { timeoutMs })` mengembalikan `{ run, status, error }`; `status` (`idle | pending | success | error`) dapat dipakai komponen lain, mis. menonaktifkan tautan atau menahan penutupan dialog. Keduanya ada di `components/ui` dan teksnya di `copy.ts`.

### Lapis 2 · `Idempotency-Key` (klien ↔ server)

- Klien membuat **UUID per niat aksi** (saat tombol pertama ditekan; disimpan di hook sampai sukses atau isian berubah) dan mengirimnya di header `Idempotency-Key` pada semua `POST/PUT/PATCH/DELETE`. "Coba lagi" memakai kunci yang sama; aksi baru atau isian yang berubah membuat kunci baru.
- **Middleware `idempotency`** di Worker (urutan: auth → `eventWriteGate` → idempotency → handler):
  - Kunci baru → `INSERT` ke `idempotency_keys` berstatus `processing` (unik pada `(actor, key)`) → jalankan handler → simpan status dan badan respons (maks. 16 KB) → `done`.
  - Kunci sama, `done` → kembalikan respons tersimpan (header `Idempotent-Replay: true`) **tanpa** menjalankan handler lagi.
  - Kunci sama, `processing` → `409 request_in_progress` + `Retry-After: 1`; klien menunggu sebentar lalu mengulang.
  - `processing` yang menggantung > 60 detik dianggap gagal dan boleh diambil alih.
  - Kunci terikat pada `(actor, route, hash isi)`; kunci sama dengan isi berbeda → `422`.
  - Kedaluwarsa 24 jam (`idempotencyTtlHours`), dibersihkan oleh Cron Trigger.
- **Biaya**: ±2 baris tulis D1 per aksi. Lalu lintas admin kecil. Untuk review pengunjung yang jumlahnya besar dipakai **idempotensi alami** (lapis 3) sehingga tabel tidak ikut ditulis; rute ditandai `idempotency: "natural"`.
- **Pengecualian**: GET/HEAD, logout, dan rute dengan idempotensi alami.

### Lapis 3 · Idempotensi alami di database

| Aksi | Perlindungan |
|---|---|
| Kirim / ubah review | `UNIQUE(booth_id, visitor_id)` + upsert; perubahan `booth_stats` dihitung dari **selisih** nilai lama → baru di dalam `batch()` yang sama, sehingga permintaan kembar menghasilkan selisih 0 |
| Daftar booth | `UNIQUE(event_id, email)` |
| Minta OTP | rate limit + cooldown di server (B9) |
| Verifikasi OTP | kode sekali pakai + penghitung percobaan |
| Unggah gambar | kunci objek acak per unggahan → wajib `Idempotency-Key` agar tidak ganda, ditambah batas `maxPhotosPerBooth` |
| Setujui / tolak booth | transisi status idempoten (`approved → approved` tanpa efek) |
| Simpan massal Data Grid | `version` per baris (permintaan ulang → 409 "sudah tersimpan") + `Idempotency-Key` |
| Putar animasi pemenang | `Idempotency-Key` + jeda minimum antar pemutaran di server (mis. 5 detik), karena tiap putaran menaikkan `reveal_seq` |
| Umumkan / Perbarui hasil, mode peringkat & rating | operasi "set" (idempoten) + `Idempotency-Key` |
| Buat event, tambah kategori ulasan, tambah booth manual | `Idempotency-Key` wajib |

### Pengujian

- **Unit**: `useAction` dipanggil dua kali secara sinkron → fungsi hanya dijalankan sekali.
- **E2E (Playwright), untuk setiap aksi utama**: klik dua kali cepat dan `Enter` dua kali → tepat satu permintaan tulis; dengan jaringan dibatasi (Slow 3G); dan skenario **"respons hilang"** (server memproses, balasan diputus) lalu "Coba lagi" → data tidak ganda.
- **Server**: dua permintaan paralel dengan kunci sama → satu efek; kunci sama dengan isi berbeda → `422`.
- **Demo**: `demo-event.html` memiliki grup tombol **JARINGAN** (Normal, Lambat, Gagal, Respons hilang). Coba klik ganda pada "Kirim penilaian" dan skenario "Respons hilang" lalu "Coba lagi": review tercatat sekali.

## B22. Standar kode web terbaru: Baseline & Modern Web Guidance

**Aturan:** semua kode front-end memakai fitur platform web yang **sudah Baseline**, dan agen koding wajib memeriksa panduan terbaru sebelum menulis UI/CSS/JS baru.

**Baseline** (W3C WebDX Community Group, didukung Google, Mozilla, Microsoft, dst.; data `web-features`, tampil di MDN dan web.dev) menandai fitur platform menurut dukungan lintas browser utama:
- **Widely available**: interoperable lebih dari 30 bulan. **Bawaan proyek ini.**
- **Newly available**: baru interoperable. Boleh dipakai **dengan cadangan** (*progressive enhancement*).
- **Limited availability**: belum interoperable. Hanya lewat deteksi fitur (`@supports`, pemeriksaan API) dan **tidak pernah** menjadi syarat alur inti (review, daftar, login).

**Target ditulis di `CLAUDE.md` / `AGENTS.md`**, misalnya: "Target Baseline proyek ini: Widely available (ditinjau tiap tahun)". Tanpa target, panduan Modern Web Guidance juga memakai Widely available sebagai bawaan.

**Modern Web Guidance** (Chrome team, rilis 1.0; menurut halamannya ada masukan dari Mozilla dan Microsoft) adalah *skill* untuk agen koding yang menyajikan panduan berdasarkan Baseline untuk 100+ kasus penggunaan (animasi dan view transitions, container queries, `oklch`, `text-wrap`, `dialog`/`popover`/anchor positioning, `field-sizing`, `:user-invalid`, kinerja INP, aksesibilitas, passkeys, dll.). Perintah pemasangan yang tercantum di dokumentasinya (periksa ulang saat memasang karena dapat berubah):
- `npx modern-web-guidance@latest install` (disarankan; pembaruan otomatis)
- Claude Code: `claude plugin marketplace add GoogleChrome/modern-web-guidance` lalu `claude plugin install modern-web-guidance@googlechrome`
- Alternatif: `npx skills add GoogleChrome/modern-web-guidance` atau `gh skill install GoogleChrome/modern-web-guidance`
- Mencari/membaca panduan lewat CLI: `npx modern-web-guidance@latest search "<topik>"` dan `retrieve "<id-panduan>"`; memindai kode lama: `legacy-scan`.
- Tidak ada perintah slash resmi yang tercantum; cara memakainya adalah meminta agen, mis. "gunakan modern-web-guidance" pada prompt.
- Klaim efektivitas (mis. 91% lulus dengan panduan vs ±51% tanpa) berasal dari Chrome dan **belum kita ukur sendiri**.

**Cara dipakai di proyek ini**
1. Pasang sekali di mesin pengembang.
2. Untuk setiap komponen/fitur baru, agen mencari panduan dulu, lalu memakai **API platform modern** (`<dialog>`, `popover`, View Transitions, container queries, `color-mix()`, `oklch`, `text-wrap`, CSS nesting, dst.) **alih-alih** pustaka atau *polyfill* lama bila fiturnya sudah Baseline.
3. Verifikasi di browser sungguhan dengan **Chrome DevTools for agents** (MCP/CLI) serta uji Playwright lintas mesin (Chromium, Firefox, WebKit).
4. CI: petakan target ke versi browser dengan `baseline-browser-mapping` (W3C WebDX) dan atur `browserslist`/target build; pertimbangkan *lint* yang menandai fitur di luar target (periksa ketersediaan dan versi plugin saat memasang).

**Selaras dengan stack**: Tailwind v4 dan React 19 sudah mengasumsikan browser modern; periksa nilai bawaan `build.target` Vite pada versi yang dipakai agar mengikuti Baseline.

**Status demo**: `demo-event.html` memakai CSS nesting, `color-mix()`, `<dialog>`, `box-decoration-break`, `aspect-ratio`, dan `inset`. **Belum diaudit** terhadap Baseline; sebelum implementasi, tiap fitur dicek di dashboard Baseline (web.dev/baseline) dan diberi cadangan bila belum Widely available.

## B23. Efek interaksi: klik, suara, dan kursor

Setiap interaksi pengunjung mendapat umpan balik **visual + suara + ikon kursor yang sesuai**, tetapi **hemat, bisa dimatikan, dan tidak mengganggu**. Berlaku di halaman pengunjung (gaya Seru). **Area admin tidak memakainya.** Demo: tombol **"Uji kursor & suara"** di bar atas membuka panel untuk mencoba semuanya, dan grup tombol SUARA, KURSOR, dan EFEK KLIK mematikan masing-masing.

### Kursor: ikon sendiri untuk tiap keadaan

| Keadaan | Ikon | Dipakai pada |
|---|---|---|
| Biasa | panah berbingkai tinta dengan bayangan keras | seluruh halaman |
| Pointer | tangan menunjuk berwarna oranye | tautan, tombol, kartu booth, chip, bintang |
| Teks (mengetik) | I-beam dengan titik oranye | kolom komentar dan isian |
| Memuat | jam | elemen `aria-busy` (tombol saat mengirim) |
| Tidak boleh | tanda larangan merah | tombol nonaktif |
| Geser: siap | tangan terbuka | galeri foto |
| Geser: menarik | tangan menggenggam | saat galeri diseret |

- **Token**: `--cursor-default`, `--cursor-pointer`, `--cursor-text`, `--cursor-wait`, `--cursor-no`, `--cursor-grab`, `--cursor-grabbing` di `theme.css`, masing-masing berisi `url(SVG 32×32) titik-tumpu, cadangan`. Komponen hanya memakai `var(--cursor-*)`. Kursor umum lain (zoom-in, help, move, crosshair, copy) disiapkan sebagai token cadangan bila kelak dipakai.
- **Hanya untuk mouse**: aturan dibungkus `@media (hover: hover) and (pointer: fine)`, jadi tidak berpengaruh di layar sentuh.
- **Ringan dan aman**: SVG kecil ditanam langsung (data-URI), tanpa permintaan jaringan; ukuran ≤ 32 px (browser membatasi kursor besar); selalu ada kursor bawaan sebagai cadangan; bingkai tinta dengan isi terang tetap terbaca di latar terang maupun gelap.
- **Bisa dimatikan** ("Kursor: Seru / Bawaan browser") untuk pengguna yang menginginkan kursor sistem.

### Efek klik (visual)
- **Cincin berwarna** (hijau, oranye, tinta) memekar dari titik sentuh selama ±0,5 detik pada setiap tekan; **tombol utama dan bintang** juga memercikkan bintang kecil; **tombol nonaktif bergetar** sekali; tombol terasa menekan (`:active`).
- Satu pendengar `pointerdown` di tingkat dokumen (bukan per elemen), hanya `transform` dan `opacity`, elemen sementara dihapus otomatis.
- Mengikuti pengaturan animasi (**Penuh / Hemat / Mati**) dan `prefers-reduced-motion`.

### Suara (disintesis, tanpa berkas audio)
- **Web Audio API** (osilator + selubung volume): **tanpa berkas audio**, jadi tanpa biaya bandwidth atau R2. Modul `lib/sfx.ts` dimuat dinamis saat sentuhan pertama (B16).
- **Peristiwa → suara** (satu sumber di objek `SFX_EVENTS`):

| Peristiwa | Suara |
|---|---|
| Klik / ketuk | pop pendek |
| Hover (hanya mouse) | tik sangat pelan, **mati bawaan** (opsi `CONFIG.fx.hoverSound`) |
| Tombol nonaktif | blip rendah + getar |
| Saklar nyala / mati | dua nada naik / turun |
| Ketuk bintang 1…5 | nada pentatonik makin tinggi; bintang 5 ditambah kilau |
| Mulai mengirim | tik |
| Berhasil | arpeggio naik |
| Gagal | dua nada rendah |
| Ulasan baru masuk | ding lembut (maks. 1 per 1,2 detik) |
| Peringkat 1 berganti | tiga nada naik |
| Pindah halaman | swish pelan |
| Notifikasi (toast) | pop |
| Hitung mundur 3-2-1 | bip |
| Pengungkapan juara 3 / 2 / 1 | jingle makin meriah |
| Hasil akhir | arpeggio + akor |

- **Aturan**: tidak ada suara sebelum interaksi pertama (kebijakan autoplay browser; konteks audio dibuat saat sentuhan pertama); volume utama rendah (±0,3); pembatas laju per jenis suara agar tidak berisik; berhenti saat tab tersembunyi.
- **Tombol suara mengambang** (kiri bawah, selalu terlihat) menyalakan/mematikan; pilihan disimpan di browser. **Bawaan nyala**, kecuali `prefers-reduced-motion` aktif (bawaan mati). Di iPhone, mode senyap perangkat dapat membisukan Web Audio.
- **Aksesibilitas**: suara tidak pernah menjadi satu-satunya penanda (selalu ada tampilan visualnya); tidak ada suara yang berulang atau berputar.

### Komponen dan konfigurasi
`ClickFx`, `SoundProvider` + `useSfx()`, `SoundToggle` (B14); token `--cursor-*` (B4); konstanta `CONFIG.fx` (volume, pembatas laju, durasi cincin). Menambah atau mengganti suara/kursor tidak menyentuh komponen. Fitur platform yang dipakai (Web Audio API, `cursor: url()`, `:is()`, `pointerdown`) diperiksa terhadap Baseline sesuai B22.

## B24. Produk & promosi booth (teknis)

Aturan produk ada di A14; di sini cara membangunnya.

**Batas 24 produk ditegakkan di server, secara atomik.** Client hanya menampilkan penghitung "7 dari 24". Dua permintaan serentak tidak boleh melewati batas, jadi penyisipan memakai kondisi di dalam satu pernyataan:

```sql
INSERT INTO products (id, event_id, booth_id, name, ... , position)
SELECT ?, ?, ?, ?, ..., COALESCE((SELECT MAX(position) + 1 FROM products WHERE booth_id = ?), 0)
WHERE (SELECT COUNT(*) FROM products WHERE booth_id = ? AND status != 'removed_by_admin') < ?;   -- ? = maxProducts
-- changes = 0 → 409 { code: "product_limit" }
```

Produk `hidden` ikut dihitung (agar batas tidak diakali dengan menyembunyikan lalu menambah). Produk pertama yang berhasil disimpan pada booth yang belum punya andalan otomatis diberi `is_featured = 1` (dalam `batch()` yang sama), sampai pemilik memilih yang lain.

**Tepat satu andalan.** Pergantian andalan dilakukan dalam satu `batch()`: lepas `is_featured` dari yang lama, pasang pada yang baru (indeks unik parsial `one_featured` menolak keadaan ganda). Bila andalan di-`hidden` atau dihapus, server memilih produk aktif berikutnya menurut `position` dalam `batch()` yang sama; booth tanpa produk aktif tidak punya andalan.

**Statistik turunan dalam `batch()` yang sama dengan perubahan produk:** `booth_stats.product_count`, `price_from` (MIN harga > 0 dari produk aktif; `NULL` bila semuanya gratis), `featured_product_id`. Perubahan produk menaikkan `stats_version` (dibatasi lajunya per booth, mis. 30 perubahan/menit) agar kunci cache snapshot berganti.

**Data yang dikirim:**
- `snapshot` (beranda) hanya memuat per booth: `priceFrom` dan andalan ringkas `{ name, priceIdr, thumbKey }` (±120 byte per booth). Daftar produk lengkap **tidak** ikut snapshot.
- `GET /api/booths/:id/products` mengirim semua produk aktif sekaligus (maks. 24, ±6 KB, cache edge singkat). **"Tampilkan lebih banyak" dan filter kategori dikerjakan di client** dari data itu: tanpa permintaan tambahan, jadi tetap cepat di jaringan expo.
- Foto etalase memakai `thumb` dan `loading="lazy"`; hanya andalan memakai `full`.

**Client (area `event`, chunk halaman booth):**
- `useWishlist()` menyimpan kunci `boothId:productId` di `localStorage` (`wishlist:{eventId}`, cadangan memori), dibatasi `wishlistMax`. Saat panel dibuka, daftar dicocokkan dengan data produk terbaru: produk yang hilang atau disembunyikan dibuang; harga yang berubah ikut berubah. Tidak ada panggilan server.
- Kunci kategori dinormalisasi (trim, huruf kecil) hanya untuk pengelompokan; label yang tampil memakai penulisan pemilik. Server menolak kategori ke-9.
- Setelah event selesai (`phase = ended`): `WriteAction` menonaktifkan editor di portal; di halaman publik `SaveButton`, `WishlistPanel`, promo, dan penanda disembunyikan, sedangkan harga tetap tampil.

**Validasi server (Zod):** nama 1–60, deskripsi ≤ 300, `price_idr` bilangan bulat 0–`maxPriceIdr`, `compare_price_idr` > `price_idr` atau kosong, `badge` hanya dari `productBadges`, kategori ≤ 20 karakter, teks selalu di-*escape* (tanpa HTML/Markdown/tautan klik), foto sesuai B15. Pemilik hanya bisa mengubah produk di booth miliknya (`booth_id` diambil dari sesi, bukan dari body).

**Batas yang bisa diatur admin.** Batas efektif = `settings_json.maxProducts ?? CONFIG.booth.maxProducts`, dibatasi `1..maxProductsHardCap`. Pengecekan atomik di atas memakai batas efektif itu. Menurunkan batas tidak menghapus produk; `POST /api/booth/products` hanya menjawab `product_limit` sampai jumlahnya turun. Perubahan batas tercatat `admin.event_settings_changed` dan menaikkan `stats_version`.

**Pesan WhatsApp lewat pengalihan server (`/go/wa/:boothId`).** Tombol tidak berisi `wa.me/<nomor>`, melainkan `/go/wa/:boothId?p=:pid`. Worker mencari nomor, menyusun pesan awal (nama produk, harga saat itu, nama acara) lalu membalas **302 ke `https://wa.me/<nomor>?text=…`**. Manfaatnya:
- **Nomor tidak ada di HTML, snapshot, maupun JSON daftar**, jadi tidak bisa dipanen sekali jalan dari data publik. Perlu diakui jujur: begitu pengunjung menekan tombol, ia akan melihat nomornya di WhatsApp, dan penyerang yang gigih bisa memanggil tautan per booth. Karena itu dibatasi laju (`whatsapp.redirectRatePerMinute` per IP), dan nomor sebaiknya nomor usaha.
- **Bisa dimatikan terpusat**: setelah event selesai, pemilik menghapus nomor, atau admin menangguhkan booth, tautan langsung berhenti bekerja.
- **Bisa dihitung**: setiap pengalihan menulis `booth.wa_click` ke Analytics Engine (B13), tanpa data pribadi, untuk statistik pemilik.
- **Validasi**: nomor dinormalisasi (buang spasi/tanda; awalan `0` → `62`; `+62`/`62` diterima) dan harus berpola `62` + 8–13 digit; teks pesan di-*encode* dan dipotong `whatsapp.messageMaxLength`. Pesan dibuat server dari data produk, **bukan** dari parameter bebas, sehingga tautan tidak bisa dipakai membuat pesan sembarang (anti-penyalahgunaan).
- **Privasi**: nomor tersimpan di `booths.whatsapp_e164` dengan persetujuan (`whatsapp_consent_at`), tidak dikirim ke client mana pun, dan **dihapus otomatis** `whatsapp.deleteDaysAfterEventEnd` hari setelah event selesai (tugas terjadwal) atau saat event diarsipkan. Menghapus nomor oleh pemilik berlaku seketika.

**Bagikan.** Panel bagikan dibangun di client: `navigator.share` bila ada (HP), kalau tidak, salin tautan dan tautan `https://wa.me/?text=…` (tanpa nomor, memilih kontak sendiri). Tautan: `/b/:boothId?p=:productId&src=share`. Pratinjau tautan (B20, `HTMLRewriter`): bila `p` valid, `og:title` = "{produk} · {booth}", `og:description` memuat harga, `og:image` = foto produk (`thumb`/`full` aman publik); kalau tidak, memakai foto sampul booth seperti biasa. Parameter `p` hanya dipakai sebagai petunjuk gulir dan sorotan di client; tidak memengaruhi penilaian. `src=share` ikut masuk skor risiko review (A6, B9): lonjakan ulasan dari satu booth lewat tautan bagikan ditahan untuk diperiksa admin.

**Moderasi & log:** admin bisa menyembunyikan produk lewat Data Grid (tab **Produk**, alasan wajib; status `removed_by_admin`, pemilik tidak bisa memulihkannya). Log: `booth.product_created`, `booth.product_updated`, `booth.product_featured`, `booth.product_deleted`, `booth.whatsapp_set`, `booth.whatsapp_removed`, `admin.product_removed` (B13); metrik agregat `booth.wa_click` dan `booth.share_opened`. Pemilik harus mencentang aturan "dilarang menawarkan imbalan untuk bintang/ulasan" sebelum produk pertama tersimpan (disimpan sebagai `booths.product_terms_accepted_at`).

**Pengujian:** (1) 30 permintaan tambah serentak pada booth kosong → tepat 24 tersimpan; (2) selalu tepat satu andalan setelah ganti, sembunyikan, dan hapus; (3) `price_from` benar untuk campuran gratis/berbayar dan semua gratis; (4) pemilik booth lain tidak bisa mengubah produk; (5) filter kategori dan "lebih banyak" (6 → 12 → … → semua) dengan 1, 6, 7, 9, dan 24 produk; (6) daftar incaran menyaring produk yang hilang; (7) tidak ada data produk di respons snapshot selain ringkasan; (8) batas dari admin: diubah ke 10 → booth ke-11 ditolak, diubah ke 200 → ditolak validasi, diturunkan di bawah jumlah produk → tidak ada yang terhapus; (9) **nomor WhatsApp tidak pernah muncul** di respons API publik, snapshot, atau HTML; `/go/wa` ditolak setelah event selesai dan setelah nomor dihapus; nomor tak valid ditolak; (10) tautan `?p=` membuka produk yang benar (termasuk yang ada di halaman "lebih banyak") dan tidak error untuk `p` tak dikenal.

## B25. Moderasi kata & komentar (teknis)

Aturan ada di A15; di sini cara membangunnya. Prinsip: **penegakan di server** (client boleh memberi petunjuk, tetapi tidak dipercaya) dan **booth tidak punya jalur apa pun untuk mengubah `status` atau `comment_status`** (tidak ada endpoint, bukan hanya tombol yang disembunyikan; diuji, lihat bawah).

**Alur saat `POST /api/booths/:id/review`:**
1. Validasi biasa (Turnstile, sesi, batas panjang, B9, B21).
2. **Normalisasi** teks komentar: huruf kecil, NFKC (lebar penuh → biasa), buang aksen/penanda tak terlihat (zero-width), petakan karakter mirip (homoglyph) dan leetspeak (`4→a`, `1→i`, `3→e`, `0→o`, `$→s`, `@→a`), kurangi huruf berulang lebih dari dua (`anjiiing` → `anjiing`), dan buat varian tanpa pemisah (`a.n.j.i.n.g`, `a n j i n g` → `anjing`) hanya untuk pencocokan.
3. **Pencocokan** terhadap `moderation_terms` yang aktif: istilah pendek **hanya pada batas kata** (menghindari salah tangkap, masalah "Scunthorpe"); `contains` hanya untuk istilah panjang. Imbuhan bahasa Indonesia ditangani dengan memeriksa bentuk dasar tanpa awalan/akhiran umum (`me-`, `di-`, `ber-`, `-an`, `-nya`, `-lah`). Entri `allow` (pengecualian) menang atas `block`. Pencocokan typo/fuzzy **mati** (`CONFIG.moderation.fuzzyMatching`).
4. **Pola kontak/iklan**: nomor telepon, URL, email, dan ajakan seperti "DM/WA/hubungi saya" → temuan jenis `contact`.
5. **Putusan** menurut `severeAction`/`mildAction`/`holdContactInfo` (A15): set `comment_status` (`visible` | `masked` | `held`), isi `comment_masked` (kata disamarkan, huruf pertama dan terakhir dibiarkan), simpan `filter_hits_json` (id istilah) dan `filter_version`. **Bintang dan `booth_stats` tidak terpengaruh.**
6. Respons ke pengirim berisi pesan netral (tanpa menyebut kata). Teks asli tetap di kolom `comment`.

**Yang dikirim ke pengunjung lain:** server **tidak pernah mengirim** komentar yang `held` atau `hidden`; untuk `masked` hanya `comment_masked`. Spotlight/ulasan pilihan hanya memakai `comment_status = 'visible'`. Admin melihat teks asli dan temuan.

**Daftar kata dan lisensi.**
- Skrip build `scripts/build-terms` mengompilasi daftar awal dari sumber di A15 ke satu berkas JSON ber-versi (Indonesia + Inggris + regional), menggabungkan duplikat, dan menandai tingkat (`severe`/`mild`) dari kategori sumber, lalu **ditinjau panitia** sebelum dipakai (berkas hasil review di-commit). Tidak ada daftar kata di dokumen ini atau di log.
- `THIRD_PARTY_NOTICES` memuat pemberitahuan lisensi (MIT, CC BY 4.0) tiap sumber yang dipakai. Dataset berlisensi **non-komersial (CC BY-NC-SA)** tidak masuk bundle; hanya untuk uji internal.
- Pada awal event, daftar dimuat ke `moderation_terms` per event; admin dapat mengubahnya tanpa deploy. Setiap perubahan menaikkan `filter_version` dan dicatat (`moderation.terms_changed`).
- Performa: daftar dikompilasi sekali per versi (struktur pencarian di memori isolat), pemeriksaan satu komentar (≤ 280 karakter) sangat murah; **ukuran bundle dan waktu per pemeriksaan harus diukur** di Workers sebelum menetapkan batas.
- **Mesin pencocok**: uji dulu `indonesian-badwords` (Node 22+, tanpa dependensi) dan `obscenity` di runtime Workers (`wrangler dev`); keduanya hanya menyebut Node di dokumentasinya. **Cadangan**: pencocok buatan sendiri (± seratus baris) di atas daftar yang sudah dikompilasi, sehingga tidak bergantung pada kompatibilitas paket.

**Laporan.** `POST /api/booth/reviews/:id/report` dan `POST /api/reviews/:id/report` hanya menulis baris `review_reports` (satu per pelapor per komentar, batas laju); tidak mengubah `comment_status`. Penanda "pelaporan mencurigakan" dihitung saat antrean dibuka: untuk tiap booth, proporsi laporannya yang tertuju ke komentar berbintang ≤ 3 **tanpa** temuan filter ≥ `suspiciousReportRatio` dengan minimal `suspiciousReportMin` laporan.

**Keputusan admin.** `PATCH …/reviews/:rid/comment` dan `POST …/moderation/reports/:rid` berjalan dalam satu `batch()` D1: simpan `original_comment` bila kosong, ubah `comment_status`, tulis keputusan laporan, naikkan `stats_version` (agar cache snapshot berganti), dan catat log. Memulihkan komentar (`visible`) menyetel `comment_locked = 1` bila admin memilih "kunci".

**Pengujian:**
1. **Booth tidak bisa menyembunyikan**: dengan sesi booth, semua endpoint yang mengubah `status`/`comment_status` mengembalikan 403; `POST …/report` tidak mengubah `comment_status`.
2. **Korpus salah-tangkap**: ratusan kata/kalimat Indonesia dan Inggris yang wajar (nama tempat, istilah teknik/biologi/medis, kata berimbuhan) **tidak boleh** tertangkap; setiap salah tangkap yang ditemukan menambah entri `allow` dan satu uji.
3. **Korpus lolos**: variasi tulisan (leetspeak, huruf berulang, pemisah, huruf besar-kecil acak, Unicode mirip) dari sampel kata berat **harus** tertangkap.
4. Bintang tetap terhitung di `booth_stats` untuk komentar `held`/`masked`; ulasan pilihan tidak pernah memuat komentar non-`visible`; komentar `held` tidak ada di respons publik, snapshot, maupun LiveHub.
5. Batas laju dan penanda pelaporan mencurigakan.
6. Uji kinerja: waktu pemeriksaan satu komentar dan ukuran bundle di Workers.

*(Status Tahap 6: mesin pencocok **buatan sendiri** di `shared/moderation.ts` (cadangan yang disebut di atas; paket pihak ketiga tidak dipakai), daftar **awal** `shared/moderation-seed.ts` (belum dari sumber A15 dan belum ditinjau panitia; `build-terms` dan `THIRD_PARTY_NOTICES` belum ada). Terukur: < 2 ms per komentar 280 huruf di Node; ukuran bundle di Workers belum diukur. Laporan oleh booth menunggu sesi booth (Tahap 8).)*

**Catatan jujur:** filter kata mengurangi, bukan menghilangkan, komentar kasar. Lapisan antreannya (laporan dan admin) dibuat supaya yang lolos tetap bisa ditangani cepat selama event berlangsung.

## B26. Booth buatan admin & komponen tahan data kosong (teknis)

Aturan dan tampilannya ada di A16; di sini cara membangunnya.

### Booth tanpa pemilik

- **Skema**: `booths.email` boleh `NULL`, `name` satu-satunya kolom wajib (B6). Status pemilik **dihitung**, tidak disimpan: `email IS NULL` → tanpa pemilik; email terisi dan `owner_last_login_at IS NULL` → diundang; sisanya aktif.
- **Satu layanan, dua pintu.** Logika booth (profil, foto, produk, WhatsApp) ada di modul layanan yang sama; route pemilik mengambil `boothId` dari **sesi**, route admin mengambil dari **path** dan peran admin (B10). Dengan begitu aturan validasi, batas produk atomik (B24), dan penjaga klik ganda (B21) tidak ada dua versi.
- **Pembuatan oleh admin** (`POST /api/admin/e/:id/booths`): `created_by = 'admin'`, `is_late = 0`, `status = approved` (selalu langsung tayang), `approved_by` diisi admin, `booth_stats` dibuat dalam `batch()` yang sama. Menaikkan `events.stats_version` agar snapshot berganti. Memakai `Idempotency-Key` (B21) supaya klik ganda tidak membuat dua booth.
- **Email dinormalisasi** (huruf kecil, trim) dan dicek unik per event; konflik → `409 email_in_use`. Bila ada booth mandiri `pending` dengan email yang sama, admin memilih menyetujui booth itu atau mengosongkan email, bukan menimpa.
- **Email**: modul `email` melewati booth tanpa email (`{ skipped: "no_owner" }`) dan menulis `email.skipped` di log; tidak ada kegagalan karena penerima kosong.
- **Persetujuan atas nama pemilik**: nomor WhatsApp yang diisi admin hanya diterima bila `consentConfirmedByAdmin = true`; tersimpan `whatsapp_consent_by = 'admin'`. Aturan produk A14 yang dicentang admin disimpan di `product_terms_accepted_at` yang sama dan tercatat dengan `actor` admin.
- **Log**: `admin.booth_created`, `admin.booth_owner_set`, `admin.booth_owner_removed`, `admin.booth_invite_sent`, `admin.booth_edited` (nilai sebelum/sesudah di `meta`), `email.skipped` (B13). Alasan tidak diminta untuk booth tanpa pemilik, wajib untuk booth berpemilik aktif.
- **Data Grid**: "+ Booth" memanggil endpoint pembuatan (bukan `PATCH …/bulk`), sehingga tidak butuh alasan; sel email pemilik masuk alur perubahan tertunda biasa (B18) dan dikirim lewat `PUT …/owner`.

### Impor CSV booth (MVP)

Tampilannya di A16; ini rancangan teknisnya.

- **Di client (chunk `areas/admin`)**: halaman `/admin/e/:id/booths/import`. Pustaka parser CSV kecil **di-`import()` saat file dipilih** (tidak ikut bundle awal, B16). Menerima `.csv` dengan pemisah **koma atau titik koma** (Excel berbahasa Indonesia memakai titik koma), UTF-8 dengan atau tanpa BOM, dan **tempel langsung dari spreadsheet**. Nama kolom tidak membedakan huruf besar-kecil dan menerima alias (`nama`/`name`, `nomor_booth`/`no`/`nomor`, `email`, `tagline`, `deskripsi`/`description`). Kolom di luar daftar diabaikan; kolom `nama` wajib ada, **kolom `email` boleh tidak ada**. Templat CSV dibuat di browser (tanpa berkas di repo).
- **Pratinjau** (`ImportPreviewTable`, memakai `DataTable`): tiap baris berstatus OK / Peringatan / Galat dengan alasan, dihitung di browser dari `shared/schemas.ts` yang sama dengan server.
  - **Galat (tidak diimpor):** nama kosong atau > 60 karakter; email tidak valid; email ganda di dalam file; email sudah dipakai booth di event ini; melebihi `CONFIG.booths.csvMaxRows`.
  - **Peringatan (default dilewati, admin boleh "Tetap buat"):** nama persis sama (tanpa membedakan huruf besar-kecil) dengan booth yang sudah ada, atau nomor booth kembar. Ini mencegah booth ganda bila file yang sama diunggah dua kali.
  - Baris bermasalah bisa **diunduh kembali sebagai CSV** (dengan kolom `alasan`) untuk diperbaiki.
- **Kirim**: client mengirim **JSON hasil parsing** (bukan berkas) ke `POST …/booths/import`, maksimal `csvMaxRows` (500) baris. Server **memvalidasi ulang semuanya** dengan Zod dan tidak mempercayai pratinjau.
- **Di server**: baris dipecah per `csvChunkSize` (50) dan tiap potongan ditulis dalam satu `batch()` D1 (booth + `booth_stats`), jadi potongan bersifat atomik. Semua booth: `created_by = 'admin'`, `is_late = 0`, `status = approved`; `email` kosong = tanpa pemilik, `email` terisi = status *diundang* **tanpa mengirim email apa pun**. `events.stats_version` dinaikkan **sekali** di akhir, bukan per baris.
- **Anti-ganda**: `Idempotency-Key` memuat hash isi baris (B21), jadi klik ganda atau jaringan putus lalu coba lagi tidak membuat booth ganda; email unik per event menjadi lapis terakhir (B6). Respons berisi hasil **per baris** (`created | skipped | error` + alasan) dan ditampilkan sebagai ringkasan "42 dibuat, 3 dilewati, 1 galat".
- **Hak akses dan jadwal**: hanya admin; tidak melewati penutupan pendaftaran maupun `eventWriteGate`, jadi bisa dipakai kapan pun termasuk setelah event selesai.
- **Log**: satu entri `admin.booths_imported` (jumlah dibuat/dilewati/galat, tanpa isi berkas) dan satu `admin.booth_created` per booth (B13).
- **Booth hasil impor biasanya hanya nama**, sehingga langsung memakai tampilan data kosong di atas (bingkai, hanya-teks, atau hilang). Admin kemudian melengkapi lewat editor booth atau Data Grid (filter kelengkapan "Hanya nama").

### Data tidak lengkap: kontrak data

- **Server mengirim `null` atau `[]`, tidak pernah URL pengganti.** Snapshot per booth memuat `coverThumbKey: string | null`, `boothNo: string | null`, `tagline: string | null`, dan seterusnya. Tidak ada gambar placeholder di R2.
- **Satu modul murni `shared/visual.ts`** (dipakai client, server, dan uji):

```ts
export const hasText = (v?: string | null) => !!v && v.trim().length > 0;

// Satu keputusan untuk SELURUH daftar, bukan per kartu (A16)
export const gridVisualMode = (items: { coverThumbKey: string | null }[]): "photo" | "text" =>
  items.some(i => i.coverThumbKey) ? "photo" : "text";   // "photo": yang kosong memakai bingkai

export const completeness = (b: BoothPublic): "name_only" | "partial" | "full" => {
  const has = [!!b.coverThumbKey, hasText(b.description), hasText(b.tagline), hasText(b.boothNo)];
  if (!has.some(Boolean)) return "name_only";
  return has.every(Boolean) ? "full" : "partial";       // ambang di CONFIG.profile
};

// Inisial aman untuk nama apa pun: huruf/angka pertama dari maks. 2 kata; cadangan = nomor booth
export const initials = (name: string, boothNo?: string | null) => {
  const parts = name.trim().split(/\s+/).map(w => w.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean) as string[];
  return (parts.slice(0, 2).join("") || boothNo || "•").toUpperCase();
};
```

### Komponen

```tsx
// components/shared/SafeImage.tsx  (satu-satunya tempat <img> ditulis)
function SafeImage({ src, alt = "", aspect, fallback }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);            // kunci baru = coba lagi
  if (!src || failed) return fallback ?? null;         // null → induk tidak menyisakan celah
  return <img src={src} alt={alt} decoding="async" loading="lazy"
              style={{ aspectRatio: aspect }} onError={() => setFailed(true)} />;
}

// Strategi HILANG / HANYA-TEKS (diperbarui atas permintaan pemilik proyek):
// Ketika foto kosong atau gagal dimuat, jangan tampilkan PhotoFrame (kotak inisial);
// tampilkan bersih nama/teks saja agar tampilan tidak penuh kotak placeholder.
<SafeImage src={thumbUrl(b.coverThumbKey)} aspect="4/3" fallback={null} />

// Strategi HANYA TEKS (tata letak berganti): dipilih di komponen induk
const hasPhoto = !!b.coverKey;
<section className={hasPhoto ? "spot spot--photo" : "spot spot--text"}> … </section>
```

- **Tanpa foto (diperbarui)**: ketika gambar kosong atau gagal dimuat (`fallback={null}`), komponen tidak menampilkan kotak inisial (`PhotoFrame` / `BD`), melainkan langsung merapikan tata letak ke mode bersih **hanya nama & data teks** (berlaku pada `WinnerReveal`, `ResultsList`, `BoothCard`, `ProductCard`, dan `ScreenPanels`).
- **Ukuran tetap saat ada foto**: `SafeImage` tetap memakai `aspect-ratio` yang sama dengan gambar aslinya sehingga tidak ada *layout shift* saat gambar dimuat.
- **`Present`** membungkus tiap bagian opsional (tagline, deskripsi, "Kenalan", produk, stiker nomor). Karena mengembalikan `null`, `gap` pada induk flex/grid tidak menyisakan celah dan judul bagian tidak pernah tampil sendirian. Judul bagian selalu **anak** dari `Present`, bukan saudaranya.
- **Pergeseran saat gambar gagal**: bila `src` ada tetapi gagal dimuat, strategi *bingkai* dan *hanya teks* berganti tanpa mengubah ukuran; strategi *hilang* boleh bergeser sedikit (kasus langka, tidak diperhalus). Ruang dipertahankan selama gambar masih dimuat.
- **Aksesibilitas**: gambar dekoratif memakai `alt=""`; bingkai `aria-hidden` karena nama booth sudah ada sebagai teks di sebelahnya.
- **Pratinjau tautan** (`HTMLRewriter`, B20): urutan `og:image` = foto produk (bila `?p=`) → foto sampul booth → gambar OG event → **tag tidak dikirim**. Tidak pernah URL kosong.
- **Hero**: `PolaroidCollage` menerima 0 sampai 3 kunci; jumlah bingkai mengikuti, 0 membuat hero satu kolom.

### Penjaga di repo

- **Aturan lint `no-raw-img`** pada `scripts/lint-tokens.mjs` (B3): `<img>`, `background-image` dari data, dan `new Image()` di luar `SafeImage` ditolak saat build. Ini yang membuat prinsip "tidak ada gambar rusak" tidak bisa dilanggar halaman baru.
- Setiap bagian opsional yang dirender di luar `Present` ditandai oleh aturan lint yang sama bila datanya bertipe `string | null`.

### Pengujian

1. **Matriks fixture** untuk setiap komponen di `shared/` dan `areas/event`: `hanyaNama`, `namaDanNomor`, `lengkap`, `fotoGagal404`, `stringKosongDanSpasi`, `namaSangatPanjang` (60 karakter), `namaEmojiAtauSimbol`. Asersi: tidak ada `<img>` tanpa `src`, tidak ada heading tanpa isi, tidak ada elemen kosong berbingkai, tidak ada teks "tidak tersedia"/"not found".
2. **Keadilan**: kartu `hanyaNama`, `namaDanNomor`, dan `lengkap` dalam satu grid memiliki lebar dan tinggi sama; urutan acak (B20) tidak bergantung pada kelengkapan data.
3. **Mode grid**: semua kosong → mode hanya-teks; satu saja berfoto → sisanya berbingkai.
4. **Foto gagal**: pada `fotoGagal404` (respons 404 dari `MEDIA_BASE_URL`) hasilnya identik dengan "tanpa foto"; tidak ada ikon rusak browser.
5. **Booth hanya nama, ujung ke ujung**: dibuat admin → muncul di grid → sorotan → halaman booth → dinilai → masuk peringkat → baris hasil akhir → poster QR; tidak ada galat konsol dan tidak ada bagian kosong.
6. **Pemilik**: melepas pemilik membuat aksi tulis sesi lama `401 owner_changed`; booth tanpa pemilik tidak bisa dicapai OTP; email notifikasi dilewati tanpa galat; pemeriksaan "booth menilai diri" (B9) dilewati; email ganda → `409 email_in_use`; klik ganda "Tambah booth" membuat satu booth.
8. **Impor CSV**: pemisah koma dan titik koma, BOM, tanpa kolom email, kolom bernama alias, baris kosong, spasi berlebih; email ganda dalam file dan email yang sudah dipakai → galat; nama kembar → peringatan (dilewati secara bawaan); 501 baris → ditolak; unggah file yang sama dua kali tidak membuat booth ganda; satu potongan gagal tidak membatalkan potongan lain dan hasil per baris tetap benar; tidak ada email terkirim; 500 booth hanya nama muncul di grid dalam mode hanya-teks tanpa galat.
7. **Galeri `/dev/components`** (B14): setiap komponen tampil dengan kolom baru **"Data kosong"** (tiga fixture di atas) di semua tema, untuk pemeriksaan visual cepat.

---

# Keputusan Terbuka

Jawaban atas ini akan mengubah rancangan; yang bercetak tebal paling berpengaruh.

1. **Skala perkiraan**: berapa booth dan berapa pengunjung yang akan menilai? (menentukan perlu-tidaknya batas viewer/uji beban berat)
2. **Mode verifikasi reviewer**: apakah ada meja registrasi untuk membagi **kode tiket**? Jika tidak, setuju default **Google 1-tap + email OTP**?
3. **Satu bintang keseluruhan** atau **multi-kriteria** (Kreativitas, Inovasi, dst.)? Saran: satu bintang untuk MVP.
4. ~~Kategori pemenang~~ **Selesai**: tidak ada kategori booth; pemenang utama hanya Booth Terfavorit. Yang ada adalah **kategori ulasan** (chip) yang diatur admin (A5).
5. **Email**: pakai Cloudflare Email Service (jika sudah tersedia untukmu) atau penyedia lain (Resend/Brevo)? Dan perlukah auto-approve dari daftar email undangan?
6. **Review ditahan**: review yang ditandai anomali **ditahan sampai admin setuju** (aman, tapi butuh admin siaga) atau **tampil dulu lalu bisa disembunyikan** (lebih "live", lebih berisiko)?
7. **Branding**: domain sudah ada (`eventunimed.id`, B12). Warna default sudah mengikuti palet UNIMED (B4); apakah LPPM punya pedoman warna/logo resmi yang perlu dipatuhi, dan boleh memakai logo UNIMED?
8. **Prefill form booth** dari event sebelumnya (tetap akun baru) — dipakai atau tidak?
9. **Retensi log**: cukup 3 bulan (Analytics Engine), atau perlu arsip jangka panjang di R2 untuk bukti/akuntabilitas LPPM?
10. ~~Pembagian area~~ **Selesai**: "tampilan all toko" = halaman event dengan daftar semua booth → area `event` (B16).
11. ~~Domain untuk gambar~~ **Selesai**: `eventunimed.id` sudah di Cloudflare → gambar dilayani dari `media.eventunimed.id` (Custom Domain R2), B15.
12. ~~Jendela voting~~ **Selesai**: pendaftaran terbuka sejak event dibuat; review terbuka tepat selama jadwal event (mulai → selesai). Kolom jadwal voting terpisah dihapus (A2, B6, B17).
13. ~~Subdomain aplikasi~~ **Selesai**: aplikasi di domain utama `eventunimed.id` (akar), karena hanya ada satu event aktif (A0).
14. ~~Booth setelah event selesai~~ **Selesai**: semua tampilan **hanya-baca**; portal booth tetap bisa dibuka (login OTP akun yang sudah ada) tetapi tidak bisa mengubah apa pun (A2, B17).
15. ~~Sunting review oleh admin~~ **Selesai**: admin boleh mengubah bintang/komentar/status (alasan wajib, nilai asli tersimpan) lewat **halaman Data ala Excel** (A3, B18). Membuat review baru atas nama admin tetap tidak disertakan kecuali kamu minta.
16. **Format ekspor**: cukup **CSV**, atau perlu **XLSX** juga di MVP? (CSV sudah masuk MVP; XLSX dijadwalkan v1.)
17. ~~Gaya gerak (A12)~~ **Selesai (diperbarui)**: Pop sebagai bawaan gaya Seru dan Glide untuk Profesional/Layar, dengan `prefers-reduced-motion`. **Animasi pemenang** ditingkatkan menjadi gaya **motion graphic** lengkap dengan pita, bunting, kilau bintang, confetti palet UNIMED, piala vektor SVG (tanpa emoji), serta efek suara B23 bawaan nyala (lihat item 40–41 dan A8).
18. **Spotlight & ulasan pilihan (A8)**: saya mengartikan "yang bagus saja" sebagai **ulasan yang tampil di spotlight hanya ★4–5, komentar ≥ 30 karakter, lolos moderasi, dan bisa disematkan admin**. Apakah juga perlu **booth yang ratingnya rendah tidak disorot**, atau semua booth tetap kebagian giliran (saran: semua tetap kebagian, karena tujuannya pemerataan)? Berapa **foto minimal/maksimal** per booth? *(Diperbarui: foto **tidak wajib**, minimal 0; maksimal tetap 6. Booth tanpa foto memakai bingkai atau tata letak hanya-teks, A16.)*
19. ~~Peringkat di Layar Besar~~ **Selesai**: boleh tampil, tetapi **selalu panel terakhir/paling bawah**, tidak pernah di atas, supaya tidak ada sorotan ke peringkat 1 (A8).
20. ~~Kategori ulasan~~ **Selesai**: hanya **chip pilihan** untuk meramaikan, diatur admin (A5). Ditambahkan: **peringkat adalah komponen opsional** yang bisa disembunyikan admin, dan admin bisa **memutar animasi pemenang** (A3, A8, B20).
21. ~~Font~~ **Selesai**: font sekarang disetujui (Bricolage Grotesque, DM Sans, Caveat) dan **semua dipanggil lewat nama variabel** supaya mudah diganti (A12, B4, B20).
22. ~~Referensi tampilan~~ **Diterapkan**: gambar di hero dibuat lebih menonjol (A12 butir 3b). Lihat pertanyaan 39.
23. ~~Mode peringkat bawaan & rating~~ **Selesai**: opsi **menyembunyikan rating** disediakan dan **diatur admin sebagai moderasi** (kapan saja); peringkat ikut tersembunyi bila rating disembunyikan (A3, B20). Mode bawaan: tampil.
24. ~~Animasi pemenang~~ **Selesai**: setelah event selesai dan hasil diumumkan, **setiap pengunjung yang membuka/menyegarkan halaman event melihat animasi pemenang**, lalu bisa menutupnya untuk masuk mode hanya-baca (A8, B20).
25. ~~Kapan animasi otomatis mulai~~ **Selesai (disetujui)**: animasi otomatis baru berlaku bila **event selesai DAN admin sudah menekan "Umumkan hasil"**. Sebelum itu pengunjung melihat "Hasil segera diumumkan" (A8, B20).
26. ~~Opsi tidak putar lagi~~ **Selesai (disetujui)**: opsi **"Jangan putar otomatis lagi di perangkat ini"** disediakan; disimpan di browser dan menyala kembali bila admin memperbarui hasil (A8, B20).
27. ~~Daftar hasil akhir~~ **Selesai**: seluruh booth masuk daftar berurutan, **juara 1–3 berbingkai berbeda**, sisanya seragam, dan **setiap baris menampilkan skor serta tag ulasan teratas buatan admin** (A8, B14).
28. ~~Gaya bawaan~~ **Selesai (sementara)**: **Seru** untuk halaman pengunjung; **Profesional**, tanpa unsur seru, hanya untuk admin, portal booth, dan cadangan. Ini tafsiran saya atas jawabanmu "hanya sebagai profesional, tidak ada serunya"; koreksi bila maksudnya lain (A12).
29. ~~Nada bahasa~~ **Selesai**: santai dan **mengajak** (kamu, yuk, cobain, mampir), bukan sekadar informasi. Panduan dan contoh teks ada di A12; sudah diterapkan di demo.
30. ~~Warna stiker tambahan~~ **Diimplementasikan untuk dilihat**: demo punya saklar **WARNA STIKER** (*dengan kuning/merah muda/biru muda* vs *hanya hijau-oranye-krem*), sehingga bisa dibandingkan langsung.
31. ~~Pilihan warna stiker~~ **Selesai**: palet **hijau-oranye-krem** (template warna UNIMED saja); saklar perbandingan masih ada di demo.
32. **Aset dari LPPM (opsional)**: logo kecil, alamat/email/telepon, dan media sosial untuk kaki halaman. Tidak ada lagi foto hero atau navigasi yang bergantung pada aset itu.
33. ~~Menu navigasi~~ **Selesai**: **tidak ada navigasi**; halaman utama langsung berisi event aktif (A0, A12).
34. ~~Kata beraksen di judul~~ **Selesai**: judul memakai dua blok stiker (*Terfavorit* pada blok hijau, "LPPM Expo Tahun 2026" pada pita oranye), bukan kata bergaris oranye ala UNIMED (A12).
35. ~~Font mengikuti UNIMED~~ **Selesai**: font **tidak** mengikuti UNIMED (hanya warna). Pilihan font tetap pertanyaan 21.
36. ~~Halaman saat tidak ada event aktif~~ **Selesai (disetujui)**: layar sederhana "Segera hadir" bernama LPPM (A0).
37. ~~Setelah event selesai~~ **Selesai**: event selesai tetap tampil hanya-baca selama belum ada pengganti; **begitu admin mengaktifkan event lain, event lama otomatis disembunyikan** dari publik (A0).
38. ~~Target Baseline~~ **Selesai (disetujui: pilih yang paling aman)**: hanya memakai fitur web yang sudah lama didukung semua browser utama (*Widely available*); fitur yang lebih baru hanya dengan cadangan (B22). Tidak ada tindakan tambahan dari pemilik proyek; pemasangan skill Modern Web Guidance bersifat opsional.
39. ~~Hero~~ **Didesain ulang** (A12 butir 3): judul dua baris selebar kontainer, kiri sapaan + tombol, kanan kipas tiga foto; di HP satu kolom dengan foto yang bisa digeser. Lihat pertanyaan 43.
40. ~~Suara bawaan~~ **Selesai (disetujui)**: bawaan nyala dengan volume rendah, tombol mute selalu terlihat, dan mati otomatis bila perangkat meminta gerak minimal (B23).
41. ~~Daftar suara~~ **Selesai (disetujui)**: suara hover dimatikan bawaan; yang aktif adalah klik, bintang, berhasil/gagal, dan momen hasil (B23).
42. ~~Ikon kursor~~ **Selesai (disetujui)** (B23).
43. **Hero (sesuai brief klien)**: kanvas krem + grid grafik, doodle kuliner, judul sebagai fokus utama dengan lencana tahun yang lebih kecil, deskripsi + baris sorotan, CTA hitam berpanah dengan efek tekan, tiga foto kuliner dengan stiker di margin polaroid, dan teks yang berubah menurut status event. Sudah sesuai, atau ada yang masih perlu disesuaikan?
44. **Halaman booth baru**: tombol kembali berbentuk pil tebal, foto menjadi slideshow polaroid yang berganti otomatis tiap 3,5 detik (jeda saat disentuh/di-hover, tombol jeda, mulai dijeda bila gerak minimal), nama booth besar dengan stiker nomor dan chip, serta CTA berpanah. Sudah sesuai? Apakah 3,5 detik pas, atau terlalu cepat/lambat? Bagian isi kini berbingkai kartu dan teks "Kenalan" yang panjang dipotong 4 baris dengan tombol "Baca selengkapnya"; apakah batas 2000 karakter dan 4 baris cukup?

45. ~~Produk & promosi booth~~ **Selesai (disetujui)**: setiap booth boleh memajang produk dan harga; **maksimal 24 produk per booth** dan **satu produk andalan yang dipilih oleh toko** (A14, B24). Web hanya etalase: tidak ada pembayaran, transaksi di booth. Demo: saklar **PRODUK & HARGA**.
46. ~~Pesan WhatsApp & bagikan~~ **Selesai (disetujui)**: pemilik booth **boleh (opsional)** mengisi nomor WhatsApp; tombol **"Pesan dulu lewat WA"** membuka chat dengan pesan sudah terisi, **nomor tidak ditampilkan sebagai teks dan tidak ada di data publik** (lewat pengalihan `/go/wa`, B24). Ditambah fitur **Bagikan** (booth dan produk) untuk pengunjung dan pemilik (A14). Demo: tombol WA dan Bagikan di halaman booth.
47. ~~Produk wajib atau tidak~~ **Selesai (disetujui)**: **mengisi produk sepenuhnya opsional** bagi booth; tidak ada syarat minimal.
48. ~~Batas per event~~ **Selesai (disetujui)**: **admin dapat mengatur batas produk per booth per event; 24 adalah bawaan** (pagar atas 100, A14, B24).
49. **Nomor WhatsApp: persetujuan dan penghapusan.** Usulan yang sudah dirancang: pemilik wajib menyetujui, nomor dihapus otomatis 30 hari setelah event selesai. Apakah 30 hari cukup, atau panitia ingin nomor dihapus langsung saat event selesai?
50. ~~Booth menyembunyikan komentar~~ **Dibatalkan (keputusan)**: booth **tidak boleh** menyembunyikan atau menghapus komentar karena bisa dipakai untuk membuang komentar jelek dan merusak keadilan. Booth hanya bisa **melaporkan**; yang menyembunyikan hanya **filter otomatis dan admin** (A15, B25).
51. **Daftar kata awal (perlu ditinjau panitia)**: usulan menyusunnya dari `indonesian-badwords` (MIT) + `abaron/bad-words` (MIT) + daftar Inggris (mis. dari `obscenity`, MIT) lalu **ditinjau manusia** sebelum dipakai; dataset CC BY-NC-SA tidak dibundel. Siapa di panitia yang meninjau dan menyetujui daftar awal itu?
52. **Tindakan default filter**: usulan komentar **berat → ditahan** (bintang tetap dihitung), **ringan → tayang dengan kata disamarkan**, kontak/tautan/iklan → ditahan. Sesuai, atau ingin semua temuan ditahan dulu sampai admin menyetujui (lebih aman, tetapi butuh admin siaga)?
53. **Klasifikasi AI** (OpenAI/Workers AI): usulan **tidak dipakai di MVP** (bahasa Indonesia tidak terdokumentasi, teks dikirim ke pihak ketiga, Perspective API ditutup 31 Des 2026). Bisa dievaluasi setelah ada contoh komentar nyata.
54. ~~Booth dibuat admin / tanpa pemilik~~ **Diterapkan (permintaan baru)**: admin dapat membuat dan mengelola booth sendiri; **pemilik boleh tidak ada**; data minimal hanya **nama**. Pemilik bisa ditambah (isi email) atau dilepas kapan saja, dan sesi lamanya otomatis tidak sah (A16, B7, B26). **Disetujui:** (a) **email pemilik benar-benar opsional**, booth berjalan penuh tanpa email dan semua keputusan ada di admin; (b) booth buatan admin **selalu langsung tayang**, tanpa opsi draf; (c) untuk booth **tanpa pemilik** admin tidak perlu mengisi alasan saat mengubahnya (tetap tercatat di log), sedangkan untuk booth berpemilik aktif alasan tetap wajib; (d) mengisi email pemilik **tidak otomatis mengirim email**, undangan lewat tombol terpisah.
55. ~~Komponen tanpa gambar~~ **Diperbarui atas permintaan pemilik proyek**: tidak ada "gambar tidak ditemukan" dan **tidak memakai bingkai inisial (`BD` / `PhotoFrame`) ketika gambar tidak ada**. Karena foto sepenuhnya opsional, item tanpa gambar (atau gagal dimuat) tampil **bersih hanya nama & teks saja** di seluruh komponen (`WinnerReveal`, `ResultsList`, `BoothCard`, `ProductCard`, `ScreenPanels`).
56. ~~Foto wajib untuk pendaftaran mandiri~~ **Selesai (disetujui): foto sepenuhnya opsional**, tanpa pengaturan untuk mewajibkannya. Dasarnya: bila tidak ada gambar, semua komponen beralih ke bingkai, hanya-teks, atau hilang (A16, B26). Form dan portal hanya memberi saran lembut.
57. ~~Impor CSV booth~~ **Selesai (disetujui): masuk MVP.** Kolom wajib hanya `nama`; email dan kolom lain opsional; semua baris langsung tayang (A16, B26).
58. **Ambang minimal review untuk masuk peringkat (A7).** Bawaan saat ini `minReviewsToRank = 3` dan `m = 5`. Uji Tahap 2 menunjukkan bila rata-rata semua review ≈ 4,8, booth 3 review ★5 mengalahkan booth 80 review 4,8 apa pun `m`-nya. Pilihan: (a) naikkan `minReviewsToRank` (mis. 5–10, sesuai perkiraan jumlah review per booth; **perlu perkiraan skala, item 1**); (b) ganti rumus dengan batas bawah interval Wilson (lebih tegas terhadap sampel kecil, tetapi lebih sulit dijelaskan ke pengunjung); (c) biarkan seperti sekarang. Saran saya: (a).

> Sudah diputuskan: realtime = Hibrida A + C (B8); gambar dikonversi ke WebP di client dan disimpan di R2 via `media.eventunimed.id` (B15); kode dipisah per area dalam satu SPA (B16); jadwal event dinamis, tombol daftar hilang otomatis tetapi **link `/register` tetap hidup untuk pendaftaran susulan** sampai event selesai, semua pendaftaran wajib diverifikasi admin (A2, B17); **event selesai = dibekukan, semua tampilan hanya-baca, hanya admin yang bisa mengubah apa pun** (A2, B17); **admin punya halaman Data ala Excel untuk melihat dan menyunting semua data** (A3, B18); **peringkat adalah komponen opsional (admin bisa menyembunyikannya, tampil paling bawah, di layar besar juga panel terakhir), rating bisa disembunyikan admin sebagai moderasi, admin bisa memutar animasi pemenang, dan setelah hasil diumumkan setiap pengunjung yang membuka halaman event melihat animasi pemenang lalu bisa menutupnya ke mode hanya-baca (dengan opsi "jangan putar otomatis lagi di perangkat ini")** (A3, A8, B20); font di-host sendiri dan **dipanggil lewat nama variabel supaya mudah diganti** (font sekarang: Bricolage Grotesque, DM Sans, Caveat) (B4, B20); **hasil akhir menampilkan skor dan tag ulasan buatan admin** (A8); **gaya visual halaman pengunjung dibuat Seru (scrapbook/polaroid/stiker) dengan bahasa santai yang mengajak (kamu, yuk, cobain, mampir); gaya Profesional dipakai untuk admin dan cadangan** (A12); **nama resmi acara "Penilaian Booth Terfavorit LPPM Expo Tahun 2026" menjadi judul utama; dari UNIMED hanya palet warna yang ditiru (tanpa navigasi, tanpa meniru tata letaknya)** (A12); **hanya ada satu event aktif, tampil langsung di domain utama tanpa slug** (A0); **kode web mengikuti Baseline (Widely available) dan Modern Web Guidance** (B22); **setiap interaksi punya efek klik, suara sintesis (tanpa berkas audio), dan ikon kursor sendiri, semuanya bisa dimatikan** (B23); **setiap aksi yang mengubah data dilindungi dari klik ganda dengan tombol ber-loader, `Idempotency-Key`, dan batasan unik** (B21); **booth boleh memajang produk dan harga (maksimal 24, satu produk andalan dipilih toko, web hanya etalase tanpa pembayaran, dilarang menawarkan imbalan untuk bintang)** (A14, B24); **admin dapat membuat booth sendiri tanpa pemilik, hanya nama yang wajib, dan semua komponen tetap bekerja bila foto, nomor, atau teks kosong (bingkai, hanya-teks, atau hilang; tidak pernah gambar rusak)** (A16, B26).
