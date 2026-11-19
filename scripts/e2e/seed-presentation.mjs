// Data presentasi (BUKAN data uji teknis): event nyata dengan 10 booth makanan khas Medan tanpa foto, produk berharga,
// pengunjung bernama, dan review (sebagian tanpa komentar, sebagian anonim). Semuanya lewat API sungguhan, jadi
// statistik, peringkat, dan umpan terhitung seperti di hari-H. Event aktif lama DIARSIPKAN (nama diberi "[Arsip uji]"),
// bukan dihapus. Hanya untuk dev lokal (localhost + APP_ENV=development: login admin dev dan kode OTP `devCode`).
//
//   npx vite --port 5173         (dev server hidup)
//   E2E_BASE=http://localhost:5173 node scripts/e2e/seed-presentation.mjs
const BASE = process.env.E2E_BASE ?? "http://localhost:5173";
// Data nyata dari panitia hanya berisi NAMA booth dan INSTITUSI/FAKULTAS. Bawaan: hanya itu (tanpa nomor, tagline, deskripsi,
// produk). EXTRAS=1 menambah nomor/tagline/deskripsi/produk contoh (untuk uji tampilan data lengkap).
const EXTRAS = process.env.EXTRAS === "1";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------- data ----------
const BOOTHS = [
  { no: "A1", name: "Bika Ambon Medan Asli", team: "Prodi Pendidikan Tata Boga · Fakultas Teknik", tagline: "Berpori, lembut, wangi pandan.", about: "Bika ambon khas Medan buatan mahasiswa Tata Boga, dipanggang tanpa pengawet.", mean: 4.65, n: 11,
    products: [["Bika Ambon Original potong", 7000, null, null, "Kue"], ["Bika Ambon Keju potong", 8000, null, "new", "Kue"], ["Bika Ambon 1 loyang", 60000, 70000, "limited", "Kue"]], },
  { no: "A2", name: "Soto Medan Santan Kental", team: "Prodi Pendidikan Kesejahteraan Keluarga · Fakultas Teknik", tagline: "Kuah gurih, rempahnya terasa.", about: "Soto Medan dengan santan kental dan perkedel kentang, disajikan hangat.", mean: 4.3, n: 9,
    products: [["Soto Medan + nasi", 18000, null, null, "Makanan"], ["Soto + perkedel", 21000, null, "new", "Makanan"], ["Es jeruk", 6000, null, null, "Minuman"]], },
  { no: "A3", name: "Mie Gomak Kuah Andaliman", team: "Himpunan Mahasiswa Kimia · FMIPA", tagline: "Pedas segar, sensasi andaliman.", about: "Mie gomak khas Batak dengan kuah andaliman, dimasak langsung di tempat.", mean: 4.0, n: 7,
    products: [["Mie gomak kuah", 17000, null, "new", "Makanan"], ["Mie gomak goreng", 17000, null, null, "Makanan"]], },
  { no: "B1", name: "Kopi Sidikalang Kampus", team: "Prodi Pendidikan Ekonomi · Fakultas Ekonomi", tagline: "Kopi Sumatera, harga mahasiswa.", about: "Kopi Sidikalang seduh langsung oleh barista mahasiswa.", mean: 4.4, n: 10,
    products: [["Kopi hitam", 10000, null, null, "Minuman"], ["Kopi susu gula aren", 15000, null, "new", "Minuman"], ["Es kopi Sidikalang", 14000, null, null, "Minuman"]], },
  { no: "B2", name: "Teh Tarik Medan Kampung", team: "UKM Wirausaha Mahasiswa", tagline: "Ditarik sampai berbusa.", about: "Teh tarik dan teh telur ala kedai kopi Medan.", mean: 3.75, n: 6,
    products: [["Teh tarik panas", 8000, null, null, "Minuman"], ["Teh tarik dingin", 10000, null, null, "Minuman"], ["Teh telur", 12000, null, "limited", "Minuman"]], },
  { no: "B3", name: "Pancake Durian Mak Itam", team: "Fakultas Ilmu Sosial", tagline: "Durian asli Medan, lumer di mulut.", about: "Pancake isi durian asli dengan kulit tipis lembut.", mean: 4.5, n: 8,
    products: [["Pancake durian isi 5", 25000, 30000, "limited", "Kue"], ["Pancake durian isi 10", 45000, null, null, "Kue"]], },
  { no: "C1", name: "Lemang Tapai Ketan", team: "Fakultas Bahasa dan Seni", tagline: "Hangat, gurih, ada tapainya.", about: "Lemang dibakar langsung bersama tapai ketan hitam.", mean: 3.85, n: 5,
    products: [["Lemang 1 batang", 40000, null, null, "Makanan"], ["Tapai ketan", 12000, null, null, "Makanan"]], },
  { no: "C2", name: "Keripik Singkong Ungu", team: "Prodi Pendidikan Biologi · FMIPA", tagline: "Renyah, ungu, bergizi.", about: "Keripik singkong ungu hasil pengabdian kepada masyarakat, tanpa pewarna buatan.", mean: 4.2, n: 7,
    products: [["Keripik original", 15000, null, null, "Camilan"], ["Keripik balado", 15000, null, "new", "Camilan"], ["Keripik toples besar", 28000, 32000, null, "Camilan"]], },
  { no: "C3", name: "Roti Jala Kari Ayam", team: "Prodi PGSD · Fakultas Ilmu Pendidikan", tagline: "Jala tipis, kari hangat.", about: "Roti jala buatan sendiri dengan kari ayam kentang.", mean: 4.05, n: 6,
    products: [["Roti jala + kari ayam", 20000, null, null, "Makanan"]], },
  { no: "C4", name: "Es Campur Medan Segar", team: "Prodi Manajemen · Fakultas Ekonomi", tagline: "Segar di siang yang panas.", about: "Es campur dan cendol dengan sirup gula merah buatan sendiri.", mean: 4.1, n: 8,
    products: [["Es campur", 12000, null, null, "Minuman"], ["Es cendol", 10000, null, "new", "Minuman"]], },
];

