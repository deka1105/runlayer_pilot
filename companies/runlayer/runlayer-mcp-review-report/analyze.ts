/**
 * Static review of an MCP server's tool manifest.
 *
 * The thing a security reviewer actually does before an MCP server is allowed
 * through a gateway: read the tool list, work out what each tool can reach, and
 * decide whether it can be granted, granted with conditions, or refused. This
 * does that mechanically, from the manifest alone.
 *
 * Two deliberate design decisions:
 *
 * 1. **Annotations are treated as claims, not facts.** MCP lets a server
 *    declare `readOnlyHint` / `destructiveHint` on each tool. Those hints come
 *    from the server being reviewed, which is the one party with a reason to
 *    understate. So the signature is classified independently and a hint that
 *    disagrees with it is itself a finding — a tool named `delete_cluster` that
 *    declares `readOnlyHint: true` is more alarming than one that declares
 *    nothing.
 *
 * 2. **The verdict is rule-driven, not score-driven.** A composite risk number
 *    would rank servers against each other and scale with tool count, which
 *    means a 40-tool server full of read methods would outrank a 3-tool server
 *    that executes shell commands. Severity bands and named rules are
 *    defensible to the person who has to sign the approval.
 *
 * What this cannot see is listed in `BLIND_SPOTS` and is rendered with every
 * report, because a static read of a tool list is a weak evidence base and a
 * review that does not say so is worse than no review.
 */

export type BlastRadius = "read" | "write" | "destructive" | "exfiltration";
export type Severity = "critical" | "high" | "medium" | "low";
export type Verdict = "approve" | "conditions" | "reject";

export type Finding = {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
  /** The parameter that triggered it, where one did. */
  param?: string;
};

export type ToolReview = {
  name: string;
  description: string | null;
  blastRadius: BlastRadius;
  /** Why it landed in that class — shown so the classification is arguable. */
  radiusBasis: string;
  declaredReadOnly: boolean | null;
  findings: Finding[];
  worst: Severity | null;
};

export type Conditions = {
  grant: string[];
  requireApproval: string[];
  deny: string[];
  notes: string[];
};

export type Review = {
  server: string;
  toolCount: number;
  counts: Record<BlastRadius, number>;
  tools: ToolReview[];
  findingCounts: Record<Severity, number>;
  verdict: Verdict;
  verdictReasons: string[];
  conditions: Conditions;
  blindSpots: string[];
  warnings: string[];
};

export type ParseResult =
  | { ok: true; server: string; tools: unknown[]; warnings: string[] }
  | { ok: false; error: string };

/* ------------------------------------------------------------- matchers --- */

/*
  Verb lists, kept explicit rather than clever. A reviewer has to be able to
  disagree with a classification, which means the rule that produced it has to
  be legible. Order matters: the first class that matches wins, highest blast
  radius first.
*/
const DESTRUCTIVE_VERBS =
  /\b(delete|destroy|drop|purge|wipe|truncate|remove|revoke|terminate|uninstall|reset|erase)\b/i;
const WRITE_VERBS =
  /\b(create|update|write|set|insert|patch|put|upsert|modify|edit|add|assign|invite|grant|deploy|restart|scale|rotate|merge|move|rename|archive|cancel|approve|submit|publish|post|run|execute|exec|invoke|trigger|start|stop|sync|attach|save|store|enable|disable|install|apply)\b/i;
/*
  Deliberately not including the noun "email": a `create_contact` tool with an
  `email` property is storing an address, not sending to one. Sending is a verb
  in the tool's name, and exfiltration needs that verb *and* a destination.
*/
const SEND_VERBS = /\b(send|notify|forward|upload|export|publish|share|webhook|push|transmit|post\s+to)\b/i;

/** Parameters that name somewhere data can be sent. */
const DESTINATION_PARAM =
  /^(url|uri|endpoint|webhook|webhook_url|callback|callback_url|destination|destination_url|dest|target_url|to|recipient|recipients|email|to_email|forward_to|upload_url|sink)$/i;

/** Parameters whose value is executed or interpreted rather than matched. */
const EXECUTION_PARAM =
  /^(command|cmd|script|code|shell|exec|program|sql|raw_sql|raw_query|expression|eval|bash|powershell)$/i;

/** Parameters naming a filesystem location. */
const PATH_PARAM = /^(path|file|file_path|filepath|dir|directory|folder|filename|location|key)$/i;

