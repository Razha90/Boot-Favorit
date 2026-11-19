import { isValidElement, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export type IconName =
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "play"
  | "pause"
  | "close"
  | "check"
  | "plus"
  | "trash"
  | "edit"
  | "save"
  | "send"
  | "share"
  | "copy"
  | "bookmark"
  | "bookmark-check"
  | "star"
  | "star-outline"
  | "sparkles"
  | "trophy"
  | "refresh"
  | "download"
  | "printer"
  | "qr"
  | "upload"
  | "lock"
  | "flag"
  | "mail"
  | "external"
  | "warning"
  | "info"
  | "grid"
  | "activity"
  | "image"
  | "calendar"
  | "sliders"
  | "store"
  | "shield"
  | "table"
  | "eye";

export type IconAnim =
  | "none"
  | "nudge-r"
  | "nudge-l"
  | "nudge-u"
  | "nudge-d"
  | "pop"
  | "spin-hover"
  | "wiggle";

const ANIM_CLASS: Record<IconAnim, string> = {
  none: "",
  "nudge-r": "icon-anim icon-nudge-r",
  "nudge-l": "icon-anim icon-nudge-l",
  "nudge-u": "icon-anim icon-nudge-u",
  "nudge-d": "icon-anim icon-nudge-d",
  pop: "icon-anim icon-pop",
  "spin-hover": "icon-anim icon-spin-hover",
  wiggle: "icon-anim icon-wiggle",
};

const DEFAULT_ANIM: Record<IconName, IconAnim> = {
  "arrow-right": "nudge-r",
  "arrow-left": "nudge-l",
  "arrow-up": "nudge-u",
  "arrow-down": "nudge-d",
  play: "pop",
  pause: "pop",
  close: "pop",
  check: "pop",
  plus: "spin-hover",
  trash: "wiggle",
  edit: "wiggle",
  save: "pop",
  send: "nudge-r",
  share: "nudge-u",
  copy: "pop",
  bookmark: "pop",
  "bookmark-check": "pop",
  star: "pop",
  "star-outline": "pop",
  sparkles: "wiggle",
  trophy: "wiggle",
  refresh: "spin-hover",
  download: "nudge-d",
  printer: "pop",
  qr: "pop",
  upload: "nudge-u",
  lock: "wiggle",
  flag: "wiggle",
  mail: "nudge-r",
  external: "nudge-r",
  warning: "wiggle",
  info: "pop",
  grid: "pop",
  activity: "wiggle",
  image: "pop",
  calendar: "pop",
  sliders: "wiggle",
  store: "pop",
  shield: "pop",
  table: "pop",
  eye: "pop",
};

function Paths({ name }: { name: IconName }) {
  switch (name) {
    case "arrow-right":
      return <path d="M5 12h14m-6-6 6 6-6 6" />;
    case "arrow-left":
      return <path d="M19 12H5m6-6-6 6 6 6" />;
    case "arrow-up":
      return <path d="M12 19V5m-6 6 6-6 6 6" />;
    case "arrow-down":
      return <path d="M12 5v14m-6-6 6 6 6-6" />;
    case "play":
      return <polygon points="7 5 19 12 7 19" fill="currentColor" stroke="none" />;
    case "pause":
      return (
        <>
          <rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none" />
          <rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none" />
        </>
      );
    case "close":
      return <path d="M18 6 6 18M6 6l12 12" />;
    case "check":
      return <path d="M5 12.5 9.5 17 19 7.5" />;
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "trash":
      return (
        <>
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="M6 7l1 13h10l1-13" />
        </>
      );
    case "edit":
      return (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      );
    case "save":
      return (
        <>
          <path d="M5 3h11l4 4v14H5Z" />
          <path d="M9 3v5h6V3" />
          <path d="M8 21v-6h8v6" />
        </>
      );
    case "send":
      return <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />;
    case "share":
      return (
        <>
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="M8.3 10.9 15.7 6.1M8.3 13.1l7.4 4.8" />
        </>
      );
    case "copy":
      return (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </>
      );
    case "bookmark":
      return <path d="M6 3h12v18l-6-4.5L6 21Z" />;
    case "bookmark-check":
      return (
        <>
          <path d="M6 3h12v18l-6-4.5L6 21Z" />
          <path d="M9.5 10.5 11.2 12.2 14.8 8.5" />
        </>
      );
    case "star":
      return (
        <path
          d="M12 2.5 14.95 8.7 21.75 9.6 16.75 14.3 18 21 12 17.7 6 21 7.25 14.3 2.25 9.6 9.05 8.7Z"
          fill="currentColor"
          stroke="none"
        />
      );
    case "star-outline":
      return (
        <path d="M12 3 14.7 8.8 21 9.6 16.3 14 17.5 20.4 12 17.3 6.5 20.4 7.7 14 3 9.6 9.3 8.8Z" />
      );
    case "sparkles":
      return (
        <>
          <path d="M12 3c.7 4 3 6.3 7 7-4 .7-6.3 3-7 7-.7-4-3-6.3-7-7 4-.7 6.3-3 7-7Z" />
          <path d="M19 16v4M17 18h4" />
        </>
      );
    case "trophy":
      return (
        <>
          <path d="M6 4h12v5a6 6 0 0 1-12 0V4Z" />
          <path d="M6 6H3.5A1.5 1.5 0 0 0 2 7.5V9a3.5 3.5 0 0 0 4 3.4" />
          <path d="M18 6h2.5A1.5 1.5 0 0 1 22 7.5V9a3.5 3.5 0 0 1-4 3.4" />
          <path d="M12 15v4M8 21h8" />
        </>
      );
    case "refresh":
      return (
        <>
          <path d="M20 11a8 8 0 0 0-14.5-4.5L3 9" />
          <path d="M3 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.5 4.5L21 15" />
          <path d="M21 20v-5h-5" />
        </>
      );
    case "download":
      return (
        <>
          <path d="M12 4v11m-4-4 4 4 4-4" />
          <path d="M4 19h16" />
        </>
      );
    case "printer":
      return (
        <>
          <path d="M6 9V4h12v5" />
          <rect x="4" y="9" width="16" height="8" rx="2" />
          <path d="M7 15h10v5H7Z" />
        </>
      );
    case "qr":
      return (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h1M20 14v1" />
        </>
      );
    case "upload":
      return (
        <>
          <path d="M12 15V4m-4 4 4-4 4 4" />
          <path d="M4 19h16" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
      );
    case "flag":
      return (
        <>
          <path d="M5 21V4" />
          <path d="M5 4h13l-2 4.5L18 13H5" />
        </>
      );
    case "mail":
      return (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      );
    case "external":
      return (
        <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      );
    case "warning":
      return (
        <>
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </>
      );
    case "info":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </>
      );
    case "grid":
      return (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      );
    case "activity":
      return <path d="M22 12h-4l-3 7-6-14-3 7H2" />;
    case "image":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m21 16-5-5L5 20" />
        </>
      );
    case "calendar":
      return (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </>
      );
    case "sliders":
      return <path d="M4 7h16M4 17h16M9 4v6M15 14v6" />;
    case "store":
      return (
        <>
          <path d="M3 9l1.5-5h15L21 9a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
          <path d="M5 12v8h14v-8" />
        </>
      );
    case "shield":
      return (
        <>
          <path d="M12 3 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
    case "table":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M9 10v10" />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      );
  }
}

