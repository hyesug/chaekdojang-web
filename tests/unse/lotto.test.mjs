import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse-8f3k2m/src/engine.js';
import { pickNumbers, currentRound } from '../../public/unse-8f3k2m/src/lotto.js';
import { splitRisk, relaxShape } from '../../public/unse-8f3k2m/src/lotto-avoid.js';
import { featuresOf, assertNoFuture, BASE, POOL } from '../../public/unse-8f3k2m/src/lotto-statistics.js';
import { buildTransition, carryStats, carryState, MIN_ROW_SAMPLES } from '../../public/unse-8f3k2m/src/lotto-transition.js';
import { classify, rangeRegime, regimeTable } from '../../public/unse-8f3k2m/src/lotto-regime.js';
import { featuresOf as comboFeatures, buildStructureModel, structureScore } from '../../public/unse-8f3k2m/src/lotto-combination.js';
import {
  verifySignals, signalsOf, probabilities, topPick, walkForward,
  randomBaseline, makeSplit, fakeDraws, skill, SIGNALS, MIN_TRAIN,
} from '../../public/unse-8f3k2m/src/lotto-backtest.js';
import { generate } from '../../public/unse-8f3k2m/src/lotto-generator.js';
import { DRAWS, DRAW_ROWS, LATEST_ROUND } from '../../public/unse-8f3k2m/src/data/draws.js';
import { LOTTO_MODEL } from '../../public/unse-8f3k2m/src/data/lotto-model.js';

const FORM = {
  name: '로또 테스트',
  year: 1990, month: 5, day: 15, hour: 14, minute: 30,
  birthPlace: '서울', homePlace: '서울', gender: 'female',
};

const read = () => {
  const r = readFortune(FORM);
  return { input: r.input, chart: r.chart };
};

// ─────────────────────────────────────────────────────────────
// 출력 계약
// ─────────────────────────────────────────────────────────────

test('번호는 정확히 여섯 개, 1~45, 중복 없이 오름차순으로 나온다', () => {
  const { input, chart } = read();
  for (const mode of ['week', 'life']) {
    const ns = pickNumbers(input, chart, mode).numbers.map((x) => x.n);
    assert.equal(ns.length, 6, `${mode}: 개수`);
    assert.equal(new Set(ns).size, 6, `${mode}: 중복`);
    for (const n of ns) assert.ok(Number.isInteger(n) && n >= 1 && n <= 45, `${mode}: ${n}`);
    assert.deepEqual(ns, [...ns].sort((a, b) => a - b), `${mode}: 정렬`);
  }
});

test('번호마다 어느 체계의 무엇에서 나왔는지가 붙어 있다', () => {
  const { input, chart } = read();
  for (const x of pickNumbers(input, chart, 'week').numbers) {
    assert.ok(x.system, '체계 이름 없음');
    assert.ok(x.why, '근거 없음');
  }
});

test('같은 사람 같은 회차면 늘 같은 번호가 나온다', () => {
  const { input, chart } = read();
  const a = pickNumbers(input, chart, 'week').numbers.map((x) => x.n).join(',');
  const b = pickNumbers(input, chart, 'week').numbers.map((x) => x.n).join(',');
  assert.equal(a, b);
});

test('평생 번호와 이번 주 번호는 서로 다르다', () => {
  const { input, chart } = read();
  const week = pickNumbers(input, chart, 'week').numbers.map((x) => x.n).join(',');
  const life = pickNumbers(input, chart, 'life').numbers.map((x) => x.n).join(',');
  assert.notEqual(week, life);
});

test('회차는 추첨이 끝나는 순간에 넘어간다', () => {
  // 1회차 추첨은 2002-12-07(토) 20:35 KST = 11:35 UTC
  assert.equal(currentRound(Date.UTC(2002, 11, 7, 11, 0)).round, 1, '추첨 전이면 1회차를 산다');
  assert.equal(currentRound(Date.UTC(2002, 11, 7, 12, 0)).round, 2, '추첨 후에는 2회차');
  assert.equal(currentRound(Date.UTC(2002, 11, 13, 0, 0)).round, 2, '다음 추첨 전까지 2회차');
});

// ─────────────────────────────────────────────────────────────
// 남과 겹치는 모양 피하기
// ─────────────────────────────────────────────────────────────

