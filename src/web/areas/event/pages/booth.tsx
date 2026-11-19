import type { PublicBoothDetail, PublicProduct } from "@shared/api-types";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Present } from "../../../components/shared/Present";
import { PriceTag } from "../../../components/shared/PriceTag";
import { FeaturedProduct } from "../../../components/shared/ProductCard";
import { RatingSummary } from "../../../components/shared/RatingSummary";
import { ReadOnlyBanner } from "../../../components/shared/WriteAction";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { EmptyState, ErrorState, Skeleton } from "../../../components/ui/states";
import { useBoothQuery, useEventData, useProductsQuery } from "../../../features/event-data";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { formatRupiahShort } from "../../../lib/format";
import {
  AboutText,
  RatePanel,
  RatingBreakdown,
  WhatsAppOrderButton,
} from "../components/booth-parts";
import { BackButton } from "../components/chrome";
import { PhotoSlideshow } from "../components/PhotoSlideshow";
import { ReviewFlow } from "../components/ReviewFlow";
import { ReviewsSection, TopCategories } from "../components/ReviewsSection";
import { Showcase } from "../components/Showcase";
import { SaveButton, ShareButton } from "../components/share-wishlist";

// Chunk terpisah dari halaman event (B16 butir 4): QR membuka halaman ini tanpa memuat dashboard.
export function Component() {
  const { boothId = "" } = useParams();
  const q = useBoothQuery(boothId);
  const { event } = useEventData();

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-28 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton>{copy.event.booth.back}</BackButton>
        <Link
          to="/"
          className="rounded-chip border-(length:--border-w) border-line bg-accent px-3 py-1 text-xs font-extrabold text-accent-fg [overflow-wrap:anywhere]"
        >
          {event.name}
        </Link>
      </div>
      <ReadOnlyBanner />

      {q.isLoading && (
        <div className="grid gap-4" aria-busy="true">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-24 w-2/3" />
        </div>
      )}
      {q.error && (
        <EmptyState title={copy.event.booth.notFoundTitle} body={copy.event.booth.notFoundBody} />
      )}
      {q.data && <BoothView booth={q.data.booth} />}
      {!q.data && !q.isLoading && !q.error && <ErrorState />}
    </div>
  );
}

