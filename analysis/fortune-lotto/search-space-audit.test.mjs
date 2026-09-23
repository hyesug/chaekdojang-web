import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const load = (name) => readFile(new URL(`./output/search-space-audit/${name}`, import.meta.url), 'utf8').then(JSON.parse);
for (const method of ['A', 'D', 'E']) test(`exact ${method} walk-forward keeps winners out of train selection and tickets valid`, async () => {
  const result = await load(`exact_walk_forward_${method}.json`);
  assert.equal(result.exact.all_leakage_checks, true);
  for (const split of result.splits) {
    assert.ok(split.train.every((index) => index < split.test[0]));
    for (const ticket of split.tickets) assert.equal(ticket.length, 6) && assert.equal(new Set(ticket).size, 6) && assert.ok(ticket.every((n) => n >= 1 && n <= 45));
  }
});

test('triple coverage has all 33 candidates and 11 excluded by first22', async () => {
  const coverage = await load('triple_candidate_coverage.json');
  assert.equal(coverage.candidate_count, 33);
  assert.equal(coverage.first22.length, 22);
  assert.equal(coverage.excluded_from_triples.length, 11);
});
