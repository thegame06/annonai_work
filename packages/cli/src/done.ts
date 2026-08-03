import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Workspace } from '@annona/core';
import { listYaml } from './yamlfiles.ts';

/**
 * Removes the measured cost of manual resynchronisation: 17 hand edits per
 * milestone in M1.5 (REQ-0014). Edits the versioned knowledge, which is the
 * source of truth, so it is deliberately a human-invoked command and prints
 * exactly what it changed.
 */
export const done = (root: string, task: string, touches: string[], json: boolean): number => {
  const files = listYaml(join(root, 'annona'));
  const changed: string[] = [];

  const patch = (file: string, edit: (text: string) => string): void => {
    const before = readFileSync(file, 'utf8');
    const after = edit(before);
    if (after !== before) { writeFileSync(file, after); changed.push(file.replace(`${root}/`, '')); }
  };

  const taskFile = files.find((f) => new RegExp(`^id: ${task}$`, 'm').test(readFileSync(f, 'utf8')));
  if (!taskFile) { console.error(`unknown task: ${task}`); return 1; }

  const text = readFileSync(taskFile, 'utf8');
  if (!/^kind: task$/m.test(text)) { console.error(`${task} is not a task`); return 1; }

  const implemented = /^implements: \[(.*)\]$/m.exec(text)?.[1]?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];

  patch(taskFile, (t) => {
    let out = t.replace(/^status: .*$/m, 'status: done');
    if (touches.length > 0) {
      out = /^touches:/m.test(out)
        ? out.replace(/^touches: \[.*\]$/m, `touches: [${touches.join(', ')}]`)
        : `${out.trimEnd()}\ntouches: [${touches.join(', ')}]\n`;
    }
    return out;
  });

  // Tests are NOT marked passing here. Whether a test passes is a fact about the
  // test run, not about this command, and asserting it would be exactly the
  // assumption REQ-0013 forbids. They are reported for review instead.
  const needsReview: string[] = [];
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    if (!/^kind: test$/m.test(t) || !/^status: pending$/m.test(t)) continue;
    const verifies = /^verifies: \[(.*)\]$/m.exec(t)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    const id = /^id: (\S+)$/m.exec(t)?.[1];
    if (id && verifies.some((v) => implemented.includes(v))) needsReview.push(id);
  }

  const ws = Workspace.load(root);
  if (!ws.ok) { console.error(ws.error.message); return 1; }
  const compiled = ws.value.compile();
  ws.value.trace({ command: 'done', durationMs: 0, ok: compiled.ok, task, detail: `${changed.length} files` });
  ws.value.close();

  const result = { task, status: 'done', touches, filesChanged: changed, testsNeedingReview: needsReview };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${task} marked done`);
    for (const c of changed) console.log(`  updated ${c}`);
    console.log(`  recompiled: ${compiled.ok ? 'ok' : 'failed'}`);
    for (const t of needsReview) console.log(`  review ${t}: still marked pending and verifies what this task implemented`);
  }
  return 0;
};
