/**
 * In-app AI skills (BEHIX-SKILLS-SPEC.md): expert knowledge from /skills/<id>/SKILL.md is prepended to the
 * systemInstruction of every Gemini/Vertex call, chosen by the call site's task id.
 *
 * SKILL.md = YAML frontmatter (id, name, version, owner, tasks, optional source + license for skills adapted
 * from open-source GitHub skills) + a concise body (≤ MAX_SKILL_WORDS words).
 */

export const SKILL_OWNERS = ["story", "characters", "world", "audio", "export"] as const;
export type SkillOwner = (typeof SKILL_OWNERS)[number];

/** Every task id an AI call site passes, with the bot that owns its skills. Add a row with each new call site. */
export const SKILL_TASKS = {
  /** src/lib/film-plan.server.ts stage 1 (acts, scenes, cast, locations). */
  "film-plan.outline": "story",
  /** src/lib/film-plan.server.ts stage 2 (shots of one scene). */
  "film-plan.shots": "story",
  /** CHAR_TASKS in src/lib/studio-ai-tasks.ts (studio-media.server.ts, puppet-build.server.ts). */
  "char.generate": "characters",
  "char.keyframe": "characters",
  "rig.refpose": "characters",
  "rig.joints": "characters",
  /** Gemini TTS style prompt (src/lib/gemini-tts.server.ts + stylePrompt in src/studio/stick/voice.ts); wired by the audio bot. */
  "tts.line": "audio",
  /** Final-delivery QA review of a rendered film (skills/export-quality-qa); call site owned by the export bot. */
  "export.qa": "export",
} as const satisfies Record<string, SkillOwner>;
export type SkillTask = keyof typeof SKILL_TASKS;

/** Licenses accepted for adapted skills (spec: MIT / Apache / CC-BY). */
export const SKILL_LICENSES = ["MIT", "Apache-2.0", "CC-BY-4.0", "CC-BY-3.0"] as const;
export type SkillLicense = (typeof SKILL_LICENSES)[number];

export const MAX_SKILL_WORDS = 1500;
/** Skills must not name retired (1.x / 2.x) generations or the slow opt-in model. */
const FORBIDDEN = [/gemini[-\s]?[12]\./i, /gemini-4-argon/i];

export type Skill = {
  id: string;
  name: string;
  version: number;
  owner: SkillOwner;
  tasks: string[];
  /** Upstream skill URL(s) this one is adapted from (https). `source: url` or `source: [url, url]`. */
  source?: string[];
  /** SPDX id(s) of the upstream license(s); required whenever `source` is set. */
  license?: SkillLicense[];
  body: string;
  path: string;
  words: number;
};

export class SkillError extends Error {}

const unquote = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2");

