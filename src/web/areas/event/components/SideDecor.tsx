import { decorLayout } from "@shared/decor-layout";
import { FOOD_ART, foodArtPath } from "@shared/food-art";
import { type CSSProperties, useMemo } from "react";
import { SafeImage } from "../../../components/shared/SafeImage";

// Hiasan latar di ruang kosong kiri-kanan layar lebar (>= 1536px, saat konten 80rem menyisakan lajur samping).
// Statis: ikut bergulir bersama halaman, tanpa animasi, di belakang konten (-z-10; induknya `isolate`), tidak
// menangkap klik, dan sengaja pudar agar perhatian tetap di konten. Posisi, sudut, dan ukuran diacak tetapi
// stabil per event (`decorLayout`, sampel berstrata supaya merata dan tidak menumpuk).
const COUNT = 8;
// Lebar stiker mengikuti lebar lajur (var --s), dibatasi 4–9rem.
const LANE_VARS = { "--s": "clamp(4rem, calc(100% - 3rem), 9rem)" } as CSSProperties;

function Lane({ seed, side }: { seed: string; side: "left" | "right" }) {
  const items = useMemo(() => decorLayout(seed, side, COUNT), [seed, side]);
  return (
    <div
      style={LANE_VARS}
      className={`absolute inset-y-0 w-[calc((100vw_-_80rem)/2)] ${side === "left" ? "left-0" : "right-0"}`}
    >
      {items.map((it) => (
        <div
          key={it.art}
          style={{
            top: `${it.topPct}%`,
            left: `calc((100% - var(--s)) * ${it.leftFrac.toFixed(3)})`,
            width: "var(--s)",
            rotate: `${it.rotate}deg`,
            scale: it.scale.toFixed(2),
          }}
          className="absolute"
        >
          <SafeImage
            src={foodArtPath(FOOD_ART[it.art] ?? "donut")}
            aspect="1/1"
            className="w-full"
            fallback={null}
          />
        </div>
      ))}
    </div>
  );
}

export function SideDecor({ seed }: { seed: string }) {
  return (
    <div
      aria-hidden="true"
      data-side-decor=""
      className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden opacity-[0.16] grayscale-[0.35] 2xl:block in-data-[vibe=pro]:hidden"
    >
      <Lane seed={seed} side="left" />
      <Lane seed={seed} side="right" />
    </div>
  );
}