test('사람들이 많이 고르는 모양을 잡아낸다', () => {
  assert.ok(splitRisk([1, 2, 3, 4, 5, 6]).score > 0.5, '연속수');
  assert.ok(splitRisk([3, 9, 14, 21, 27, 31]).hits.some((h) => h.includes('31 이하')), '생일형');
  assert.ok(splitRisk([2, 8, 14, 20, 26, 32]).hits.some((h) => h.includes('일정하게')), '등차수열');
  assert.ok(splitRisk([1, 8, 15, 22, 29, 36]).hits.some((h) => h.includes('세로줄')), '용지 세로줄');
  assert.ok(splitRisk([3, 13, 23, 33, 41, 45]).hits.some((h) => h.includes('끝자리')), '같은 끝자리');
});

test('평범한 조합은 건드리지 않는다', () => {
  const plain = [4, 17, 23, 35, 38, 44];
  assert.ok(splitRisk(plain).score < 0.25);
  const picked = plain.map((n) => ({ n, overlap: 2, system: 's', why: 'w' }));
  assert.equal(relaxShape(picked, [{ n: 11, overlap: 1, system: 'p', why: 'w' }]).swapped, null);
});

test('흔한 모양이면 겹침이 가장 약한 한 자리만 바꾼다', () => {
  const picked = [1, 2, 3, 4, 5, 6].map((n, i) => ({ n, overlap: i === 5 ? 1 : 3, system: 's', why: 'w' }));
  const pool = [11, 19, 27, 33, 41].map((n) => ({ n, overlap: 1, system: 'p', why: 'w' }));
  const r = relaxShape(picked, pool);
  assert.ok(r.after.score < r.before.score, '모양이 나아져야 한다');
  assert.equal(r.numbers.length, 6);
  assert.equal(r.swapped.from, 6, '겹침이 가장 약한 자리를 바꾼다');
  assert.equal(r.numbers.filter((x) => ![1, 2, 3, 4, 5, 6].includes(x.n)).length, 1, '한 자리만');
});

// ─────────────────────────────────────────────────────────────
// 통계 신호
// ─────────────────────────────────────────────────────────────

test('가중치가 없으면 확률은 균등(6/45)이고, 있어도 합은 항상 6이다', () => {
  const sig = signalsOf(DRAWS.length ? DRAWS.slice(0, 300) : fakeDraws(300, 1));
  for (const p of probabilities(sig, {})) assert.ok(Math.abs(p - BASE) < 1e-9);
  const tilted = probabilities(sig, { 빈도: 0.3, 이월: 0.2 });
  assert.ok(Math.abs(tilted.reduce((a, b) => a + b, 0) - 6) < 1e-6);
});

test('확률 상위 여섯 개를 오름차순으로 돌려준다', () => {
  const p = new Array(POOL).fill(0).map((_, i) => i / POOL);
  assert.deepEqual(topPick(p), [40, 41, 42, 43, 44, 45]);
});

/** 1~9 번이 자주 나오게 편향을 심은 가짜 회차 */
function biased(count, seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = new Set();
    while (s.size < 6) s.add(rnd() < 0.35 ? 1 + Math.floor(rnd() * 9) : 1 + Math.floor(rnd() * 45));
    out.push([...s].sort((x, y) => x - y));
  }
  return out;
}

test('공정한 추첨이면 어떤 신호도 채택되지 않는다', () => {
  for (const seed of [12345, 999, 777]) {
    const v = verifySignals(fakeDraws(420, seed), { minTrain: 200 });
    assert.ok(v.statWeight < 0.05, `seed ${seed}: 비중 ${v.statWeight} (${v.used.join(',')})`);
  }
});

test('진짜 편향이 있으면 신호가 살아남는다', () => {
  // 검사가 무조건 탈락시키기만 한다면 아무것도 검증하지 못하는 것이다.
  const v = verifySignals(biased(420, 555), { minTrain: 200 });
  assert.ok(v.used.length > 0, '편향을 심었는데 아무 신호도 못 찾았다');
});

test('회차가 모자라면 검증하지 않고 이유를 밝힌다', () => {
  const v = verifySignals([]);
  assert.equal(v.ok, false);
  assert.match(v.reason, /회차/);
  assert.equal(v.statWeight ?? 0, 0);
});

// ─────────────────────────────────────────────────────────────
// 미래를 보지 않는가 · 구간 나누기
// ─────────────────────────────────────────────────────────────

