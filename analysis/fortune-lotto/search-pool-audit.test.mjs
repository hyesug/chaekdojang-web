import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SPLITS, VARIANTS, buildPool, ensureUniverse, loadContext, poolHash, rankFormulas, runVariant, splitIndexes, trainD, winningOracle } from './run-search-pool-audit.mjs';

const BASELINE = 'f55d525'; // staging head before this audit
const load = (dir, name) => readFile(new URL(`./output/${dir}/${name}`, import.meta.url), 'utf8').then(JSON.parse);
const ctxPromise = loadContext();
const validTicket = (t) => t.length === 6 && new Set(t).size === 6 && t.every((n) => Number.isInteger(n) && n >= 1 && n <= 45);

test('D1 recomputed live reproduces existing exact WF 920 split by split', async () => {
  const ctx = await ctxPromise, old = await load('search-space-audit', 'exact_walk_forward_D.json'), d1 = runVariant(ctx, 'D1');
  assert.equal(d1.exact_walk_forward.stats.score, 920);
  assert.equal(d1.exact_walk_forward.stats.score, old.exact.stats.score);
  d1.exact_walk_forward.splits.forEach((s, k) => assert.deepEqual(s.tickets, old.splits[k].tickets));
  assert.equal((await load('search-pool-audit', 'D_first22_top900.json')).exact_walk_forward.stats.score, 920);
});

test('oracle refuses test-round winning numbers', async () => {
  const ctx = await ctxPromise, z = splitIndexes(SPLITS[0]), read = winningOracle(ctx.rows, z.train, {}, 'probe');
  assert.throws(() => read(z.test[0]), /leakage/);
  assert.doesNotThrow(() => read(z.train.at(-1)));
});

for (const v of ['D2', 'D3']) test(`${v}: every split reads no test index in ranking/pool/search, pool is exactly 2500`, async () => {
  const x = await load('search-pool-audit', VARIANTS[v].file);
  assert.equal(x.pool_size, 2500);
  assert.equal(x.exact_walk_forward.all_leakage_checks, true);
  assert.equal(x.exact_walk_forward.splits.length, SPLITS.length);
  for (const s of x.exact_walk_forward.splits) {
    assert.equal(s.pool_size, 2500);
    assert.equal(new Set(s.pool_keys).size, 2500);
    for (const stage of ['ranking', 'pool', 'greedy_local_swap']) {
      assert.equal(s.stage_access[stage].test_indexes_read, 0, `${s.label} ${stage}`);
      if (s.stage_access[stage].max != null) assert.ok(s.stage_access[stage].max < s.test_range[0] - 1);
    }
    assert.equal(s.stage_access.ranking.reads, s.train_range[1]);
  }
});

test('D2/D3 live training on first split stays train-only (oracle would throw otherwise)', async () => {
  const ctx = await ctxPromise; ensureUniverse(ctx, 'all33');
  const z = splitIndexes(SPLITS[0]);
  for (const v of ['D2', 'D3']) { const t = trainD(ctx, v, z.train); assert.equal(t.pool.length, 2500); assert.ok(t.access.ranking.max < z.test[0]); assert.ok(t.access.greedy_local_swap.max < z.test[0]); }
});

test('all tickets are 6 distinct numbers in 1..45', async () => {
  for (const v of Object.keys(VARIANTS)) for (const s of (await load('search-pool-audit', VARIANTS[v].file)).exact_walk_forward.splits) for (const t of s.tickets) assert.ok(validTicket(t), `${v} ${s.label} ${t}`);
});

test('D3 diversity pool is deterministic (same input twice → same hash, equals stored)', async () => {
  const ctx = await ctxPromise, forms = ensureUniverse(ctx, 'all33'), all = ctx.rows.map((_, i) => i);
  const hash = () => { const read = winningOracle(ctx.rows, all, {}, 'ranking'); return poolHash(buildPool(VARIANTS.D3, rankFormulas(forms, all, all.map(read)), ctx.specs).pool); };
  const a = hash(), b = hash();
  assert.equal(a, b);
  assert.equal(a, (await load('search-pool-audit', VARIANTS.D3.file)).in_sample.pool_hash);
});

test('existing analysis artifacts and protected code unchanged', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const paths = ['analysis/fortune-lotto/output/method-comparison', 'analysis/fortune-lotto/output/search-space-audit', 'analysis/fortune-lotto/run-search-space-audit.mjs', 'analysis/fortune-lotto/run-method-comparison.mjs', 'analysis/fortune-lotto/run-extended-comparison.mjs', 'public/unse/src', 'app'];
  assert.equal(execFileSync('git', ['diff', '--name-only', BASELINE, '--', ...paths], { cwd: root, encoding: 'utf8' }), '');
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', ...paths], { cwd: root, encoding: 'utf8' }), '');
});
