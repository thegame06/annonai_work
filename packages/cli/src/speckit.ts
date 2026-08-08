import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';

export type ImportKind = 'feature' | 'requirement' | 'adr' | 'component' | 'task';

export type ImportEntity = {
  id: string;
  kind: ImportKind;
  title: string;
  status: string;
  source: string;
  tags: string[];
  summary?: string;
  body?: string;
  feature?: string;
  decides?: string[];
  subject?: string;
  depends_on?: string[];
  implements?: string[];
  touches?: string[];
};

export type ImportResult = { entities: ImportEntity[]; files: string[] };

const PREFIX: Record<ImportKind, string> = { feature: 'FEAT', requirement: 'REQ', adr: 'ADR', component: 'CMP', task: 'TASK' };
const DIR: Record<ImportKind, string> = { feature: 'features', requirement: 'features', adr: 'adrs', component: 'architecture', task: 'features' };
const ACCEPTANCE = /acceptance criteria|acceptance|criterios de aceptaci[oó]n|user stor(?:y|ies)|historias de usuario/i;
const PLAN = /implementation plan|technical decisions|technical decision|plan de implementaci[oó]n|decisiones t[eé]cnicas|arquitectura/i;
const TASKS = /tasks?|task list|tareas?/i;

const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'item';
const title = (value: string): string => value.replace(/^[-*]\s+(?:\[[ xX]\]\s*)?/, '').replace(/^\d+[.)]\s+/, '').trim();
const clean = (value: string): string => value.replace(/[`*_]/g, '').trim();
const idFor = (kind: ImportKind, counters: Record<ImportKind, number>): string => `${PREFIX[kind]}-${String(++counters[kind]).padStart(4, '0')}`;

const listInputFiles = (input: string): string[] => {
  if (!existsSync(input)) throw new Error(`Spec Kit path does not exist: ${input}`);
  const statFiles = (path: string): string[] => {
    const entries = readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    return entries.flatMap((entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) return statFiles(child);
      return ['.md', '.txt'].includes(extname(entry.name).toLowerCase()) ? [child] : [];
    });
  };
  return extname(input) ? [input] : statFiles(input);
};

const headingTitle = (content: string, fallback: string): string => {
  const heading = content.split(/\r?\n/).find((line) => /^#\s+/.test(line));
  return clean(heading?.replace(/^#+\s+/, '') ?? basename(fallback, extname(fallback)));
};

const sectionLines = (content: string, matcher: RegExp): string[] => {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let active = false;
  let level = 0;
  for (const line of lines) {
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      const current = h[1]!.length;
      if (active && current <= level) break;
      if (matcher.test(h[2]!)) { active = true; level = current; continue; }
    }
    if (active && line.trim()) out.push(line.trim());
  }
  return out;
};

const bulletItems = (lines: string[]): string[] => lines
  .filter((line) => /^[-*]\s+|^\d+[.)]\s+/.test(line))
  .map((line) => clean(title(line)))
  .filter(Boolean);

export const parseSpecKit = (input: string): ImportResult => {
  const files = listInputFiles(input);
  const counters: Record<ImportKind, number> = { feature: 0, requirement: 0, adr: 0, component: 0, task: 0 };
  const entities: ImportEntity[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lower = basename(file).toLowerCase();
    if (!/spec|feature|requirements?|plan|tasks?|design|architecture/.test(lower + content.slice(0, 200).toLowerCase())) continue;

    const feature: ImportEntity = {
      id: idFor('feature', counters), kind: 'feature', title: headingTitle(content, file), status: 'draft',
      source: 'speckit', tags: ['speckit'], summary: `Imported from ${basename(file)}.`, body: content.trim(),
    };
    entities.push(feature);

    const requirementItems = [
      ...bulletItems(sectionLines(content, ACCEPTANCE)),
      ...content.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^(as a|as an|i want|so that|given|when|then)\b/i.test(line)).map(clean),
    ];
    for (const item of [...new Set(requirementItems)].slice(0, 50)) {
      entities.push({ id: idFor('requirement', counters), kind: 'requirement', title: item, status: 'draft', feature: feature.id, source: 'speckit', tags: ['speckit'], summary: item });
    }

    const planItems = bulletItems(sectionLines(content, PLAN));
    for (const item of planItems.slice(0, 25)) {
      entities.push({ id: idFor('adr', counters), kind: 'adr', title: item, status: 'proposed', decides: [], subject: slug(item), source: 'speckit', tags: ['speckit'], summary: item });
    }

    const taskItems = bulletItems(sectionLines(content, TASKS));
    const reqIds = entities.filter((e) => e.kind === 'requirement' && e.feature === feature.id).map((e) => e.id);
    for (const item of taskItems.slice(0, 100)) {
      entities.push({ id: idFor('task', counters), kind: 'task', title: item, status: 'draft', implements: reqIds, touches: [], source: 'speckit', tags: ['speckit'], summary: item });
    }
  }

  return { entities, files };
};

const yamlString = (value: string): string => JSON.stringify(value);
const yamlList = (values: string[]): string => `[${values.map(yamlString).join(', ')}]`;

export const entityToYaml = (entity: ImportEntity): string => {
  const lines = [`id: ${entity.id}`, `kind: ${entity.kind}`, `title: ${yamlString(entity.title)}`, `status: ${yamlString(entity.status)}`];
  if (entity.feature) lines.push(`feature: ${entity.feature}`);
  if (entity.implements) lines.push(`implements: ${yamlList(entity.implements)}`);
  if (entity.touches) lines.push(`touches: ${yamlList(entity.touches)}`);
  if (entity.decides) lines.push(`decides: ${yamlList(entity.decides)}`);
  if (entity.subject) lines.push(`subject: ${yamlString(entity.subject)}`);
  if (entity.depends_on) lines.push(`depends_on: ${yamlList(entity.depends_on)}`);
  lines.push(`source: ${yamlString(entity.source)}`, `tags: ${yamlList(entity.tags)}`);
  if (entity.summary) lines.push(`summary: ${yamlString(entity.summary)}`);
  if (entity.body) lines.push(`body: |`, ...entity.body.split(/\r?\n/).map((line) => `  ${line}`));
  return `${lines.join('\n')}\n`;
};

export const importSpecKit = (root: string, input: string): ImportResult => {
  const result = parseSpecKit(input);
  for (const entity of result.entities) {
    const dir = join(root, 'annona', DIR[entity.kind]);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${entity.id}-${slug(entity.title)}.yaml`), entityToYaml(entity));
  }
  return { ...result, files: result.files.map((file) => relative(root, file)) };
};
