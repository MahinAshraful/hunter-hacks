import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// On Vercel (and any serverless platform with a read-only filesystem),
// open the DB in true read-only mode. WAL is disabled there because
// setting `journal_mode = WAL` writes to the file header, which the
// read-only FS rejects. The lookups-table inserts in /api/lookup and
// /api/estimate are already wrapped in try/catch.
const READONLY = process.env.VERCEL === "1" || process.env.APP_DB_READONLY === "1";

// Vercel's `nft` file tracer should ship data/app.db with the function
// (see outputFileTracingIncludes in next.config.ts), but the layout of
// /var/task differs across runtimes. Try a series of known locations
// and use the first one that exists. This makes the route robust to
// path-resolution quirks instead of dying on a single hardcoded guess.
function resolveDbPath(): string {
  if (process.env.APP_DB_PATH) return process.env.APP_DB_PATH;
  const candidates = [
    path.join(process.cwd(), "data", "app.db"),
    // Vercel function root (each function is unpacked under /var/task)
    "/var/task/data/app.db",
    // Some Vercel layouts put traced files alongside the route handler
    path.join(process.cwd(), ".next", "server", "data", "app.db"),
    // Walk up from this file's directory in case cwd is wrong
    path.resolve(__dirname, "..", "..", "data", "app.db"),
    path.resolve(__dirname, "..", "..", "..", "data", "app.db"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  // Fall through to the first candidate so the open call produces a
  // clear ENOENT with a known path the user can grep for in logs.
  return candidates[0];
}

let _sqlite: Database.Database | null = null;
let _db: BetterSQLite3Database<typeof schema> | null = null;

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getSqlite(): Database.Database {
  if (_sqlite) return _sqlite;
  const dbPath = resolveDbPath();
  if (!READONLY) ensureDir(dbPath);
  try {
    _sqlite = new Database(
      dbPath,
      READONLY ? { readonly: true, fileMustExist: true } : {},
    );
  } catch (err) {
    // Re-throw with the resolved path in the message so the route's
    // 500-handler logs include the path that was actually attempted.
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to open SQLite at ${dbPath}: ${msg}`);
  }
  if (!READONLY) _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  return _sqlite;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (_db) return _db;
  _db = drizzle(getSqlite(), { schema });
  return _db;
}

export function initSchema(): void {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS buildings (
      bbl                 TEXT PRIMARY KEY,
      borough             TEXT NOT NULL,
      address             TEXT NOT NULL,
      zipcode             TEXT,
      owner_name          TEXT,
      unit_count_latest   INTEGER,
      unit_count_year     INTEGER,
      on_dhcr_list_latest INTEGER NOT NULL DEFAULT 0,
      source_year_max     INTEGER,
      lat                 REAL,
      lng                 REAL
    );
    CREATE INDEX IF NOT EXISTS idx_buildings_zip  ON buildings(zipcode);
    CREATE INDEX IF NOT EXISTS idx_buildings_addr ON buildings(address);

    CREATE TABLE IF NOT EXISTS rgb_increases (
      order_no         INTEGER PRIMARY KEY,
      lease_start_from TEXT NOT NULL,
      lease_start_to   TEXT NOT NULL,
      one_year_pct     REAL NOT NULL,
      two_year_pct     REAL NOT NULL,
      notes            TEXT
    );

    CREATE TABLE IF NOT EXISTS lookups (
      id                          INTEGER PRIMARY KEY AUTOINCREMENT,
      bbl                         TEXT,
      searched_at                 TEXT NOT NULL DEFAULT (datetime('now')),
      was_stabilized              INTEGER,
      estimated_overcharge_cents  INTEGER
    );
  `);
}

export { schema };
