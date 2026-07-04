import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const buildings = sqliteTable(
  "buildings",
  {
    bbl: text("bbl").primaryKey(),
    borough: text("borough").notNull(),
    address: text("address").notNull(),
    zipcode: text("zipcode"),
    ownerName: text("owner_name"),
    unitCountLatest: integer("unit_count_latest"),
    unitCountYear: integer("unit_count_year"),
    onDhcrListLatest: integer("on_dhcr_list_latest").notNull().default(0),
    sourceYearMax: integer("source_year_max"),
    lat: real("lat"),
    lng: real("lng"),
  },
  (t) => [
    index("idx_buildings_zip").on(t.zipcode),
    index("idx_buildings_addr").on(t.address),
  ],
);

// NOTE: RGB order data intentionally lives in data/seed/rgb_orders.json
// (imported directly by src/lib/rgb.ts) — not in SQLite. Don't add a
// table for it here; that would create a second source of truth.

export const lookups = sqliteTable("lookups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bbl: text("bbl"),
  searchedAt: text("searched_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  wasStabilized: integer("was_stabilized"),
  estimatedOverchargeCents: integer("estimated_overcharge_cents"),
});

export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
export type Lookup = typeof lookups.$inferSelect;
export type NewLookup = typeof lookups.$inferInsert;
