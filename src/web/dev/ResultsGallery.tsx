// Galeri komponen hasil, animasi pemenang, bagian 03, dan panel Layar Besar (hanya dev).
import type { PublicBooth, PublicSnapshot } from "@shared/api-types";
import { type ReactNode, useState } from "react";
import { StandingsSection } from "../areas/event/components/StandingsSection";
import {
  BoothsPanel,
  FeedPanel,
  RankingPanel,
  SpotlightPanel,
} from "../areas/screen/components/ScreenPanels";
import { ResultsList } from "../components/shared/ResultsList";
import { WinnerReveal } from "../components/shared/WinnerReveal";
import { Button } from "../components/ui/Button";
import { BOOTHS, RESULT_ENTRIES } from "./fixtures";

const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid content-start gap-2">
    <span className="text-xs font-bold text-muted">{label}</span>
    {children}
  </div>
);

const LABEL: Record<keyof typeof RESULT_ENTRIES, string> = {
  lengkap: "Lengkap (podium, baris, belum cukup ulasan, foto 404)",
  hanyaDuaDiperingkat: "Hanya 2 diperingkat",
  tanpaPeringkat: "Tak ada yang diperingkat",
  namaAneh: "Nama panjang, emoji, spasi",
  kosong: "Kosong",
};

const BOOTH_LIST: PublicBooth[] = [
  {
    ...BOOTHS.lengkap,
    id: "a",
    name: "Kopi Rempah Nusantara",
    ratingAverage: 4.7,
    ratingCount: 24,
  },
  { ...BOOTHS.namaDanNomor, id: "b" },
  { ...BOOTHS.hanyaNama, id: "c" },
];
const SNAPSHOT: PublicSnapshot = {
  eventId: "galeri",
  ratingsHidden: false,
  booths: BOOTH_LIST,
  stats: { boothCount: 3, reviewCount: 24, average: 4.5 },
  ranking: [
    { boothId: "a", rank: 1, score: 4.6, average: 4.7, reviewCount: 24 },
    { boothId: "b", rank: 2, score: 4.1, average: 4.3, reviewCount: 9 },
  ],
  feed: [
    {
      id: "f1",
      boothId: "a",
      boothName: "Kopi Rempah Nusantara",
      stars: 5,
      text: "Kopinya enak sekali dan penjualnya ramah.",
      displayName: "Ani",
      createdAt: 2,
    },
    {
      id: "f2",
      boothId: "c",
      boothName: "Es Teh Pak Budi",
      stars: 4,
      text: "Segar dan murah.",
      displayName: "Pengunjung",
      createdAt: 1,
    },
  ],
  reveal: null,
  resultsPublished: false,
  resultsVersion: 0,
};

export function ResultsGallery({
  Section,
}: {
  Section: (p: { title: string; hint?: string; children: ReactNode }) => ReactNode;
}) {
  const [reveal, setReveal] = useState(false);
  const booths = new Map(BOOTH_LIST.map((b) => [b.id, b]));
  return (
    <>
      <Section
        title="Hasil · ResultsList"
        hint="Seluruh booth; juara 1–3 berbingkai khusus; 4+ baris sama; belum cukup ulasan terpisah."
      >
        <div className="grid gap-8">
          {(Object.keys(RESULT_ENTRIES) as (keyof typeof RESULT_ENTRIES)[]).map((k) => (
            <Cell key={k} label={LABEL[k]}>
              <ResultsList results={RESULT_ENTRIES[k]} />
            </Cell>
          ))}
        </div>
      </Section>

      <Section
        title="Hasil · Animasi pemenang"
        hint="3-2-1 → juara 3 → 2 → 1 → daftar. Esc, Lewati, atau sentuh."
      >
        <div>
          <Button variant="primary" onClick={() => setReveal(true)}>
            Putar animasi
          </Button>
        </div>
        {reveal && (
          <WinnerReveal
            results={RESULT_ENTRIES.lengkap}
            onClose={() => setReveal(false)}
            onOptOut={() => {}}
          />
        )}
      </Section>

      <Section
        title="Event · Bagian 03"
        hint="Peringkat + ulasan terbaru; peringkat disembunyikan; tanpa isi; hasil akhir."
      >
        <div className="grid gap-8">
          <Cell label="Peringkat tampil + ulasan terbaru">
            <StandingsSection snapshot={SNAPSHOT} frozen={false} results={null} />
          </Cell>
          <Cell label="Peringkat disembunyikan (server mengirim null): hanya ulasan terbaru">
            <StandingsSection
              snapshot={{ ...SNAPSHOT, ranking: null }}
              frozen={false}
              results={null}
            />
          </Cell>
          <Cell label="Rating disembunyikan: tanpa bintang pada ulasan">
            <StandingsSection
              snapshot={{
                ...SNAPSHOT,
                ratingsHidden: true,
                ranking: null,
                feed: SNAPSHOT.feed.map((f) => ({ ...f, stars: null })),
              }}
              frozen={false}
              results={null}
            />
          </Cell>
          <Cell label="Selesai, hasil belum diumumkan">
            <StandingsSection snapshot={SNAPSHOT} frozen results={null} />
          </Cell>
          <Cell label="Selesai + diumumkan: hasil akhir">
            <StandingsSection
              snapshot={{ ...SNAPSHOT, resultsPublished: true, resultsVersion: 1 }}
              frozen
              results={RESULT_ENTRIES.lengkap}
            />
          </Cell>
        </div>
      </Section>

      <Section title="Layar Besar · Panel" hint="Huruf besar, tanpa interaksi.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Cell label="Sorotan (lengkap)">
            <SpotlightPanel booth={BOOTH_LIST[0] as PublicBooth} ratingsHidden={false} />
          </Cell>
          <Cell label="Sorotan (hanya nama, rating disembunyikan)">
            <SpotlightPanel booth={BOOTH_LIST[2] as PublicBooth} ratingsHidden />
          </Cell>
          <Cell label="Semua booth">
            <BoothsPanel booths={BOOTH_LIST} />
          </Cell>
          <Cell label="Ulasan terbaru">
            <FeedPanel feed={SNAPSHOT.feed} />
          </Cell>
          <Cell label="Peringkat">
            <RankingPanel ranking={SNAPSHOT.ranking ?? []} booths={booths} />
          </Cell>
        </div>
      </Section>
    </>
  );
}