/** Parameters that carry a secret into the gateway, and therefore into its logs. */
const CREDENTIAL_PARAM =
  /^(token|api_token|api_key|apikey|secret|password|passwd|credential|credentials|auth|authorization|private_key|access_key|session|cookie)$/i;

/** A tool that returns a collection should be able to be bounded. */
const LIST_VERBS = /\b(list|search|query|find|fetch|get_all|export|dump|scan|read)\b/i;
const LIMIT_PARAM = /^(limit|max|max_results|maxresults|count|page_size|pagesize|top|first|n)$/i;

/*
  Published tool-poisoning patterns. A tool description is read by the model,
  not by the user, so instructions hidden there execute with the agent's
  authority — and unlike a prompt injection arriving in tool output, this one is
  sitting in the manifest where a static review can catch it.
*/
const INJECTION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i, label: "instruction override" },
  { re: /do\s+not\s+(tell|inform|mention|reveal)\s+(the\s+)?user/i, label: "concealment from the user" },
  { re: /<\s*important\s*>/i, label: "pseudo-tag addressed to the model" },
  { re: /before\s+(using|calling)\s+(any\s+)?other\s+tool/i, label: "preempts other tools" },
  { re: /\b(system\s+prompt|your\s+instructions)\b/i, label: "references the model's instructions" },
  { re: /\b(id_rsa|\.ssh|\.env|credentials\.json|private\s+key)\b/i, label: "names a credential file" },
  { re: /you\s+must\s+always/i, label: "imperative addressed to the model" },
];

/**
 * Tool names are `snake_case` or `kebab-case`, and `\b` does not match across an
 * underscore because `_` is a word character — so `/\badd\b/` does not match
 * `add_note`. Every verb test runs against this, not the raw name.
 */
const words = (s: string) => s.replace(/[_\-]+/g, " ").trim();

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
const worstOf = (findings: Finding[]): Severity | null =>
  SEVERITY_ORDER.find((s) => findings.some((f) => f.severity === s)) ?? null;

export const BLIND_SPOTS = [
  "What the server does with the credential it holds. A manifest lists what a tool accepts, never the scope of the token behind it — a read-only tool on an admin key is still an admin key.",
  "Where the server sends traffic. Egress is invisible here; a tool with no destination parameter can still call out.",
  "What the operator retains. Nothing in a tool list describes logging, retention, or who can read a request after it is served.",
  "Whether the manifest stays this way. Descriptions and schemas can change after approval, and the agent re-reads them every session.",
  "Runtime content. Instructions arriving inside a tool's results are a separate problem from instructions in its description, and need inspection at call time.",
  "Server identity. Nothing here proves this manifest came from the server you think it did.",
];

/* --------------------------------------------------------------- parsing --- */

/**
 * Accepts what a reviewer would actually paste: a `tools/list` response, a bare
 * array of tools, or a wrapper with the array somewhere obvious. Anything else
 * fails with a message naming what was found instead, since "invalid JSON" sends
 * someone hunting through 400 lines.
 */
export function parseManifest(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Nothing to review — paste a tools/list response." };

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }

  const warnings: string[] = [];
  let tools: unknown[] | null = null;
  let server = "unnamed server";

  if (Array.isArray(data)) {
    tools = data;
    warnings.push("A bare array was supplied, so there is no server name or protocol version to check.");
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const result = obj.result as Record<string, unknown> | undefined;
    const candidate = obj.tools ?? result?.tools;
    if (Array.isArray(candidate)) tools = candidate;

    const info = (obj.serverInfo ?? obj.server ?? result?.serverInfo) as Record<string, unknown> | undefined;
    const named = info?.name ?? obj.name;
    if (typeof named === "string" && named.trim()) server = named.trim();
    else warnings.push("The manifest carries no server name.");
  }

  if (!tools) return { ok: false, error: "No `tools` array found. Expected a tools/list response or an array of tools." };
  if (tools.length === 0) return { ok: false, error: "The manifest declares no tools." };

  return { ok: true, server, tools, warnings };
}

/* ------------------------------------------------------------- analysis --- */

type SchemaLike = {
  type?: unknown;
  properties?: Record<string, Record<string, unknown>>;
  required?: unknown;
  additionalProperties?: unknown;
};

const asSchema = (v: unknown): SchemaLike | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as SchemaLike) : null;

