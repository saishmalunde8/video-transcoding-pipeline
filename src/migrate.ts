import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";

// Works from both src/ and dist/: each is one folder below the repo root.
const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text        PRIMARY KEY,
      checksum   text        NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

  const { rows } = await client.query<{ version: string; checksum: string }>(
    "SELECT version, checksum FROM schema_migrations",
  );
  const applied = new Map(rows.map((row) => [row.version, row.checksum]));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await readFile(new URL(file, MIGRATIONS_DIR), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");

    const appliedChecksum = applied.get(file);
    if (appliedChecksum !== undefined) {
      if (appliedChecksum !== checksum) {
        throw new Error(`${file} was edited after it was applied. Write a new migration instead.`);
      }
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [
        file,
        checksum,
      ]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`${file} failed, nothing from it was applied`, { cause: e });
    }
    console.log(`applied ${file}`);
  }
  console.log(`up to date (${files.length} migration file(s))`);
} finally {
  await client.end();
}
