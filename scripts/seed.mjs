/**
 * Creates and seeds the tables each pilot owns.
 *
 * Idempotent: safe to run on every deploy. Tables are prefixed p_<slug>_ so no
 * pilot can collide with another or with the app's own tables.
 */
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

// ------------------------------------------------------------------ runlayer
/*
  The review log for runlayer-mcp-review-report. Seeded with earlier reviews of
  servers that are *not* the four samples in the pilot, so a fresh database
  shows a review queue with history rather than an empty page — and so nothing
  in the seed can be mistaken for the output the analyser computes live.

  `seed_key` exists only to make the insert idempotent; a review submitted
  through the UI leaves it null.
*/
await sql`
  create table if not exists p_runlayer_mcp_review_report_reviews (
    id          bigserial primary key,
    server      text not null,
    tool_count  integer not null,
    verdict     text not null,
    critical    integer not null default 0,
    high        integer not null default 0,
    counts      jsonb not null default '{}'::jsonb,
    source      text not null default 'pasted',
    seed_key    text unique,
    reviewed_at timestamptz not null default now()
  )`;

const mcpReviews = [
  // server, tools, verdict, critical, high, read, write, destructive, exfil, days ago
  ["northwind-warehouse", 7, "approve", 0, 0, 7, 0, 0, 0, 9],
  ["orbit-ticketing", 11, "conditions", 0, 3, 6, 4, 1, 0, 7],
  ["helios-identity", 8, "reject", 1, 2, 3, 4, 1, 0, 5],
  ["acme-billing", 12, "conditions", 0, 4, 5, 5, 1, 1, 3],
  ["pagemill-analytics", 5, "approve", 0, 0, 5, 0, 0, 0, 1],
];
for (const [server, tools, verdict, critical, high, read, write, destructive, exfil, ago] of mcpReviews) {
  await sql`
    insert into p_runlayer_mcp_review_report_reviews
      (server, tool_count, verdict, critical, high, counts, source, seed_key, reviewed_at)
    values (${server}, ${tools}, ${verdict}, ${critical}, ${high},
            ${JSON.stringify({ read, write, destructive, exfiltration: exfil })}::jsonb,
            'sample', ${`seed:${server}`}, now() - (${ago} || ' days')::interval)
    on conflict (seed_key) do nothing`;
}
const mcpCount = await sql`select count(*)::int n from p_runlayer_mcp_review_report_reviews`;
console.log(`  p_runlayer_mcp_review_report_reviews: ${mcpCount[0].n} reviews on record`);
