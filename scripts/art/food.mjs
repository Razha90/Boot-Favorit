// Sumber ilustrasi kartun makanan (orisinal, tidak terikat merek/institusi mana pun).
// Dijalankan oleh `npm run build:art`; hasilnya (SVG) di-commit ke public/art/food/.
// Warna di sini adalah warna ILUSTRASI (bukan UI), jadi sengaja berada di luar theme.css.

const INK = "#19232B";
const CREAM = "#FFF4DC";
const PINK = "#FF8FA3";
const RED = "#E5483C";
const YELLOW = "#FFD54A";
const ORANGE = "#FDA31B";
const GREEN = "#1EB05F";
const MINT = "#6FD08C";
const BUN = "#E9A24B";
const BROWN = "#7A4A2A";

/** Wajah lucu: dua mata, senyum, dan pipi. `s` = skala, pusat di (x, y). */
const face = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<circle cx="-9" cy="0" r="3" fill="${INK}" stroke="none"/>` +
  `<circle cx="9" cy="0" r="3" fill="${INK}" stroke="none"/>` +
  `<path d="M-5 6Q0 12 5 6" fill="none" stroke-width="2.8"/>` +
  `<circle cx="-15" cy="6" r="3.6" fill="${PINK}" fill-opacity=".75" stroke="none"/>` +
  `<circle cx="15" cy="6" r="3.6" fill="${PINK}" fill-opacity=".75" stroke="none"/>` +
  `</g>`;

/** Garis bertepi gelap (sedotan, tusuk): garis tebal gelap di bawah garis berwarna. */
const rod = (d, color, w = 5) =>
  `<path d="${d}" stroke="${INK}" stroke-width="${w + 6}" fill="none"/>` +
  `<path d="${d}" stroke="${color}" stroke-width="${w}" fill="none"/>`;

const ring = (cx, cy, r) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

export const FOOD = {
  donut: () =>
    `<path fill-rule="evenodd" fill="#F2C27A" d="${ring(60, 62, 40)}${ring(60, 62, 11)}"/>` +
    `<path fill-rule="evenodd" fill="${PINK}" d="${ring(60, 60, 33)}${ring(60, 60, 11)}"/>` +
    `<g stroke-width="3.2" fill="none"><path d="M40 40l5-3" stroke="${YELLOW}"/><path d="M62 31l5 2" stroke="${GREEN}"/><path d="M80 42l4-4" stroke="${CREAM}"/><path d="M36 58l1-6" stroke="${ORANGE}"/><path d="M84 62l-2-6" stroke="${GREEN}"/></g>` +
    face(60, 78, 0.8),

  boba: () =>
    rod("M62 8L70 40", ORANGE, 5) +
    `<path d="M32 50L38 106Q39 110 43 110H77Q81 110 82 106L88 50Z" fill="${CREAM}"/>` +
    `<path d="M34 66H86L82.4 106Q81.6 108.5 79 108.5H41Q38.4 108.5 37.6 106Z" fill="#D9A66B" stroke="none"/>` +
    `<path d="M32 50L38 106Q39 110 43 110H77Q81 110 82 106L88 50" fill="none"/>` +
    `<rect x="26" y="38" width="68" height="13" rx="6" fill="${GREEN}"/>` +
    `<g fill="#4A2E20" stroke-width="2"><circle cx="45" cy="100" r="5"/><circle cx="58" cy="102" r="5"/><circle cx="71" cy="100" r="5"/><circle cx="52" cy="91" r="5"/><circle cx="65" cy="91" r="5"/></g>` +
    face(60, 76, 0.85),

  burger: () =>
    `<path d="M18 96H102Q102 108 90 108H30Q18 108 18 96Z" fill="${BUN}"/>` +
    `<rect x="16" y="78" width="88" height="16" rx="8" fill="${BROWN}"/>` +
    `<path d="M18 66H102L96 77L84 70L72 82L62 70L48 78L36 70L24 77Z" fill="${YELLOW}"/>` +
    `<path d="M14 62Q22 52 30 62Q38 52 46 62Q54 52 62 62Q70 52 78 62Q86 52 94 62Q102 52 106 62V68H14Z" fill="${MINT}"/>` +
    `<path d="M18 58Q18 20 60 20Q102 20 102 58Z" fill="${BUN}"/>` +
    `<g fill="${CREAM}" stroke-width="1.8"><ellipse cx="38" cy="36" rx="3.6" ry="2.2" transform="rotate(-20 38 36)"/><ellipse cx="60" cy="30" rx="3.6" ry="2.2"/><ellipse cx="82" cy="36" rx="3.6" ry="2.2" transform="rotate(20 82 36)"/><ellipse cx="30" cy="48" rx="3.6" ry="2.2" transform="rotate(-30 30 48)"/><ellipse cx="90" cy="48" rx="3.6" ry="2.2" transform="rotate(30 90 48)"/></g>` +
    face(60, 42, 0.8),

  pizza: () =>
    `<path d="M16 34Q60 14 104 34L60 108Z" fill="${YELLOW}"/>` +
    `<path d="M13 30Q60 6 107 30Q109 42 99 42Q60 24 21 42Q11 42 13 30Z" fill="${BUN}"/>` +
    `<g fill="${RED}" stroke-width="2.6"><circle cx="40" cy="52" r="7"/><circle cx="80" cy="52" r="7"/><circle cx="60" cy="90" r="6"/></g>` +
    `<circle cx="48" cy="80" r="3" fill="${GREEN}" stroke="none"/><circle cx="74" cy="76" r="3" fill="${GREEN}" stroke="none"/>` +
    face(60, 64, 0.8),

  cupcake: () =>
    `<path d="M26 66L34 106Q35 110 39 110H81Q85 110 86 106L94 66Z" fill="${GREEN}"/>` +
    `<path d="M42 70L45 108M60 70V108M78 70L75 108" fill="none" stroke-width="2.2"/>` +
    `<path d="M24 68Q18 54 34 52Q32 38 50 40Q52 24 66 30Q80 28 80 42Q98 42 94 54Q104 58 96 68Z" fill="${PINK}"/>` +
    `<circle cx="62" cy="22" r="7" fill="${RED}"/><path d="M62 15Q63 8 70 6" fill="none" stroke-width="2.6"/>` +
    face(60, 88, 0.85),

  coffee: () =>
    `<path d="M44 30Q38 22 44 14M60 30Q54 22 60 14M76 30Q70 22 76 14" fill="none" stroke-width="3"/>` +
    `<ellipse cx="57" cy="104" rx="42" ry="8" fill="${GREEN}"/>` +
    `<path d="M88 52H98Q108 52 108 64Q108 76 96 78L86 78" fill="none"/>` +
    `<path d="M26 42H88V70Q88 98 57 98Q26 98 26 70Z" fill="${CREAM}"/>` +
    `<ellipse cx="57" cy="42" rx="31" ry="7" fill="${BROWN}"/>` +
    face(57, 68, 0.9),

  satay: () =>
    rod("M12 102L108 18", "#E8C9A0", 3) +
    `<g stroke-width="3.5">` +
    [
      [36, 82],
      [58, 62],
      [80, 43],
    ]
      .map(
        ([x, y]) =>
          `<g transform="translate(${x} ${y}) rotate(-40)"><rect x="-16" y="-14" width="32" height="28" rx="9" fill="#B5653A"/><path d="M-9 -9V9M9 -9V9" fill="none" stroke-width="2" stroke-opacity=".45"/>${face(0, 0, 0.55)}</g>`,
      )
      .join("") +
    `</g>`,

  banana: () =>
    `<path d="M34 20L46 17Q44 54 68 72Q84 84 106 78Q98 108 62 106Q16 100 20 42Q22 28 34 20Z" fill="${YELLOW}"/>` +
    `<path d="M32 12L48 9L49 19L34 23Z" fill="${BROWN}"/>` +
    `<path d="M24 52Q24 84 50 98" fill="none" stroke="${CREAM}" stroke-opacity=".7" stroke-width="3"/>` +
    face(60, 90, 0.8),

  watermelon: () =>
    `<g transform="translate(0 8)">` +
    `<path d="M12 50A48 48 0 0 0 108 50Z" fill="${GREEN}"/>` +
    `<path d="M19 50A41 41 0 0 0 101 50Z" fill="${CREAM}" stroke-width="2.4"/>` +
    `<path d="M24 50A36 36 0 0 0 96 50Z" fill="#F2495C" stroke-width="2.4"/>` +
    `<g fill="${INK}" stroke="none"><ellipse cx="40" cy="62" rx="2.6" ry="4" transform="rotate(20 40 62)"/><ellipse cx="80" cy="62" rx="2.6" ry="4" transform="rotate(-20 80 62)"/><ellipse cx="46" cy="76" rx="2.6" ry="4" transform="rotate(30 46 76)"/><ellipse cx="74" cy="76" rx="2.6" ry="4" transform="rotate(-30 74 76)"/></g>` +
    face(60, 64, 0.8) +
    `</g>`,

  icecream: () =>
    `<g transform="translate(0 4) translate(60 62) scale(.93) translate(-60 -62)">` +
    `<path d="M38 62L60 110L82 62Z" fill="${BUN}"/>` +
    `<path d="M47 76L66 98M73 76L54 98M56 66L70 94" fill="none" stroke-width="2" stroke-opacity=".5"/>` +
    `<circle cx="60" cy="30" r="19" fill="${CREAM}"/>` +
    `<circle cx="60" cy="54" r="25" fill="${PINK}"/>` +
    `<circle cx="60" cy="9" r="6" fill="${RED}"/><path d="M60 3Q62 -2 67 -3" fill="none" stroke-width="2.4"/>` +
    face(60, 53, 0.85) +
    `</g>`,

  bakso: () =>
    `<path d="M22 56Q30 44 38 56Q46 44 54 56Q62 44 70 56Q78 44 86 56Q94 44 98 56Z" fill="${YELLOW}"/>` +
    `<g fill="#E8C9A0"><circle cx="40" cy="46" r="11"/><circle cx="62" cy="40" r="11"/><circle cx="82" cy="47" r="11"/></g>` +
    `<ellipse cx="52" cy="50" rx="5" ry="3" fill="${GREEN}" stroke-width="2.4" transform="rotate(-25 52 50)"/>` +
    `<path d="M44 100H76L80 110H40Z" fill="${ORANGE}"/>` +
    `<path d="M16 56H104Q104 100 60 100Q16 100 16 56Z" fill="${CREAM}"/>` +
    `<path d="M17 68H103" fill="none" stroke="${ORANGE}" stroke-width="4"/>` +
    `<path d="M44 28Q40 22 44 16M78 26Q74 20 78 14" fill="none" stroke-width="2.8"/>` +
    face(60, 82, 0.8),

  esteh: () =>
    rod("M64 6L56 70", GREEN, 4) +
    `<path d="M34 22H86L80 106Q79.6 110 75 110H45Q40.4 110 40 106Z" fill="${CREAM}"/>` +
    `<path d="M35.3 40H84.7L80.2 105Q79.8 108 76 108H44Q40.2 108 39.8 105Z" fill="#E58A2B" stroke="none"/>` +
    `<g fill="#E3F6FF" fill-opacity=".85" stroke-width="2.4"><rect x="42" y="42" width="16" height="16" rx="4" transform="rotate(-12 50 50)"/><rect x="62" y="50" width="16" height="16" rx="4" transform="rotate(14 70 58)"/></g>` +
    `<path d="M34 22H86L80 106Q79.6 110 75 110H45Q40.4 110 40 106Z" fill="none"/>` +
    `<g transform="translate(88 26)"><circle r="13" fill="${YELLOW}"/><circle r="8" fill="${CREAM}" fill-opacity=".8" stroke-width="2"/><path d="M0-8V8M-8 0H8M-5.6-5.6L5.6 5.6M5.6-5.6L-5.6 5.6" stroke-width="1.6"/></g>` +
    face(60, 86, 0.8),
};

export const FOOD_NAMES = Object.keys(FOOD);

/** SVG utuh siap simpan. Lebar-tinggi 120 agar mudah diskalakan. */
export function foodSvg(name) {
  const body = FOOD[name]();
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">` +
    `${body}</svg>\n`
  );
}