// Komentar khusus tiap booth, digabung dengan pembuka/penutup acak (tanpa teks kembar dalam satu booth).
const TALK = {
  A1: { like: ["bikanya lembut, manisnya pas dan wangi pandan.", "pori-porinya rapi dan teksturnya kenyal.", "yang keju gurihnya seimbang, nggak bikin eneg.", "satu loyang langsung habis dibagi sekeluarga.", "mirip bika ambon toko langganan di Medan.", "kuenya masih hangat dan lembap.", "kemasannya rapi, cocok buat oleh-oleh.", "rasa original-nya paling juara."], meh: ["enak, tapi antreannya agak lama.", "rasanya bagus, cuma porsi potongnya kecil."], bad: ["kehabisan yang original, sayang banget."] },
  A2: { like: ["kuahnya gurih dan santannya nggak amis.", "perkedelnya renyah di luar, empuk di dalam.", "rempahnya terasa, mirip soto Medan beneran.", "porsinya pas buat makan siang.", "sambalnya pedas segar, cocok dengan kuahnya.", "disajikan masih panas, mantap."], meh: ["enak, cuma agak asin buat saya."], bad: ["kuahnya sudah agak dingin waktu sampai."] },
  A3: { like: ["andalimannya bikin lidah bergetar, unik!", "beda dari mie biasa, pedasnya pas.", "mie-nya kenyal dan kuahnya segar.", "pertama kali coba andaliman dan langsung suka."], meh: ["rasanya unik, tapi pedasnya agak kuat buat saya.", "enak, cuma harus tahan pedas."], bad: ["terlalu pedas buat saya, nggak habis."] },
  B1: { like: ["kopinya aromanya kuat tapi nggak pahit.", "kopi susu gula aren-nya pas, nggak kemanisan.", "baristanya ramah dan cepat melayani.", "harga mahasiswa, rasa kedai kopi.", "es kopinya segar buat siang yang panas.", "kopi hitamnya mantap, ampasnya halus."], meh: ["enak, tempat duduknya aja yang kurang."], bad: ["esnya cepat cair jadi agak hambar."] },
  B2: { like: ["busanya tebal dan manisnya pas.", "teh telurnya hangat dan kental, suka!"], meh: ["lumayan, tapi kurang kental menurut saya.", "biasa saja, tapi harganya murah."], bad: ["terlalu manis buat selera saya."] },
  B3: { like: ["duriannya terasa asli, bukan sekadar esens.", "kulitnya tipis dan lembut, isinya melimpah.", "pecinta durian wajib mampir!", "lumer di mulut, nggak terlalu manis.", "isi 10 langsung ludes dibagi teman-teman.", "aromanya menggoda dari jauh."], meh: ["enak, tapi saya bukan penggemar durian."], bad: [] },
  C1: { like: ["lemangnya harum bambu, tapainya manis segar."], meh: ["enak tapi ujungnya agak keras.", "gurih, cuma porsinya kecil."], bad: ["porsinya kurang untuk harganya."] },
  C2: { like: ["renyah banget dan warnanya cantik.", "baladonya juara, pedas manisnya pas.", "cocok buat oleh-oleh, nggak berminyak.", "ternyata singkong ungu enak dan bergizi."], meh: ["enak, tapi cepat habis dimakan sendiri."], bad: [] },
  C3: { like: ["karinya kental dan hangat, rotinya lembut.", "porsi pas, rasanya rumahan banget.", "roti jalanya tipis dan nggak amis."], meh: ["enak, karinya bisa lebih banyak."], bad: ["rotinya sempat dingin waktu disajikan."] },
  C4: { like: ["segar banget, isiannya banyak!", "cendolnya kenyal, santannya pas.", "sirup gula merahnya wangi."], meh: ["manisnya agak kurang buat saya."], bad: ["esnya cepat mencair."] },
};
const OPEN = { hi: ["Mantap!", "Recommended banget.", "Suka banget.", "Wajib coba!", "Puas banget.", "", "", ""], mid: ["Lumayan,", "Oke sih,", "Boleh lah,", ""], lo: ["Sayang sekali,", "Kurang cocok,", ""] };
const CLOSE = ["Pasti balik lagi.", "Harganya juga bersahabat.", "Cocok buat teman-teman.", "", "", ""];
const used = new Set();
function comment(boothNo, starCount) {
  const t = TALK[boothNo];
  const kind = starCount >= 4 ? "hi" : starCount === 3 ? "mid" : "lo";
  const pool = kind === "hi" ? t.like : kind === "mid" ? t.meh : t.bad;
  if (!pool.length || rnd() > 0.78) return null; // sebagian review hanya bintang
  for (let i = 0; i < 14; i++) {
    const text = [pick(OPEN[kind]), pick(pool), kind === "hi" ? pick(CLOSE) : ""].filter(Boolean).join(" ");
    const out = text.charAt(0).toUpperCase() + text.slice(1);
    if (!used.has(`${boothNo}|${out}`)) {
      used.add(`${boothNo}|${out}`);
      return out;
    }
  }
  return null;
}

