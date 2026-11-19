import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import {
  compileTerms,
  findTermHits,
  hasContactInfo,
  type ModerationPolicy,
  maskRange,
  moderateComment,
  normalizeWord,
} from "./moderation";
import { SEED_TERMS } from "./moderation-seed";

const compiled = compileTerms(
  SEED_TERMS.map((s, i) => ({ ...s, id: `t${i}` })),
  1,
);
const POLICY: ModerationPolicy = {
  severeAction: CONFIG.moderation.severeAction,
  mildAction: CONFIG.moderation.mildAction,
  holdContactInfo: CONFIG.moderation.holdContactInfo,
};
const check = (text: string, policy: ModerationPolicy = POLICY) =>
  moderateComment(text, compiled, policy);

describe("normalizeWord", () => {
  it("huruf kecil, tanpa aksen, huruf berulang dilebur", () => {
    expect(normalizeWord("ANJIIING")).toBe("anjing");
    expect(normalizeWord("Ánjîng")).toBe("anjing");
    expect(normalizeWord("faaak")).toBe("fak");
  });

  it("leetspeak dan homoglyph dipetakan hanya di dalam kata berhuruf", () => {
    expect(normalizeWord("4njing")).toBe("anjing");
    expect(normalizeWord("@njing")).toBe("anjing");
    expect(normalizeWord("b4ngs4t")).toBe("bangsat");
    expect(normalizeWord("аnjing")).toBe("anjing"); // 'а' kiril
    expect(normalizeWord("2026")).toBe("2026"); // angka murni tidak berubah
    expect(normalizeWord("100")).toBe("10"); // hanya dilebur, bukan jadi huruf
  });

  it("penanda tak terlihat dibuang", () => {
    expect(normalizeWord("anj​ing")).toBe("anjing");
  });
});

describe("tertangkap: variasi penulisan dari kata berat dan ringan", () => {
  const severe = [
    "kamu bangsat",
    "BANGSAT!!!",
    "b4ngs4t",
    "baaangsaaat",
    "b.a.n.g.s.a.t",
    "b a n g s a t",
    "bajingan lu",
    "dasar anjing",
    "anjiiiing",
    "4njing",
    "@njing",
    "аnjing", // kiril
    "anj​ing", // zero-width
    "ANJING",
    "Anjing!",
    "dianjingkan",
    "anjingnya",
    "fuck this",
    "fuuuck",
    "f.u.c.k",
    "what the fuck",
    "motherfucker",
    "kontol",
    "k0nt0l",
    "memek",
    "ngentot",
    "pelacur",
    "lonte",
    "jancok",
    "jancuk",
    "nigger",
    "cunt",
  ];
  for (const s of severe) {
    it(`berat: ${JSON.stringify(s)}`, () => {
      expect(check(s).status).toBe("held");
    });
  }

  const mild = [
    "anjir",
    "sialan",
    "brengsek",
    "kampret",
    "tolol",
    "goblok",
    "bego",
    "bodoh",
    "asu",
    "shit",
    "damn",
    "bitch",
  ];
  for (const s of mild) {
    it(`ringan: ${JSON.stringify(s)} → disamarkan`, () => {
      const r = check(`booth ini ${s} banget`);
      expect(r.status).toBe("masked");
      expect(r.masked).not.toBeNull();
      expect(r.masked).not.toContain(s);
    });
  }

  it("imbuhan umum pada istilah ringan", () => {
    for (const s of ["bodohnya", "membodohi", "dibodohi", "bodohlah", "tololnya", "kebodohan"]) {
      // "kebodohan" memakai "ke-" yang sengaja tidak dipakai; sisanya harus tertangkap.
      const expected = s === "kebodohan" ? "visible" : "masked";
      expect(check(s).status, s).toBe(expected);
    }
  });

  it("huruf besar-kecil acak dan campuran", () => {
    expect(check("BaNgSaT").status).toBe("held");
    expect(check("aNjIr").status).toBe("masked");
  });
});

