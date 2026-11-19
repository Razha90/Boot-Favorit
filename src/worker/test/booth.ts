// Pembantu tes portal booth: klien dengan cookie sendiri di atas `visitorClient` (cookie jar yang sama).
import type { adminHarness } from "./admin";
import { visitorClient } from "./visitor";

type Harness = ReturnType<typeof adminHarness>;

export interface BoothProfile {
  name: string;
  boothNo?: string;
  tagline?: string;
  description?: string;
  teamName?: string;
}

/** Minta kode OTP booth. Di dev lokal kode dikembalikan sebagai `devCode`. */
export const requestBoothOtp = (
  b: ReturnType<typeof visitorClient>,
  email: string,
  purpose: "register" | "login",
) => b.call("POST", "/api/booth/otp/request", { email, purpose }, { key: false });

/** Masuk sebagai pemilik booth yang emailnya sudah tercatat. */
export async function loginBooth(h: Harness, email: string) {
  const b = visitorClient(h);
  const req = await requestBoothOtp(b, email, "login");
  if (!req.json.devCode) throw new Error(`login booth: tidak ada devCode (${req.status})`);
  const ver = await b.call(
    "POST",
    "/api/booth/otp/verify",
    { email, purpose: "login", code: req.json.devCode },
    { key: false },
  );
  if (ver.status !== 200)
    throw new Error(`verifikasi login booth gagal: ${ver.status} ${JSON.stringify(ver.json)}`);
  return b;
}

/** Daftar mandiri penuh: OTP → bukti email → profil. Mengembalikan klien yang sudah bersesi. */
export async function registerBoothVia(h: Harness, email: string, profile: BoothProfile) {
  const b = visitorClient(h);
  const req = await requestBoothOtp(b, email, "register");
  if (!req.json.devCode) throw new Error(`daftar booth: tidak ada devCode (${req.status})`);
  await b.call(
    "POST",
    "/api/booth/otp/verify",
    { email, purpose: "register", code: req.json.devCode },
    { key: false },
  );
  const reg = await b.call("POST", "/api/booth/register", { email, ...profile });
  return { b, reg };
}

/** Admin menjadikan `email` pemilik booth (tanpa mengirim apa pun). */
export const setOwnerEmail = (
  h: Harness,
  eventId: string,
  boothId: string,
  email: string | null,
  reason = "uji coba",
) => h.call("PUT", `/api/admin/e/${eventId}/booths/${boothId}/owner`, { email, reason });