const NAMES = ["Rizky", "Putri", "Ahmad", "Siti", "Dewi", "Budi", "Andre", "Nadia", "Fadli", "Sari", "Hendra", "Maya", "Ilham", "Rani", "Yoga", "Citra", "Dimas", "Lestari", "Bagas", "Anisa", "Rafi", "Melati", "Gilang", "Nurul", "Fajar", "Intan", "Aldi", "Wulan", "Reza", "Tiara", "Kevin", "Salsabila", "Faisal", "Dinda", "Hasan", "Marlina", "Joko", "Sinta", "Agus", "Rina"];

// ---------- util ----------
let seed = 20261120;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();

async function api(method, path, { body, headers = {}, jar } = {}) {
  const h = { origin: BASE, ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (method !== "GET") h["idempotency-key"] = uuid();
  if (jar?.cookie) h.cookie = jar.cookie;
  let res;
  for (let attempt = 0; attempt < 8; attempt++) {
    res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status !== 429) break;
    await sleep(20_000); // pembatas laju per pengunjung/IP: tunggu lalu coba lagi
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (jar && setCookie.length) jar.cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${typeof json === "string" ? json.slice(0, 120) : JSON.stringify(json)}`);
  return json;
}

function stars(mean) {
  const table = mean >= 4.5 ? [0.6, 0.3, 0.08, 0.02, 0] : mean >= 4.2 ? [0.45, 0.4, 0.1, 0.05, 0] : mean >= 3.9 ? [0.3, 0.4, 0.2, 0.08, 0.02] : [0.2, 0.35, 0.28, 0.12, 0.05];
  let r = rnd();
  for (let i = 0; i < 5; i++) {
    r -= table[i];
    if (r <= 0) return 5 - i;
  }
  return 4;
}

// ---------- 1-2. event, booth, produk ----------
// RESUME_EVENT=<id>: lanjutkan penyemaian yang terputus (urutan acak deterministik, jadi review yang sudah masuk dilewati).
console.log(`Basis: ${BASE}`);
const RESUME = process.env.RESUME_EVENT;
let event;
let booths = [];
if (RESUME) {
  event = { id: RESUME };
  const snap0 = await api("GET", "/api/snapshot");
  booths = BOOTHS.map((b) => ({ ...b, id: snap0.booths.find((x) => x.name === b.name).id }));
  console.log(`Melanjutkan event ${RESUME} (${snap0.stats.reviewCount} review sudah ada)`);
} else {
  const events = (await api("GET", "/api/admin/events")).events;
const old = events.find((e) => e.isActive);
if (old && !old.name.startsWith("[Arsip uji]")) {
  await api("PUT", `/api/admin/events/${old.id}`, { body: { name: `[Arsip uji] ${old.name}` } });
  console.log(`Event lama diarsipkan: ${old.name}`);
}
const now = Date.now();
event = (
  await api("POST", "/api/admin/events", {
    body: {
      name: "Penilaian Booth Terfavorit LPPM Expo Tahun 2026",
      titleHighlight: "Terfavorit",
      timezone: "Asia/Jakarta",
      registrationOpenAt: now - 6 * DAY,
      registrationCloseAt: now - 2 * DAY,
      eventStartAt: now - 8 * HOUR,
      eventEndAt: now + 2 * DAY,
    },
  })
).event;
console.log(`Event baru: ${event.id}`);

// ---------- 2. booth + produk ----------
const base = `/api/admin/e/${event.id}`;
for (const b of BOOTHS) {
  const created = (
    await api("POST", `${base}/booths`, {
      body: EXTRAS
        ? { name: b.name, boothNo: b.no, tagline: b.tagline, description: b.about, teamName: b.team }
        : { name: b.name, teamName: b.team },
    })
  ).booth;
  if (EXTRAS) {
    let first = true;
    for (const [name, price, compare, badge, category] of b.products) {
      await api("POST", `${base}/booths/${created.id}/products`, {
        body: { name, priceIdr: price, comparePriceIdr: compare, badge, category, termsConfirmed: first ? true : undefined },
      });
      first = false;
    }
  }
  booths.push({ ...b, id: created.id });
}
console.log(`${booths.length} booth dibuat (tanpa foto${EXTRAS ? ", dengan nomor/tagline/produk" : ", hanya nama + institusi"})`);
await api("POST", `/api/admin/events/${event.id}/activate`);
console.log("Event diaktifkan");

}
// ---------- 3. pengunjung + review ----------
const categories = (await api("GET", "/api/event")).event.reviewCategories;
const visitors = NAMES.map((name, i) => ({ name, email: `${name.toLowerCase()}${i + 1}@example.com`, ip: `10.20.${i + 1}.7`, jar: { cookie: "" }, done: new Set() }));

const tasks = [];
for (const b of booths) {
  const who = [...visitors].sort(() => rnd() - 0.5).slice(0, b.n);
  for (const v of who) tasks.push({ booth: b, visitor: v, stars: stars(b.mean) });
}
tasks.sort(() => rnd() - 0.5);

async function login(v) {
  if (v.jar.cookie) return;
  const h = { "cf-connecting-ip": v.ip };
  const req = await api("POST", "/api/visitor/otp/request", { body: { email: v.email }, headers: h });
  if (!req.devCode) throw new Error("devCode tidak tersedia: jalankan hanya di dev lokal");
  await api("POST", "/api/visitor/otp/verify", { body: { email: v.email, code: req.devCode, displayName: v.name }, headers: h, jar: v.jar });
}

let ok = 0;
const alreadyDone = RESUME ? (await api("GET", "/api/snapshot")).stats.reviewCount : 0;
for (const [index, t] of tasks.entries()) {
  const commentText = comment(t.booth.no, t.stars);
  const cats = rnd() < 0.7 ? [...categories].sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * 2)).map((c) => c.id) : [];
  const anonymous = rnd() < 0.15; // dihitung selalu agar urutan acak sama saat melanjutkan
  if (index < alreadyDone) {
    ok++;
    continue;
  }
  await login(t.visitor);
  await api("POST", `/api/booths/${t.booth.id}/review`, {
    body: { stars: t.stars, comment: commentText, categoryIds: cats, anonymous },
    headers: { "cf-connecting-ip": t.visitor.ip },
    jar: t.visitor.jar,
  });
  ok++;
  if (ok % 10 === 0) console.log(`  ${ok}/${tasks.length} review`);
  await sleep(1150); // jarak antar review: tidak memicu penahanan lonjakan (skor risiko)
}

// ---------- 4. ringkasan ----------
const snap = await api("GET", "/api/snapshot");
console.log(`\nSelesai. ${snap.stats.boothCount} booth, ${snap.stats.reviewCount} review (dari ${tasks.length} dikirim), rata-rata ${snap.stats.average?.toFixed(2)}`);
for (const r of snap.ranking ?? []) {
  const b = snap.booths.find((x) => x.id === r.boothId);
  console.log(`  ${String(r.rank).padStart(2)}. ${b?.name.padEnd(28)} ${r.average.toFixed(2)} (${r.reviewCount})`);
}
if (snap.stats.reviewCount < tasks.length) console.log(`PERHATIAN: ${tasks.length - snap.stats.reviewCount} review ditahan sistem anti-spam (cek Moderasi di admin).`);
