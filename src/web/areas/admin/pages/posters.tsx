// Halaman Poster QR cetak A4/A5 (explore.md A3 langkah 4, A4, B29): murni di klien dari event + booth approved.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { PosterPrintLayer } from "../../../components/shared/PosterPrint";
import { type PosterContent, type PosterSize, QrPoster } from "../../../components/shared/QrPoster";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, Input, Select } from "../../../components/ui/Form";
import { InfoTip } from "../../../components/ui/InfoTip";
import { QueryState } from "../../../components/ui/states";
import { copy } from "../../../lib/copy";
import { adminApi, adminKeys } from "../api";

const P = copy.admin.posters;

/** Alamat QR utama harus http(s) yang sah; selain itu kembali ke alamat situs ini. */
function cleanUrl(input: string, fallback: string): string {
  try {
    const u = new URL(input.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}

const hostOf = (url: string) => new URL(url).host.replace(/^www\./, "");

export function Component() {
  const { id = "" } = useParams();
  const [size, setSize] = useState<PosterSize>("a4");
  const [includeEvent, setIncludeEvent] = useState(true);
  const [includeRegister, setIncludeRegister] = useState(true);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [mainUrl, setMainUrl] = useState(`${origin}/`);
  const [printing, setPrinting] = useState(false);

  const event = useQuery({ queryKey: adminKeys.event(id), queryFn: () => adminApi.event(id) });
  const booths = useQuery({
    queryKey: [...adminKeys.booths(id), "approved"],
    queryFn: () => adminApi.booths(id, { status: "approved" }),
  });

  const eventName = event.data?.event.name ?? copy.fallbackEventName;
  const approved = booths.data?.booths;

  const posters = useMemo<(PosterContent & { key: string })[]>(() => {
    const out: (PosterContent & { key: string })[] = [];
    const main = cleanUrl(mainUrl, `${origin}/`);
    if (includeEvent) {
      out.push({
        key: "event",
        kind: "event",
        eventName,
        title: P.eventTitle,
        tagline: copy.event.hero.greeting,
        url: main,
        displayUrl: hostOf(main),
        qrLabel: P.eventQrLabel,
        seed: id || "event",
      });
    }
    for (const b of approved ?? []) {
      out.push({
        key: b.id,
        kind: "booth",
        eventName,
        title: b.name,
        badge: b.boothNo ? P.boothNo(b.boothNo) : null,
        teamName: b.teamName,
        tagline: b.tagline,
        url: `${origin}/b/${b.id}?src=qr`,
        displayUrl: hostOf(origin),
        qrLabel: P.qrLabel(b.name),
        seed: b.id,
      });
    }
    if (includeRegister) {
      out.push({
        key: "register",
        kind: "register",
        eventName,
        title: P.registerTitle,
        url: `${origin}/register`,
        displayUrl: `${hostOf(origin)}/register`,
        qrLabel: P.scanToRegister,
        seed: id || "register",
      });
    }
    return out;
  }, [approved, eventName, id, includeEvent, includeRegister, mainUrl, origin]);

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{P.title}</h1>
            <p className="text-sm text-muted">{P.hint}</p>
          </div>
          <Button
            variant="primary"
            icon="qr"
            disabled={posters.length === 0}
            onClick={() => setPrinting(true)}
          >
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
                  onChange={(e) => setSize(e.target.value as PosterSize)}
                >
                  <option value="a4">{P.sizes.a4}</option>
                  <option value="a5">{P.sizes.a5}</option>
                </Select>
              )}
            </Field>
            <Field label={P.eventUrlLabel} hint={P.eventUrlHint} className="min-w-64 flex-1">
              {(fid) => (
                <Input
                  id={fid}
                  inputMode="url"
                  value={mainUrl}
                  onChange={(e) => setMainUrl(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-sm">
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeEvent}
                  onChange={(e) => setIncludeEvent(e.target.checked)}
                />
                {P.includeEvent}
              </label>
              <InfoTip text={P.includeEventInfo} title={P.includeEvent} />
            </div>
            <div className="flex items-center gap-1.5">
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
        {(approved ?? []).length === 0 && <p className="text-sm text-muted">{P.empty}</p>}
        <div className="grid items-start gap-6 md:grid-cols-2">
          {posters.map(({ key, ...p }) => (
            <QrPoster key={key} size={size} {...p} />
          ))}
        </div>
      </QueryState>

      <PosterPrintLayer active={printing} size={size} onDone={() => setPrinting(false)}>
        {posters.map(({ key, ...p }) => (
          <QrPoster key={key} size={size} eager {...p} />
        ))}
      </PosterPrintLayer>
    </>
  );
}
