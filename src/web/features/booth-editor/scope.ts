// Foto, logo, dan produk booth dikelola dari DUA tempat: admin (atas nama booth) dan pemilik (portal). Rute kedua sisi
// sengaja berbentuk sama (explore.md B10), jadi satu `BoothScope` dengan basis path berbeda cukup; komponen editor tidak
// perlu tahu siapa penggunanya. Hanya path yang beda: aturan siapa boleh apa ditegakkan server.
import type { PhotoView, ProductView } from "@shared/api-types";
import { api } from "../../lib/api";
import type { ConvertedImage } from "../../lib/image/convert-to-webp";

type Ctx = { key: string };

const multipart = (image: ConvertedImage) => {
  const f = new FormData();
  f.append("full", image.full, "full.webp");
  f.append("thumb", image.thumb, "thumb.webp");
  return f;
};

export interface BoothScope {
  /** id booth; dasar kunci cache */
  boothId: string;
  photos(): Promise<{ photos: PhotoView[] }>;
  upload(
    kind: "photo" | "logo" | "product",
    image: ConvertedImage,
    ctx: Ctx,
    productId?: string,
  ): Promise<unknown>;
  deletePhoto(id: string, ctx: Ctx): Promise<{ photos: PhotoView[] }>;
  reorderPhotos(ids: string[], ctx: Ctx): Promise<{ photos: PhotoView[] }>;
  removeLogo(ctx: Ctx): Promise<{ ok: true }>;
  products(): Promise<{ products: ProductView[] }>;
  createProduct(body: unknown, ctx: Ctx): Promise<{ product: ProductView }>;
  patchProduct(id: string, body: unknown, ctx: Ctx): Promise<{ product: ProductView }>;
  deleteProduct(id: string, ctx: Ctx): Promise<{ ok: true }>;
  setFeatured(id: string, ctx: Ctx): Promise<{ products: ProductView[] }>;
  removeProductPhoto(id: string, ctx: Ctx): Promise<{ product: ProductView }>;
}

export function makeBoothScope(boothId: string, base: string): BoothScope {
  return {
    boothId,
    photos: () => api("GET", `${base}/photos`),
    upload: (kind, image, { key }, productId) =>
      api("POST", `${base}/media?kind=${kind}${productId ? `&productId=${productId}` : ""}`, {
        form: multipart(image),
        key,
      }),
    deletePhoto: (id, { key }) => api("DELETE", `${base}/photos/${id}`, { key }),
    reorderPhotos: (ids, { key }) => api("PUT", `${base}/photos/order`, { body: { ids }, key }),
    removeLogo: ({ key }) => api("DELETE", `${base}/logo`, { key }),
    products: () => api("GET", `${base}/products`),
    createProduct: (body, { key }) => api("POST", `${base}/products`, { body, key }),
    patchProduct: (id, body, { key }) => api("PATCH", `${base}/products/${id}`, { body, key }),
    deleteProduct: (id, { key }) => api("DELETE", `${base}/products/${id}`, { key }),
    setFeatured: (id, { key }) => api("PUT", `${base}/products/${id}/featured`, { key }),
    removeProductPhoto: (id, { key }) => api("DELETE", `${base}/products/${id}/photo`, { key }),
  };
}

/** Admin mengelola atas nama booth. */
export const adminScope = (eventId: string, boothId: string): BoothScope =>
  makeBoothScope(boothId, `/api/admin/e/${eventId}/booths/${boothId}`);

/** Pemilik mengelola boothnya sendiri; id booth diambil server dari sesi. */
export const ownerScope = (boothId: string): BoothScope => makeBoothScope(boothId, "/api/booth");
