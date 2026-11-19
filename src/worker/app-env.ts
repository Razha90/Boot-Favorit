import type { Context } from "hono";
import type { EventRow } from "./db/schema";

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
  };
};

export type AppContext = Context<AppEnv>;
