import { FoodSticker } from "../../../components/shared/FoodSticker";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";

// "Papan stiker" hiasan untuk hero saat event belum punya foto suasana (A16, B27): satu ilustrasi besar di
// papan bertumpuk, empat stiker pengiring, kilau, dan lencana tulisan tangan. Murni dekoratif (aria-hidden),
// tidak bergantung pada data booth mana pun. Lebar dipaksa penuh agar tidak pernah menyusut saat gambar belum
// termuat.
const SATELLITES = [
  { offset: 3, pos: "left-0 top-[6%] -rotate-12", bg: "bg-sticker-3" },
  { offset: 6, pos: "right-0 top-0 rotate-12", bg: "bg-sticker-2" },
  {
    offset: 9,
    pos: "bottom-[8%] left-[2%] rotate-6",
    bg: "bg-sticker-1",
  },
  {
    offset: 11,
    pos: "bottom-[14%] right-[-1%] -rotate-6",
    bg: "bg-sticker-5",
  },
] as const;

const SPARKLE = "M24 4C25 16 32 23 44 24C32 25 25 32 24 44C23 32 16 25 4 24C16 23 23 16 24 4Z";

export function HeroArt({ seed }: { seed: string }) {
  return (
    <div
      aria-hidden="true"
      data-hero-art=""
      className="relative mx-auto aspect-square w-full max-w-md lg:max-w-[34rem]"
    >
      <div className="absolute inset-[7%] rotate-3 rounded-[2.5rem] border-(length:--border-w) border-line bg-sticker-4 shadow-card in-data-[vibe=pro]:rotate-0" />
      <div className="absolute inset-[15%] grid -rotate-2 place-items-center rounded-[2rem] border-(length:--border-w) border-line bg-surface-raised shadow-card in-data-[vibe=pro]:rotate-0">
        <FoodSticker seed={seed} className="w-[80%]" />
      </div>

      {SATELLITES.map((s) => (
        <div
          key={s.offset}
          className={cn(
            "absolute w-[26%] rounded-card border-(length:--border-w) border-line p-[1.5%] shadow-card",
            s.pos,
            s.bg,
          )}
        >
          <FoodSticker seed={seed} offset={s.offset} className="w-full" />
        </div>
      ))}

      {[
        "left-[30%] top-[-2%] size-8",
        "right-[8%] top-[44%] size-6",
        "left-[-1%] top-[48%] size-7",
      ].map((cls) => (
        <svg
          key={cls}
          viewBox="0 0 48 48"
          aria-hidden="true"
          className={cn("reveal-twinkle absolute text-accent in-data-[vibe=pro]:hidden", cls)}
        >
          <path
            d={SPARKLE}
            fill="currentColor"
            stroke="var(--line)"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}

      <p className="absolute bottom-[-1%] left-1/2 w-max max-w-[80%] -translate-x-1/2 rotate-[-3deg] rounded-chip border-(length:--border-w) border-line bg-accent px-4 py-1.5 text-center font-hand text-xl text-accent-fg shadow-card sm:text-2xl">
        {copy.event.hero.artBadge}
      </p>
    </div>
  );
}