/** Minimal YAML for the frontmatter: `key: value`, `key: [a, b]`, `# comments`. */
export function parseFrontmatter(raw: string): { data: Record<string, string | string[]>; body: string } {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new SkillError("missing --- frontmatter ---");
  const data: Record<string, string | string[]> = {};
  for (const line0 of m[1].split(/\r?\n/)) {
    const line = line0.replace(/\s+#.*$/, "").trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) throw new SkillError(`bad frontmatter line: ${line0}`);
    const [, key, value] = kv;
    if (key in data) throw new SkillError(`duplicate key: ${key}`);
    const list = /^\[(.*)\]$/.exec(value.trim());
    data[key] = list ? list[1].split(",").map((s) => unquote(s.trim())).filter(Boolean) : unquote(value.trim());
  }
  return { data, body: m[2].trim() };
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function parseSkill(raw: string, path: string): Skill {
  const fail = (msg: string): never => { throw new SkillError(`${path}: ${msg}`); };
  let parsed: ReturnType<typeof parseFrontmatter>;
  try { parsed = parseFrontmatter(raw); } catch (e) { return fail((e as Error).message); }
  const { data, body } = parsed;
  const str = (k: string, required = true): string | undefined => {
    const v = data[k];
    if (v === undefined || v === "") return required ? fail(`missing ${k}`) : undefined;
    if (typeof v !== "string") return fail(`${k} must be a string`);
    return v;
  };
  const id = str("id")!;
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) fail(`bad id "${id}"`);
  const folder = /(?:^|\/)skills\/([^/]+)\/SKILL\.md$/.exec(path)?.[1];
  if (folder && folder !== id) fail(`id "${id}" must match folder "${folder}"`);
  const version = Number(str("version"));
  if (!Number.isInteger(version) || version < 1) fail("version must be a positive integer");
  const owner = str("owner") as SkillOwner;
  if (!SKILL_OWNERS.includes(owner)) fail(`unknown owner "${owner}"`);
  const tasks = data.tasks;
  if (!Array.isArray(tasks) || !tasks.length) fail("tasks must be a non-empty [list]");
  const list = (k: string): string[] | undefined => {
    const v = data[k];
    if (v === undefined || v === "") return undefined;
    const out = Array.isArray(v) ? v : [v];
    return out.length ? out : undefined;
  };
  const source = list("source");
  for (const url of source ?? []) if (!/^https:\/\/\S+$/.test(url)) fail(`source must be an https URL ("${url}")`);
  const license = list("license") as SkillLicense[] | undefined;
  for (const l of license ?? []) if (!SKILL_LICENSES.includes(l)) fail(`license "${l}" is not one of ${SKILL_LICENSES.join(", ")}`);
  if (source && !license) fail("source needs a license");
  if (!body) fail("empty body");
  const words = wordCount(body);
  if (words > MAX_SKILL_WORDS) fail(`${words} words, cap is ${MAX_SKILL_WORDS}`);
  for (const re of FORBIDDEN) if (re.test(raw)) fail(`mentions a forbidden model (${re.source})`);
  const skill: Skill = { id, name: str("name")!, version, owner, tasks: tasks as string[], body, path, words };
  if (source) skill.source = source;
  if (license) skill.license = license;
  return skill;
}

/** Parses all files; ids must be unique. Sorted by id so the prompt prefix is deterministic. */
export function loadSkills(files: Record<string, string>): Skill[] {
  const skills = Object.entries(files).map(([path, raw]) => parseSkill(raw, path));
  const seen = new Set<string>();
  for (const s of skills) {
    if (seen.has(s.id)) throw new SkillError(`duplicate skill id "${s.id}"`);
    seen.add(s.id);
  }
  return skills.sort((a, b) => a.id.localeCompare(b.id));
}

function bundled(): Record<string, string> {
  try {
    // Vite inlines every SKILL.md at build time (server and client bundles alike).
    return import.meta.glob("/skills/*/SKILL.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  } catch {
    // Plain Node (unit tests): import.meta.glob does not exist; tests pass files explicitly.
    return {};
  }
}

let cache: Skill[] | null = null;
export const SKILLS = (): Skill[] => (cache ??= loadSkills(bundled()));

/** Concatenated bodies of the skills that list `task`; "" when none. */
export function skillsFor(task: string, skills: Skill[] = SKILLS()): string {
  return skills
    .filter((s) => s.tasks.includes(task))
    .map((s) => `## Skill: ${s.name} (${s.id} v${s.version})\n\n${s.body}`)
    .join("\n\n");
}

/** systemInstruction with the task's skills prepended. */
export function withSkills(task: string, systemInstruction: string, skills: Skill[] = SKILLS()): string {
  const prefix = skillsFor(task, skills);
  if (!prefix) return systemInstruction;
  return systemInstruction ? `${prefix}\n\n---\n\n${systemInstruction}` : prefix;
}

/** systemInstruction text for a task, or undefined when no skill lists it (call stays byte-identical). */
export const skillSystem = (task: string, skills?: Skill[]): string | undefined => skillsFor(task, skills) || undefined;
