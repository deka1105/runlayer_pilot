import type { ReactNode } from "react";

/**
 * Shared furniture for pilots that have grown into multi-view apps.
 *
 * This lives in `src/lib` rather than a company folder because the repo's rule
 * is that code moves here once a *second* pilot needs it — which happened the
 * moment more than one pilot got views. Everything here is chrome; nothing in
 * it knows anything about a particular company.
 */

export function Page({ title, lede, children }: {
  title: string; lede?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {lede && <p className="mt-1 mb-5 max-w-prose text-sm text-foreground/55">{lede}</p>}
      {children}
    </div>
  );
}

/** Synthetic data must be labelled on the face of the UI, every view of it. */
export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground/70">
      <strong className="font-semibold">Illustrative demo.</strong> {children}
    </div>
  );
}

export function Tile({ label, value, sub, tone }: {
  label: string; value: string; sub: string;
  tone?: "good" | "warn" | "bad";
}) {
  const valueCls =
    tone === "bad" ? "text-red-700 dark:text-red-400"
    : tone === "warn" ? "text-amber-700 dark:text-amber-400"
    : tone === "good" ? "text-emerald-700 dark:text-emerald-400"
    : "text-foreground";
  return (
    <div className="rounded-lg border border-foreground/12 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-foreground/45">{label}</p>
      <p className={`mt-1 font-mono text-[19px] leading-none tabular-nums ${valueCls}`}>{value}</p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-foreground/50">{sub}</p>
    </div>
  );
}

/** For a view whose table is empty — says why, and what to do instead. */
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-foreground/20 px-5 py-9 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-foreground/55">
        {children}
      </p>
    </div>
  );
}
