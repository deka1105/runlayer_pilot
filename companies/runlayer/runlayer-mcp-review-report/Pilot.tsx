import { dbConfigured } from "@/lib/db";
import { DemoBanner } from "@/lib/app-shell";
import { DEMO_NOTE } from "./fixtures";
import { Reviewer } from "./Reviewer";
import { loadLog, type LogRow } from "./load";

/**
 * MCP server review report — Runlayer P-1.
 *
 * Before an MCP server is allowed through a gateway, somebody reads its tool
 * list and decides whether it can be granted, granted with conditions, or
 * refused. Two of Runlayer's own published customer outcomes are about escaping
 * that review, and their catalogue of 200+ servers is only worth anything
 * because the review already happened for each entry. This produces the
 * document the review is supposed to end in.
 *
 * Deliberately static: it reads a manifest and nothing else. Every report
 * carries what it could not see, because a tool list does not reveal the scope
 * of the credential behind the server — which is usually the thing that
 * matters most.
 */
export default async function McpReviewReportPilot() {
  const log = dbConfigured() ? await loadLog().catch(() => [] as LogRow[]) : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
      <DemoBanner>{DEMO_NOTE}</DemoBanner>

      <h1 className="text-lg font-semibold tracking-tight">
        Can this MCP server be granted to the default User role?
      </h1>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-foreground/65">
        Paste a <span className="font-mono text-[12px]">tools/list</span> response. Every tool is
        classified by what it can reach, each parameter is checked against the things that make a
        tool ungovernable, and the result is an approve / conditions / reject recommendation with
        the policy it implies — grant, require approval, deny.
      </p>

      <div className="mt-6">
        <Reviewer />
      </div>

      <section className="mt-10">
        <h2 className="mb-2 border-b border-foreground/15 pb-2 text-[13px] font-semibold">
          Review log{" "}
          <span className="font-mono text-[11px] font-normal text-foreground/50">
            {log.length ? `${log.length} most recent` : "empty"}
          </span>
        </h2>
        {log.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-foreground/55">
            Nothing reviewed yet. Reviews are recorded here, so the next person to open this page
            sees what was decided about a server rather than reviewing it again.
          </p>
        ) : (
          <ul className="divide-y divide-foreground/10">
            {log.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <span className="font-mono text-[12.5px] [overflow-wrap:anywhere]">{r.server}</span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] ${
                    r.verdict === "approve"
                      ? "border-emerald-600/50 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300"
                      : r.verdict === "reject"
                        ? "border-red-600/50 text-red-800 dark:border-red-400/40 dark:text-red-300"
                        : "border-amber-600/50 text-amber-800 dark:border-amber-400/40 dark:text-amber-300"
                  }`}
                >
                  {r.verdict}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-foreground/50">
                  {r.toolCount} {r.toolCount === 1 ? "tool" : "tools"} · {r.counts.read ?? 0}r/{r.counts.write ?? 0}w/
                  {r.counts.destructive ?? 0}d/{r.counts.exfiltration ?? 0}x
                  {r.critical > 0 && ` · ${r.critical} critical`}
                </span>
                <time
                  dateTime={r.reviewedAt}
                  className="ml-auto shrink-0 font-mono text-[10.5px] text-foreground/40"
                >
                  {r.reviewedAt.slice(0, 16).replace("T", " ")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
