// Isi email untuk pemilik booth (explore.md A4): undangan dan notifikasi keputusan admin. Fungsi murni: mudah diuji.
// Tidak memuat data pribadi selain nama booth; tautan menuju portal (masuk dengan kode OTP ke email ini).

import type { BoothStatus } from "@shared/api-types";
import type { EmailMessage } from "./email";

export type BoothMailKind =
  | "invite"
  | Extract<BoothStatus, "approved" | "rejected" | "revision" | "suspended">;

export interface BoothMailInput {
  to: string;
  eventName: string;
  boothName: string;
  /** Alasan dari admin (untuk rejected/revision) */
  reason?: string | null;
  /** Alamat dasar situs, mis. https://eventunimed.id */
  origin: string;
}

const outro = "Salam,\nPanitia";

export function boothMail(kind: BoothMailKind, i: BoothMailInput): EmailMessage {
  const portal = `${i.origin}/booth`;
  const reason = i.reason?.trim() ? `\nAlasan dari panitia: ${i.reason.trim()}\n` : "";
  switch (kind) {
    case "invite":
      return {
        to: i.to,
        subject: `Kamu pemilik booth ${i.boothName} di ${i.eventName}`,
        text: `Halo,\n\nEmail ini didaftarkan panitia sebagai pemilik booth "${i.boothName}" di ${i.eventName}.\nMasuk ke portal booth: ${portal}\nTidak ada kata sandi: kami kirim kode ke email ini setiap kamu masuk.\n\n${outro}`,
      };
    case "approved":
      return {
        to: i.to,
        subject: `Booth ${i.boothName} disetujui`,
        text: `Halo,\n\nBooth "${i.boothName}" sudah disetujui dan tampil di ${i.eventName}.\nKelola profil, foto, dan produk di ${portal}\n\n${outro}`,
      };
    case "rejected":
      return {
        to: i.to,
        subject: `Booth ${i.boothName} belum bisa disetujui`,
        text: `Halo,\n\nMaaf, booth "${i.boothName}" belum bisa disetujui untuk ${i.eventName}.\n${reason}\nHubungi panitia bila ada pertanyaan. Statusnya bisa dilihat di ${portal}\n\n${outro}`,
      };
    case "revision":
      return {
        to: i.to,
        subject: `Booth ${i.boothName} perlu diperbaiki`,
        text: `Halo,\n\nBooth "${i.boothName}" perlu diperbaiki sebelum disetujui.\n${reason}\nPerbaiki di ${portal}, lalu kirim ulang.\n\n${outro}`,
      };
    case "suspended":
      return {
        to: i.to,
        subject: `Booth ${i.boothName} ditangguhkan`,
        text: `Halo,\n\nBooth "${i.boothName}" untuk sementara tidak tampil di ${i.eventName}.\n${reason}\nHubungi panitia untuk penjelasan. Status bisa dilihat di ${portal}\n\n${outro}`,
      };
  }
}
