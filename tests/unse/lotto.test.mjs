import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse-8f3k2m/src/engine.js';
import { pickNumbers, currentRound } from '../../public/unse-8f3k2m/src/lotto.js';
import { splitRisk, relaxShape } from '../../public/unse-8f3k2m/src/lotto-avoid.js';
import { verifySignals, signalsOf, probabilities, SIGNALS } from '../../public/unse-8f3k2m/src/lotto-stats.js';
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
  const sig = signalsOf(DRAWS.length ? DRAWS.slice(0, 300) : fake(300, 1));
  for (const p of probabilities(sig, {})) assert.ok(Math.abs(p - 6 / 45) < 1e-9);
  const tilted = probabilities(sig, { 빈도: 0.3, 이월: 0.2 });
  assert.ok(Math.abs(tilted.reduce((a, b) => a + b, 0) - 6) < 1e-6);
});

/** 공정한 추첨을 흉내 낸 가짜 회차 */
function fake(count, seed, bias = false) {
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
    while (s.size < 6) {
      let v = 1 + Math.floor(rnd() * 45);
      if (bias && rnd() < 0.35) v = 1 + Math.floor(rnd() * 9);
      s.add(v);
    }
    out.push([...s].sort((x, y) => x - y));
  }
  return out;
}

test('공정한 추첨이면 어떤 신호도 채택되지 않는다', () => {
  for (const seed of [12345, 999, 777]) {
    const v = verifySignals(fake(420, seed));
    assert.ok(v.statWeight < 0.05, `seed ${seed}: 비중 ${v.statWeight} (${v.used.join(',')})`);
  }
});

test('진짜 편향이 있으면 신호가 살아남는다', () => {
  // 검사가 무조건 탈락시키기만 한다면 아무것도 검증하지 못하는 것이다.
  const v = verifySignals(fake(420, 555, true));
  assert.ok(v.used.length > 0, '편향을 심었는데 아무 신호도 못 찾았다');
});

test('회차가 모자라면 검증하지 않고 이유를 밝힌다', () => {
  const v = verifySignals([]);
  assert.equal(v.ok, false);
  assert.match(v.reason, /회차/);
  assert.equal(v.statWeight ?? 0, 0);
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
