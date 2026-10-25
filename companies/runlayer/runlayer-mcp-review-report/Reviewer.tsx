"use client";

import { useState, useTransition } from "react";
import { reviewManifest, type ReviewResponse } from "./actions";
import { SAMPLES } from "./fixtures";
import { Report } from "./Report";

/**
 * The input half: a manifest goes in, a review comes back.
 *
 * Client state rather than a form post because the report is the thing being
 * demoed and a navigation between press and result loses the point. The samples
 * fill the textarea rather than bypassing it, so what produced the report
 * stays visible and editable — the fastest way to see that the report is
 * derived is to change one line of the manifest and watch a finding appear.
 */
export function Reviewer() {
  const [text, setText] = useState(SAMPLES[0].manifest);
  const [active, setActive] = useState<string | null>(SAMPLES[0].id);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [pending, start] = useTransition();

  const run = (source: "sample" | "pasted") =>
    start(async () => setResult(await reviewManifest(text, source)));

  const pick = (id: string, manifest: string) => {
    setActive(id);
    setText(manifest);
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] text-foreground/55">Sample servers:</span>
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(s.id, s.manifest)}
            title={s.note}
            className={`rounded border px-2 py-1 font-mono text-[11.5px] transition-colors ${
              active === s.id
                ? "border-foreground/40 bg-foreground/10"
                : "border-foreground/15 text-foreground/65 hover:border-foreground/30 hover:bg-foreground/5"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="manifest" className="mb-1.5 block text-[12px] text-foreground/55">
          Paste a <span className="font-mono">tools/list</span> response — a sample above, or your own
        </label>
        <textarea
          id="manifest"
          value={text}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setActive(null);
            setResult(null);
          }}
          rows={10}
          className="w-full resize-y rounded-lg border border-foreground/15 bg-foreground/[0.02] px-3 py-2 font-mono text-[11.5px] leading-relaxed outline-none focus:border-foreground/40"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run(active ? "sample" : "pasted")}
          disabled={pending || !text.trim()}
          className="rounded-lg border border-foreground/25 bg-foreground/5 px-3.5 py-1.5 text-[13px] font-medium transition-colors hover:border-foreground/45 hover:bg-foreground/10 disabled:opacity-40"
        >
          {pending ? "Reviewing…" : "Review this server"}
        </button>
        {result?.ok === false && (
          <span className="text-[12.5px] text-red-700 dark:text-red-400">{result.error}</span>
        )}
      </div>

      {result?.ok && <Report review={result.review} />}
    </div>
  );
}
