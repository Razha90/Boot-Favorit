// DAFTAR AWAL istilah moderasi (explore.md A15, B25). Ini daftar PERMULAAN yang disusun untuk menguji mesin;
// BELUM ditinjau panitia dan BELUM memakai sumber di A15 (drizki/indonesian-badwords, abaron/bad-words, dst.).
// Sebelum event: bangun daftar lengkap lewat skrip build-terms (belum ada), tinjau manusia, lalu ganti isi berkas ini
// atau muat langsung ke `moderation_terms` lewat admin. Pemberitahuan lisensi sumber: THIRD_PARTY_NOTICES.
//
// Prinsip pemilihan: hanya istilah yang hampir selalu kasar; kata yang punya arti sah (mis. nama hewan atau makanan)
// sengaja TIDAK dimasukkan, karena komentar tentang makanan di expo tidak boleh ikut tertahan. Admin menambah
// atau mengecualikan lewat panel moderasi tanpa deploy.

import type { Severity, TermKind, TermMatch } from "./moderation";

export interface SeedTerm {
  term: string;
  lang: "id" | "en" | "regional";
  severity: Severity;
  kind: TermKind;
  match: TermMatch;
}

const t = (
  term: string,
  lang: SeedTerm["lang"],
  severity: Severity,
  match: TermMatch = "word",
  kind: TermKind = "block",
): SeedTerm => ({ term, lang, severity, kind, match });

export const SEED_TERMS: readonly SeedTerm[] = [
  // Indonesia: berat (hinaan berat, seksual eksplisit)
  t("bajingan", "id", "severe", "contains"),
  t("bangsat", "id", "severe", "contains"),
  t("kontol", "id", "severe", "contains"),
  t("memek", "id", "severe", "contains"),
  t("ngentot", "id", "severe", "contains"),
  t("pelacur", "id", "severe"),
  t("lonte", "id", "severe"),
  t("anjing", "id", "severe"),
  t("keparat", "id", "severe"),
  // Daerah
  t("jancok", "regional", "severe", "contains"),
  t("jancuk", "regional", "severe", "contains"),
  t("asu", "regional", "mild"),
  // Indonesia: ringan
  t("anjir", "id", "mild"),
  t("sialan", "id", "mild"),
  t("brengsek", "id", "mild"),
  t("kampret", "id", "mild"),
  t("tolol", "id", "mild"),
  t("goblok", "id", "mild"),
  t("bego", "id", "mild"),
  t("bodoh", "id", "mild"),
  t("idiot", "id", "mild"),
  // Inggris
  t("fuck", "en", "severe", "contains"),
  t("nigger", "en", "severe", "contains"),
  t("cunt", "en", "severe"),
  t("whore", "en", "severe"),
  t("slut", "en", "severe"),
  t("retard", "en", "severe"),
  t("bitch", "en", "mild"),
  t("shit", "en", "mild"),
  t("asshole", "en", "mild"),
  t("bastard", "en", "mild"),
  t("dick", "en", "mild"),
  t("pussy", "en", "mild"),
  t("damn", "en", "mild"),
  t("stupid", "en", "mild"),
  // Pengecualian (salah tangkap yang diketahui)
  t("petai", "id", "mild", "word", "allow"),
  t("mentai", "id", "mild", "word", "allow"),
  t("mentaiko", "id", "mild", "word", "allow"),
  t("dikdik", "id", "mild", "word", "allow"),
];
