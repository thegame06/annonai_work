import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from '../../core/src/knowledge/compile.ts';
import { importSpecKit, parseSpecKit } from '../src/speckit.ts';

const fixture = `# Checkout recovery

## User stories
- As a shopper, I want to resume checkout after a failed payment.

## Acceptance criteria
- Given a failed card, when the shopper returns, then the cart is preserved.

## Implementation plan
- Store checkout recovery state server-side.

## Task list
- [ ] Add recovery endpoint
- [ ] Persist recovery token
`;

test('maps Spec Kit artifacts to Annona entity kinds', () => {
  const root = mkdtempSync(join(tmpdir(), 'speckit-'));
  try {
    const spec = join(root, 'spec.md');
    writeFileSync(spec, fixture);

    const result = parseSpecKit(spec);
    assert.deepEqual(result.entities.map((entity) => entity.kind), [
      'feature', 'requirement', 'requirement', 'adr', 'task', 'task',
    ]);
    assert.equal(result.entities[0]?.title, 'Checkout recovery');
    assert.equal(result.entities[1]?.feature, 'FEAT-0001');
    assert.deepEqual(result.entities.at(-1)?.implements, ['REQ-0001', 'REQ-0002']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('imports valid Annona YAML under annona/', () => {
  const root = mkdtempSync(join(tmpdir(), 'annona-speckit-'));
  try {
    writeFileSync(join(root, 'annona.yaml'), 'format: 1\nname: test\n');
    const source = join(root, 'speckit');
    mkdirSync(source);
    writeFileSync(join(source, 'feature.md'), fixture);

    const result = importSpecKit(root, source);
    assert.equal(result.entities.length, 6);
    assert.match(readFileSync(join(root, 'annona', 'features', 'FEAT-0001-checkout-recovery.yaml'), 'utf8'), /source: "speckit"/);

    const compiled = load(join(root, 'annona'));
    assert.equal(compiled.problems.length, 0);
    assert.equal(compiled.nodes.length, 6);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
