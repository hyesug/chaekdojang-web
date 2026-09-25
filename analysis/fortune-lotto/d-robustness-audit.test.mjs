import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SPLITS, loadContext, splitIndexes, winningOracle } from './run-search-pool-audit.mjs';
import { EXPERIMENTS, aliasGroups, buildSpace, runExperiment, trainD } from './run-d-robustness-audit.mjs';

const BASELINE = 'cf77b01'; // staging head before this audit
const load = (dir, name) => readFile(new URL(`./output/${dir}/${name}`, import.meta.url), 'utf8').then(JSON.parse);
const ctxPromise = loadContext();

test('D0 recomputed live reproduces exact WF 920 with identical split tickets', async () => {
  const ctx = await ctxPromise, old = await load('search-space-audit', 'exact_walk_forward_D.json'), d0 = runExperiment(ctx, 'D0');
  assert.equal(d0.exact_walk_forward.stats.score, 920);
  d0.exact_walk_forward.splits.forEach((s, k) => assert.deepEqual(s.tickets, old.splits[k].tickets));
});

test('oracle refuses test-round winning numbers', async () => {
  const ctx = await ctxPromise, z = splitIndexes(SPLITS[0]);
  assert.throws(() => winningOracle(ctx.rows, z.train, {}, 'probe')(z.test[0]), /leakage/);
});

for (const e of Object.keys(EXPERIMENTS)) test(`${e}: no test index read before evaluation, tickets valid`, async () => {
  const x = await load('d-robustness-audit', EXPERIMENTS[e].file);
  assert.equal(x.exact_walk_forward.all_leakage_checks, true);
  assert.equal(x.pool_size, 900);
  for (const s of x.exact_walk_forward.splits) {
    for (const a of Object.values(s.stage_access)) { assert.equal(a.test_indexes_read, 0); assert.ok(a.max < s.test_range[0] - 1); }
    for (const t of s.tickets) assert.ok(t.length === 6 && new Set(t).size === 6 && t.every((n) => Number.isInteger(n) && n >= 1 && n <= 45), `${s.label} ${t}`);
  }
});

test('D_alias removes exactly the identical columns and keeps first22 triple set', async () => {
  const ctx = await ctxPromise, space = buildSpace(ctx, 'D_alias');
  assert.deepEqual(aliasGroups(ctx).flatMap((g) => g.merged).sort(), ['jamidusu.c3_jaebaek', 'sukyo.c1_nakshatra', 'sukyo.c2_nakshatra_pada']);
  assert.equal(space.specs.length, 30);
  assert.equal(space.tripleCandidates, 21);
  assert.ok(space.specs.slice(0, 21).every((s) => ctx.specs.indexOf(s) < 22));
});

test('D_unique never repeats a formula; D0 repeats in at least one split', async () => {
  const u = await load('d-robustness-audit', 'D_unique.json'), d0 = await load('d-robustness-audit', 'D0.json');
  for (const s of [u.in_sample, ...u.exact_walk_forward.splits]) assert.equal(new Set(s.formulas).size, 6);
  assert.ok(d0.exact_walk_forward.splits.some((s) => s.duplicate_formula_count > 0));
});

test('D_tie pool is deterministic', async () => {
  const ctx = await ctxPromise, space = buildSpace(ctx, 'D_tie'), z = splitIndexes(SPLITS[0]);
  const a = trainD(ctx, space, 'D_tie', z.train), b = trainD(ctx, space, 'D_tie', z.train);
  assert.deepEqual(a.pool.map((f) => f.key), b.pool.map((f) => f.key));
  assert.equal(JSON.stringify(a.rule.formulas.map((f) => f.key)), JSON.stringify(b.rule.formulas.map((f) => f.key)));
});

test('existing artifacts and production code unchanged', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const paths = ['analysis/fortune-lotto/output/method-comparison', 'analysis/fortune-lotto/output/search-space-audit', 'analysis/fortune-lotto/output/search-pool-audit', 'analysis/fortune-lotto/run-search-space-audit.mjs', 'analysis/fortune-lotto/run-search-pool-audit.mjs', 'analysis/fortune-lotto/run-method-comparison.mjs', 'public/unse/src', 'app'];
  assert.equal(execFileSync('git', ['diff', '--name-only', BASELINE, '--', ...paths], { cwd: root, encoding: 'utf8' }), '');
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', ...paths], { cwd: root, encoding: 'utf8' }), '');
});
