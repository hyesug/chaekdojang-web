import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SPLITS, loadContext, splitIndexes } from './run-search-pool-audit.mjs';
import { train } from './run-j15-audit.mjs';

const load = (name) => readFile(new URL(`./output/j15-audit/${name}`, import.meta.url), 'utf8').then(JSON.parse);

for (const m of ['U33', 'J15']) test(`${m}: no leakage, tickets valid`, async () => {
  const x = await load(`${m}.json`);
  assert.equal(x.exact_walk_forward.all_leakage_checks, true);
  x.exact_walk_forward.splits.forEach((s, k) => {
    const testStart = splitIndexes(SPLITS[k]).test[0];
    for (const a of Object.values(s.stage_access)) { assert.equal(a.test_indexes_read, 0); assert.ok(a.max < testStart); }
    for (const t of s.tickets) assert.ok(t.length === 6 && new Set(t).size === 6 && t.every((n) => Number.isInteger(n) && n >= 1 && n <= 45));
  });
});

test('J15 satisfies 15-system coverage and constraints in every split and in-sample', async () => {
  const x = await load('J15.json');
  for (const s of [x.in_sample, ...x.exact_walk_forward.splits]) {
    assert.equal(s.system_count, 15);
    assert.equal(s.duplicate_formula_count, 0);
    assert.ok(Object.values(s.system_uses).every((n) => n <= 2));
  }
});

test('J15 training is deterministic', async () => {
  const ctx = await loadContext(), z = splitIndexes(SPLITS[0]);
  const run = () => train(ctx, 'J15', z.train).rule.formulas.map((f) => f.key);
  const a = run(), b = run();
  assert.deepEqual(a, b);
  const x = await load('J15.json');
  assert.equal(new Set(train(ctx, 'J15', z.train).rule.formulas.flatMap((f) => f.systems)).size, 15);
  assert.equal(x.exact_walk_forward.splits[0].formulas.length, 6);
});
