import type { BoothScope } from "./scope";

export interface EditorProps {
  scope: BoothScope;
  /** Hanya yang dibutuhkan editor: bisa dari tampilan admin maupun tampilan pemilik. */
  booth: { id: string; logoKey: string | null };
  /** Muat ulang data booth (dan daftar terkait) setelah perubahan */
  refresh: () => Promise<unknown>;
}
