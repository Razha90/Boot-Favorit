import type { BoothSelfView } from "@shared/api-types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PosterPrintButton } from "../../../components/shared/PosterPrint";
import { type PosterContent, QrPoster } from "../../../components/shared/QrPoster";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import type { BoothScope } from "../../../features/booth-editor/scope";
import { copy } from "../../../lib/copy";
import { buildShareText, buildShareUrl, whatsappShareLink } from "../../../lib/share";

/** Panel Bagikan (A14): tautan booth dan tiap produk, teks siap kirim, dan QR. Teks bawaan tidak meminta bintang/ulasan. */
export function ShareCard({
  booth,
  eventName,
  scope,
}: {
  booth: BoothSelfView;
  eventName: string;
  scope: BoothScope;
}) {
  const t = copy.booth.share;
  const origin = window.location.origin;
  const products = useQuery({
    queryKey: ["booth-editor", "products", scope.boothId],
    queryFn: () => scope.products(),
  });
  const active = products.data?.products.filter((p) => p.status === "active") ?? [];
  const boothUrl = buildShareUrl({ origin, boothId: booth.id });
  // QR dicetak di booth: sinyalnya `src=qr` (bukan `share`), supaya tidak dihitung lonjakan tautan sebar (A6).
  const qrUrl = `${origin}/b/${encodeURIComponent(booth.id)}?src=qr`;
  const text = buildShareText({ eventName, boothName: booth.name });
  const posterContent: PosterContent = {
    kind: "booth",
    eventName,
    title: booth.name,
    badge: booth.boothNo ? copy.admin.posters.boothNo(booth.boothNo) : null,
    teamName: booth.teamName,
    tagline: booth.tagline,
    url: qrUrl,
    displayUrl: new URL(origin).host.replace(/^www\./, ""),
    qrLabel: t.qrLabel,
    seed: booth.id,
  };

  return (
    <Card title={t.title}>
      <p className="text-sm text-muted">{t.hint}</p>
      {booth.status !== "approved" && <p className="text-xs text-muted">{t.notPublic}</p>}

      <div className="grid gap-4 sm:grid-cols-[1fr_17rem]">
        <div className="grid content-start gap-3">
          <LinkRow label={t.boothLink} url={boothUrl} />
          <div className="grid gap-1">
            <p className="text-sm font-bold">{t.text}</p>
            <p className="rounded-card bg-surface-tint px-3 py-2 text-sm [overflow-wrap:anywhere]">
              {text}
            </p>
            <div>
              <a
                href={whatsappShareLink(text, boothUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-bold text-primary-strong underline"
              >
                {t.whatsapp}
              </a>
            </div>
          </div>
        </div>
        <div className="grid content-start gap-2">
          <QrPoster size="a4" {...posterContent} />
          <p className="text-xs text-muted">{t.posterHint}</p>
          <PosterPrintButton content={posterContent} />
        </div>
      </div>

      <h3 className="text-sm font-bold">{t.products}</h3>
      {active.length === 0 ? (
        <p className="text-sm text-muted">{t.noProducts}</p>
      ) : (
        <ul className="grid gap-2">
          {active.map((p) => (
            <li key={p.id}>
              <LinkRow
                label={p.name}
                url={buildShareUrl({ origin, boothId: booth.id, productId: p.id })}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const t = copy.booth.share;
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1">
      <p className="text-sm font-bold [overflow-wrap:anywhere]">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 rounded-card bg-surface-tint px-2 py-1 text-xs [overflow-wrap:anywhere]">
          {url}
        </code>
        <Button
          size="sm"
          onClick={() => {
            // Clipboard bisa ditolak (izin/HTTP): tidak ada pesan "tersalin" palsu.
            navigator.clipboard
              ?.writeText(url)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? t.copied : t.copy}
        </Button>
      </div>
    </div>
  );
}
