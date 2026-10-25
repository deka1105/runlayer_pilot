"use server";

import { revalidatePath } from "next/cache";
import { dbConfigured, sql } from "@/lib/db";
import { reviewText, type Review } from "./analyze";

export type ReviewResponse = { ok: true; review: Review } | { ok: false; error: string };

/**
 * Reviews a pasted manifest and records the outcome.
 *
 * The report is returned to the caller as well as persisted, so the page shows
 * the result immediately rather than after a round trip through the database —
 * and so the analyser still works with no database wired up, which is the
 * state a fresh deploy is in before the integration injects DATABASE_URL.
 */
export async function reviewManifest(text: string, source: "sample" | "pasted"): Promise<ReviewResponse> {
  // Guard the input a demo actually receives: a paste of a whole log file, or
  // nothing. Truncating rather than rejecting keeps a long paste explicable.
  const input = String(text ?? "").slice(0, 400_000);

  const result = reviewText(input);
  if (!result.ok) return result;

  if (dbConfigured()) {
    try {
      await sql()`
        insert into p_runlayer_mcp_review_report_reviews
          (server, tool_count, verdict, critical, high, counts, source)
        values (
          ${result.review.server},
          ${result.review.toolCount},
          ${result.review.verdict},
          ${result.review.findingCounts.critical},
          ${result.review.findingCounts.high},
          ${JSON.stringify(result.review.counts)}::jsonb,
          ${source}
        )`;
      /*
        Keyed on the route pattern, not the URL. The pilot renders through the
        dynamic route `/pilots/[slug]`, and the cache stored the entry under
        that pattern — passing the literal path writes the row and leaves the
        log on screen showing the previous state until a hard reload.
      */
      revalidatePath("/pilots/[slug]", "page");
    } catch {
      // A failed write must not lose the reviewer their report; the log is the
      // secondary surface here, the report is the point.
    }
  }

  return result;
}
