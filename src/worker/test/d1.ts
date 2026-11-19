// D1 palsu untuk tes, di atas node:sqlite (SQLite sungguhan). D1 adalah SQLite, jadi SQL migrasi,
// indeks parsial, CHECK, dan kunci asing diuji apa adanya. Hanya dipakai di tes (butuh tipe Node).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

type Row = Record<string, unknown>;

const toParam = (v: unknown): SQLInputValue =>
  v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : (v as SQLInputValue);

class TestStatement {
  constructor(
    private readonly sqlite: DatabaseSync,
    readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new TestStatement(this.sqlite, this.sql, params);
  }

  private stmt() {
    return this.sqlite.prepare(this.sql);
  }

  async all() {
    const results = this.stmt().all(...this.params.map(toParam)) as Row[];
    return { success: true, results, meta: { changes: 0, rows_read: results.length } };
  }

  async first(column?: string) {
    const row = this.stmt().get(...this.params.map(toParam)) as Row | undefined;
    if (!row) return null;
    return column ? (row[column] ?? null) : row;
  }

  async raw() {
    const s = this.stmt();
    s.setReturnArrays(true);
    return s.all(...this.params.map(toParam)) as unknown as unknown[][];
  }

  async run() {
    const r = this.stmt().run(...this.params.map(toParam));
    return {
      success: true,
      results: [],
      meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
    };
  }
}

class TestD1 {
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(sql: string) {
    return new TestStatement(this.sqlite, sql);
  }

  /** Seperti D1: seluruh batch atomik (semua berhasil atau semua dibatalkan). */
  async batch(statements: TestStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const out = [];
      for (const s of statements) {
        // Pernyataan yang mengembalikan baris (SELECT, RETURNING) memakai all(); sisanya run().
        out.push(/^\s*(select|with)\b|\breturning\b/i.test(s.sql) ? await s.all() : await s.run());
      }
      this.sqlite.exec("COMMIT");
      return out;
    } catch (err) {
      this.sqlite.exec("ROLLBACK");
      throw err;
    }
  }

  async exec(sql: string) {
    this.sqlite.exec(sql);
    return { count: 1, duration: 0 };
  }
}

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

/** Terapkan semua migrasi drizzle/*.sql berurutan (pemisah: `--> statement-breakpoint`). */
export function applyMigrations(sqlite: DatabaseSync): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const text = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
    for (const statement of text.split("--> statement-breakpoint")) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
}

export function createTestDb() {
  const sqlite = new DatabaseSync(":memory:");
  applyMigrations(sqlite);
  const d1 = new TestD1(sqlite) as unknown as D1Database;
  return { sqlite, d1, db: drizzle(d1, { schema }) };
}

export type TestDb = ReturnType<typeof createTestDb>;
