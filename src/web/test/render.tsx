// Pembantu tes area event: membungkus UI dengan semua provider yang dipakai halaman pengunjung.
import type { PublicEvent } from "@shared/api-types";
import type { EventSchedule } from "@shared/event-state";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../components/ui/Toast";
import { sampleResolver } from "../dev/fixtures";
import { EventDataProvider } from "../features/event-data";
import { EventStateProvider } from "../lib/event-state";
import { MediaUrlProvider } from "../lib/media-url";
import { PinsProvider } from "../lib/pins";
import type { SafeStorage } from "../lib/safe-storage";
import { WishlistProvider } from "../lib/wishlist";

export const SCHEDULE: EventSchedule = {
  registrationOpenAt: 1000,
  registrationCloseAt: 2000,
  eventStartAt: 3000,
  eventEndAt: 4000,
  resultsPublishedAt: null,
  allowLateRegistration: true,
};

export const makeEvent = (over: Partial<PublicEvent> = {}): PublicEvent => ({
  id: "ev1",
  name: "Penilaian Booth Terfavorit LPPM Expo Tahun 2026",
  titleHighlight: "Terfavorit",
  timezone: "Asia/Jakarta",
  schedule: SCHEDULE,
  ratingsMode: "visible",
  rankingMode: "visible",
  versions: { active: 1, stats: 0, results: 0 },
  reviewCategories: [],
  media: { logoKey: null, ogImageKey: null, heroKeys: [] },
  ...over,
});

export const memStore = (): SafeStorage => {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
  };
};

/** Komponen "tidak dirender" = tidak ada isi selain wilayah pengumuman milik ToastProvider. */
export function isEmpty(container: HTMLElement): boolean {
  return [...container.children].every((el) => el.hasAttribute("aria-live"));
}

/** `serverNow` = waktu server saat data diterima; jam lokal dibuat konsisten agar status tidak bergeser. */
export function renderEvent(
  ui: ReactElement,
  o: { event?: PublicEvent; serverNow?: number; route?: string; store?: SafeStorage } = {},
) {
  const event = o.event ?? makeEvent();
  const serverNow = o.serverNow ?? 3500; // event berlangsung
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[o.route ?? "/"]}>
      <QueryClientProvider client={client}>
        <MediaUrlProvider resolve={sampleResolver}>
          <EventDataProvider data={{ event, serverNow }} fetchedAt={Date.now()}>
            <EventStateProvider schedule={event.schedule} serverNow={serverNow}>
              <ToastProvider>
                <WishlistProvider eventId={event.id} store={o.store ?? memStore()}>
                  <PinsProvider eventId={event.id} store={o.store ?? memStore()}>
                    {ui}
                  </PinsProvider>
                </WishlistProvider>
              </ToastProvider>
            </EventStateProvider>
          </EventDataProvider>
        </MediaUrlProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** Foto sungguhan di dalam `root`. Stiker kartun makanan (`/art/...`) dekoratif dan tidak dihitung (A16, B27). */
export const photoImgs = (root: ParentNode): HTMLImageElement[] =>
  [...root.querySelectorAll("img")].filter((i) => !i.getAttribute("src")?.startsWith("/art/"));
