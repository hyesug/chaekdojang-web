import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SPLITS, loadContext, splitIndexes } from './run-search-pool-audit.mjs';
import { trainD } from './run-d-robustness-audit.mjs';
import { buildVariant, runVariant } from './run-d-4term-audit.mjs';

const load = (dir, name) => readFile(new URL(`./output/${dir}/${name}`, import.meta.url), 'utf8').then(JSON.parse);
const ctxPromise = loadContext();

test('D3term recomputed live reproduces D_tie exact WF 835 with identical tickets', async () => {
  const d3 = runVariant(await ctxPromise, 'D3term'), tie = await load('d-robustness-audit', 'D_tie.json');
  assert.equal(d3.exact_walk_forward.score, 835);
  d3.exact_walk_forward.splits.forEach((s, k) => assert.deepEqual(s.tickets, tie.exact_walk_forward.splits[k].tickets));
});

for (const v of ['D3term', 'D4term']) test(`${v}: no leakage, tickets valid`, async () => {
  const x = await load('d-4term-audit', `${v}.json`);
  assert.equal(x.exact_walk_forward.all_leakage_checks, true);
  x.exact_walk_forward.splits.forEach((s, k) => {
    const testStart = splitIndexes(SPLITS[k]).test[0];
    for (const a of Object.values(s.stage_access)) { assert.equal(a.test_indexes_read, 0); assert.ok(a.max < testStart); }
    for (const t of s.tickets) assert.ok(t.length === 6 && new Set(t).size === 6 && t.every((n) => Number.isInteger(n) && n >= 1 && n <= 45));
  });
});

test('D4term training is deterministic', async () => {
  const ctx = await ctxPromise, space = buildVariant(ctx, 'D4term'), z = splitIndexes(SPLITS[0]);
  const run = () => { const t = trainD(ctx, space, 'D_tie', z.train); return [t.pool.map((f) => f.key), t.rule.formulas.map((f) => f.key)]; };
  assert.deepEqual(run(), run());
  assert.equal(space.forms.length, 17633 + 7315 * 6);
});
