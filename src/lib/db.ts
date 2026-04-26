import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_PATH = process.env.APP_DB_PATH ?? path.join(process.cwd(), "data", "app.db");

// On Vercel (and any serverless platform with a read-only filesystem),
// open the DB in true read-only mode. WAL is also disabled there because
// setting `journal_mode = WAL` writes to the file header, which the
// read-only FS rejects. The lookups-table inserts in /api/lookup and
// /api/estimate are already wrapped in try/catch, so they fail silently
// in production — analytics row, not load-bearing.
const READONLY = process.env.VERCEL === "1" || process.env.APP_DB_READONLY === "1";

let _sqlite: Database.Database | null = null;
let _db: BetterSQLite3Database<typeof schema> | null = null;

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getSqlite(): Database.Database {
  if (_sqlite) return _sqlite;
  if (!READONLY) ensureDir(DB_PATH);
  _sqlite = new Database(
    DB_PATH,
    READONLY ? { readonly: true, fileMustExist: true } : {},
  );
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
