// Halaman Poster QR cetak A4/A5 (explore.md A3 langkah 4, A4): murni di klien dari booth approved + QrCode.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";
import { Present } from "../../../components/shared/Present";
import { QrCode } from "../../../components/shared/QrCode";
import { Button } from "../../../components/ui/Button";
import { Badge, Card } from "../../../components/ui/Card";
import { Field, Select } from "../../../components/ui/Form";
import { InfoTip } from "../../../components/ui/InfoTip";
import { QueryState } from "../../../components/ui/states";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { adminApi, adminKeys } from "../api";

const P = copy.admin.posters;

export function Component() {
  const { id = "" } = useParams();
  const [size, setSize] = useState<"a4" | "a5">("a4");
  const [includeRegister, setIncludeRegister] = useState(true);

  const event = useQuery({ queryKey: adminKeys.event(id), queryFn: () => adminApi.event(id) });
  const booths = useQuery({
    queryKey: [...adminKeys.booths(id), "approved"],
    queryFn: () => adminApi.booths(id, { status: "approved" }),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const approved = booths.data?.booths ?? [];
  const eventName = event.data?.event.name ?? copy.fallbackEventName;

  return (
    <>
      <style>{`@page { size: ${size} portrait; margin: 12mm; }`}</style>

      <div className="grid gap-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{P.title}</h1>
            <p className="text-sm text-muted">{P.hint}</p>
          </div>
          <Button variant="primary" onClick={() => window.print()}>
            {P.print}
          </Button>
        </div>

        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <Field label={P.sizeLabel} className="w-60">
              {(fid) => (
                <Select
                  id={fid}
                  value={size}
                  onChange={(e) => setSize(e.target.value as "a4" | "a5")}
                >
                  <option value="a4">{P.sizes.a4}</option>
                  <option value="a5">{P.sizes.a5}</option>
                </Select>
              )}
            </Field>
            <div className="flex items-center gap-1.5 pb-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeRegister}
                  onChange={(e) => setIncludeRegister(e.target.checked)}
                />
                {P.includeRegister}
              </label>
              <InfoTip text={P.includeRegisterInfo} title={P.includeRegister} />
            </div>
          </div>
        </Card>
      </div>

      <QueryState loading={event.isLoading || booths.isLoading} error={event.error ?? booths.error}>
        {approved.length === 0 && !includeRegister ? (
          <p className="text-sm text-muted">{P.empty}</p>
        ) : (
          <div className="grid gap-6 print:block print:gap-0">
            {approved.length === 0 && <p className="text-sm text-muted print:hidden">{P.empty}</p>}
            {approved.map((b) => {
              const url = `${origin}/b/${b.id}?src=qr`;
              return (
                <PosterSheet
                  key={b.id}
                  size={size}
                  eventName={eventName}
                  badge={b.boothNo ? P.boothNo(b.boothNo) : null}
                  title={b.name}
                  subtitle={b.tagline}
                  url={url}
                  qrLabel={P.qrLabel(b.name)}
                  cta={P.scanToRate}
                />
              );
            })}
            {includeRegister && (
              <PosterSheet
                size={size}
                eventName={eventName}
                badge={null}
                title={P.registerTitle}
                subtitle={P.registerSubtitle}
                url={`${origin}/register`}
                qrLabel={P.scanToRegister}
                cta={P.registerSubtitle}
              />
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}

function PosterSheet({
  size,
  eventName,
  badge,
  title,
  subtitle,
  url,
  qrLabel,
  cta,
}: {
  size: "a4" | "a5";
  eventName: string;
  badge: string | null;
  title: string;
  subtitle: string | null;
  url: string;
  qrLabel: string;
  cta: string;
}) {
  return (
    <article
      className={cn(
        "mx-auto flex flex-col items-center justify-between rounded-card border-(length:--border-w) border-line bg-surface-raised p-8 text-center shadow-card print:m-0 print:w-full print:break-after-page print:last:break-after-auto print:border-0 print:shadow-none",
        size === "a4" ? "aspect-[210/297] w-full max-w-xl" : "aspect-[148/210] w-full max-w-md",
      )}
    >
      <div className="grid justify-items-center gap-2">
        <p className="text-xs font-bold tracking-wide text-muted uppercase">{eventName}</p>
        <Present when={badge}>
          <Badge tone="primary">{badge}</Badge>
        </Present>
        <h2 className="font-display text-3xl font-extrabold [overflow-wrap:anywhere]">{title}</h2>
        <Present when={subtitle}>
          <p className="max-w-md text-sm text-muted">{subtitle}</p>
        </Present>
      </div>

      <div className={cn("w-full", size === "a4" ? "max-w-72" : "max-w-52")}>
        <QrCode
          value={url}
          label={qrLabel}
          className="border-(length:--border-w) border-line p-3"
        />
      </div>

      <div className="grid gap-1">
        <p className="text-base font-bold">{cta}</p>
        <p className="font-mono text-xs text-muted [overflow-wrap:anywhere]">{url}</p>
      </div>
    </article>
  );
}
