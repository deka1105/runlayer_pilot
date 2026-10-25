import { neon } from "@neondatabase/serverless";

/**
 * Lazy, because Next evaluates top-level module code at build time and
 * `neon()` throws without DATABASE_URL — which would break the first deploy,
 * before the Marketplace integration has injected env vars.
 *
 * A plain function, not a Proxy: Proxy wrappers break libraries that inspect
 * the client object.
 */
type Sql = ReturnType<typeof neon>;
let _sql: Sql | null = null;

export function sql(): Sql {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql;
}

/** False during a build with no database wired up yet. */
export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