const propsOf = (schema: SchemaLike | null): [string, Record<string, unknown>][] => {
  const p = schema?.properties;
  if (!p || typeof p !== "object") return [];
  return Object.entries(p).filter(([, v]) => v && typeof v === "object");
};

/** A destination is "bounded" only if the schema actually constrains it. */
const isConstrained = (prop: Record<string, unknown>) =>
  Array.isArray(prop.enum) || typeof prop.pattern === "string" || "const" in prop;

function classify(
  name: string,
  description: string | null,
  params: [string, Record<string, unknown>][],
  declaredDestructive: boolean | null,
): { blastRadius: BlastRadius; radiusBasis: string } {
  /*
    The name carries the verb in almost every real manifest, and matching it
    alone avoids the false positives that nouns in prose produce. The
    description is consulted only when the name says nothing, and that
    fallback is reported in the basis so a reviewer can see which signal was
    used.
  */
  const n = words(name);
  const d = description ?? "";
  const from = (re: RegExp): "name" | "description" | null =>
    re.test(n) ? "name" : re.test(d) ? "description" : null;

  const where = (src: "name" | "description") => (src === "name" ? "its name" : "its description");

  const destination = params.find(
    ([p, v]) => DESTINATION_PARAM.test(p) || v.format === "uri" || v.format === "url",
  );
  const sends = from(SEND_VERBS);
  if (destination && sends) {
    return {
      blastRadius: "exfiltration",
      radiusBasis: `${where(sends)} describes sending, and it takes a destination (\`${destination[0]}\`) — data can leave through this tool`,
    };
  }

  if (declaredDestructive === true) {
    return { blastRadius: "destructive", radiusBasis: "the server declares destructiveHint: true" };
  }
  const destroys = from(DESTRUCTIVE_VERBS);
  if (destroys) {
    return { blastRadius: "destructive", radiusBasis: `${where(destroys)} describes removing something` };
  }
  const writes = from(WRITE_VERBS) ?? sends;
  if (writes) {
    return { blastRadius: "write", radiusBasis: `${where(writes)} describes changing state` };
  }
  return { blastRadius: "read", radiusBasis: "no state-changing verb in its name or description" };
}