test('history 에 목표 회차 이후가 섞이면 즉시 던진다', () => {
  const h = fakeDraws(100, 1);
  assert.doesNotThrow(() => assertNoFuture(h, 100));
  assert.throws(() => assertNoFuture(h, 99), /leakage/);
});

test('walk-forward 는 목표 회차 앞쪽만 본다', () => {
  // 뒤쪽 절반을 전부 같은 조합으로 바꿔도 앞 구간 채점이 달라지면 안 된다.
  const base = fakeDraws(500, 42);
  const tainted = base.map((d, i) => (i >= 300 ? [1, 2, 3, 4, 5, 6] : d));
  const cfg = { only: { 빈도: 0.2 } };
  const a = walkForward(base, { from: 200, to: 300, configs: cfg, minTrain: 150 }).only;
  const b = walkForward(tainted, { from: 200, to: 300, configs: cfg, minTrain: 150 }).only;
  assert.equal(a.brierScore, b.brierScore, '미래가 과거 채점에 영향을 줬다');
});

test('구간은 시간순으로 겹치지 않게 나뉜다', () => {
  const s = makeSplit(1000, MIN_TRAIN);
  assert.ok(s.trainTo >= MIN_TRAIN);
  assert.ok(s.trainTo < s.validTo);
  assert.ok(s.validTo < s.testTo);
  assert.equal(s.testTo, 1000);
});

test('무작위 기준선은 씨앗이 같으면 같은 값이 나온다', () => {
  const o = { from: 200, to: 300, sims: 5, seed: 7, minTrain: 150 };
  const d = fakeDraws(400, 3);
  assert.deepEqual(randomBaseline(d, o).matchDistribution, randomBaseline(d, o).matchDistribution);
});

test('무작위 기준선의 평균 적중은 이론값 0.8 부근이다', () => {
  const r = randomBaseline(fakeDraws(500, 9), { from: 200, to: 500, sims: 40, minTrain: 150 });
  assert.ok(Math.abs(r.averageMatches - 6 * BASE) < 0.12, `실측 ${r.averageMatches}`);
});

// ─────────────────────────────────────────────────────────────
// 전이 · 상태 · 조합
// ─────────────────────────────────────────────────────────────

test('표본이 모자란 전이 행은 균등으로 되돌린다', () => {
  const m = buildTransition(fakeDraws(5, 1));
  for (let i = 1; i <= POOL; i++) {
    if (m.rowCount[i] < MIN_ROW_SAMPLES) {
      for (let j = 1; j <= POOL; j++) assert.equal(m.p[i][j], BASE);
    }
  }
});

test('이월 분포는 0~6 에 모두 담기고 평균이 이론값 0.8 부근이다', () => {
  const s = carryStats(fakeDraws(800, 11));
  assert.equal(s.dist.length, 7);
  assert.equal(s.dist.reduce((a, b) => a + b, 0), s.samples);
  assert.ok(Math.abs(s.mean - 6 * BASE) < 0.2, `실측 ${s.mean}`);
  assert.equal(carryState(0), 'LOW_REPEAT');
  assert.equal(carryState(1), 'NORMAL_REPEAT');
  assert.equal(carryState(3), 'HIGH_REPEAT');
});

test('상태는 세 축 모두 유효한 라벨을 낸다', () => {
  const r = classify(fakeDraws(200, 5));
  assert.ok(['HOT', 'NEUTRAL', 'COLD'].includes(r.frequency));
  assert.ok(['LOW_HEAVY', 'BALANCED', 'HIGH_HEAVY'].includes(r.range));
  assert.ok(['LOW_REPEAT', 'NORMAL_REPEAT', 'HIGH_REPEAT'].includes(r.repeat));
  // 회차가 모자라면 전부 중립
  assert.deepEqual(classify(fakeDraws(3, 5)),
    { frequency: 'NEUTRAL', range: 'BALANCED', repeat: 'NORMAL_REPEAT' });
});

test('구간 상태는 실제 저/고 쏠림을 따라간다', () => {
  assert.equal(rangeRegime([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]), 'LOW_HEAVY');
  assert.equal(rangeRegime([[40, 41, 42, 43, 44, 45], [30, 31, 32, 33, 34, 35]]), 'HIGH_HEAVY');
});

