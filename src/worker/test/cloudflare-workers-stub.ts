// Pengganti modul `cloudflare:workers` untuk tes Node: hanya kelas dasar yang diwarisi LiveHub.
export class DurableObject<E = unknown> {
  constructor(
    protected ctx: unknown,
    protected env: E,
  ) {}
}