function reviewTool(raw: unknown): ToolReview {
  const tool = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = typeof tool.name === "string" && tool.name.trim() ? tool.name.trim() : "(unnamed tool)";
  const description =
    typeof tool.description === "string" && tool.description.trim() ? tool.description.trim() : null;

  const schema = asSchema(tool.inputSchema) ?? asSchema(tool.input_schema);
  const params = propsOf(schema);
  const required = Array.isArray(schema?.required) ? (schema!.required as unknown[]).filter((r) => typeof r === "string") : [];

  const ann = (tool.annotations && typeof tool.annotations === "object" ? tool.annotations : {}) as Record<string, unknown>;
  const declaredReadOnly = typeof ann.readOnlyHint === "boolean" ? ann.readOnlyHint : null;
  const declaredDestructive = typeof ann.destructiveHint === "boolean" ? ann.destructiveHint : null;
  const declaredIdempotent = typeof ann.idempotentHint === "boolean" ? ann.idempotentHint : null;

  const { blastRadius, radiusBasis } = classify(name, description, params, declaredDestructive);
  const findings: Finding[] = [];

  // A hint that disagrees with the signature is the most informative thing in a
  // manifest: it is either a mistake in the server or an attempt to be granted
  // more than it should be.
  if (declaredReadOnly === true && blastRadius !== "read") {
    findings.push({
      code: "hint-contradiction",
      severity: "critical",
      title: "Declares itself read-only but its signature is not",
      detail: `\`${name}\` sets readOnlyHint: true while ${radiusBasis}. The hint comes from the server being reviewed, so the signature is the evidence and the hint is the claim. Classified as ${blastRadius}.`,
    });
  }

  for (const { re, label } of INJECTION_PATTERNS) {
    if (description && re.test(description)) {
      findings.push({
        code: "description-injection",
        severity: "critical",
        title: "Tool description contains instructions aimed at the model",
        detail: `The description of \`${name}\` contains text matching a known tool-poisoning pattern (${label}). Descriptions are read by the agent, not the user, so instructions placed here run with the agent's authority on every session.`,
      });
      break;
    }
  }

  for (const [param, prop] of params) {
    if (EXECUTION_PARAM.test(param)) {
      findings.push({
        code: "shell-surface",
        severity: "critical",
        title: "Accepts a command or query to execute",
        detail: `\`${param}\` is free text that the server executes. Per-tool authorisation cannot bound this — whatever the tool is permitted to do, this parameter can reach everything the server can.`,
        param,
      });
    }
    if ((DESTINATION_PARAM.test(param) || prop.format === "uri" || prop.format === "url") && !isConstrained(prop)) {
      findings.push({
        code: "unbounded-destination",
        severity: "high",
        title: "Destination is caller-controlled",
        detail: `\`${param}\` accepts any value — no enum, pattern or const. An agent can be induced to name a destination the operator never approved. An allowlist pattern on this parameter closes it.`,
        param,
      });
    }
    if (CREDENTIAL_PARAM.test(param)) {
      findings.push({
        code: "credential-param",
        severity: "high",
        title: "Takes a secret as an argument",
        detail: `\`${param}\` carries a credential through the gateway, which means it passes through request logs and session history. Server-side credential storage avoids it.`,
        param,
      });
    }
    if (PATH_PARAM.test(param) && !isConstrained(prop)) {
      findings.push({
        code: "unbounded-path",
        severity: "high",
        title: "Filesystem location is unconstrained",
        detail: `\`${param}\` has no pattern or enum, so nothing in the schema stops a traversal outside the intended root.`,
        param,
      });
    }
  }

  if (LIST_VERBS.test(`${words(name)} ${description ?? ""}`) && params.length > 0 && !params.some(([p]) => LIMIT_PARAM.test(p))) {
    findings.push({
      code: "no-limit",
      severity: "medium",
      title: "Returns a collection with no bound",
      detail: `\`${name}\` reads a set but exposes no limit or page-size parameter. Volume is its own disclosure risk: one call can pull the whole table into a transcript.`,
    });
  }

  if (blastRadius === "destructive" && declaredIdempotent !== true) {
    findings.push({
      code: "destructive-unguarded",
      severity: "high",
      title: "Destructive and not declared idempotent",
      detail: `\`${name}\` removes something and does not declare idempotentHint: true, so a retry after a timeout may not be safe. This is the set that wants an approval step rather than a grant.`,
    });
  }

  if (schema && schema.additionalProperties !== false) {
    findings.push({
      code: "open-input",
      severity: "medium",
      title: "Input schema does not close additionalProperties",
      detail: "Arguments outside the declared properties are accepted, so what the tool actually reads is not fully described by its schema.",
    });
  }

  if (!description) {
    findings.push({
      code: "missing-description",
      severity: "medium",
      title: "No description",
      detail: `\`${name}\` cannot be reviewed on intent, and the agent choosing when to call it has nothing to go on either.`,
    });
  }

  for (const r of required as string[]) {
    const prop = params.find(([p]) => p === r);
    if (!prop) {
      findings.push({
        code: "required-undeclared",
        severity: "medium",
        title: "Required argument is not declared",
        detail: `\`${r}\` is listed as required but has no entry in properties, so its type and constraints are unknown.`,
        param: r,
      });
    }
  }

  if (!schema) {
    findings.push({
      code: "no-schema",
      severity: "medium",
      title: "No input schema",
      detail: `\`${name}\` declares no inputSchema, so its arguments are undefined and unconstrained.`,
    });
  }

  if (typeof tool.name !== "string" || !tool.name.trim()) {
    findings.push({
      code: "unnamed",
      severity: "high",
      title: "Tool has no name",
      detail: "An entry in the tools array has no usable name, so it cannot be granted, denied or audited by name — which is how every control in a gateway refers to it.",
    });
  }

  if (!description && !schema) {
    findings.push({
      code: "unreviewable",
      severity: "high",
      title: "Nothing to review",
      detail: `\`${name}\` declares neither a description nor an input schema. There is no evidence here to approve on; the classification above is the absence of a signal, not a finding of safety.`,
    });
  }

  return { name, description, blastRadius, radiusBasis, declaredReadOnly, findings, worst: worstOf(findings) };
}

const RADIUS_ORDER: BlastRadius[] = ["exfiltration", "destructive", "write", "read"];

