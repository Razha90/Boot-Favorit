// Galeri komponen area event (hanya dev): tiap komponen × status event × fixture data kosong (AGENTS.md: wajib).
import type { PublicEvent } from "@shared/api-types";
import { type EventSchedule, getEventState } from "@shared/event-state";
import { type ReactNode, useMemo } from "react";
import {
  AboutText,
  RatePanel,
  RatingBreakdown,
  WhatsAppOrderButton,
} from "../areas/event/components/booth-parts";
import { SiteFooter } from "../areas/event/components/chrome";
import { Hero } from "../areas/event/components/Hero";
import { PhotoSlideshow } from "../areas/event/components/PhotoSlideshow";
import { Showcase } from "../areas/event/components/Showcase";
import { SpotlightSection } from "../areas/event/components/SpotlightSection";
import { SaveButton, ShareButton, WishlistFab } from "../areas/event/components/share-wishlist";
import { EventDataProvider } from "../features/event-data";
import { EventStateProvider } from "../lib/event-state";
import type { SafeStorage } from "../lib/safe-storage";
import { WishlistProvider } from "../lib/wishlist";
import { BOOTH_NAMES, BOOTHS, PRODUCTS } from "./fixtures";

type Phase = "upcoming" | "live" | "ended" | "results";
const DAY = 86_400_000;
const PHASES: [Phase, string][] = [
  ["upcoming", "Belum mulai"],
  ["live", "Berjalan"],
  ["ended", "Selesai (hasil belum)"],
  ["results", "Selesai + hasil diumumkan"],
];

function scheduleFor(phase: Phase, now: number): EventSchedule {
  const base = {
    registrationOpenAt: now - 5 * DAY,
    registrationCloseAt: now - 4 * DAY,
    allowLateRegistration: false,
  };
  if (phase === "upcoming")
    return {
      ...base,
      registrationCloseAt: now + DAY,
      eventStartAt: now + 2 * DAY,
      eventEndAt: now + 3 * DAY,
      resultsPublishedAt: null,
    };
  if (phase === "live")
    return { ...base, eventStartAt: now - DAY, eventEndAt: now + DAY, resultsPublishedAt: null };
  return {
    ...base,
    eventStartAt: now - 3 * DAY,
    eventEndAt: now - DAY,
    resultsPublishedAt: phase === "results" ? now - 1000 : null,
  };
}

const memoryStore = (): SafeStorage => {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
  };
};

function eventFor(
  phase: Phase,
  now: number,
  heroKeys: string[] = [],
  logoKey: string | null = null,
): PublicEvent {
  return {
    id: "galeri",
    name: "Penilaian Booth Terfavorit LPPM Expo Tahun 2026",
    titleHighlight: "Terfavorit",
    timezone: "Asia/Jakarta",
    schedule: scheduleFor(phase, now),
    ratingsMode: "visible",
    rankingMode: "visible",
    versions: { active: 1, stats: 0, results: 0 },
    reviewCategories: [],
    media: { logoKey, ogImageKey: null, heroKeys },
  };
}

/** Penyedia konteks event untuk satu fase; tiap sel galeri punya penyimpanan incaran sendiri (tanpa localStorage). */
function Scope({
  phase,
  event,
  children,
}: {
  phase: Phase;
  event?: PublicEvent;
  children: (e: PublicEvent, now: () => number) => ReactNode;
}) {
  const now = useMemo(() => Date.now(), []);
  const ev = event ?? eventFor(phase, now);
  const store = useMemo(memoryStore, []);
  return (
    <EventDataProvider data={{ event: ev, serverNow: now }} fetchedAt={now}>
      <EventStateProvider schedule={ev.schedule} serverNow={now}>
        <WishlistProvider eventId={`galeri-${phase}`} store={store}>
          {children(ev, () => Date.now())}
        </WishlistProvider>
      </EventStateProvider>
    </EventDataProvider>
  );
}

const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid content-start gap-2">
    <span className="text-xs font-bold text-muted">{label}</span>
    {children}
  </div>
);

const photos = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ keyFull: `ok:${i + 1}`, keyThumb: `ok:${i + 1}` }));
const manyProducts = Array.from({ length: 14 }, (_, i) => ({
  ...PRODUCTS.tanpaFoto,
  id: `g${i}`,
  name: `Produk ${i + 1}`,
  category: `Kategori ${(i % 3) + 1}`,
}));