test('상태별 다음 회차 분포를 표로 낸다', () => {
  const t = regimeTable(fakeDraws(400, 13));
  for (const st of ['LOW_HEAVY', 'BALANCED', 'HIGH_HEAVY']) assert.ok(st in t);
  assert.ok(Math.abs(t._uniform - 22 / 45) < 1e-9);
});

test('조합 feature 를 전부 계산한다', () => {
  const f = comboFeatures([3, 4, 13, 23, 33, 43], [3, 9, 20, 31, 40, 45], [1, 2, 3, 4, 5, 6]);
  assert.equal(f.odd, 5);
  assert.equal(f.even, 1);
  assert.equal(f.low, 3);
  assert.equal(f.high, 3);
  assert.equal(f.sum, 119);
  assert.equal(f.consecutive, 1);
  assert.equal(f.sameTailMax, 5);
  assert.equal(f.minGap, 1);
  assert.equal(f.overlapPrev, 1);
  assert.equal(f.overlapPrev2, 2);
  assert.equal(f.decades.reduce((a, b) => a + b, 0), 6);
});

test('균등 추첨 데이터에서는 구조 신호가 켜지지 않는다', () => {
  const m = buildStructureModel(fakeDraws(600, 21));
  assert.equal(m.informative, false, m.tests.map((t) => `${t.name} z=${t.z.toFixed(2)}`).join(', '));
  assert.equal(structureScore(comboFeatures([1, 2, 3, 4, 5, 6]), m), 0, '꺼져 있으면 점수는 0이어야 한다');
});

// ─────────────────────────────────────────────────────────────
// 후보 생성
// ─────────────────────────────────────────────────────────────

const POOL_FIXTURE = [3, 7, 11, 14, 19, 22, 26, 31, 35, 38, 41, 44].map((n, i) => ({ n, mass: 12 - i }));

test('후보를 잔뜩 만들어 상위권에서 고른다', () => {
  const g = generate({
    pool: POOL_FIXTURE,
    probabilities: new Array(POOL).fill(BASE),
    structure: buildStructureModel([]),
    seed: 'x', candidates: 3000,
  });
  assert.ok(g.poolSize > 100, `후보 ${g.poolSize}개`);
  assert.ok(g.topSize >= 20 && g.topSize <= 500);
  assert.equal(g.chosen.numbers.length, 6);
});

test('Utility = PredictionScore − λ × 공동당첨위험 이고 둘은 따로 계산된다', () => {
  const g = generate({
    pool: POOL_FIXTURE,
    probabilities: new Array(POOL).fill(BASE),
    structure: buildStructureModel([]),
    seed: 'y', candidates: 2000,
  });
  const c = g.chosen;
  assert.ok(Math.abs(c.utility - (c.predictionScore - 0.15 * c.popularityPenalty)) < 1e-9);
  // 공동당첨 위험이 PredictionScore 안에 섞이면 안 된다
  assert.ok(Number.isFinite(c.predictionScore) && Number.isFinite(c.popularityPenalty));
});

