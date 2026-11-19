// Uji realtime LiveHub (explore.md B8) di dev server sungguhan (workerd + DO + D1 lokal), tanpa browser.
// Mode bawaan: pemeriksaan fungsional kecil. Mode beban: `VIEWERS=300 REVIEWS=120 node scripts/e2e/live-load.mjs`.
// Prasyarat: npx vite --port 5197 --strictPort; .dev.vars berisi DEV_ADMIN_EMAIL. Node ≥ 22 (WebSocket bawaan).
// Menyemai event BARU dan mengaktifkannya (menggantikan event aktif di D1 lokal).

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const WS = BASE.replace(/^http/, "ws");
const VIEWERS = Number(process.env.VIEWERS ?? 3);
const REVIEWS = Number(process.env.REVIEWS ?? 12);
const BOOTHS = Number(process.env.BOOTHS ?? 3); // ambang peringkat 3 ulasan/booth: butuh review ≥ 3 × BOOTHS
const TICK_MS = 2500; // CONFIG.live.tickMs
const LOAD = VIEWERS > 20;

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Admin (jalur dev localhost) ----------
const adm = async (method, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { status: r.status, json: t ? JSON.parse(t) : null };
};
const DAY = 86_400_000;
const now = Date.now();
const ev = await adm("POST", "/api/admin/events", {
  name: `Uji Live ${now}`,
  registrationOpenAt: now - 3 * DAY,
  registrationCloseAt: now - 2 * DAY,
  eventStartAt: now - DAY,
  eventEndAt: now + 30 * DAY,
});
const EID = ev.json.event.id;
await adm("PUT", `/api/admin/events/${EID}`, { settings: { reviewerAuthMode: "open_turnstile" } });
const booths = [];
for (let i = 0; i < BOOTHS; i++) {
  booths.push((await adm("POST", `/api/admin/e/${EID}/booths`, { name: `Booth ${i + 1}` })).json.booth);
}
await adm("POST", `/api/admin/events/${EID}/activate`);

// ---------- Penonton WebSocket ----------
class Viewer {
  constructor(id, screen = false) {
    this.id = id;
    this.msgs = [];
    this.closed = null;
    this.ws = new WebSocket(`${WS}/ws${screen ? "?screen=1" : ""}`, { headers: { "cf-connecting-ip": `10.9.${id >> 8}.${id & 255}` } });
    this.ready = new Promise((res) => {
      this.ws.addEventListener("message", (e) => {
        if (String(e.data) === "pong") return; // balasan auto-response, bukan pesan siaran
        const m = JSON.parse(String(e.data));
        this.msgs.push({ at: Date.now(), m });
        if (m.t === "hello") res(true);
      });
      this.ws.addEventListener("close", (e) => {
        this.closed = { code: e.code, reason: e.reason };
        res(false);
      });
      this.ws.addEventListener("error", () => res(false));
    });
  }
  ofType(t) {
    return this.msgs.filter((x) => x.m.t === t).map((x) => x.m);
  }
}

const viewers = [];
for (let i = 0; i < VIEWERS; i++) {
  viewers.push(new Viewer(i + 1));
  if (i % 50 === 49) await sleep(100);
}
const screen = new Viewer(9999, true);
const connected = (await Promise.all([...viewers, screen].map((v) => v.ready))).filter(Boolean).length;
check(`${connected}/${VIEWERS + 1} koneksi WebSocket diterima (hello)`, connected === VIEWERS + 1);

// Pembanding: selama event berjalan, ping dijawab pong oleh auto-response (WebSocket Hibernation).
const pingPong = (v, ms = 1500) =>
  new Promise((res) => {
    if (v.ws.readyState !== 1) return res("tertutup");
    const t = setTimeout(() => res("tak-menjawab"), ms);
    const on = (e) => {
      if (String(e.data) === "pong") {
        clearTimeout(t);
        v.ws.removeEventListener("message", on);
        res("pong");
      }
    };
    v.ws.addEventListener("message", on);
    v.ws.send("ping");
  });
check("Auto-response ping → pong berfungsi (keep-alive tanpa membangunkan DO)", (await pingPong(viewers[0])) === "pong");

