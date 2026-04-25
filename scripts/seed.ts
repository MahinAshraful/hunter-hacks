import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import { getSqlite, initSchema } from "../src/lib/db";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SEED_DIR = path.join(PROJECT_ROOT, "data", "seed");
const RGB_PATH = path.join(SEED_DIR, "rgb_orders.json");
const RENTSTAB_PATH = path.join(SEED_DIR, "rentstab.csv");
const RENTSTAB_V2_PATH = path.join(SEED_DIR, "rentstab_v2.csv");

const RENTSTAB_YEARS = [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017];
const RENTSTAB_V2_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

type RgbOrder = {
  order_no: number;
  lease_start_from: string;
  lease_start_to: string;
  one_year_pct: number;
  two_year_pct: number;
  notes: string | null;
};

function seedRgb(): number {
  const sqlite = getSqlite();
  const raw = fs.readFileSync(RGB_PATH, "utf8");
  const orders: RgbOrder[] = JSON.parse(raw);

  sqlite.exec("DELETE FROM rgb_increases;");
  const stmt = sqlite.prepare(`
    INSERT INTO rgb_increases (order_no, lease_start_from, lease_start_to, one_year_pct, two_year_pct, notes)
    VALUES (@order_no, @lease_start_from, @lease_start_to, @one_year_pct, @two_year_pct, @notes)
  `);
  const tx = sqlite.transaction((rows: RgbOrder[]) => {
    for (const r of rows) stmt.run(r);
  });
  tx(orders);
  return orders.length;
}

function ynToInt(v: string | undefined): number {
  return v?.trim().toUpperCase() === "Y" ? 1 : 0;
}

function toInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

type BuildingAccumulator = {
  bbl: string;
  borough: string;
  address: string;
  zipcode: string | null;
  owner_name: string | null;
  unit_count_latest: number | null;
  unit_count_year: number | null;
  on_dhcr_list_latest: number;
  source_year_max: number | null;
  lat: number | null;
  lng: number | null;
};

async function seedRentstab(): Promise<number> {
  const sqlite = getSqlite();
  sqlite.exec("DELETE FROM buildings;");

  const insert = sqlite.prepare(`
    INSERT INTO buildings (
      bbl, borough, address, zipcode, owner_name,
      unit_count_latest, unit_count_year, on_dhcr_list_latest,
      source_year_max, lat, lng
    ) VALUES (
      @bbl, @borough, @address, @zipcode, @owner_name,
      @unit_count_latest, @unit_count_year, @on_dhcr_list_latest,
      @source_year_max, @lat, @lng
    )
  `);

  const parser = fs.createReadStream(RENTSTAB_PATH).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true }),
  );

  let total = 0;
  let batch: BuildingAccumulator[] = [];
  const BATCH_SIZE = 1000;

  const flush = sqlite.transaction((rows: BuildingAccumulator[]) => {
    for (const r of rows) insert.run(r);
  });

  for await (const row of parser) {
    const bbl = (row["ucbbl"] || "").trim();
    if (!bbl) continue;

    let unitLatest: number | null = null;
    let unitYear: number | null = null;
    let dhcrLatest = 0;
    let sourceYearMax: number | null = null;

    for (const year of RENTSTAB_YEARS) {
      const uc = toInt(row[`${year}uc`]);
      const dhcr = ynToInt(row[`${year}dhcr`]);
      if (uc !== null && uc > 0) {
        if (unitYear === null || year > unitYear) {
          unitLatest = uc;
          unitYear = year;
        }
        sourceYearMax = sourceYearMax === null ? year : Math.max(sourceYearMax, year);
      }
      if (dhcr === 1) {
        dhcrLatest = year >= (sourceYearMax ?? 0) ? 1 : dhcrLatest;
        sourceYearMax = sourceYearMax === null ? year : Math.max(sourceYearMax, year);
      }
    }

    const acc: BuildingAccumulator = {
      bbl,
      borough: (row["borough"] || "").trim() || boroughFromBbl(bbl),
      address: (row["address"] || "").trim(),
      zipcode: (row["zipcode"] || "").trim() || null,
      owner_name: (row["ownername"] || "").trim() || null,
      unit_count_latest: unitLatest,
      unit_count_year: unitYear,
      on_dhcr_list_latest: dhcrLatest,
      source_year_max: sourceYearMax,
      lat: toFloat(row["lat"]),
      lng: toFloat(row["lon"]),
    };

    batch.push(acc);
    if (batch.length >= BATCH_SIZE) {
      flush(batch);
      total += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    flush(batch);
    total += batch.length;
  }
  return total;
}