/** Ikon vektor SVG murni dengan animasi hover & klik bawaan (tanpa emoji atau teks menyamar). */
export function Icon({
  name,
  anim,
  className,
}: {
  name: IconName;
  anim?: IconAnim;
  className?: string;
}) {
  const effectiveAnim = anim ?? DEFAULT_ANIM[name];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn(
        "size-4 shrink-0 fill-none stroke-current",
        ANIM_CLASS[effectiveAnim],
        className,
      )}
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Paths name={name} />
    </svg>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return extractText(node.props.children);
  return "";
}

/** Menentukan ikon otomatis dari label tombol agar setiap tombol memiliki ikon animasi. */
export function inferButtonIcon(children: ReactNode): IconName | null {
  const s = extractText(children).trim().toLowerCase();
  if (!s) return null;
  if (/\b(kirim|ajukan|verifikasi|kirim ulang)\b/.test(s)) return "send";
  if (/\b(simpan|terapkan|jadikan aktif)\b/.test(s)) return "save";
  if (/\bsalin\b/.test(s)) return "copy";
  if (/\b(ekspor|unduh)\b/.test(s)) return "download";
  if (/\b(cetak|pdf)\b/.test(s)) return "printer";
  if (/\b(unggah|impor|pilih foto|pilih berkas)\b/.test(s)) return "upload";
  if (/\b(hapus|buang|kosongkan|singkirkan|lepas|cabut)\b/.test(s)) return "trash";
  if (/\b(tambah|buat|daftarkan)\b/.test(s)) return "plus";
  if (/\b(tutup|batal|lewati)\b/.test(s)) return "close";
  if (/\b(coba lagi|segarkan|muat|perbarui|ganti)\b/.test(s)) return "refresh";
  if (/\b(setujui|pulihkan|umumkan)\b/.test(s)) return "check";
  if (/\b(tolak|revisi|tangguhkan)\b/.test(s)) return "warning";
  if (/\blaporkan\b/.test(s)) return "flag";
  if (/\b(bagikan)\b/.test(s)) return "share";
  if (/\b(undang)\b/.test(s)) return "mail";
  if (/\b(putar)\b/.test(s)) return "play";
  if (/\b(jeda)\b/.test(s)) return "pause";
  if (/\b(masuk|keluar|buka)\b/.test(s)) return "lock";
  if (/\b(sunting|ubah|edit)\b/.test(s)) return "edit";
  if (/\b(lihat|tampilkan|berikutnya|lanjut)\b/.test(s)) return "arrow-right";
  if (/\b(kembali|sebelumnya)\b/.test(s)) return "arrow-left";
  if (/\b(qr|poster)\b/.test(s)) return "qr";
  return "sparkles";
}
