// Galeri komponen (hanya mode dev): tiap komponen × varian × fixture data kosong × tema (explore.md B14 butir 8).
import { type ReactNode, useState } from "react";
import { BoothCard } from "../components/shared/BoothCard";
import { BoothGrid } from "../components/shared/BoothGrid";
import { PhotoFrame } from "../components/shared/PhotoFrame";
import { PriceTag } from "../components/shared/PriceTag";
import { FeaturedProduct, ProductGrid } from "../components/shared/ProductCard";
import { ProfileCompleteness } from "../components/shared/ProfileCompleteness";
import { RatingStars } from "../components/shared/RatingStars";
import { RatingSummary } from "../components/shared/RatingSummary";
import { ActionButton } from "../components/ui/ActionButton";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/Modal";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/states";
import { ToastProvider, useToast } from "../components/ui/Toast";
import { MediaUrlProvider } from "../lib/media-url";
import { applyTheme, type ThemeMode, type Vibe } from "../lib/theme-loader";
import { EventGallery } from "./EventGallery";
import { BOOTH_NAMES, BOOTHS, PRODUCTS, sampleResolver } from "./fixtures";
import { ReviewGallery } from "./ReviewGallery";

const LABEL: Record<string, string> = {
  lengkap: "Lengkap",
  namaDanNomor: "Nama + nomor",
  hanyaNama: "Hanya nama",
  fotoGagal404: "Foto gagal (404)",
  stringKosong: "Teks kosong/spasi",
  namaPanjang: "Nama 60 huruf",
  namaSimbol: "Emoji/simbol",
  gratis: "Semua gratis",
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t-(length:--border-w) border-line pt-6">
      <h2 className="font-display text-2xl font-extrabold">{title}</h2>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {children}
    </section>
  );
}

const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid content-start gap-1">
    <span className="text-xs font-bold text-muted">{label}</span>
    {children}
  </div>
);

function Controls() {
  const [vibe, setVibe] = useState<Vibe>("seru");
  const [mode, setMode] = useState<ThemeMode>("kertas");
  const set = (v: Vibe, m: ThemeMode) => {
    setVibe(v);
    setMode(m);
    applyTheme({ vibe: v, mode: m });
  };
  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b-(length:--border-w) border-line bg-surface p-3">
      <strong className="mr-2">Gaya</strong>
      {(["seru", "pro"] as const).map((v) => (
        <Button
          key={v}
          size="sm"
          variant={vibe === v ? "primary" : "secondary"}
          aria-pressed={vibe === v}
          onClick={() => set(v, mode)}
        >
          {v}
        </Button>
      ))}
      <strong className="ml-3 mr-2">Tema</strong>
      {(["kertas", "panggung"] as const).map((m) => (
        <Button
          key={m}
          size="sm"
          variant={mode === m ? "primary" : "secondary"}
          aria-pressed={mode === m}
          onClick={() => set(vibe, m)}
        >
          {m}
        </Button>
      ))}
    </div>
  );
}

function UiSection() {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <Section title="Primitif UI" hint="Tombol aksi, keadaan, toast, dialog.">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="primary">Utama</Button>
        <Button>Sekunder</Button>
        <Button variant="danger">Bahaya</Button>
        <Button variant="ghost">Ghost</Button>
        <ActionButton variant="primary" action={() => new Promise((r) => setTimeout(r, 1500))}>
          Aksi lambat (1,5 dtk)
        </ActionButton>
        <ActionButton
          action={async () => {
            throw new Error("gagal");
          }}
        >
          Aksi gagal
        </ActionButton>
        <Button onClick={() => toast.push("Tersimpan, makasih ya!", "success")}>
          Toast sukses
        </Button>
        <Button onClick={() => toast.push("Ada yang salah.", "danger")}>Toast galat</Button>
        <Button onClick={() => setConfirm(true)}>Dialog konfirmasi</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["muted", "primary", "accent", "danger"] as const).map((t) => (
          <Badge key={t} tone={t}>
            {t}
          </Badge>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <EmptyState title="Belum ada booth" body="Booth akan muncul di sini begitu didaftarkan." />
        <ErrorState onRetry={() => {}} />
        <div className="grid gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Hapus produk?"
        message="Produk dan fotonya dihapus. Tidak bisa dibatalkan."
        confirmLabel="Hapus"
        danger
        action={() => new Promise((r) => setTimeout(r, 1000))}
      />
    </Section>
  );
}