test('같은 씨앗이면 같은 조합, 다른 씨앗이면 대체로 다르다', () => {
  const o = {
    pool: POOL_FIXTURE, probabilities: new Array(POOL).fill(BASE),
    structure: buildStructureModel([]), candidates: 2000,
  };
  const a = generate({ ...o, seed: 'same' }).chosen.numbers.join(',');
  const b = generate({ ...o, seed: 'same' }).chosen.numbers.join(',');
  const c = generate({ ...o, seed: 'other' }).chosen.numbers.join(',');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('후보 번호는 체계가 낸 풀에서 나온다 (근거 없는 번호 금지)', () => {
  const allowed = new Set(POOL_FIXTURE.map((c) => c.n));
  const g = generate({
    pool: POOL_FIXTURE, probabilities: new Array(POOL).fill(BASE),
    structure: buildStructureModel([]), seed: 'z', candidates: 2000,
  });
  for (const n of g.chosen.numbers) assert.ok(allowed.has(n), `${n} 은 후보 풀 밖이다`);
});

// ─────────────────────────────────────────────────────────────
// 실제 회차 데이터
// ─────────────────────────────────────────────────────────────

test('회차 데이터는 1회차부터 빠짐없이 이어진다', () => {
  if (!DRAW_ROWS.length) return; // 데이터를 아직 넣지 않았으면 건너뛴다
  assert.equal(DRAW_ROWS[0][0], 1, '1회차부터 시작');
  for (let i = 1; i < DRAW_ROWS.length; i++) {
    assert.equal(DRAW_ROWS[i][0], DRAW_ROWS[i - 1][0] + 1, `${DRAW_ROWS[i][0]}회 앞이 비었다`);
  }
  assert.equal(LATEST_ROUND, DRAW_ROWS[DRAW_ROWS.length - 1][0]);
});

test('추첨일은 2002-12-07 토요일부터의 주간 주기와 정확히 맞는다', () => {
  if (!DRAW_ROWS.length) return;
  const FIRST = Date.UTC(2002, 11, 7), WEEK = 7 * 86400000;
  for (const [round, date] of DRAW_ROWS) {
    if (!date) continue;
    const t = Date.parse(`${date}T00:00:00Z`);
    assert.equal(new Date(t).getUTCDay(), 6, `${round}회가 토요일이 아니다`);
    assert.equal(t, FIRST + (round - 1) * WEEK, `${round}회의 날짜가 주기에서 벗어났다`);
  }
});

test('모든 회차의 번호가 1~45, 중복 없이 여섯 개다', () => {
  for (const nums of DRAWS) {
    assert.equal(nums.length, 6);
    assert.equal(new Set(nums).size, 6);
    for (const n of nums) assert.ok(Number.isInteger(n) && n >= 1 && n <= 45);
  }
});

test('저장된 검증 결과가 실제 회차 수와 어긋나지 않는다', () => {
  // 회차를 새로 넣고 lotto-verify.mjs 를 안 돌리면 여기서 걸린다.
  if (!DRAWS.length) return;
  assert.equal(LOTTO_MODEL.drawCount, DRAWS.length,
    '회차를 넣은 뒤 node scripts/lotto-verify.mjs 를 다시 돌려야 합니다');
});

test('채택된 신호가 없으면 가중치도 전부 0이다', () => {
  const sum = SIGNALS.reduce((a, n) => a + (LOTTO_MODEL.weights?.[n] ?? 0), 0);
  if (!LOTTO_MODEL.used?.length) assert.equal(sum, 0);
  else assert.ok(sum > 0 && sum <= 0.7, `비중 합계 ${sum}`);
});

test('저장된 모델에 모델 비교와 최종확인 결과가 들어 있다', () => {
  if (!DRAWS.length) return;
  assert.ok(Array.isArray(LOTTO_MODEL.comparison) && LOTTO_MODEL.comparison.length, '모델 비교 없음');
  assert.ok(LOTTO_MODEL.comparison.some((c) => c.label === '무작위'), '무작위 기준이 비교에 없음');
  assert.ok(LOTTO_MODEL.finalTest, '최종확인 결과 없음');
  assert.equal(LOTTO_MODEL.finalTest.matchDistribution.length, 7);
  assert.ok(LOTTO_MODEL.split.trainTo < LOTTO_MODEL.split.validTo);
  assert.ok(LOTTO_MODEL.split.validTo < LOTTO_MODEL.split.testTo);
});

// ─────────────────────────────────────────────────────────────
// 분석 메타데이터
// ─────────────────────────────────────────────────────────────

test('개발용 분석값이 번호와 함께 나온다', () => {
  const { input, chart } = read();
  const a = pickNumbers(input, chart, 'week').analysis;
  assert.ok(a.modelVersion, '모델 버전 없음');
  assert.equal(typeof a.targetDraw, 'number');
  assert.ok(a.weights && 'randomness' in a.weights, '가중치 없음');
  assert.ok(Array.isArray(a.activeSignals));
  assert.ok(a.candidate.poolSize > 0);
  assert.ok(Number.isFinite(a.candidate.utility));
  // 통계가 꺼져 있으면 randomness 가 대부분을 가져간다
  if (!a.activeSignals.length) assert.equal(a.statWeight, 0);
});

test('명반이 없어도(빈 후보) 여섯 개를 만들어낸다', () => {
  const g = generate({
    pool: [], probabilities: new Array(POOL).fill(BASE),
    structure: buildStructureModel([]), seed: 'nochart', candidates: 1000,
  });
  assert.equal(g.chosen.numbers.length, 6);
  assert.equal(new Set(g.chosen.numbers).size, 6);
});
