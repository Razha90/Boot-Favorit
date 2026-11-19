import type { Context } from "hono";
import type { BoothRow, EventRow, VisitorRow } from "./db/schema";

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
    /** Booth dari cookie sesi (hanya ada di rute portal yang lolos requireBooth). */
    booth: BoothRow;
  };
};

export type AppContext = Context<AppEnv>;