export function Component() {
  return (
    <MediaUrlProvider resolve={sampleResolver}>
      <ToastProvider>
        <Controls />
        <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6">
          <header>
            <h1 className="font-display text-4xl font-extrabold">Galeri komponen</h1>
            <p className="text-muted">
              Hanya mode dev. Ganti gaya dan tema di atas; periksa tiap kolom data kosong.
            </p>
          </header>

          <Section
            title="PhotoFrame"
            hint="Bingkai pengganti foto: inisial + nomor, warna stabil dari id. Bukan pesan kesalahan."
          >
            <div className="grid gap-4 sm:grid-cols-4">
              {BOOTH_NAMES.map((n) => (
                <Cell key={n} label={LABEL[n] ?? n}>
                  <PhotoFrame
                    id={BOOTHS[n].id}
                    name={BOOTHS[n].name}
                    boothNo={BOOTHS[n].boothNo}
                    size="md"
                  />
                </Cell>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(["xs", "sm"] as const).map((s) => (
                <PhotoFrame key={s} id="b-lengkap" name="Kopi Rempah" size={s} />
              ))}
            </div>
          </Section>

          <Section
            title="BoothCard · card"
            hint="Ukuran kartu SAMA untuk semua fixture (keadilan). Mode foto: yang tanpa foto memakai bingkai."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BOOTH_NAMES.map((n) => (
                <Cell key={n} label={LABEL[n] ?? n}>
                  <BoothCard booth={BOOTHS[n]} variant="card" visualMode="photo" />
                </Cell>
              ))}
            </div>
          </Section>

          <Section title="BoothGrid" hint="Satu keputusan mode untuk seluruh daftar.">
            <h3 className="font-bold">Campuran (sebagian berfoto)</h3>
            <BoothGrid booths={BOOTH_NAMES.map((n) => BOOTHS[n])} />
            <h3 className="font-bold">Tak satu pun berfoto → semua hanya-teks</h3>
            <BoothGrid
              booths={[
                BOOTHS.hanyaNama,
                BOOTHS.namaDanNomor,
                BOOTHS.namaPanjang,
                BOOTHS.namaSimbol,
              ]}
            />
            <h3 className="font-bold">Rating disembunyikan admin</h3>
            <BoothGrid booths={[BOOTHS.lengkap, BOOTHS.hanyaNama]} ratingsHidden />
            <h3 className="font-bold">Kosong</h3>
            <BoothGrid booths={[]} />
          </Section>

          <Section
            title="BoothCard · spotlight"
            hint="Dua kolom bila ada foto; hanya-teks (nama sebagai tipografi) bila tanpa foto atau foto gagal."
          >
            <div className="grid gap-4">
              {(["lengkap", "hanyaNama", "fotoGagal404", "stringKosong"] as const).map((n) => (
                <Cell key={n} label={LABEL[n] ?? n}>
                  <BoothCard booth={BOOTHS[n]} variant="spotlight" />
                </Cell>
              ))}
            </div>
          </Section>

          <Section title="BoothCard · row, compact, admin">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid content-start gap-2">
                {BOOTH_NAMES.slice(0, 4).map((n, i) => (
                  <BoothCard key={n} booth={BOOTHS[n]} variant="row" rank={i + 1} />
                ))}
              </div>
              <div className="grid content-start gap-2">
                {BOOTH_NAMES.slice(0, 4).map((n) => (
                  <BoothCard key={n} booth={BOOTHS[n]} variant="compact" />
                ))}
              </div>
              <div className="grid content-start gap-2">
                <BoothCard
                  booth={BOOTHS.hanyaNama}
                  variant="admin"
                  completeness="name_only"
                  actions={<Button size="sm">Kelola</Button>}
                />
                <BoothCard booth={BOOTHS.namaDanNomor} variant="admin" completeness="partial" />
                <BoothCard booth={BOOTHS.lengkap} variant="admin" completeness="full" />
              </div>
            </div>
          </Section>

          <Section title="RatingStars, RatingSummary, PriceTag, ProfileCompleteness">
            <div className="grid gap-4 sm:grid-cols-3">
              <Cell label="display 0 / 2,5 / 4,7 / 5">
                {[0, 2.5, 4.7, 5].map((v) => (
                  <RatingStars key={v} mode="display" value={v} />
                ))}
              </Cell>
              <Cell label="input (keyboard: panah, Home, End)">
                <InputDemo />
              </Cell>
              <Cell label="RatingSummary">
                <RatingSummary average={4.7} count={24} />
                <RatingSummary average={null} count={0} />
                <RatingSummary average={4.7} count={24} hidden />
              </Cell>
              <Cell label="PriceTag">
                <PriceTag priceIdr={18000} compareIdr={24000} size="sticker" />
                <PriceTag priceIdr={14500} size="short" />
                <PriceTag priceIdr={0} size="sticker" />
                <PriceTag priceIdr={18000} />
              </Cell>
              <Cell label="ProfileCompleteness (khusus admin/portal)">
                <ProfileCompleteness level="name_only" />
                <ProfileCompleteness level="partial" />
                <ProfileCompleteness level="full" />
                <ProfileCompleteness level="name_only" variant="hint" />
              </Cell>
            </div>
          </Section>

          <Section
            title="Produk"
            hint="Satu keputusan mode untuk seluruh etalase; andalan tanpa foto = hanya teks."
          >
            <h3 className="font-bold">Campuran</h3>
            <ProductGrid products={Object.values(PRODUCTS)} />
            <h3 className="font-bold">Tanpa foto sama sekali → daftar kompak</h3>
            <ProductGrid products={[PRODUCTS.tanpaFoto, PRODUCTS.gratis, PRODUCTS.namaPanjang]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Cell label="Andalan berfoto">
                <FeaturedProduct product={PRODUCTS.lengkap} />
              </Cell>
              <Cell label="Andalan tanpa foto (hanya teks)">
                <FeaturedProduct product={PRODUCTS.tanpaFoto} />
              </Cell>
            </div>
          </Section>

          <EventGallery Section={Section} />
          <ReviewGallery Section={Section} />

          <UiSection />
        </main>
      </ToastProvider>
    </MediaUrlProvider>
  );
}

function InputDemo() {
  const [v, setV] = useState(0);
  return (
    <span className="grid gap-1">
      <RatingStars mode="input" value={v} onChange={setV} size="lg" />
      <span className="text-xs text-muted">nilai: {v}</span>
    </span>
  );
}