function boroughFromBbl(bbl: string): string {
  const d = bbl.charAt(0);
  return { "1": "MN", "2": "BX", "3": "BK", "4": "QN", "5": "SI" }[d] ?? "";
}

async function enrichWithV2(): Promise<{ updated: number; addedFromV2Only: number }> {
  const sqlite = getSqlite();
  if (!fs.existsSync(RENTSTAB_V2_PATH)) return { updated: 0, addedFromV2Only: 0 };

  const update = sqlite.prepare(`
    UPDATE buildings
    SET unit_count_latest = @unit_count_latest,
        unit_count_year   = @unit_count_year,
        source_year_max   = MAX(COALESCE(source_year_max, 0), @unit_count_year)
    WHERE bbl = @bbl
      AND (unit_count_year IS NULL OR unit_count_year < @unit_count_year)
  `);

  const parser = fs.createReadStream(RENTSTAB_V2_PATH).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true }),
  );

  let updated = 0;
  let addedFromV2Only = 0;

  const tx = sqlite.transaction((rows: { bbl: string; uc: number; year: number }[]) => {
    for (const r of rows) {
      const result = update.run({
        bbl: r.bbl,
        unit_count_latest: r.uc,
        unit_count_year: r.year,
      });
      if (result.changes > 0) updated += 1;
      else addedFromV2Only += 1;
    }
  });

  let batch: { bbl: string; uc: number; year: number }[] = [];
  const BATCH_SIZE = 2000;

  for await (const row of parser) {
    const bbl = (row["ucbbl"] || "").trim();
    if (!bbl) continue;

    let bestYear: number | null = null;
    let bestCount: number | null = null;
    for (const year of RENTSTAB_V2_YEARS) {
      const uc = toInt(row[`uc${year}`]);
      if (uc !== null && uc > 0) {
        if (bestYear === null || year > bestYear) {
          bestYear = year;
          bestCount = uc;
        }
      }
    }
    if (bestYear === null || bestCount === null) continue;

    batch.push({ bbl, uc: bestCount, year: bestYear });
    if (batch.length >= BATCH_SIZE) {
      tx(batch);
      batch = [];
    }
  }
  if (batch.length) tx(batch);

  return { updated, addedFromV2Only };
}

async function main() {
  const t0 = Date.now();
  initSchema();

  console.log("→ seeding RGB orders…");
  const rgbCount = seedRgb();
  console.log(`  ${rgbCount} orders inserted`);

  console.log("→ seeding rentstab.csv (this is the slow one, ~46k rows)…");
  const buildingsCount = await seedRentstab();
  console.log(`  ${buildingsCount.toLocaleString()} buildings inserted`);

  console.log("→ enriching with rentstab_v2.csv (2018-2024 unit counts)…");
  const { updated, addedFromV2Only } = await enrichWithV2();
  console.log(`  ${updated.toLocaleString()} buildings updated to a newer year`);
  console.log(`  ${addedFromV2Only.toLocaleString()} v2 BBLs not in rentstab.csv (skipped)`);

  const sqlite = getSqlite();
  const summary = sqlite
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN unit_count_latest > 0 THEN 1 ELSE 0 END) AS with_units,
        SUM(CASE WHEN on_dhcr_list_latest = 1 THEN 1 ELSE 0 END) AS on_dhcr_list,
        MAX(source_year_max) AS newest_year
      FROM buildings`,
    )
    .get() as { total: number; with_units: number; on_dhcr_list: number; newest_year: number | null };

  console.log("");
  console.log("─── seed summary ───");
  console.log(`  total buildings:          ${summary.total.toLocaleString()}`);
  console.log(`  with unit_count > 0:      ${summary.with_units.toLocaleString()}`);
  console.log(`  on DHCR list (latest yr): ${summary.on_dhcr_list.toLocaleString()}`);
  console.log(`  newest source year:       ${summary.newest_year ?? "—"}`);
  console.log(`  elapsed:                  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("─────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
