// Aturan domain booth yang murni (explore.md A16, B24).

export type OwnerState = "none" | "invited" | "active";

/**
 * Status pemilik DIHITUNG, tidak disimpan (A16):
 * email kosong = tanpa pemilik; email terisi dan belum pernah login = diundang; sudah login = aktif.
 */
export const ownerState = (b: {
  email: string | null;
  ownerLastLoginAt: number | null;
}): OwnerState => (b.email === null ? "none" : b.ownerLastLoginAt === null ? "invited" : "active");

const WHATSAPP_E164 = /^62\d{8,13}$/;

/**
 * Normalisasi nomor WhatsApp ke format 62… tanpa "+" (B24):
 * buang spasi/tanda baca; awalan 0 → 62; +62/62 diterima. Mengembalikan null bila tidak valid.
 */
export function normalizeWhatsapp(input: string): string | null {
  let n = input.trim().replace(/[\s().-]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("0")) n = `62${n.slice(1)}`;
  return WHATSAPP_E164.test(n) ? n : null;
}
