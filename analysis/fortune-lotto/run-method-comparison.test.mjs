import test from 'node:test';
import assert from 'node:assert/strict';

test('shared evaluator rejects invalid tickets and uses the requested weighted score', async () => {
  const { evaluateTickets } = await import('./run-method-comparison.mjs');
  const rows = [{ round: 1, winning: [1, 2, 3, 4, 5, 6], time_source: 'official_schedule' }];
  assert.equal(evaluateTickets([[1, 2, 3, 4, 5, 6]], rows).score, 3000);
  assert.throws(() => evaluateTickets([[1, 1, 2, 3, 4, 5]], rows), /six unique/);
});

test('comparison runner permanently rejects unique event signature routing', async () => {
  const { conditionalRuleIsAllowed } = await import('./run-method-comparison.mjs');
  assert.equal(conditionalRuleIsAllowed({ branchCount: 20, maxDepth: 2, leafSizes: [30, 30] }), true);
  assert.equal(conditionalRuleIsAllowed({ branchCount: 21, maxDepth: 2, leafSizes: [30] }), false);
  assert.equal(conditionalRuleIsAllowed({ branchCount: 1, maxDepth: 3, leafSizes: [30] }), false);
  assert.equal(conditionalRuleIsAllowed({ branchCount: 1, maxDepth: 2, leafSizes: [29] }), false);
  assert.equal(conditionalRuleIsAllowed({ branchCount: 1, maxDepth: 2, leafSizes: [1242], usesEventSignature: true }), false);
});

test('raw-feature A excludes a feature that is absent from any cached event row', async () => {
  const { completeFeatureIndexes } = await import('./run-method-comparison.mjs');
  const manifest = [{ id: 'present' }, { id: 'missing' }];
  const rows = [{ raw: [1, 2], spread: [1, 2] }, { raw: [3], spread: [3] }];
  assert.deepEqual(completeFeatureIndexes(manifest, rows), [0]);
});

test('null-target permutations are seeded Fisher-Yates permutations', async () => {
  const { seededPermutation } = await import('./run-method-comparison.mjs');
  const order = seededPermutation(8, 17);
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.notDeepEqual(order, seededPermutation(8, 18));
});
