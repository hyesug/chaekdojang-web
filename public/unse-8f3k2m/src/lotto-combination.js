/**
 * lotto-combination.js — 번호 하나하나가 아니라 여섯 개 묶음의 생김새
 *
 * 홀짝 비율, 총합, 번호 사이 간격 같은 것들. 과거 당첨조합이 이런 값에서
 * 균등 추첨과 다른 모양을 보이는지 검정한다.
 *
 * 【좁히지 않는다】 "과거 평균과 비슷한 조합만 남기기"는 하지 않는다. 그건
 * 근거 없이 번호 공간을 잘라내는 짓이다. 균등 가정과 **유의하게 다를 때만**
 * 구조 신호를 켜고, 그렇지 않으면(거의 언제나 그렇다) 0으로 둔다.
 * 모든 조합은 원칙적으로 가능하다.
 */
import { POOL, PICK } from './lotto-statistics.js';

/** 여섯 개 묶음의 생김새를 전부 잰다 */
export function featuresOf(nums, prev = [], prev2 = []) {
  const s = [...nums].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  const mean = sum / s.length;

  const gaps = [];
  for (let i = 1; i < s.length; i++) gaps.push(s[i] - s[i - 1]);

  const tails = new Map();
  for (const n of s) tails.set(n % 10, (tails.get(n % 10) ?? 0) + 1);

  // 번호대별 분포 — 1~9, 10~19, 20~29, 30~39, 40~45
  const decades = new Array(5).fill(0);
  for (const n of s) decades[Math.min(4, Math.floor(n / 10))]++;

  const p1 = new Set(prev);
  const p2 = new Set(prev2);

  return {
    odd: s.filter((n) => n % 2 === 1).length,
    even: s.filter((n) => n % 2 === 0).length,
    low: s.filter((n) => n <= 22).length,   // 1~22
    high: s.filter((n) => n > 22).length,   // 23~45
    sum,
    mean,
    stdev: Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length),
    gaps,
    minGap: gaps.length ? Math.min(...gaps) : 0,
    maxGap: gaps.length ? Math.max(...gaps) : 0,
    consecutive: gaps.filter((g) => g === 1).length,
    sameTailMax: Math.max(...tails.values()),
    decades,
    overlapPrev: s.filter((n) => p1.has(n)).length,
    overlapPrev2: s.filter((n) => p2.has(n)).length,
  };
}

/** 씨앗 하나로 굴러가는 난수 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 과거 조합의 생김새가 균등 추첨과 다른지 검정한다.
 *
 * 합계·홀짝·저고 세 축을 본다. 균등 추첨을 몬테카를로로 2만 번 돌려 기준
 * 분포를 만들고, 실제 평균이 그 기준에서 몇 표준오차만큼 떨어졌는지 잰다.
 * |z| > 3 인 축이 하나라도 있으면 구조 신호를 쓸 수 있다고 본다.
 */
export function buildStructureModel(train, seed = 0x5721) {
  const empty = {
    informative: false, tests: [], sumMean: 0, sumStd: 1,
    note: '학습 회차가 모자라 구조 검정을 하지 않았습니다.',
  };
  if (!train.length) return empty;

  const obs = train.map((d) => featuresOf(d));
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  // 균등 추첨 기준 분포
  const r = rng(seed);
  const sims = 20000;
  const simSum = [], simOdd = [], simLow = [];
  for (let i = 0; i < sims; i++) {
    const set = new Set();
    while (set.size < PICK) set.add(1 + Math.floor(r() * POOL));
    const f = featuresOf([...set]);
    simSum.push(f.sum); simOdd.push(f.odd); simLow.push(f.low);
  }
  const stat = (xs) => {
    const m = avg(xs);
    return { mean: m, std: Math.sqrt(avg(xs.map((x) => (x - m) ** 2))) };
  };

  const tests = [];
  for (const [name, get, sim] of [
    ['합계', (f) => f.sum, simSum],
    ['홀수 개수', (f) => f.odd, simOdd],
    ['저구간 개수', (f) => f.low, simLow],
  ]) {
    const o = stat(obs.map(get));
    const u = stat(sim);
    // 표본평균의 표준오차 = σ/√n
    const se = u.std / Math.sqrt(obs.length);
    const z = se ? (o.mean - u.mean) / se : 0;
    tests.push({ name, observed: o.mean, uniform: u.mean, z });
  }

  const informative = tests.some((t) => Math.abs(t.z) > 3);
  const sumStat = stat(obs.map((f) => f.sum));
  return {
    informative,
    tests,
    sumMean: sumStat.mean,
    sumStd: sumStat.std || 1,
    note: informative
      ? '과거 조합의 생김새가 균등 추첨과 다릅니다. 구조 신호를 씁니다.'
      : '과거 조합의 생김새가 균등 추첨과 구별되지 않습니다. 구조 신호를 쓰지 않습니다.',
  };
}

/** 구조 점수 — 모델이 informative 가 아니면 언제나 0 */
export function structureScore(f, model) {
  if (!model?.informative || !model.sumStd) return 0;
  const z = (f.sum - model.sumMean) / model.sumStd;
  return -Math.min(4, z * z) / 4; // 중심에서 멀수록 감점, [-1, 0]
}
