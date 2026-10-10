import test from 'node:test';
import assert from 'node:assert/strict';

test('G temporal features use draws strictly before the target round', async () => {
  const { temporalNumberFeatures } = await import('./run-extended-comparison.mjs');
  const rows = [
    { winning: [1, 2, 3, 4, 5, 6] },
    { winning: [7, 8, 9, 10, 11, 12] },
  ];
  const first = temporalNumberFeatures(rows, 0, 1);
  const second = temporalNumberFeatures(rows, 1, 1);
  assert.equal(first.all_count, 0);
  assert.equal(second.all_count, 1);
  assert.equal(second.last_5, 1);
});

test('H allows coordinate values but rejects fortune interpretation identifiers', async () => {
  const { isAstronomyCoordinateId } = await import('./run-extended-comparison.mjs');
  assert.equal(isAstronomyCoordinateId('astrology.태양_longitude_degree'), true);
  assert.equal(isAstronomyCoordinateId('astrology.ascendant_degree'), true);
  assert.equal(isAstronomyCoordinateId('astrology.태양_sign'), false);
  assert.equal(isAstronomyCoordinateId('vedic_sukyo_shared.nakshatra_index'), false);
});

test('hybrid ticket selection is deterministic and does not require winners', async () => {
  const { hybridTicket } = await import('./run-extended-comparison.mjs');
  const a = [1, 2, 3, 4, 5, 6], e = [1, 2, 7, 8, 9, 10], weights = { a: 1, e: 1, agreement: 1 };
  const first = hybridTicket(a, e, weights);
  assert.deepEqual(first, hybridTicket(a, e, weights));
  assert.equal(first.length, 6);
  assert.equal(new Set(first).size, 6);
  assert.deepEqual(first.slice(0, 2), [1, 2]);
});

test('walk-forward splits keep every training index before every test index', async () => {
  const { expandingSplits } = await import('./run-extended-comparison.mjs');
  for (const split of expandingSplits(1242)) {
    assert.ok(Math.max(...split.train) < Math.min(...split.test));
  }
});
