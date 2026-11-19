import { useQuery } from "@tanstack/react-query";
import { boothApi, boothKeys } from "./booth-api";

/** Sesi portal: `data.me` null = belum masuk. Galat `owner_changed` (pemilik diubah admin) muncul sebagai `error`. */
export const useBoothSession = () =>
  useQuery({ queryKey: boothKeys.session, queryFn: boothApi.session, retry: false });
