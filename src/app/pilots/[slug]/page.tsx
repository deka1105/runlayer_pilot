import Link from "next/link";
import { notFound } from "next/navigation";
import { getPilot, pilots } from "@/lib/pilots";

export async function generateStaticParams() {
  return pilots.map(({ slug }) => ({ slug }));
}

export default async function PilotPage(props: PageProps<"/pilots/[slug]">) {
  const { slug } = await props.params;
  const pilot = getPilot(slug);
  if (!pilot) notFound();

  const { default: Pilot } = await pilot.load();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Chrome belongs to the shell so a pilot's folder holds only the pilot.
          The back-link points at the index rather than a /companies route —
          that route exists in the factory, not here, and linking to it from a
          standalone repo is a dead end. */}
      <header className="border-b border-foreground/10 px-6 py-3">
        <div className="mx-auto flex w-full max-w-5xl items-baseline justify-between gap-4">
          <Link href="/" className="font-mono text-xs text-foreground/40 hover:text-foreground/70">
            ← Runlayer
          </Link>
          <span className="font-mono text-xs text-foreground/40">{pilot.useCase} · pilot</span>
        </div>
      </header>
      <main className="flex-1">
        <Pilot />
      </main>
    </div>
  );
}