/** Builds the review. Pure — same manifest in, same report out. */
export function review(parsed: Extract<ParseResult, { ok: true }>): Review {
  const tools = parsed.tools.map(reviewTool);

  const counts: Record<BlastRadius, number> = { read: 0, write: 0, destructive: 0, exfiltration: 0 };
  for (const t of tools) counts[t.blastRadius]++;

  const findingCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const t of tools) for (const f of t.findings) findingCounts[f.severity]++;

  const critical = tools.filter((t) => t.findings.some((f) => f.severity === "critical"));
  const high = tools.filter((t) => t.findings.some((f) => f.severity === "high"));
  const changesState = tools.filter((t) => t.blastRadius !== "read");

  const verdictReasons: string[] = [];
  let verdict: Verdict;

  if (critical.length > 0) {
    verdict = "reject";
    verdictReasons.push(
      `${critical.length} tool${critical.length === 1 ? " carries" : "s carry"} a critical finding (${[
        ...new Set(critical.flatMap((t) => t.findings.filter((f) => f.severity === "critical").map((f) => f.code))),
      ].join(", ")}). These are not conditions a policy can add — the tool has to change.`,
    );
  } else if (changesState.length > 0 || high.length > 0) {
    verdict = "conditions";
    if (changesState.length > 0) {
      verdictReasons.push(
        `${changesState.length} of ${tools.length} tool${tools.length === 1 ? "" : "s"} ${changesState.length === 1 ? "changes" : "change"} state or can send data outward, so a blanket grant would hand every holder of this connector the same reach.`,
      );
    }
    if (high.length > 0) {
      verdictReasons.push(
        `${high.length} tool${high.length === 1 ? " has" : "s have"} a high-severity finding that a scoped grant or an approval step contains.`,
      );
    }
  } else {
    verdict = "approve";
    verdictReasons.push(
      `All ${tools.length} tool${tools.length === 1 ? "" : "s"} read. No critical or high-severity findings, and nothing in the manifest can change or send state.`,
    );
  }

  const named = (list: ToolReview[]) => list.map((t) => t.name);
  const conditions: Conditions = {
    grant: named(tools.filter((t) => t.blastRadius === "read" && !t.findings.some((f) => f.severity === "high" || f.severity === "critical"))),
    requireApproval: named(tools.filter((t) => (t.blastRadius === "write" || t.blastRadius === "destructive") && !t.findings.some((f) => f.severity === "critical"))),
    deny: named([...new Set([...critical, ...tools.filter((t) => t.blastRadius === "exfiltration")])]),
    notes: [],
  };

  if (conditions.deny.length > 0) {
    conditions.notes.push("Denied tools stay denied at the gateway rather than being left to a role grant, so a new role cannot quietly re-enable them.");
  }
  if (tools.some((t) => t.findings.some((f) => f.code === "credential-param"))) {
    conditions.notes.push("Move credentials out of tool arguments before granting: anything passed as a parameter is in the session record.");
  }
  if (tools.some((t) => t.findings.some((f) => f.code === "no-limit"))) {
    conditions.notes.push("Cap result volume on the unbounded read tools — a bounded read is still a bulk export without one.");
  }
  if (counts.read === tools.length) {
    conditions.notes.push("A read-only connector is still a disclosure surface: the grant decides who sees the data, not whether it moves.");
  }

  /*
    Severity first, then blast radius. Grouping by capability reads more
    tidily, but it buries a critical finding on a `write` tool underneath
    every `destructive` one — and the first thing a reviewer looks for is what
    blocks approval, not what the connector is for. Tools with no findings
    sort last by their radius.
  */
  const sevRank = (t: ToolReview) => (t.worst ? SEVERITY_ORDER.indexOf(t.worst) : SEVERITY_ORDER.length);
  tools.sort(
    (a, b) =>
      sevRank(a) - sevRank(b) ||
      RADIUS_ORDER.indexOf(a.blastRadius) - RADIUS_ORDER.indexOf(b.blastRadius) ||
      a.name.localeCompare(b.name),
  );

  return {
    server: parsed.server,
    toolCount: tools.length,
    counts,
    tools,
    findingCounts,
    verdict,
    verdictReasons,
    conditions,
    blindSpots: BLIND_SPOTS,
    warnings: parsed.warnings,
  };
}

/** Parse and review in one step. */
export function reviewText(text: string): { ok: true; review: Review } | { ok: false; error: string } {
  const parsed = parseManifest(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, review: review(parsed) };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  approve: "Approve",
  conditions: "Approve with conditions",
  reject: "Reject",
};