export function EventGallery({
  Section,
}: {
  Section: (p: { title: string; hint?: string; children: ReactNode }) => ReactNode;
}) {
  return (
    <>
      <Section
        title="Event · Hero"
        hint="Teks, lencana, dan CTA selalu selaras status. 0, 1, dan 3 foto suasana; foto gagal → satu kolom."
      >
        {PHASES.map(([phase, label]) => (
          <Cell key={phase} label={`${label} · tanpa foto`}>
            <Scope phase={phase}>
              {(ev, now) => (
                <Hero
                  event={ev}
                  state={getEventState(ev.schedule, now())}
                  boothCount={8}
                  serverNow={now}
                  registrationVisible={getEventState(ev.schedule, now()).registrationButtonVisible}
                />
              )}
            </Scope>
          </Cell>
        ))}
        {(
          [
            ["1 foto", ["ok:1"]],
            ["3 foto", ["ok:1", "ok:2", "ok:3"]],
            ["foto gagal (404)", ["broken:1", "broken:2"]],
          ] as const
        ).map(([label, keys]) => (
          <Cell key={label} label={`Berjalan · ${label}`}>
            <Scope phase="live" event={eventFor("live", Date.now(), [...keys])}>
              {(ev, now) => (
                <Hero
                  event={ev}
                  state={getEventState(ev.schedule, now())}
                  boothCount={0}
                  serverNow={now}
                  registrationVisible={false}
                />
              )}
            </Scope>
          </Cell>
        ))}
      </Section>

      <Section
        title="Event · Slideshow foto booth"
        hint="Satu foto: tanpa kontrol. Banyak: progres, jeda (hover/fokus/sentuh/tab tersembunyi), panah. Semua gagal: hilang."
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {(
            [
              ["Tanpa foto", 0],
              ["1 foto", 1],
              ["3 foto", 3],
            ] as const
          ).map(([label, n]) => (
            <Cell key={label} label={label}>
              <Scope phase="live">{() => <PhotoSlideshow photos={photos(n)} />}</Scope>
              {n === 0 && <span className="text-xs text-muted">(tidak dirender)</span>}
            </Cell>
          ))}
        </div>
      </Section>

      <Section
        title="Event · Sorotan adil"
        hint="Rotasi dari waktu server; booth tanpa foto ikut dapat giliran (hanya-teks)."
      >
        <Scope phase="live">
          {(_, now) => (
            <SpotlightSection
              booths={BOOTH_NAMES.map((n) => BOOTHS[n])}
              seed="galeri"
              serverNow={now}
              ratingsHidden={false}
            />
          )}
        </Scope>
      </Section>

      <Section
        title="Event · Etalase produk"
        hint="6 dulu + 'lebih banyak'; chip kategori bila > 8 produk; tanpa produk = hilang."
      >
        <Scope phase="live">
          {() => (
            <div className="grid gap-6">
              <Cell label="14 produk, 3 kategori">
                <Showcase products={manyProducts} />
              </Cell>
              <Cell label="Campuran fixture">
                <Showcase products={Object.values(PRODUCTS)} />
              </Cell>
              <Cell label="Tanpa foto sama sekali (daftar kompak)">
                <Showcase products={[PRODUCTS.tanpaFoto, PRODUCTS.gratis]} />
              </Cell>
              <Cell label="Kosong (tidak dirender)">
                <Showcase products={[]} />
              </Cell>
            </div>
          )}
        </Scope>
      </Section>

      <Section title="Event · Kenalan, ulasan, penilaian, aksi">
        <div className="grid gap-6 sm:grid-cols-2">
          <Scope phase="live">
            {() => (
              <>
                <Cell label="AboutText pendek">
                  <AboutText text="Kami meracik kopi rempah sejak 2019." />
                </Cell>
                <Cell label="AboutText panjang (potong 4 baris)">
                  <AboutText text={"Kami meracik kopi rempah sejak 2019. ".repeat(20)} />
                </Cell>
                <Cell label="Sebaran bintang">
                  <RatingBreakdown distribution={[1, 2, 4, 9, 14]} />
                </Cell>
                <Cell label="Aksi produk">
                  <span className="flex flex-wrap items-center gap-2">
                    <SaveButton boothId="b-lengkap" productId="p1" />
                    <WhatsAppOrderButton boothId="b-lengkap" productId="p1" productName="Kopi" />
                    <ShareButton
                      boothId="b-lengkap"
                      boothName="Kopi Rempah"
                      productId="p1"
                      productName="Kopi"
                    />
                  </span>
                  <WishlistFab booths={[BOOTHS.lengkap]} />
                </Cell>
              </>
            )}
          </Scope>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PHASES.slice(0, 3).map(([phase, label]) => (
            <Cell key={phase} label={`Kartu penilaian · ${label}`}>
              <Scope phase={phase}>{() => <RatePanel />}</Scope>
            </Cell>
          ))}
        </div>
      </Section>

      <Section title="Event · Kaki halaman">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Tanpa logo", null],
              ["Dengan logo", "ok:2"],
              ["Logo gagal", "broken:1"],
            ] as const
          ).map(([label, logo]) => (
            <Cell key={label} label={label}>
              <Scope phase="live" event={eventFor("live", Date.now(), [], logo)}>
                {(ev) => <SiteFooter event={ev} />}
              </Scope>
            </Cell>
          ))}
        </div>
      </Section>
    </>
  );
}
