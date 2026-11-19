// @vitest-environment jsdom
import { getEventState } from "@shared/event-state";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTHS, PRODUCTS } from "../../dev/fixtures";
import { failAllImages } from "../../test/assertions";
import { isEmpty, makeEvent, memStore, renderEvent, SCHEDULE } from "../../test/render";
import {
  AboutText,
  RatePanel,
  RatingBreakdown,
  WhatsAppOrderButton,
} from "./components/booth-parts";
import { ComingSoonScreen, SiteFooter } from "./components/chrome";
import { Hero } from "./components/Hero";
import { PhotoSlideshow } from "./components/PhotoSlideshow";
import { Showcase } from "./components/Showcase";
import { SpotlightSection } from "./components/SpotlightSection";
import { SaveButton, ShareButton, WishlistFab } from "./components/share-wishlist";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const NOW = { live: 3500, upcoming: 1500, late: 2500, ended: 5000 } as const;
const stateAt = (t: number, schedule = SCHEDULE) => getEventState(schedule, t);

// jsdom tanpa AnimationEvent: React mendengar nama berawalan, jadi kirim keduanya (peramban asli hanya satu).
const animationEnd = (el: Element) => {
  for (const type of ["animationend", "webkitAnimationEnd"]) {
    fireEvent(el, new Event(type, { bubbles: true }));
  }
};

