import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = new URL('../', import.meta.url);
const json = async (path) => JSON.parse(await (await import('node:fs/promises')).readFile(new URL(path, ROOT), 'utf8'));
const sampleRounds = [1, 57, 123, 218, 356, 489, 612, 744, 877, 1012, 1127, 1242];

async function predictor() {
  const directory = await mkdtemp(join(tmpdir(), 'lotto-future-predictor-'));
  const outfile = join(directory, 'predictor.mjs');
  await build({ entryPoints: [fileURLToPath(new URL('../lib/lotto-future/predictor.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
  return { module: await import(`file://${outfile}`), cleanup: () => rm(directory, { recursive: true, force: true }) };
}

function assertTicket(ticket) {
  assert.equal(ticket.length, 6);
  assert.equal(new Set(ticket).size, 6);
  assert.ok(ticket.every((number) => Number.isInteger(number) && number >= 1 && number <= 45));
}

test('고정 A/D/E/H는 대표 과거 회차에서 확정 산출물과 일치한다', async () => {
  const [{ module, cleanup }, dataset, a, d, e, h] = await Promise.all([
    predictor(),
    json('analysis/fortune-lotto/output/method-comparison/common_dataset.json'),
    json('analysis/fortune-lotto/output/method-comparison/method_A.json'),
    json('analysis/fortune-lotto/output/method-comparison/method_D.json'),
    json('analysis/fortune-lotto/output/method-comparison/method_E.json'),
    json('analysis/fortune-lotto/output/method-comparison/method-H/best_astronomical_model.json'),
  ]);
  try {
    for (const round of sampleRounds) {
      const row = dataset.rows[round - 1];
      const input = { round, drawDate: row.date, drawTime: row.time };
      const one = module.generateFrozenPredictions(input, []);
      const two = module.generateFrozenPredictions(input, []);
      for (const model of ['A', 'D', 'E', 'F', 'H']) {
        assertTicket(one.predictions[model]);
        assert.deepEqual(one.predictions[model], two.predictions[model]);
      }
      assert.deepEqual(one.predictions.A, a.tickets[round - 1], `A round ${round}`);
      assert.deepEqual(one.predictions.D, d.tickets[round - 1], `D round ${round}`);
      assert.deepEqual(one.predictions.E, e.tickets[round - 1], `E round ${round}`);
      assert.deepEqual(one.predictions.H, h.tickets[round - 1], `H round ${round}`);
    }
  } finally {
    await cleanup();
  }
});

test('F는 과거 10개 이웃의 비가중 빈도만 사용하며 self·future를 배제한다', async () => {
  const [{ module, cleanup }, dataset] = await Promise.all([predictor(), json('analysis/fortune-lotto/output/method-comparison/common_dataset.json')]);
  try {
    const row = dataset.rows[899];
    const event = { round: row.round, drawDate: row.date, drawTime: row.time };
    const baseline = module.pastOnlyFSelection(event, []);
    const contaminated = module.pastOnlyFSelection(event, [
      { round: row.round, drawDate: row.date, drawTime: row.time, numbers: [1, 2, 3, 4, 5, 6] },
      { round: row.round + 1, drawDate: '2020-04-04', drawTime: '20:35', numbers: [1, 2, 3, 4, 5, 6] },
    ]);
    assert.equal(baseline.neighbors.length, 10);
    assert.ok(baseline.neighbors.every((neighbor) => neighbor.round < row.round));
    assert.deepEqual(contaminated.ticket, baseline.ticket);
    const counts = Array(46).fill(0);
    baseline.neighbors.forEach((neighbor) => neighbor.numbers.forEach((number) => { counts[number]++; }));
    const expected = Array.from({ length: 45 }, (_, index) => index + 1).sort((a, b) => counts[b] - counts[a] || a - b).slice(0, 6);
    assert.deepEqual(baseline.ticket, expected);
  } finally {
    await cleanup();
  }
});
