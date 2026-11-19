// R2 palsu di memori untuk tes.
export interface FakeObject {
  bytes: Uint8Array;
  contentType?: string;
  cacheControl?: string;
}

export class FakeR2 {
  readonly objects = new Map<string, FakeObject>();
  /** Set kunci yang membuat put() gagal (simulasi R2 bermasalah). */
  failPutFor = new Set<string>();

  async put(
    key: string,
    value: ArrayBuffer | Uint8Array | string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ) {
    if ([...this.failPutFor].some((f) => key.includes(f))) throw new Error("R2 put gagal");
    const bytes =
      typeof value === "string"
        ? new TextEncoder().encode(value)
        : value instanceof Uint8Array
          ? value
          : new Uint8Array(value);
    this.objects.set(key, {
      bytes,
      contentType: options?.httpMetadata?.contentType,
      cacheControl: options?.httpMetadata?.cacheControl,
    });
    return {} as unknown;
  }

  async delete(keys: string | string[]) {
    for (const k of Array.isArray(keys) ? keys : [keys]) this.objects.delete(k);
  }

  /** Mirip R2ObjectBody: isi sebagai aliran + metadata HTTP. */
  async get(key: string) {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      body: new Blob([obj.bytes.slice().buffer]).stream(),
      httpEtag: `"etag-${key.length}"`,
      writeHttpMetadata(h: Headers) {
        if (obj.contentType) h.set("content-type", obj.contentType);
        if (obj.cacheControl) h.set("cache-control", obj.cacheControl);
      },
    };
  }

  asBucket(): R2Bucket {
    return this as unknown as R2Bucket;
  }
}
