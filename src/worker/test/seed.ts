// Data uji publik: event aktif + booth lengkap, booth hanya-nama, dan booth belum tayang.
import { fakeWebp } from "@shared/webp-fixture";
import { eq } from "drizzle-orm";
import { boothStats, events } from "../db/schema";
import type { adminHarness } from "./admin";
import { TIMES } from "./fixtures";

type Harness = ReturnType<typeof adminHarness>;

export const photoForm = (
  full: readonly [number, number] = [1280, 960],
  thumb: readonly [number, number] = [480, 360],
) => {
  const f = new FormData();
  const blob = (w: number, h: number, size: number) =>
    new Blob([fakeWebp("VP8 ", w, h, size).slice().buffer], { type: "image/webp" });
  f.append("full", blob(full[0], full[1], 300), "f.webp");
  f.append("thumb", blob(thumb[0], thumb[1], 100), "t.webp");
  return f;
};

export async function seedPublic(h: Harness, opts: { activate?: boolean } = {}) {
  const event = (
    await h.call("POST", "/api/admin/events", { name: 'Expo <Uji> & "Rasa"', ...TIMES })
  ).json.event as { id: string };
  const base = `/api/admin/e/${event.id}/booths`;

  // Booth lengkap: foto, produk (andalan + berbayar), WhatsApp, deskripsi.
  const lengkap = (
    await h.call("POST", base, {
      name: "Kopi Rempah",
      boothNo: "A12",
      tagline: "Hangat di lidah",
      description: "Kopi dengan rempah pilihan.",
    })
  ).json.booth as { id: string };
  await h.call("PATCH", `${base}/${lengkap.id}`, {
    about: "Cerita panjang booth ini.",
    teamName: "Prodi Gizi",
  });
  const photo1 = (
    await h.call("POST", `${base}/${lengkap.id}/media?kind=photo`, undefined, { raw: photoForm() })
  ).json.photo;
  const photo2 = (
    await h.call("POST", `${base}/${lengkap.id}/media?kind=photo`, undefined, { raw: photoForm() })
  ).json.photo;
  const p1 = (
    await h.call("POST", `${base}/${lengkap.id}/products`, {
      name: "Kopi Rempah Susu",
      priceIdr: 18000,
      comparePriceIdr: 24000,
      badge: "limited",
      category: "Minuman",
      termsConfirmed: true,
    })
  ).json.product as { id: string };
  const p2 = (
    await h.call("POST", `${base}/${lengkap.id}/products`, { name: "Teh Tarik", priceIdr: 9000 })
  ).json.product as { id: string };
  await h.call("PUT", `${base}/${lengkap.id}/whatsapp`, {
    number: "0812-3456-7890",
    consentConfirmedByAdmin: true,
  });

  const hanyaNama = (await h.call("POST", base, { name: "Es Teh Pak Budi" })).json.booth as {
    id: string;
  };
  const pending = (await h.call("POST", base, { name: "Belum Tayang" })).json.booth as {
    id: string;
  };
  await h.call("PATCH", `${base}/${pending.id}`, { status: "pending" });

  if (opts.activate !== false) await h.call("POST", `/api/admin/events/${event.id}/activate`);

  /** Rating: booth_stats diisi langsung (API review baru ada di Tahap 6). */
  const setStats = (boothId: string, s: { count: number; sum: number; s5?: number; s4?: number }) =>
    h.t.db
      .update(boothStats)
      .set({ reviewCount: s.count, starSum: s.sum, s5: s.s5 ?? 0, s4: s.s4 ?? 0 })
      .where(eq(boothStats.boothId, boothId));
  const setEvent = (patch: Partial<typeof events.$inferInsert>) =>
    h.t.db.update(events).set(patch).where(eq(events.id, event.id));

  return { event, base, lengkap, hanyaNama, pending, p1, p2, photo1, photo2, setStats, setEvent };
}
