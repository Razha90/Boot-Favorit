import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { copy } from "../../lib/copy";
import { Button } from "../ui/Button";
import { Select } from "../ui/Form";
import { type PosterContent, type PosterSize, QrPoster } from "./QrPoster";

/**
 * Lapisan cetak poster (explore.md B29): saat `active`, poster dirender di luar #root dan dialog cetak peramban
 * dibuka; CSS cetak (`.poster-printing`) menyembunyikan seluruh aplikasi sehingga hanya poster yang tercetak.
 * Gambar dipaksa termuat dulu (maks. 2 dtk) agar logo dan stiker tidak kosong di hasil cetak.
 */
export function PosterPrintLayer({
  active,
  size,
  onDone,
  children,
}: {
  active: boolean;
  size: PosterSize;
  onDone: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const finish = () => {
      document.body.classList.remove("poster-printing");
      onDone();
    };
    document.body.classList.add("poster-printing");
    window.addEventListener("afterprint", finish, { once: true });
    void (async () => {
      const imgs = [...document.querySelectorAll<HTMLImageElement>(".poster-print-root img")];
      const loaded = Promise.all(
        imgs.map((i) =>
          i.complete || typeof i.decode !== "function" ? null : i.decode().catch(() => null),
        ),
      );
      const fontsReady = document.fonts?.ready?.catch(() => null) ?? Promise.resolve();
      await Promise.race([
        Promise.all([loaded, fontsReady]),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
      if (!cancelled) window.print();
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", finish);
      document.body.classList.remove("poster-printing");
    };
  }, [active, onDone]);

  if (!active) return null;
  return createPortal(
    <div className="poster-print-root">
      <style>{`@page { size: ${size} portrait; margin: 0; }`}</style>
      {children}
    </div>,
    document.body,
  );
}

/** Pilih ukuran kertas lalu cetak SATU poster (dipakai di kartu Bagikan portal booth). */
export function PosterPrintButton({ content }: { content: PosterContent }) {
  const [size, setSize] = useState<PosterSize>("a4");
  const [printing, setPrinting] = useState(false);
  const P = copy.poster;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={P.sizeLabel}
        value={size}
        onChange={(e) => setSize(e.target.value as PosterSize)}
        className="w-auto"
      >
        <option value="a4">{P.sizes.a4}</option>
        <option value="a5">{P.sizes.a5}</option>
      </Select>
      <Button icon="qr" onClick={() => setPrinting(true)}>
        {P.printOne}
      </Button>
      <PosterPrintLayer active={printing} size={size} onDone={() => setPrinting(false)}>
        <QrPoster size={size} eager {...content} />
      </PosterPrintLayer>
    </div>
  );
}
