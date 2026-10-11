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
      for (const model of ['A', 'D', 'E', 'F', 'H', 'S1', 'S2', 'S3']) {
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

test('득표 전략은 원본 슬롯 득표·체계 지지 수·번호 오름차순 동률로 6개를 고른다', async () => {
  const { module, cleanup } = await predictor();
  try {
    // 7: 3표·체계 1개 / 10~14: 각 2표·체계 1개(한 체계 안 중복) / 30: 2표·체계 2개 / 1: 1표
    const tickets = module.voteStrategyTickets({
      'a.c1': 7, 'a.c2': 7, 'a.c3': 7,
      'b.c1': 10, 'b.c2': 10, 'c.c1': 11, 'c.c2': 11, 'd.c1': 12, 'd.c2': 12, 'e.c1': 13, 'e.c2': 13, 'f.c1': 14, 'f.c2': 14,
      'p.c1': 30, 'q.c1': 30, 'r.c1': 1,
    });
    assert.deepEqual(tickets.S1, [7, 10, 11, 12, 13, 14]); // 득표순, 2표 동률은 번호 오름차순이라 30 탈락
    assert.deepEqual(tickets.S2, [7, 10, 11, 12, 13, 30]); // 2표 이상 그룹 안에서 체계 지지 2인 30이 먼저, 1표 번호는 제외
    assert.deepEqual(tickets.S3, [7, 10, 11, 12, 13, 30]); // 체계 지지 2인 30이 먼저, 14 탈락
    Object.values(tickets).forEach(assertTicket);
    // 9: 3표·체계 1개 / 3·4·5·6·8: 2표·체계 1개 / 30: 2표·체계 2개 — 세 전략이 모두 갈린다
    const distinct = module.voteStrategyTickets({
      'a.c1': 9, 'a.c2': 9, 'a.c3': 9, 'b.c1': 3, 'b.c2': 3, 'c.c1': 4, 'c.c2': 4, 'd.c1': 5, 'd.c2': 5,
      'e.c1': 6, 'e.c2': 6, 'f.c1': 8, 'f.c2': 8, 'p.c1': 30, 'q.c1': 30, 'r.c1': 1,
    });
    assert.deepEqual(distinct.S1, [3, 4, 5, 6, 8, 9]); // 득표순: 9 → 2표는 번호순
    assert.deepEqual(distinct.S2, [3, 4, 5, 6, 8, 30]); // 그룹 안 체계 지지 → 번호순이라 3표인 9 탈락
    assert.deepEqual(distinct.S3, [3, 4, 5, 6, 9, 30]); // 체계 지지 → 득표 → 번호순
    const short = module.voteStrategyTickets({ 'a.c1': 9, 'a.c2': 9, 'b.c1': 40, 'c.c1': 41, 'd.c1': 42, 'e.c1': 43, 'f.c1': 44, 'g.c1': 45 });
    assert.deepEqual(short.S2, [9, 40, 41, 42, 43, 44]); // 2표 이상이 부족하면 1표 번호로 채움
    const tie = module.voteStrategyTickets({ 'a.c1': 30, 'b.c1': 20, 'c.c1': 10, 'd.c1': 40, 'e.c1': 5, 'f.c1': 15, 'g.c1': 1, 'g.c2': 1 });
    assert.deepEqual(tie.S1, [1, 5, 10, 15, 20, 30]);
    assert.deepEqual(tie.S3, [1, 5, 10, 15, 20, 30]);
    Object.values(tie).forEach(assertTicket);
    assert.throws(() => module.voteStrategyTickets({ 'a.c1': 1, 'b.c1': 2, 'c.c1': 3, 'd.c1': 4, 'e.c1': 5, 'f.c1': 5 }), /fewer than 6/);
    assert.throws(() => module.voteStrategyTickets({ 'a.c1': 46 }), /out of range/);
  } finally {
    await cleanup();
  }
});

test('득표 전략 1243~1245 회귀 fixture는 고정 티켓과 당첨 교집합을 유지한다', async () => {
  const { module, cleanup } = await predictor();
  const draws = [
    { round: 1243, drawDate: '2026-09-26', drawTime: '21:30', numbers: [9, 18, 24, 38, 43, 44] },
    { round: 1244, drawDate: '2026-10-03', drawTime: '21:35', numbers: [1, 13, 18, 26, 34, 38] },
    { round: 1245, drawDate: '2026-10-10', drawTime: '20:35', numbers: [4, 5, 25, 28, 32, 42] },
  ];
  const expected = {
    1243: { S1: [[1, 4, 23, 42, 43, 44], [43, 44]], S2: [[1, 4, 23, 42, 43, 44], [43, 44]], S3: [[1, 4, 23, 42, 43, 44], [43, 44]] },
    1244: { S1: [[1, 8, 9, 10, 23, 31], [1]], S2: [[1, 8, 9, 10, 23, 31], [1]], S3: [[1, 8, 9, 10, 23, 31], [1]] },
    1245: { S1: [[1, 8, 11, 19, 27, 42], [42]], S2: [[1, 8, 11, 21, 22, 27], []], S3: [[1, 8, 11, 21, 27, 42], [42]] },
  };
  try {
    for (const draw of draws) {
      const { predictions } = module.generateFrozenPredictions(draw, draws.filter((row) => row.round < draw.round));
      for (const model of ['S1', 'S2', 'S3']) {
        const [ticket, hits] = expected[draw.round][model];
        assert.deepEqual(predictions[model], ticket, `${model} round ${draw.round}`);
        assert.deepEqual(predictions[model].filter((number) => draw.numbers.includes(number)), hits, `${model} hits ${draw.round}`);
      }
    }
  } finally {
    await cleanup();
  }
});

test('로또 예측은 c991927 고정 엔진만 쓰고 일반 운세 엔진(public/unse)을 불러오지 않는다', async () => {
  const result = await build({ entryPoints: [fileURLToPath(new URL('../lib/lotto-future/predictor.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
  const inputs = Object.keys(result.metafile.inputs).map((path) => path.replaceAll('\\', '/'));
  assert.ok(inputs.some((path) => path.includes('lib/lotto-future/engine-c991927/')));
  assert.deepEqual(inputs.filter((path) => path.includes('public/unse')), []);
  const { module, cleanup } = await predictor();
  try {
    const generated = module.generateFrozenPredictions({ round: 1246, drawDate: '2026-10-17', drawTime: '20:35' }, []);
    assert.equal(generated.engineVersion, 'unse-c991927');
    assert.match(generated.modelVersion, /v4-votes$/);
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