// ---------- Pengirim review: pengunjung anonim, tiap pengunjung IP sendiri ----------
async function newVisitor(i) {
  const ip = `10.8.${i >> 8}.${i & 255}`;
  const r = await fetch(`${BASE}/api/visitor/anonymous`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ displayName: `Tamu${i}` }),
  });
  const cookie = (r.headers.getSetCookie()[0] ?? "").split(";")[0];
  return { ip, cookie, ok: r.ok };
}
async function submit(v, booth, stars, comment) {
  const r = await fetch(`${BASE}/api/booths/${booth.id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), cookie: v.cookie, "cf-connecting-ip": v.ip },
    body: JSON.stringify({ stars, ...(comment ? { comment } : {}) }),
  });
  return r.status;
}

const people = [];
for (let i = 0; i < REVIEWS; i++) people.push(await newVisitor(i + 1));
check(`${people.filter((p) => p.ok).length}/${REVIEWS} pengunjung anonim masuk`, people.every((p) => p.ok));

// ---------- 1. Lonjakan review → SATU tick, bukan satu pesan per review ----------
const t0 = Date.now();
const statuses = await Promise.all(
  people.map((p, i) => submit(p, booths[i % BOOTHS], 3 + (i % 3), `Ulasan ke-${i} dari uji live`)),
);
check(`${statuses.filter((s) => s === 201).length}/${REVIEWS} review diterima (201)`, statuses.every((s) => s === 201), [...new Set(statuses)].join(","));
const burstMs = Date.now() - t0;
await sleep(TICK_MS * 2 + 1500); // dua tick + sisa
const ticksPerViewer = viewers.map((v) => v.ofType("tick").length);
const maxTicks = Math.max(...ticksPerViewer, 0);
check(
  `Lonjakan ${REVIEWS} review (${burstMs} ms) → ≤ 2 pesan tick per penonton (dibatch per ${TICK_MS} ms)`,
  maxTicks >= 1 && maxTicks <= 2,
  `tick per penonton: min=${Math.min(...ticksPerViewer)} maks=${maxTicks}`,
);
const v0 = viewers[0];
const delta = v0.ofType("tick").flatMap((t) => t.booths);
const total = new Map();
for (const d of delta) total.set(d.id, d.count); // delta membawa hitungan TERBARU per booth
const sumCounts = [...total.values()].reduce((a, b) => a + b, 0);
check("Jumlah ulasan pada delta cocok dengan review yang diterima", sumCounts === statuses.filter((s) => s === 201).length, `${sumCounts}`);
const feed = v0.ofType("tick").flatMap((t) => t.feed);
const more = v0.ofType("tick").reduce((n, t) => n + t.more, 0);
check("Feed ≤ 5 item per tick; sisanya diringkas '+N ulasan baru'", feed.length <= 10 && (REVIEWS <= 5 || more > 0 || feed.length >= 5), `feed=${feed.length} more=${more}`);
check("Peringkat ikut dalam tick (peringkat tampil)", v0.ofType("tick").some((t) => Array.isArray(t.ranks)));
check("Pesan tick kecil (< 6 KB per pesan)", v0.msgs.every((x) => JSON.stringify(x.m).length < 6000), `${Math.max(...v0.msgs.map((x) => JSON.stringify(x.m).length))} B maks`);

// ---------- 2. Peringkat disembunyikan: TIDAK ADA ranks/leader yang bocor ----------
const before = v0.msgs.length;
await adm("PUT", `/api/admin/events/${EID}/ranking-mode`, { mode: "hidden" });
await sleep(800); // refresh dari aksi admin langsung disiarkan (tidak menunggu tick)
check("Aksi admin → pesan 'refresh' ke semua penonton", viewers.every((v) => v.ofType("refresh").length >= 1) && screen.ofType("refresh").length >= 1);
const extra = await newVisitor(REVIEWS + 1);
await submit(extra, booths[0], 5, "Satu lagi setelah peringkat disembunyikan");
await sleep(TICK_MS + 1500);
const after = v0.msgs.slice(before).map((x) => x.m).filter((m) => m.t === "tick");
check("Peringkat tersembunyi: tick tidak membawa ranks maupun leaderChanged", after.length >= 1 && after.every((t) => t.ranks === null && t.leaderChanged === false && t.leader === null), JSON.stringify(after[0] ?? {}).slice(0, 80));
check("Peringkat tersembunyi: tak ada kata 'score' di seluruh pesan setelahnya", !v0.msgs.slice(before).some((x) => JSON.stringify(x.m).includes('"score"')));

// ---------- 3. Batas penonton dan degradasi halus ----------
if (LOAD) {
  const extraViewers = [];
  for (let i = 0; i < 150; i++) extraViewers.push(new Viewer(20000 + i));
  await Promise.all(extraViewers.map((v) => v.ready));
  const rejected = extraViewers.filter((v) => v.closed !== null && v.ms === undefined).length;
  const accepted = extraViewers.filter((v) => v.ofType("hello").length === 1).length;
  console.log(`INFO  penonton tambahan: diterima=${accepted} ditolak=${rejected} (batas umum ${400 - 5})`);
  for (const v of extraViewers) v.ws.close();
}

// ---------- 4. Event selesai → siaran berhenti dan koneksi ditutup ----------
await adm("PUT", `/api/admin/events/${EID}`, {
  registrationOpenAt: now - 4 * DAY,
  registrationCloseAt: now - 3 * DAY,
  eventStartAt: now - 2 * DAY,
  eventEndAt: Date.now() + 4000,
});
await sleep(1500);
const endedAt = Date.now();
await sleep(6500);
const closedCount = [...viewers, screen].filter((v) => v.closed !== null || v.ws.readyState === 3).length;
// Soket yang katanya terbuka: masih dilayani server? (auto-response "ping" → "pong" tanpa membangunkan DO)
const pong = await Promise.all([...viewers, screen].map((v) => pingPong(v)));
const tally = (arr) => Object.entries(arr.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})).map(([k, n]) => `${k}×${n}`).join(" ");
console.log(`INFO  jawaban ping setelah event selesai: ${tally(pong)}`);
// Di proxy dev frame penutupan dari server tidak sampai ke klien (readyState tetap OPEN), tetapi soket sudah tidak
// dilayani server: tidak menjawab ping. Klien nyata menutup sendiri saat menerima event_status.
const serverClosed = pong.filter((p) => p !== "pong").length;
console.log(`INFO  readyState di klien: ${tally([...viewers, screen].map((v) => (v.ws.readyState === 3 ? "tertutup" : "terbuka")))}; kode tutup: ${tally([...viewers, screen].map((v) => v.closed?.code ?? "-"))}`);
const gotEnded = viewers.concat(screen).filter((v) => v.ofType("event_status").length >= 1).length;
check(
  `Setelah event selesai: ${Math.max(closedCount, serverClosed)}/${VIEWERS + 1} koneksi tidak lagi dilayani server`,
  Math.max(closedCount, serverClosed) === VIEWERS + 1,
  `terlihat tertutup di klien: ${closedCount}; ${Math.round((Date.now() - endedAt) / 100) / 10}s sejak jadwal diubah`,
);
check("Penonton menerima 'event_status' sebelum ditutup", gotEnded === VIEWERS + 1);
const late = new Viewer(31337);
await Promise.race([late.ready, sleep(3000)]);
check("Koneksi baru setelah selesai ditolak (tanpa hello, tanpa siaran)", late.ofType("hello").length === 0 && late.ofType("tick").length === 0);

// ---------- Ringkasan beban ----------
const allMsgs = viewers.reduce((n, v) => n + v.msgs.length, 0);
console.log(`INFO  total pesan keluar ${allMsgs} untuk ${VIEWERS} penonton dan ${REVIEWS + 1} review → ${(allMsgs / VIEWERS).toFixed(1)} pesan/penonton (bukan ${REVIEWS + 1})`);

for (const v of [...viewers, screen]) {
  try {
    v.ws.close();
  } catch {}
}
console.log(failed === 0 ? "\nSEMUA LULUS" : `\n${failed} PEMERIKSAAN GAGAL`);
process.exit(failed === 0 ? 0 : 1);
