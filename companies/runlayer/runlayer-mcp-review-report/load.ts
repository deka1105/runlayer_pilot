import { sql } from "@/lib/db";
import type { BlastRadius } from "./analyze";

/**
 * The review log — every manifest this gateway has been asked about.
 *
 * A review is not a one-shot calculation in practice: the question an approver
 * asks second is "what did we decide about the last one", which is what
 * Runlayer's catalogue is for. So reviews persist, and the next visitor sees
 * what the previous one submitted.
 */
export type LogRow = {
  id: string;
  server: string;
  toolCount: number;
  verdict: string;
  critical: number;
  high: number;
  counts: Record<BlastRadius, number>;
  source: string;
  reviewedAt: string;
};

export async function loadLog(limit = 12): Promise<LogRow[]> {
  const rows = (await sql()`
    select id, server, tool_count, verdict, critical, high, counts, source, reviewed_at
      from p_runlayer_mcp_review_report_reviews
     order by reviewed_at desc, id desc
     limit ${limit}
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    server: String(r.server),
    toolCount: Number(r.tool_count),
    verdict: String(r.verdict),
    critical: Number(r.critical),
    high: Number(r.high),
    counts: (r.counts ?? { read: 0, write: 0, destructive: 0, exfiltration: 0 }) as Record<BlastRadius, number>,
    source: String(r.source),
    reviewedAt: new Date(String(r.reviewed_at)).toISOString(),
  }));
}
