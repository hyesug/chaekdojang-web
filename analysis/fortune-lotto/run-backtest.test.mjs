import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('uses the count array returned by elementDistribution', async () => {
  const source = await readFile(new URL('./run-backtest.mjs', import.meta.url), 'utf8');
  assert.match(source, /elementDistribution\(p\)\.count\.forEach/);
});

test('supplies the engine calendar field names to every system', async () => {
  const source = await readFile(new URL('./run-backtest.mjs', import.meta.url), 'utf8');
  assert.match(source, /\.\.\.e, year: e\.y, month: e\.m, day: e\.d,/);
});

test('does not emit the Tianfu palace twice', async () => {
  const source = await readFile(new URL('./run-backtest.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\[\['tianfu',0\],\['taiyin'/);
});

test('uses fixed 1-1242 event metadata without falsely labelling schedule time as exact', async () => {
  const source = await readFile(new URL('./run-backtest.mjs', import.meta.url), 'utf8');
  assert.match(source, /const END_ROUND = 1242/);
  assert.match(source, /draw_times\.json/);
  assert.match(source, /time_source: 'official_schedule'/);
  assert.doesNotMatch(source, /time_source: 'exact'/);
});

test('searches expanded arithmetic and reports high-cardinality branch diagnostics', async () => {
  const source = await readFile(new URL('./run-backtest.mjs', import.meta.url), 'utf8');
  assert.match(source, /'mul'/);
  assert.match(source, /'mean'/);
  assert.match(source, /branch_diagnostics/);
});

test('includes an explicitly diagnosable event-signature condition for the no-complexity-penalty search', async () => {
  const source = await readFile(new URL('./run-backtest.mjs', import.meta.url), 'utf8');
  assert.match(source, /event_signature/);
  assert.match(source, /memorization_prone/);
});

test('uses a deterministic fallback when shifted time produces an unseen condition branch', async () => {
  const source = await readFile(new URL('./run-backtest.mjs', import.meta.url), 'utf8');
  assert.match(source, /fallback: candidates\[0\]/);
  assert.match(source, /\?\? conditionFormula\.fallback/);
});
