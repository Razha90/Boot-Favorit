import { describe, expect, it } from "vitest";
import { type BoothVisualFields, completeness, gridVisualMode, hasText, initials } from "./visual";

const nameOnly: BoothVisualFields = {
  id: "b1",
  name: "Kopi Rempah",
  boothNo: null,
  coverThumbKey: null,
  description: null,
  tagline: null,
};
const full: BoothVisualFields = {
  ...nameOnly,
  boothNo: "A12",
  coverThumbKey: "events/e1/booths/b1/x-thumb.webp",
  description: "Kopi dengan rempah",
  tagline: "Hangat di lidah",
};

describe("hasText", () => {
  it("menganggap null, undefined, kosong, dan spasi saja sebagai tidak ada", () => {
    for (const v of [null, undefined, "", "   ", "\n\t"]) expect(hasText(v)).toBe(false);
    expect(hasText("a")).toBe(true);
  });
});

describe("gridVisualMode", () => {
  it("text bila tak satu pun berfoto (termasuk daftar kosong)", () => {
    expect(gridVisualMode([])).toBe("text");
    expect(gridVisualMode([{ coverThumbKey: null }, { coverThumbKey: "" }])).toBe("text");
  });

  it("photo bila sedikitnya satu berfoto", () => {
    expect(gridVisualMode([{ coverThumbKey: null }, { coverThumbKey: "k.webp" }])).toBe("photo");
  });
});

describe("completeness", () => {
  it("hanya nama", () => {
    expect(completeness(nameOnly)).toBe("name_only");
    expect(completeness({ ...nameOnly, description: "  ", tagline: "" })).toBe("name_only");
  });

  it("sebagian", () => {
    expect(completeness({ ...nameOnly, boothNo: "A12" })).toBe("partial");
    expect(completeness({ ...full, coverThumbKey: null })).toBe("partial");
  });

  it("lengkap", () => {
    expect(completeness(full)).toBe("full");
  });
});

describe("initials", () => {
  it("huruf pertama dari maksimal dua kata, huruf besar", () => {
    expect(initials("Kopi Rempah Nusantara")).toBe("KR");
    expect(initials("warung makan")).toBe("WM");
    expect(initials("  mie  ")).toBe("M");
  });

  it("melewati simbol dan emoji di awal kata", () => {
    expect(initials("🍜 Mie Ayam")).toBe("MA");
    expect(initials("*** Es Teh ***")).toBe("ET");
  });

  it("mendukung huruf beraksen dan angka", () => {
    expect(initials("Éclair Shop")).toBe("ÉS");
    expect(initials("Bakso 99")).toBe("B9");
  });

  it("cadangan: nomor booth, lalu titik tengah", () => {
    expect(initials("☕", "a12")).toBe("A12");
    expect(initials("☕")).toBe("•");
    expect(initials("☕", "   ")).toBe("•");
  });
});
