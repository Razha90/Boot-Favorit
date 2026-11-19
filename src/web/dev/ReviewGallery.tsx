// Galeri komponen penilaian dan ulasan (hanya dev): form, terima kasih, masuk per mode, ulasan × fixture data kosong.
import type { ReviewSubmitResult, VisitorMe } from "@shared/api-types";
import type { ReactNode } from "react";
import { LoginPanel } from "../areas/event/components/LoginPanel";
import { ReviewForm } from "../areas/event/components/ReviewForm";
import { ReviewItem } from "../areas/event/components/ReviewItem";
import { TopCategories } from "../areas/event/components/ReviewsSection";
import { ThankYou } from "../areas/event/components/ThankYou";
import { REVIEWS } from "./fixtures";

const CATS = [
  { id: "c1", label: "Seru" },
  { id: "c2", label: "Ramah" },
  { id: "c3", label: "Rapi" },
  { id: "c4", label: "Kreatif" },
];

const RESULT: ReviewSubmitResult = {
  review: { boothId: "b1", stars: 5, comment: null, categoryIds: [], anonymous: false },
  created: true,
  commentHeld: false,
  progress: { reviewed: 3, total: 24 },
  suggestions: [
    { id: "b2", name: "Es Teh Pak Budi" },
    { id: "b3", name: "Mie Ayam Bu Tini" },
    { id: "b4", name: "Workshop Daur Ulang" },
  ],
};

const me = (authMode: VisitorMe["authMode"], googleClientId: string | null = null): VisitorMe => ({
  visitor: null,
  authMode,
  googleClientId,
  turnstileSiteKey: null,
  reviewed: [],
});
const turnstile = { ref: { current: null }, token: undefined, reset: () => {}, required: false };

const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid content-start gap-2">
    <span className="text-xs font-bold text-muted">{label}</span>
    {children}
  </div>
);

const LABEL: Record<keyof typeof REVIEWS, string> = {
  lengkap: "Lengkap (bintang + kategori)",
  tanpaKategori: "Tanpa kategori",
  ratingDisembunyikan: "Rating disembunyikan (tanpa bintang)",
  tanpaNama: "Tanpa nama",
  teksPanjang: "Teks panjang",
  tanpaSpasi: "Teks 280 huruf tanpa spasi",
  emoji: "Emoji",
  samaran: "Kata disamarkan",
  namaPanjang: "Nama panjang tanpa spasi",
  multibaris: "Beberapa paragraf",
};

export function ReviewGallery({
  Section,
}: {
  Section: (p: { title: string; hint?: string; children: ReactNode }) => ReactNode;
}) {
  const noop = async () => {};
  return (
    <>
      <Section
        title="Event · Form penilaian"
        hint="Bintang wajib; kategori maks. 3; komentar opsional. Baru, mengedit, dan saat keamanan belum siap."
      >
        <div className="grid gap-6 sm:grid-cols-3">
          <Cell label="Baru">
            <ReviewForm categories={CATS} submit={noop} />
          </Cell>
          <Cell label="Mengedit">
            <ReviewForm
              categories={CATS}
              initial={{
                boothId: "b1",
                stars: 4,
                comment: "Oke banget",
                categoryIds: ["c2"],
                anonymous: false,
              }}
              submit={noop}
            />
          </Cell>
          <Cell label="Tanpa kategori event + keamanan belum siap">
            <ReviewForm categories={[]} disabled submit={noop} />
          </Cell>
        </div>
      </Section>

      <Section title="Event · Terima kasih">
        <div className="grid gap-6 sm:grid-cols-3">
          <Cell label="Biasa">
            <ThankYou result={RESULT} onEdit={() => {}} />
          </Cell>
          <Cell label="Komentar ditahan">
            <ThankYou result={{ ...RESULT, commentHeld: true }} onEdit={() => {}} />
          </Cell>
          <Cell label="Semua booth sudah dinilai">
            <ThankYou
              result={{ ...RESULT, progress: { reviewed: 24, total: 24 }, suggestions: [] }}
              onEdit={() => {}}
            />
          </Cell>
        </div>
      </Section>

      <Section
        title="Event · Masuk"
        hint="Email terverifikasi (OTP) dan Google bila dikonfigurasi; tanpa login anonim dan tanpa keluar."
      >
        <div className="grid gap-6 sm:grid-cols-3">
          <Cell label="Google + email (tombol Google tidak dimuat di galeri: butuh client id sungguhan)">
            <LoginPanel me={me("google_or_email")} turnstile={turnstile} onLoggedIn={() => {}} />
          </Cell>
        </div>
      </Section>

      <Section
        title="Event · Ulasan"
        hint="Satu keputusan: komentar yang ditahan tidak pernah sampai ke komponen ini."
      >
        <TopCategories
          items={[
            { id: "c1", label: "Seru", count: 12 },
            { id: "c2", label: "Ramah", count: 9 },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(REVIEWS) as (keyof typeof REVIEWS)[]).map((k) => (
            <Cell key={k} label={LABEL[k]}>
              <ReviewItem review={REVIEWS[k]} onReport={() => {}} />
            </Cell>
          ))}
        </div>
      </Section>
    </>
  );
}
