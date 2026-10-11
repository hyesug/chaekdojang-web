import assert from 'node:assert/strict';
import test from 'node:test';
import { DEV, HOLDOUT, SCORE, WINDOWS, ruleTicket, stats } from './run-latest-engine-research.mjs';
import { aggregate } from './run-latest-engine-walk-forward.mjs';

test('기존 연구와 같은 점수 벡터·walk-forward 시험 창을 쓰고 개발/독립 구간이 겹치지 않는다', () => {
  assert.deepEqual(SCORE, [0, 1, 3, 10, 50, 300, 3000]);
  assert.deepEqual(WINDOWS.slice(0, 7), [[601, 700], [701, 800], [801, 900], [901, 1000], [1001, 1100], [1101, 1200], [1201, 1242]]);
  assert.ok(Math.max(...DEV.map(([, b]) => b)) < Math.min(...HOLDOUT.map(([a]) => a)));
});

test('stats 는 적중 분포·점수·3개 이상 비율을 기존 지표대로 센다', () => {
  const draws = [{ round: 1, numbers: [1, 2, 3, 4, 5, 6] }, { round: 2, numbers: [1, 2, 3, 40, 41, 42] }];
  const result = stats({ 1: [1, 2, 3, 7, 8, 9], 2: [10, 11, 12, 13, 14, 15] }, draws);
  assert.equal(result.score, 10);
  assert.equal(result.mean, 1.5);
  assert.equal(result.ge3, 0.5);
  assert.deepEqual(result.hist, [1, 0, 0, 1, 0, 0, 0]);
});

test('득표 규칙은 체계 부분집합·체계 지지·이웃 확장을 반영하고 항상 1~45의 서로 다른 6개를 낸다', () => {
  const candidates = { 'a.c1': 7, 'a.c2': 7, 'b.c1': 9, 'c.c1': 9, 'd.c1': 30 };
  assert.deepEqual(ruleTicket(candidates, { key: 'votes' }), [1, 2, 7, 9, 30, 3].sort((x, y) => x - y));
  assert.deepEqual(ruleTicket(candidates, { key: 'votes', systems: ['d'] }), [1, 2, 3, 4, 5, 30]);
  // 7: 한 체계 3표 / 9~14: 각각 두 체계 1표씩 → 득표순은 7 을 넣고, 체계 지지순은 7 을 뺀다
  const contested = { 'a.c1': 7, 'a.c2': 7, 'a.c3': 7 };
  [9, 10, 11, 12, 13, 14].forEach((n, i) => { contested[`p${i}.c1`] = n; contested[`q${i}.c1`] = n; });
  assert.deepEqual(ruleTicket(contested, { key: 'votes' }), [7, 9, 10, 11, 12, 13]);
  assert.deepEqual(ruleTicket(contested, { key: 'support' }), [9, 10, 11, 12, 13, 14]);
  const expanded = ruleTicket({ 'a.c1': 45 }, { key: 'votes', spread: 1, alpha: 0.5 });
  assert.ok(expanded.includes(44) && expanded.includes(45) && expanded.includes(1));
  for (const ticket of [ruleTicket(candidates, { key: 'votes', spread: 1, alpha: 0.25 }), expanded]) {
    assert.equal(new Set(ticket).size, 6);
    assert.ok(ticket.every((n) => Number.isInteger(n) && n >= 1 && n <= 45));
  }
});

test('walk-forward 요약은 지정한 시험 창만 합친다', () => {
  const splits = [
    { range: '601-700', stats: { rounds: 100, hits: 80, hist: [0, 0, 0, 2, 0, 0, 0] } },
    { range: '1101-1200', stats: { rounds: 100, hits: 90, hist: [0, 0, 0, 4, 1, 0, 0] } },
  ];
  assert.deepEqual(aggregate(splits, ['601-700']), { mean: 0.8, ge3: 0.02 });
  assert.deepEqual(aggregate(splits, ['1101-1200']), { mean: 0.9, ge3: 0.05 });
});
