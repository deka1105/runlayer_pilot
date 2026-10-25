import type { ComponentType } from "react";

/**
 * The pilots built for Runlayer.
 *
 * Extracted from the pilot factory; each entry points at a folder under
 * `companies/runlayer/`. Adding one by hand means creating that folder and
 * appending here, exactly as in the source repo.
 */
export type Pilot = {
  slug: string;
  title: string;
  company: string;
  useCase: string;
  demo: string;
  built: string;
  tier: "eval" | "outreach";
  load: () => Promise<{ default: ComponentType }>;
};

export const pilots: Pilot[] = [
  {
    slug: "runlayer-mcp-review-report",
    title: "MCP server review report",
    company: "runlayer",
    useCase: "UC-1",
    demo: "Paste an MCP server's tools/list response and the security review comes back \\u2014 infra-ops is 9 tools, 1 of them able to send data out and 1 destructive, with run_command accepting a shell string and delete_cluster declaring itself read-only, so the verdict is reject and the policy it implies is written out tool by tool.",
    built: "2026-10-25",
    tier: "outreach",
    load: () => import("@companies/runlayer/runlayer-mcp-review-report/Pilot"),
  },
];

export function getPilot(slug: string): Pilot | undefined {
  return pilots.find((p) => p.slug === slug);
}
