import type { Context } from "hono";
import type { EventRow, VisitorRow } from "./db/schema";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    requestId: string;
    /** Jam yang dipakai seluruh middleware (bisa diganti di tes). */
    now: () => number;
    /** Event aktif, atau null bila belum ada. Dimuat oleh loadActiveEvent. */
    event: EventRow | null;
    /** Admin yang sudah lolos requireAdmin (hanya ada di /api/admin/*). */
    admin: { email: string };
    /** Pengunjung dari cookie sesi (null = belum masuk). Diisi oleh loadVisitor di rute pengunjung. */
    visitor: VisitorRow | null;
  };
};

export type AppContext = Context<AppEnv>;
