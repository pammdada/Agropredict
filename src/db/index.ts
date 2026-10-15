import path from "node:path";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Database access.
 * - DATABASE_URL empty or "pglite:<dir>" → embedded Postgres (PGlite) on disk.
 * - DATABASE_URL "postgres://..." → any Postgres (e.g. Supabase) via postgres-js.
 * Both expose the same Drizzle API, so the rest of the app is driver-agnostic.
 */
export type DB = ReturnType<typeof drizzlePglite<typeof schema>>;

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

type DbState = { promise?: Promise<DB> };
const globalForDb = globalThis as unknown as { __agropredicDb?: DbState };
const state: DbState = (globalForDb.__agropredicDb ??= {});

function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || "pglite:./.data/pglite";
}

async function connect(): Promise<DB> {
  const url = databaseUrl();
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, { prepare: false, max: 5 });
    const db = drizzlePostgres(client, { schema });
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    return db as unknown as DB;
  }

  const dir = path.resolve(process.cwd(), url.replace(/^pglite:/, ""));
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

/** Returns the shared Drizzle instance, running pending migrations and the demo seed on first use. */
export function getDb(): Promise<DB> {
  state.promise ??= connect().then(async (db) => {
    if (process.env.AUTO_SEED !== "false") {
      const { seedIfEmpty } = await import("./seed");
      await seedIfEmpty(db);
    }
    return db;
  });
  state.promise.catch(() => {
    state.promise = undefined;
  });
  return state.promise;
}

export { schema };
