import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export const getDb = (env: Pick<Env, "DB">) => drizzle(env.DB, { schema });

export type Db = ReturnType<typeof getDb>;

/** Satu batch() D1 (atomik). Aman untuk daftar kosong. */
export async function runBatch(db: Db, statements: BatchItem<"sqlite">[]): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
