// Usage: tsx scripts/db.ts <migrate|seed|reset>
// Stop the dev server first when using PGlite: only one process can open the data directory.
import { rmSync } from "node:fs";
import path from "node:path";

async function main() {
  const cmd = process.argv[2] ?? "migrate";
  const url = process.env.DATABASE_URL?.trim() || "pglite:./.data/pglite";

  if (cmd === "reset") {
    if (!url.startsWith("pglite:")) throw new Error("reset only supports PGlite; drop the schema manually on remote Postgres.");
    rmSync(path.resolve(url.replace(/^pglite:/, "")), { recursive: true, force: true });
    console.log("PGlite data directory removed.");
  }

  process.env.AUTO_SEED = "false";
  const { getDb } = await import("../src/db");
  const { seedIfEmpty } = await import("../src/db/seed");
  const db = await getDb();
  console.log("Migrations applied.");
  if (cmd === "seed" || cmd === "reset") {
    const seeded = await seedIfEmpty(db);
    console.log(seeded ? "Demo seed loaded." : "Database already has data; seed skipped.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