describe("TIDAK tertangkap: korpus salah-tangkap (kata wajar)", () => {
  const innocent = [
    // nama tempat dan orang
    "Scunthorpe",
    "Bekasi",
    "Pasuruan",
    "Sukabumi",
    "Cikampek",
    "Dickens",
    "Medan",
    "Unimed",
    "Deli Serdang",
    // makanan dan minuman (expo)
    "mie ayam",
    "sate padang",
    "kopi susu",
    "bakso urat",
    "es teh",
    "petai",
    "mentai rice",
    "mentaiko",
    "shiitake",
    "nasi goreng",
    "roti bakar",
    "kue lapis",
    "cokelat",
    "keripik",
    "es krim",
    "jus alpukat",
    "martabak",
    "sambal",
    // kata berimbuhan dan umum
    "asuransi",
    "asuhan",
    "mengasuh",
    "asumsi",
    "kasur",
    "pasukan",
    "tolong",
    "tolonglah",
    "bagus sekali",
    "memang",
    "pembahasan",
    "analisis",
    "kelas",
    "bangsa",
    "bangsawan",
    "kampus",
    "kampung",
    "anjungan",
    "anjuran",
    "ngantuk",
    "menteri",
    "kontrol",
    "konsol",
    "mekanik",
    "pemekaran",
    "memoar",
    "babi", // sengaja tidak ada di daftar awal (booth makanan)
    // istilah teknik/medis/biologi
    "anal retentive".split(" ")[1] ?? "",
    "class",
    "assassin",
    "classic",
    "glass",
    "passion",
    "bass",
    "analysis",
    "cockpit",
    "peacock",
    "titanium",
    "assume",
    "document",
    "documentary",
    "shitake",
    "therapist",
    "arsenal",
    // kalimat lengkap
    "Boothnya keren banget, ramah dan rapi!",
    "Kopi rempahnya enak, harganya Rp 25.000 saja.",
    "Antreannya panjang tapi worth it.",
    "Produknya inovatif dan bermanfaat untuk mahasiswa.",
    "The staff were friendly and the coffee was great.",
    "Tempatnya nyaman, pelayanannya cepat, recommended!",
    "Saya suka konsepnya, kreatif sekali.",
    "Booth nomor 12 dekat pintu masuk.",
    "Harga terjangkau, rasa luar biasa.",
    "Mantap, lain kali mampir lagi ya!",
  ];
  for (const s of innocent) {
    it(`aman: ${JSON.stringify(s)}`, () => {
      const r = check(s);
      expect(r.hits, `${s} salah tangkap`).toEqual([]);
      expect(r.status).toBe("visible");
    });
  }

  it("entri `allow` menang atas `block` (pengecualian)", () => {
    const c = compileTerms(
      [
        { id: "b", term: "taik", severity: "mild", kind: "block", match: "contains" },
        { id: "a", term: "taiko", severity: "mild", kind: "allow", match: "word" },
      ],
      1,
    );
    expect(findTermHits("alat taiko", c)).toEqual([]);
    expect(findTermHits("taik", c)).toHaveLength(1);
  });

  it("istilah `contains` yang terlalu pendek diperlakukan sebagai kata utuh", () => {
    const c = compileTerms(
      [{ id: "x", term: "ass", severity: "mild", kind: "block", match: "contains" }],
      1,
    );
    expect(findTermHits("class assassin", c)).toEqual([]);
    expect(findTermHits("ass", c)).toHaveLength(1);
  });
});

describe("data kontak, tautan, iklan", () => {
  const contact = [
    "hubungi 081234567890",
    "wa 0812-3456-7890",
    "+62 812 3456 7890",
    "kunjungi www.toko-saya.com",
    "https://bit.ly/abc",
    "toko.id",
    "email saya budi@gmail.com",
    "ig: @tokosaya",
    "follow @tokosaya ya",
    "DM saya ya kak",
    "WA aku aja",
    "hubungi kami",
    "telegram: tokosaya",
  ];
  for (const s of contact) {
    it(`ditahan: ${JSON.stringify(s)}`, () => {
      const r = check(s);
      expect(r.contact, s).toBe(true);
      expect(r.status).toBe("held");
    });
  }

  const ok = [
    "Rp 25.000 saja",
    "harga 15.000 per cup",
    "booth nomor 12",
    "tahun 2026 ini seru",
    "wah enak banget",
    "tunggu antrean sekitar 30 menit",
    "follow the signs to the entrance",
  ];
  for (const s of ok) {
    it(`aman: ${JSON.stringify(s)}`, () => {
      expect(hasContactInfo(s), s).toBe(false);
    });
  }

  it("kebijakan holdContactInfo=false: tayang", () => {
    expect(check("hubungi 081234567890", { ...POLICY, holdContactInfo: false }).status).toBe(
      "visible",
    );
  });
});

describe("putusan dan penyamaran", () => {
  it("berat → ditahan; hasil tidak memuat teks dan tidak menyebut kata", () => {
    const r = check("dasar bangsat");
    expect(r.status).toBe("held");
    expect(r.masked).toBeNull();
    expect(r.hits).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain("bangsat");
  });

  it("ringan → disamarkan, huruf pertama dan terakhir dibiarkan, kalimat lain utuh", () => {
    expect(check("Boothnya keren tapi anjir lama").masked).toBe("Boothnya keren tapi a***r lama");
  });

  it("campuran berat + ringan → ditahan", () => {
    expect(check("anjir bangsat").status).toBe("held");
  });

  it("kebijakan: berat disamarkan bila diatur `mask`", () => {
    const r = check("dasar bangsat", { ...POLICY, severeAction: "mask" });
    expect(r.status).toBe("masked");
    expect(r.masked).toBe("dasar b*****t");
  });

  it("kebijakan: ringan ditahan atau dibiarkan sesuai pengaturan", () => {
    expect(check("anjir", { ...POLICY, mildAction: "hold" }).status).toBe("held");
    expect(check("anjir", { ...POLICY, mildAction: "allow" }).status).toBe("visible");
  });

  it("menyamarkan beberapa kata dan kata yang dieja", () => {
    expect(check("sialan, kampret!").masked).toBe("s****n, k*****t!");
    expect(maskRange("a.n.j.i.n.g", [{ start: 0, end: 11 }])).toBe("a*********g");
  });

  it("kata dua huruf atau kurang disamarkan penuh", () => {
    expect(maskRange("ab", [{ start: 0, end: 2 }])).toBe("**");
  });

  it("teks kosong, spasi, emoji, dan angka tidak menimbulkan galat", () => {
    for (const s of ["", "   ", "🍜🔥", "12345", "!!!"]) {
      expect(() => check(s)).not.toThrow();
    }
    expect(check("").status).toBe("visible");
  });
});

describe("kinerja: pemeriksaan satu komentar harus murah", () => {
  it("1.000 komentar 280 huruf dalam waktu singkat", () => {
    const text =
      `Boothnya keren, kopi rempahnya enak dan pelayanannya ramah sekali. ${"lorem ipsum dolor ".repeat(14)}`.slice(
        0,
        280,
      );
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) check(text);
    const perCheckMs = (performance.now() - t0) / 1000;
    expect(perCheckMs).toBeLessThan(2); // jauh di bawah anggaran CPU Worker
  });
});