function BoothView({ booth }: { booth: PublicBoothDetail }) {
  const { event } = useEventData();
  const state = useEventState();
  const [params] = useSearchParams();
  const highlightId = params.get("p");
  const products = useProductsQuery(booth.id);
  const [slideEmpty, setSlideEmpty] = useState(false);

  useEffect(() => {
    document.title = `${booth.name} · ${event.name}`;
  }, [booth.name, event.name]);

  const list: PublicProduct[] = products.data?.products ?? [];
  const featured = booth.featuredProduct
    ? list.find((p) => p.id === booth.featuredProduct?.id)
    : undefined;
  const others = featured ? list.filter((p) => p.id !== featured.id) : list;
  const hasPhotos = booth.photos.length > 0 && !slideEmpty;
  const hasWhatsapp = products.data?.hasWhatsapp ?? booth.hasWhatsapp;

  // Tautan produk andalan: gulir ke blok andalan (produk lain disorot oleh Showcase).
  useEffect(() => {
    if (featured && highlightId === featured.id) {
      document.getElementById("andalan")?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  }, [featured, highlightId]);

  const actionsFor = (p: PublicProduct) => (
    <span className="flex flex-wrap items-center gap-2 pt-1">
      <SaveButton boothId={booth.id} productId={p.id} />
      {hasWhatsapp && (
        <WhatsAppOrderButton
          boothId={booth.id}
          productId={p.id}
          productName={p.name}
          variant="icon"
        />
      )}
      <ShareButton
        boothId={booth.id}
        boothName={booth.name}
        productId={p.id}
        productName={p.name}
        label=""
      />
    </span>
  );

  return (
    <>
      <section
        data-hero-layout={hasPhotos ? "photo" : "text"}
        className={hasPhotos ? "grid gap-8 lg:grid-cols-2 lg:items-center" : "grid gap-4"}
      >
        {hasPhotos && <PhotoSlideshow photos={booth.photos} onEmpty={() => setSlideEmpty(true)} />}
        <div className="grid content-center gap-3">
          <Present when={booth.boothNo}>
            <span className="w-fit rounded-chip border-(length:--border-w) border-line bg-sticker-3 px-3 py-1 text-sm font-extrabold text-primary-fg">
              {copy.visitor.boothNo(booth.boothNo ?? "")}
            </span>
          </Present>
          <h1 className="font-display text-5xl font-extrabold leading-none [overflow-wrap:anywhere] sm:text-6xl">
            {booth.name}
          </h1>
          <RatingSummary
            average={booth.ratingAverage}
            count={booth.ratingCount}
            hidden={booth.ratingsHidden}
          />
          <Present when={booth.tagline}>
            <p className="font-hand text-3xl">{booth.tagline}</p>
          </Present>
          <div className="flex flex-wrap items-center gap-2">
            <Present when={booth.teamName}>
              <span className="rounded-chip bg-surface-tint px-3 py-1 text-sm font-bold">
                {booth.teamName}
              </span>
            </Present>
            {booth.priceFrom !== null && (
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                {copy.visitor.startsFrom(formatRupiahShort(booth.priceFrom))}
              </span>
            )}
            {booth.allFree && <PriceTag priceIdr={0} size="short" />}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!state.frozen && (
              <a
                href="#nilai"
                className="group hidden items-center gap-2 rounded-chip border-(length:--border-w) border-line bg-text px-5 py-2 font-bold text-surface shadow-[5px_5px_0_var(--accent)] transition-transform hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0_var(--accent)] md:inline-flex"
              >
                <Icon name="star" className="size-4 text-accent" />
                {copy.event.booth.rateCta}
              </a>
            )}
            {featured && (
              <a href="#andalan" className="text-sm font-bold underline underline-offset-4">
                {copy.event.booth.seeFeatured}
              </a>
            )}
            <ShareButton boothId={booth.id} boothName={booth.name} size="md" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-6">
          <Present when={featured}>
            {featured && (
              <div id="andalan" className="scroll-mt-24">
                <FeaturedProduct
                  product={featured}
                  actions={
                    <span className="flex flex-wrap items-center gap-2 pt-1">
                      <SaveButton boothId={booth.id} productId={featured.id} />
                      {hasWhatsapp && (
                        <WhatsAppOrderButton
                          boothId={booth.id}
                          productId={featured.id}
                          productName={featured.name}
                        />
                      )}
                      <ShareButton
                        boothId={booth.id}
                        boothName={booth.name}
                        productId={featured.id}
                        productName={featured.name}
                      />
                      <span className="text-xs">
                        {booth.boothNo
                          ? copy.event.booth.buyAt(booth.boothNo)
                          : copy.event.booth.buyHere}
                      </span>
                    </span>
                  }
                />
              </div>
            )}
          </Present>

          <Present when={others}>
            <Card title={copy.event.booth.showcase}>
              <Showcase products={others} highlightId={highlightId} actions={actionsFor} />
              <p className="text-xs text-muted">{copy.event.booth.disclaimer}</p>
            </Card>
          </Present>

          <Present when={booth.about}>
            <Card title={copy.event.booth.about}>
              <AboutText text={booth.about} />
            </Card>
          </Present>

          <Card title={copy.event.booth.reviews}>
            <TopCategories items={booth.topCategories} />
            <RatingBreakdown distribution={booth.distribution} />
            {(booth.ratingsHidden || booth.ratingCount === 0) && (
              <p className="text-sm text-muted">
                {booth.ratingsHidden ? copy.visitor.ratingsHidden : copy.event.booth.noReviews}
              </p>
            )}
            <ReviewsSection boothId={booth.id} />
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6">
          <RatePanel id="nilai">
            <ReviewFlow booth={booth} />
          </RatePanel>
        </aside>
      </div>

      {/* Bilah bawah di HP: tombol bagikan/produk dan kasih bintang (area aman diperhitungkan) */}
      <nav
        aria-label={copy.event.booth.showcase}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t-(length:--border-w) border-line bg-surface-raised px-4 pt-3 md:hidden"
      >
        {others.length > 0 && (
          <button
            type="button"
            onClick={() =>
              document
                .querySelector("[data-visual-mode]")
                ?.scrollIntoView?.({ behavior: "smooth", block: "start" })
            }
            className="group inline-flex flex-1 items-center justify-center gap-1.5 rounded-chip border-(length:--border-w) border-line px-4 py-2 text-center text-sm font-bold transition-transform active:scale-95"
          >
            <Icon name="sparkles" className="size-4" />
            {copy.event.booth.products}
          </button>
        )}
        {!state.frozen && (
          <a
            href="#nilai"
            className="group inline-flex flex-[2] items-center justify-center gap-1.5 rounded-chip border-(length:--border-w) border-line bg-text px-4 py-2 text-center text-sm font-bold text-surface transition-transform active:scale-95"
          >
            <Icon name="star" className="size-4 text-accent" />
            {copy.event.booth.rateCta}
          </a>
        )}
      </nav>
    </>
  );
}