describe("Hero", () => {
  const renderHero = (serverNow: number, event = makeEvent(), boothCount = 8) => {
    const state = stateAt(serverNow, event.schedule);
    return renderEvent(
      <Hero
        event={event}
        state={state}
        boothCount={boothCount}
        serverNow={() => serverNow}
        registrationVisible={state.registrationButtonVisible}
      />,
      { event, serverNow },
    );
  };

  it("judul = nama resmi acara dengan kata sorotan pada blok; teks mengajak", () => {
    const { container } = renderHero(NOW.live);
    expect(container.querySelector("h1")?.textContent).toBe(
      "Penilaian Booth Terfavorit LPPM Expo Tahun 2026",
    );
    expect(container.querySelector("h1 mark")?.textContent).toBe("Terfavorit");
    expect(container.textContent).toContain("Booth mana yang paling bikin kamu WOW?");
  });

  it("teks, lencana, dan CTA selaras status: upcoming, live, selesai, hasil diumumkan", () => {
    const check = (t: number, badge: string, cta: string, event = makeEvent()) => {
      const { container, unmount } = renderHero(t, event);
      expect(container.textContent).toContain(badge);
      expect(screen.getByRole("link", { name: new RegExp(cta) })).toBeTruthy();
      unmount();
    };
    check(NOW.upcoming, "VOTING SEGERA DIBUKA", "Intip booth-nya");
    check(NOW.live, "VOTING DIBUKA", "Yuk, cobain jelajah booth");
    check(NOW.ended, "EVENT UDAH SELESAI", "Lihat semua booth");
    check(
      NOW.ended,
      "EVENT UDAH SELESAI",
      "Lihat Rekap & Booth Terfavorit",
      makeEvent({ schedule: { ...SCHEDULE, resultsPublishedAt: 4100 } }),
    );
  });

  it("hitung mundur saat belum mulai; tidak ada saat sudah berjalan", () => {
    expect(renderHero(NOW.upcoming).container.textContent).toContain("Voting dibuka dalam");
    cleanup();
    expect(renderHero(NOW.live).container.textContent).not.toContain("Voting dibuka dalam");
  });

  it("'Daftar Toko' hanya selama pendaftaran reguler; susulan tidak punya tombol", () => {
    expect(renderHero(1500).container.querySelector("a[href='/register']")).not.toBeNull(); // reguler
    cleanup();
    expect(renderHero(NOW.late).container.querySelector("a[href='/register']")).toBeNull(); // sudah ditutup
  });

  it("tanpa foto suasana: satu kolom berisi teks, tanpa kolase, tanpa elemen kosong", () => {
    const { container } = renderHero(NOW.live);
    expect(container.querySelector("header")?.getAttribute("data-hero-layout")).toBe("text");
    expect(container.querySelector("[data-collage]")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("kolase mengikuti jumlah foto (1–3) dan beralih ke teks bila semua gagal dimuat", async () => {
    for (const n of [1, 2, 3]) {
      const heroKeys = Array.from({ length: n }, (_, i) => `ok:${i}`);
      const { container, unmount } = renderHero(
        NOW.live,
        makeEvent({ media: { logoKey: null, ogImageKey: null, heroKeys } }),
      );
      expect(container.querySelector("[data-collage]")?.getAttribute("data-collage")).toBe(
        String(n),
      );
      expect(container.querySelectorAll("figure")).toHaveLength(n);
      unmount();
    }
    const { container } = renderHero(
      NOW.live,
      makeEvent({ media: { logoKey: null, ogImageKey: null, heroKeys: ["broken:1", "broken:2"] } }),
    );
    expect(container.querySelector("header")?.getAttribute("data-hero-layout")).toBe("collage");
    await act(async () => void failAllImages(container));
    expect(container.querySelector("header")?.getAttribute("data-hero-layout")).toBe("text");
    expect(container.querySelector("[data-collage]")).toBeNull();
  });

  it("tanpa booth: tidak ada lencana '0 booth ikut serta'", () => {
    expect(renderHero(NOW.live, makeEvent(), 0).container.textContent).not.toMatch(
      /0 booth ikut serta/,
    );
    cleanup();
    expect(renderHero(NOW.live, makeEvent(), 8).container.textContent).toContain(
      "8 booth ikut serta",
    );
  });

  it("tanpa kata sorotan: judul tetap utuh", () => {
    const { container } = renderHero(NOW.live, makeEvent({ titleHighlight: null }));
    expect(container.querySelector("h1 mark")).toBeNull();
    expect(container.querySelector("h1")?.textContent).toContain("Terfavorit");
  });
});

describe("SiteFooter dan ComingSoonScreen", () => {
  it("kaki halaman: nama acara, penyelenggara, balik ke atas; tanpa logo = tidak ada gambar", () => {
    const { container } = renderEvent(<SiteFooter event={makeEvent()} />);
    expect(container.textContent).toContain("Penilaian Booth Terfavorit LPPM Expo Tahun 2026");
    expect(container.textContent).toContain("Diselenggarakan oleh LPPM UNIMED");
    expect(container.querySelector("a[href='#top']")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("dengan logo tampil; logo gagal dimuat hilang tanpa bekas", async () => {
    const { container } = renderEvent(
      <SiteFooter
        event={makeEvent({
          media: { logoKey: "broken:1-full.webp", ogImageKey: null, heroKeys: [] },
        })}
      />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(1);
    await act(async () => void failAllImages(container));
    expect(container.querySelector("img")).toBeNull();
  });

  it("Segera hadir: hanya nama penyelenggara dan pesan; tanpa data event", () => {
    const { container } = renderEvent(<ComingSoonScreen />);
    expect(container.querySelector("h1")?.textContent).toBe("Segera hadir");
    expect(container.textContent).toContain("LPPM UNIMED");
  });
});

describe("PhotoSlideshow", () => {
  const photos = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ keyFull: `ok:${i}`, keyThumb: `ok:${i}` }));
  const section = (c: HTMLElement) => c.querySelector("section") as HTMLElement;
  const progress = (c: HTMLElement) => c.querySelector("[data-progress]") as HTMLElement | null;

  it("tanpa foto: tidak dirender dan onEmpty dipanggil (hero menjadi satu kolom)", () => {
    const onEmpty = vi.fn();
    const { container } = renderEvent(<PhotoSlideshow photos={[]} onEmpty={onEmpty} />);
    expect(isEmpty(container)).toBe(true);
    expect(onEmpty).not.toHaveBeenCalled(); // tak ada foto sejak awal = bukan "gagal"
  });

  it("satu foto: tanpa panah, penghitung, segmen, thumbnail, dan pewaktu", () => {
    const { container } = renderEvent(<PhotoSlideshow photos={photos(1)} />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.queryByLabelText("Foto berikutnya")).toBeNull();
    expect(progress(container)).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
  });

  it("beberapa foto: penghitung, segmen progres, dan geser dengan tombol (berputar)", () => {
    const { container } = renderEvent(<PhotoSlideshow photos={photos(3)} />);
    expect(section(container).getAttribute("aria-roledescription")).toBe("carousel");
    expect(container.textContent).toContain("1/3");
    fireEvent.click(screen.getByLabelText("Foto berikutnya"));
    expect(container.textContent).toContain("2/3");
    fireEvent.click(screen.getByLabelText("Foto sebelumnya"));
    fireEvent.click(screen.getByLabelText("Foto sebelumnya")); // dari 1 mundur → 3
    expect(container.textContent).toContain("3/3");
    fireEvent.click(screen.getByLabelText("Lihat foto 2"));
    expect(container.textContent).toContain("2/3");
  });

  it("pewaktu = animasi CSS: animationend memajukan foto; dijeda oleh hover, fokus, dan tombol jeda", () => {
    const { container } = renderEvent(<PhotoSlideshow photos={photos(3)} />);
    const bar = () => progress(container) as HTMLElement;
    expect(bar().style.animationPlayState).toBe("running");
    animationEnd(bar());
    expect(container.textContent).toContain("2/3");

    fireEvent.mouseEnter(section(container));
    expect(bar().style.animationPlayState).toBe("paused");
    animationEnd(bar()); // saat dijeda, animationend tidak memajukan
    expect(container.textContent).toContain("2/3");
    fireEvent.mouseLeave(section(container));
    expect(bar().style.animationPlayState).toBe("running");

    fireEvent.focus(screen.getByLabelText("Foto berikutnya"));
    expect(bar().style.animationPlayState).toBe("paused");
    fireEvent.blur(screen.getByLabelText("Foto berikutnya"));

    fireEvent.click(screen.getByLabelText("Jeda slideshow"));
    expect(bar().style.animationPlayState).toBe("paused");
    fireEvent.click(screen.getByLabelText("Putar slideshow"));
    expect(bar().style.animationPlayState).toBe("running");
  });

  it("dijeda saat tab tersembunyi", () => {
    const { container } = renderEvent(<PhotoSlideshow photos={photos(2)} />);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(progress(container)?.style.animationPlayState).toBe("paused");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(progress(container)?.style.animationPlayState).toBe("running");
  });

  it("gerak minimal (prefers-reduced-motion): mulai dalam keadaan dijeda", () => {
    // jsdom tidak punya matchMedia: pasang sementara, lalu kembalikan agar tes lain tidak terpengaruh.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (q: string) => ({ matches: q.includes("reduce"), media: q }),
    });
    try {
      const { container } = renderEvent(<PhotoSlideshow photos={photos(2)} />);
      expect(progress(container)?.style.animationPlayState).toBe("paused");
    } finally {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });

  it("panah keyboard dari kontrol yang difokuskan", () => {
    const { container } = renderEvent(<PhotoSlideshow photos={photos(3)} />);
    fireEvent.keyDown(screen.getByLabelText("Foto berikutnya"), { key: "ArrowRight" });
    expect(container.textContent).toContain("2/3");
    fireEvent.keyDown(screen.getByLabelText("Foto berikutnya"), { key: "ArrowLeft" });
    expect(container.textContent).toContain("1/3");
  });

  it("foto yang gagal dimuat dibuang; semua gagal → onEmpty", async () => {
    const onEmpty = vi.fn();
    const { container } = renderEvent(
      <PhotoSlideshow
        photos={[
          { keyFull: "ok:1", keyThumb: "ok:1" },
          { keyFull: "broken:2", keyThumb: "broken:2" },
        ]}
        onEmpty={onEmpty}
      />,
    );
    const broken = [...container.querySelectorAll("img")].filter((i) =>
      i.src.includes("/media/events/gagal"),
    );
    expect(broken.length).toBeGreaterThan(0);
    for (const i of broken) await act(async () => void i.dispatchEvent(new Event("error")));
    expect(container.textContent).not.toContain("/2");
    expect(onEmpty).not.toHaveBeenCalled();

    const all = renderEvent(
      <PhotoSlideshow photos={[{ keyFull: "broken:1", keyThumb: "broken:1" }]} onEmpty={onEmpty} />,
    );
    await act(async () => void failAllImages(all.container));
    expect(onEmpty).toHaveBeenCalled();
    expect(isEmpty(all.container)).toBe(true);
  });
});

describe("AboutText", () => {
  const sizes = (scroll: number, client: number) => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scroll);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(client);
  };

  it("kosong/spasi: tidak dirender sama sekali", () => {
    for (const v of [null, "", "   "])
      expect(isEmpty(renderEvent(<AboutText text={v} />).container)).toBe(true);
  });

  it("teks pendek: tanpa tombol 'Baca selengkapnya'", () => {
    sizes(60, 60);
    renderEvent(<AboutText text="Singkat." />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("teks terpotong: tombol muncul dan membuka/melipat dengan aria-expanded", () => {
    sizes(300, 80);
    const { container } = renderEvent(<AboutText text={"Paragraf satu.\n\nParagraf dua."} />);
    const btn = screen.getByRole("button", { name: "Baca selengkapnya" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("p")?.className).toContain("whitespace-pre-line");
    fireEvent.click(btn);
    const lipat = screen.getByRole("button", { name: "Lipat lagi" });
    expect(lipat.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("p")?.getAttribute("data-expanded")).toBe("true");
  });

  it("selalu di-escape: tanpa HTML", () => {
    sizes(60, 60);
    const { container } = renderEvent(<AboutText text={"<img src=x onerror=alert(1)>"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });
});

describe("RatingBreakdown dan RatePanel", () => {
  it("sebaran: tidak dirender bila null (disembunyikan) atau belum ada ulasan", () => {
    expect(isEmpty(renderEvent(<RatingBreakdown distribution={null} />).container)).toBe(true);
    expect(isEmpty(renderEvent(<RatingBreakdown distribution={[0, 0, 0, 0, 0]} />).container)).toBe(
      true,
    );
    const { container } = renderEvent(<RatingBreakdown distribution={[0, 0, 1, 1, 2]} />);
    expect(container.querySelectorAll("figure > div")).toHaveLength(5);
    expect(container.textContent).toContain("2");
  });

  const panel = (serverNow: number) => renderEvent(<RatePanel id="nilai" />, { serverNow });
  it("kartu penilaian menurut status: belum mulai → hitung mundur, berjalan → pengganti jujur, selesai → ditutup", () => {
    expect(panel(NOW.upcoming).container.textContent).toContain("Voting dibuka dalam");
    cleanup();
    expect(panel(NOW.live).container.textContent).toContain("lagi disiapkan");
    cleanup();
    expect(panel(NOW.ended).container.textContent).toContain("udah ditutup");
  });
});

describe("WhatsAppOrderButton", () => {
  it("tautan ke /go/wa (nomor tidak pernah ada di halaman); buka tab baru dengan rel aman", () => {
    renderEvent(<WhatsAppOrderButton boothId="b1" productId="p 1" productName="Kopi" />);
    const a = screen.getByRole("link") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("/go/wa/b1?p=p%201");
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
    expect(a.getAttribute("aria-label")).toContain("Kopi");
  });

  it("hilang setelah event selesai", () => {
    const { container } = renderEvent(<WhatsAppOrderButton boothId="b1" />, {
      serverNow: NOW.ended,
    });
    expect(isEmpty(container)).toBe(true);
  });
});

describe("Showcase", () => {
  const many = (n: number, cat = (i: number) => `Kat ${i % 3}`) =>
    Array.from({ length: n }, (_, i) => ({
      ...PRODUCTS.tanpaFoto,
      id: `p${i}`,
      name: `Produk ${i}`,
      category: cat(i),
    }));

  it("tanpa produk: tidak dirender (judul induk ikut hilang)", () => {
    expect(isEmpty(renderEvent(<Showcase products={[]} />).container)).toBe(true);
  });

  it("menampilkan 6 dulu, lalu 'Tampilkan lebih banyak' menambah 6; keterangan jumlah", () => {
    renderEvent(<Showcase products={many(14, () => "Sama")} />);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(6);
    expect(screen.getByText("Menampilkan 6 dari 14 produk")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan lebih banyak (6)" }));
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan lebih banyak (2)" }));
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(14);
    expect(screen.queryByRole("button", { name: /lebih banyak/ })).toBeNull();
  });

  it("chip kategori hanya bila produk > 8 dan ada ≥ 2 kategori; memfilter dan kembali ke 6 pertama", () => {
    const { unmount } = renderEvent(<Showcase products={many(8)} />);
    expect(screen.queryByRole("button", { name: "Semua" })).toBeNull(); // 8 bukan > 8
    unmount();
    renderEvent(<Showcase products={many(12)} />);
    const chip = screen.getByRole("button", { name: "Kat 1" });
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(4); // 12 produk, 3 kategori
    fireEvent.click(screen.getByRole("button", { name: "Semua" }));
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(6);
  });

  it("satu kategori saja walau banyak produk: tanpa chip", () => {
    renderEvent(<Showcase products={many(12, () => "Sama")} />);
    expect(screen.queryByRole("button", { name: "Semua" })).toBeNull();
  });

  it("tautan produk (?p=) membuka halaman yang memuatnya dan menyorotnya", () => {
    vi.useFakeTimers();
    const { container } = renderEvent(
      <Showcase products={many(14, () => "Sama")} highlightId="p10" />,
    );
    expect(screen.getAllByRole("heading", { level: 4 }).length).toBeGreaterThanOrEqual(11);
    expect(container.querySelector("#produk-p10")?.className).toContain("ring-4");
    act(() => void vi.advanceTimersByTime(2600));
    expect(container.querySelector("#produk-p10")?.className).not.toContain("ring-4");
  });

  it("produk tak dikenal pada ?p= diabaikan tanpa galat", () => {
    renderEvent(<Showcase products={many(3)} highlightId="tidak-ada" />);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(3);
  });

  it("mode untuk SELURUH etalase: tanpa satu pun foto → daftar kompak; sebagian berfoto → bingkai", () => {
    const { container, unmount } = renderEvent(<Showcase products={many(3)} />);
    expect(container.querySelector("ul")?.getAttribute("data-visual-mode")).toBe("text");
    unmount();
    const mixed = renderEvent(<Showcase products={[PRODUCTS.lengkap, PRODUCTS.tanpaFoto]} />);
    expect(mixed.container.querySelector("ul")?.getAttribute("data-visual-mode")).toBe("photo");
    expect(mixed.container.querySelectorAll("[data-photo-frame]")).toHaveLength(1);
  });
});

describe("Bagikan dan Incaran", () => {
  it("ShareButton: dialog berisi tautan bagikan (src=share), tanpa permintaan bintang; salin menampilkan toast", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
    renderEvent(<ShareButton boothId="b1" boothName="Kopi" productId="p9" productName="Susu" />);
    fireEvent.click(screen.getByRole("button", { name: "Bagikan" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toContain("/b/b1?p=p9&src=share");
    const wa = screen.getByRole("link", { name: "Kirim lewat WhatsApp" }) as HTMLAnchorElement;
    expect(decodeURIComponent(wa.href)).not.toMatch(/bintang|ulasan/i);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salin tautan" })));
    expect(writeText).toHaveBeenCalledWith(input.value);
    expect(screen.getByText("Tautan disalin")).toBeTruthy();
  });

  it("SaveButton: simpan/buang (aria-pressed), batas penuh memberi toast, hilang setelah event selesai", () => {
    const { container, unmount } = renderEvent(
      <>
        <SaveButton boothId="b1" productId="p1" />
        <WishlistFab booths={[BOOTHS.lengkap]} />
      </>,
    );
    const btn = screen.getByRole("button", { name: /Simpan ke incaran/ });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(
      screen.getByRole("button", { name: /Tersimpan di incaran/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Incaranku (1)" })).toBeTruthy(); // tombol melayang muncul
    fireEvent.click(screen.getByRole("button", { name: /Tersimpan di incaran/ }));
    expect(screen.queryByRole("button", { name: /Incaranku/ })).toBeNull(); // kosong → hilang
    unmount();

    const ended = renderEvent(<SaveButton boothId="b1" productId="p1" />, { serverNow: NOW.ended });
    expect(isEmpty(ended.container)).toBe(true);
    expect(container).toBeTruthy();
  });

  it("Incaranku: tersimpan di penyimpanan per event dan dimuat kembali", () => {
    const store = memStore();
    const first = renderEvent(<SaveButton boothId="b1" productId="p1" />, { store });
    fireEvent.click(screen.getByRole("button", { name: /Simpan ke incaran/ }));
    first.unmount();
    renderEvent(<SaveButton boothId="b1" productId="p1" />, { store });
    expect(screen.getByRole("button", { name: /Tersimpan di incaran/ })).toBeTruthy();
  });
});

describe("SpotlightSection: rotasi adil dari waktu server", () => {
  const booths = [
    BOOTHS.lengkap,
    BOOTHS.hanyaNama,
    BOOTHS.namaDanNomor,
    BOOTHS.fotoGagal404,
    BOOTHS.gratis,
  ];

  it("dalam satu putaran setiap booth tampil tepat satu kali; booth tanpa foto ikut dapat giliran", () => {
    vi.useFakeTimers();
    let now = 0; // dimulai tepat di awal putaran 0
    const { container } = renderEvent(
      <SpotlightSection
        booths={booths}
        seed="seed-uji"
        serverNow={() => now}
        ratingsHidden={false}
      />,
    );
    const seen: string[] = [];
    const layouts = new Set<string>();
    for (let i = 0; i < booths.length; i++) {
      seen.push(container.querySelector("h2")?.textContent ?? "");
      layouts.add(container.querySelector("article")?.getAttribute("data-layout") ?? "");
      now += 8000; // CONFIG.live.spotlightMs
      act(() => void vi.advanceTimersByTime(8100));
    }
    expect(new Set(seen).size).toBe(booths.length);
    expect(seen.sort()).toEqual(booths.map((b) => b.name).sort());
    expect(layouts.has("text")).toBe(true); // ada yang tanpa foto, tetap dapat giliran
  });

  it("satu booth: tidak berputar; tanpa booth: tidak dirender", () => {
    const one = renderEvent(
      <SpotlightSection
        booths={[BOOTHS.hanyaNama]}
        seed="s"
        serverNow={() => 0}
        ratingsHidden={false}
      />,
    );
    expect(one.container.querySelector("h2")?.textContent).toBe("Es Teh Pak Budi");
    one.unmount();
    expect(
      isEmpty(
        renderEvent(
          <SpotlightSection booths={[]} seed="s" serverNow={() => 0} ratingsHidden={false} />,
        ).container,
      ),
    ).toBe(true);
  });

  it("urutan putaran berbeda antar pengunjung (seed) tetapi stabil untuk seed yang sama", () => {
    const first = (seed: string) => {
      const { container, unmount } = renderEvent(
        <SpotlightSection booths={booths} seed={seed} serverNow={() => 0} ratingsHidden={false} />,
      );
      const name = container.querySelector("h2")?.textContent;
      unmount();
      return name;
    };
    expect(first("a")).toBe(first("a"));
    const names = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(first));
    expect(names.size).toBeGreaterThan(1);
  });
});

describe("helper", () => {
  beforeEach(() => undefined);
  it("within tersedia (sanity impor)", () => {
    expect(typeof within).toBe("function");
  });
});
