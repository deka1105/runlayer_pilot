import type { BlastRadius, Review, Severity, Verdict } from "./analyze";
import { VERDICT_LABEL } from "./analyze";

/**
 * The review, rendered as the document an approver signs.
 *
 * No server imports — the reviewer is a client component and renders this with
 * whatever the action returned.
 */

const VERDICT_STYLE: Record<Verdict, string> = {
  approve: "border-emerald-600/50 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300",
  conditions: "border-amber-600/50 bg-amber-500/10 text-amber-900 dark:border-amber-400/40 dark:text-amber-300",
  reject: "border-red-600/50 bg-red-500/10 text-red-800 dark:border-red-400/40 dark:text-red-300",
};

const RADIUS_LABEL: Record<BlastRadius, string> = {
  read: "read",
  write: "write",
  destructive: "destructive",
  exfiltration: "can send data out",
};

const RADIUS_STYLE: Record<BlastRadius, string> = {
  read: "border-foreground/20 text-foreground/60",
  write: "border-sky-600/40 text-sky-800 dark:border-sky-400/30 dark:text-sky-300",
  destructive: "border-amber-600/50 text-amber-800 dark:border-amber-400/40 dark:text-amber-300",
  exfiltration: "border-red-600/50 text-red-800 dark:border-red-400/40 dark:text-red-300",
};

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "border-red-600/50 text-red-800 dark:border-red-400/40 dark:text-red-300",
  high: "border-amber-600/50 text-amber-800 dark:border-amber-400/40 dark:text-amber-300",
  medium: "border-foreground/25 text-foreground/65",
  low: "border-foreground/20 text-foreground/50",
};

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-foreground/12 px-3 py-2">
      <div className={`font-mono text-[22px] leading-none tabular-nums ${value > 0 ? tone : "text-foreground/30"}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-tight text-foreground/55">{label}</div>
    </div>
  );
}

function Block({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-[12px] font-semibold">{title}</div>
      <div className={`mt-1.5 flex flex-wrap gap-1.5 ${mono ? "" : "block"}`}>
        {mono ? (
          items.map((i) => (
            <span key={i} className="rounded border border-foreground/15 bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[11px] [overflow-wrap:anywhere]">
              {i}
            </span>
          ))
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-foreground/70">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function Report({ review }: { review: Review }) {
  const { conditions } = review;

  return (
    <div className="space-y-5">
      <div className={`rounded-lg border px-4 py-3 ${VERDICT_STYLE[review.verdict]}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="text-[17px] font-semibold tracking-tight">{VERDICT_LABEL[review.verdict]}</div>
          <div className="font-mono text-[11.5px] opacity-80 [overflow-wrap:anywhere]">
            {review.server} · {review.toolCount} {review.toolCount === 1 ? "tool" : "tools"}
          </div>
        </div>
        <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed">
          {review.verdictReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Count label="read only" value={review.counts.read} tone="text-foreground/70" />
        <Count label="change state" value={review.counts.write} tone="text-sky-700 dark:text-sky-300" />
        <Count label="destructive" value={review.counts.destructive} tone="text-amber-700 dark:text-amber-300" />
        <Count label="can send data out" value={review.counts.exfiltration} tone="text-red-700 dark:text-red-400" />
      </div>

      {(conditions.grant.length > 0 || conditions.requireApproval.length > 0 || conditions.deny.length > 0) && (
        <section className="space-y-3 rounded-lg border border-foreground/12 px-4 py-3">
          <h3 className="text-[13px] font-semibold">Policy this implies</h3>
          <Block title="Grant to the default User role" items={conditions.grant} mono />
          <Block title="Require approval" items={conditions.requireApproval} mono />
          <Block title="Deny at the gateway" items={conditions.deny} mono />
          <Block title="" items={conditions.notes} />
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[13px] font-semibold">
          Tools <span className="font-mono text-[11px] font-normal text-foreground/50">
            {review.findingCounts.critical} critical · {review.findingCounts.high} high · {review.findingCounts.medium} medium
          </span>
        </h3>
        <div className="divide-y divide-foreground/10 overflow-hidden rounded-lg border border-foreground/12">
          {review.tools.map((t) => (
            <details key={`${t.name}-${t.radiusBasis}`} className="group px-3 py-2.5 open:bg-foreground/[0.02]">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1.5 list-none">
                <span className="font-mono text-[12.5px] [overflow-wrap:anywhere]">{t.name}</span>
                <Chip className={RADIUS_STYLE[t.blastRadius]}>{RADIUS_LABEL[t.blastRadius]}</Chip>
                {t.worst && <Chip className={SEVERITY_STYLE[t.worst]}>{t.worst}</Chip>}
                {t.declaredReadOnly === true && t.blastRadius !== "read" && (
                  <Chip className="border-red-600/50 text-red-800 dark:border-red-400/40 dark:text-red-300">
                    claims read-only
                  </Chip>
                )}
                <span className="ml-auto font-mono text-[10.5px] text-foreground/40 group-open:hidden">
                  {t.findings.length ? `${t.findings.length} finding${t.findings.length === 1 ? "" : "s"}` : "no findings"}
                </span>
              </summary>

              <div className="mt-2 space-y-2 border-l-2 border-foreground/10 pl-3">
                <p className="text-[12px] leading-relaxed text-foreground/55">
                  Classified <span className="font-medium text-foreground/75">{t.blastRadius}</span> because {t.radiusBasis}.
                </p>
                {t.description && (
                  <p className="text-[12px] leading-relaxed text-foreground/60 [overflow-wrap:anywhere]">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-foreground/40">declared</span>{" "}
                    {t.description}
                  </p>
                )}
                {t.findings.map((f) => (
                  <div key={f.code + (f.param ?? "")} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip className={SEVERITY_STYLE[f.severity]}>{f.severity}</Chip>
                      <span className="text-[12.5px] font-medium">{f.title}</span>
                      {f.param && (
                        <span className="font-mono text-[11px] text-foreground/50">{f.param}</span>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed text-foreground/65 [overflow-wrap:anywhere]">{f.detail}</p>
                  </div>
                ))}
                {t.findings.length === 0 && (
                  <p className="text-[12px] text-foreground/50">Nothing flagged on this tool.</p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-foreground/20 px-4 py-3">
        <h3 className="text-[13px] font-semibold">What this review cannot see</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-foreground/55">
          A tool manifest is a weak evidence base. Everything below is outside it, and a clean
          report above is not a finding that any of it is safe.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-foreground/70">
          {review.blindSpots.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {review.warnings.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-300">
            {review.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
