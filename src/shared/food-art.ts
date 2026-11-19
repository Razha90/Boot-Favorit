// Ilustrasi kartun makanan pengganti foto (explore.md A16, B27). Berkas SVG/PNG dibuat skrip
// `scripts/build-art.mjs`; daftar nama di sini HARUS sama dengan `FOOD_NAMES` di `scripts/art/food.mjs`
// (dijaga tes `food-art.test.ts`).
import { hash32 } from "./fair-order";

export const FOOD_ART = [
  "donut",
  "boba",
  "burger",
  "pizza",
  "cupcake",
  "coffee",
  "satay",
  "banana",
  "watermelon",
  "icecream",
  "bakso",
  "esteh",
] as const;

export type FoodArt = (typeof FOOD_ART)[number];

/**
 * Ilustrasi untuk satu booth: ditentukan dari id sehingga tetap sama tiap dimuat, di server maupun client.
 * Bukan sinyal apa pun tentang booth (bukan jenis dagangan atau peringkat); hanya hiasan agar kartu tidak kosong.
 */
export function foodArtFor(id: string, offset = 0): FoodArt {
  const i = (hash32(id) + offset) % FOOD_ART.length;
  return FOOD_ART[i] as FoodArt;
}

export const foodArtPath = (name: FoodArt) => `/art/food/${name}.svg`;
/** Kartu pratinjau tautan 1200x630 per ilustrasi (tanpa teks; judul datang dari og:title). */
export const foodOgPath = (name: FoodArt) => `/og/food-${name}.png`;
export const DEFAULT_OG_PATH = "/og/default.png";
