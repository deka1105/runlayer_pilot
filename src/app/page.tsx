import Link from "next/link";
import { pilots } from "@/lib/pilots";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Runlayer</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {pilots.length} working pilot{pilots.length === 1 ? "" : "s"}, built to show one
          thing each. Synthetic data throughout — nothing here touches a real system.
        </p>
      </header>

      <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
        {pilots.map((p) => (
          <li key={p.slug} className="py-4">
            <Link href={`/pilots/${p.slug}`} className="transition-opacity hover:opacity-60">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{p.title}</span>
                <span className="shrink-0 font-mono text-[11px] text-foreground/40">{p.useCase}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground/60">{p.demo}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
