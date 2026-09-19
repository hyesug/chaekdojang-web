/**
 * lotto-backtest.js — 신호가 쓸 만한지 판정하는 곳
 *
 * 이 파일이 엔진의 심판이다. 다른 모듈은 신호를 만들기만 하고, 쓸지 말지는
 * 전부 여기서 정한다. 판정 기준은 넷이다.
 *
 *   1. 과거를 설명하는 게 아니라 **아직 안 본 회차**를 맞혀야 한다 (walk-forward)
 *   2. 학습·검증·최종확인 구간을 시간으로 나누고, 최종확인은 **가중치를 다 정한 뒤
 *      딱 한 번만** 본다
 *   3. 공정한 추첨을 흉내 낸 가짜 데이터에 **같은 절차**를 돌려 나오는 우연 수준을
 *      넘어야 한다
 *   4. 한 구간이 아니라 여러 구간에서 **계속** 나아야 한다
 *
 * 3번이 없으면 반드시 속는다. 신호 여럿 × 세기 여럿 중 제일 좋은 걸 고르는 절차는
 * 완전한 잡음에서도 "조금 나아 보이는 것"을 하나쯤 만들어낸다.
 */
import {
  POOL, PICK, BASE, featuresOf,
  frequencySignal, recencySignal, intervalSignal, trendSignal,
} from './lotto-statistics.js';
import { followerSignal, carrySignal, lag2Signal } from './lotto-transition.js';
import { regimeSignal } from './lotto-regime.js';

export const MODEL_VERSION = 'lotto-stat-1.1.0';
/** 이만큼은 쌓여야 학습을 시작한다 */
export const MIN_TRAIN = 300;
/** feature 계산에 쓰는 history 상한. 없으면 회차가 늘수록 O(n²)로 느려진다 */
const WINDOW = 600;
/** 통계가 차지할 수 있는 최대 비중. 나머지는 명반과 무작위 몫이다 */
export const MAX_STAT_WEIGHT = 0.7;
/** 가짜 데이터를 몇 벌 만들어 우연 수준을 잴지 */
const NULL_SETS = 6;
/** 신호 세기 후보 */
const SCALES = [0.05, 0.1, 0.2, 0.4];
/** 이만큼 좋아지면 신뢰도 100%로 본다 */
const FULL_CREDIT = 0.01;

/** 신호 이름과 만드는 법. 여기 없는 신호는 모델에 들어올 수 없다. */
export const SIGNAL_DEFS = {
  빈도: (h, f) => frequencySignal(f),
  최근: (h, f) => recencySignal(f),
  간격: (h, f) => intervalSignal(f),
  추세: (h, f) => trendSignal(f),
  전이: (h) => followerSignal(h),
  이월: (h) => carrySignal(h),
  'N-2': (h) => lag2Signal(h),
  구간: (h) => regimeSignal(h),
};
export const SIGNALS = Object.keys(SIGNAL_DEFS);

/** history → 신호 전부 */
export function signalsOf(history) {
  const f = featuresOf(history);
  const out = {};
  for (const [name, fn] of Object.entries(SIGNAL_DEFS)) out[name] = fn(history, f);
  return out;
}

/** 신호에 가중치를 실어 번호별 확률로. 합은 항상 6이 된다 */
export function probabilities(sig, weights) {
  const raw = new Array(POOL).fill(0);
  for (const name of SIGNALS) {
    const w = weights[name] || 0;
    if (!w) continue;
    for (let i = 0; i < POOL; i++) raw[i] += w * sig[name][i];
  }
  const p = raw.map((s) => Math.max(1e-6, BASE * (1 + s)));
  const sum = p.reduce((a, b) => a + b, 0);
  return p.map((x) => Math.min(0.999, (x * PICK) / sum));
}

/** 확률 상위 여섯 개. 동점은 번호 순으로 갈라 결정적으로 만든다 */
export function topPick(p) {
  return p
    .map((v, i) => ({ n: i + 1, v }))
    .sort((a, b) => b.v - a.v || a.n - b.n)
    .slice(0, PICK)
    .map((x) => x.n)
    .sort((a, b) => a - b);
}

/* ── 채점 ── */

/** 균등하게 찍었을 때의 Brier / LogLoss — 비교 기준 */
export const BASE_BRIER = (PICK * (BASE - 1) ** 2 + (POOL - PICK) * BASE ** 2) / POOL;
export const BASE_LOGLOSS = (PICK * -Math.log(BASE) + (POOL - PICK) * -Math.log(1 - BASE)) / POOL;

/** 기준보다 얼마나 나아졌나. 0이면 같고 음수면 더 나쁘다 */
export const skill = (score, base = BASE_BRIER) => 1 - score / base;

function emptyMetrics() {
  return {
    sampleSize: 0, averageMatches: 0,
    hit3PlusRate: 0, hit4PlusRate: 0, hit5PlusRate: 0,
    brierScore: BASE_BRIER, logLoss: BASE_LOGLOSS,
    matchDistribution: new Array(PICK + 1).fill(0),
  };
}

/**
 * 여러 가중치 조합을 **한 번의 시간 순회로** 동시에 채점한다.
 * 비용의 대부분이 신호 계산이라, 스텝마다 신호를 한 번만 만들고 조합별로
 * 확률만 다시 매긴다. 조합이 늘어도 거의 안 느려진다.
 */
export function walkForward(draws, { from, to, configs, minTrain = MIN_TRAIN }) {
  const keys = Object.keys(configs);
  const acc = {};
  for (const k of keys) {
    acc[k] = { brier: 0, logloss: 0, matches: 0, dist: new Array(PICK + 1).fill(0) };
  }
  let n = 0;

  for (let t = Math.max(minTrain, from); t < Math.min(to, draws.length); t++) {
    // 목표 회차 앞쪽만 자른다. 이 한 줄이 leakage 방지의 전부다.
    const history = draws.slice(Math.max(0, t - WINDOW), t);
    if (history.length < minTrain) continue;
    const sig = signalsOf(history);
    const actual = draws[t];

    for (const k of keys) {
      const p = probabilities(sig, configs[k]);
      let brier = 0;
      let logloss = 0;
      for (let i = 0; i < POOL; i++) {
        const y = actual.includes(i + 1) ? 1 : 0;
        const pi = Math.min(0.999999, Math.max(1e-6, p[i]));
        brier += (pi - y) ** 2;
        logloss += -(y * Math.log(pi) + (1 - y) * Math.log(1 - pi));
      }
      const m = topPick(p).filter((x) => actual.includes(x)).length;
      const a = acc[k];
      a.brier += brier / POOL;
      a.logloss += logloss / POOL;
      a.matches += m;
      a.dist[m]++;
    }
    n++;
  }

  const out = {};
  for (const k of keys) {
    const a = acc[k];
    out[k] = n ? {
      sampleSize: n,
      averageMatches: a.matches / n,
      hit3PlusRate: (a.dist[3] + a.dist[4] + a.dist[5] + a.dist[6]) / n,
      hit4PlusRate: (a.dist[4] + a.dist[5] + a.dist[6]) / n,
      hit5PlusRate: (a.dist[5] + a.dist[6]) / n,
      brierScore: a.brier / n,
      logLoss: a.logloss / n,
      matchDistribution: a.dist,
    } : emptyMetrics();
  }
  return out;
}

/* ── 무작위 기준선 ── */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 공정한 추첨을 흉내 낸 가짜 회차 */
export function fakeDraws(count, seed) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = new Set();
    while (s.size < PICK) s.add(1 + Math.floor(r() * POOL));
    out.push([...s].sort((a, b) => a - b));
  }
  return out;
}

/**
 * 균등 무작위 기준선 — 한 번 찍어보고 비교하지 않는다. 몬테카를로로 여러 번
 * 찍어 평균을 낸다. 씨앗이 고정이라 언제 돌려도 같은 값이 나온다.
 */
export function randomBaseline(draws, { from, to, sims = 200, seed = 0xBA5E, minTrain = MIN_TRAIN }) {
  const dist = new Array(PICK + 1).fill(0);
  let matches = 0;
  let n = 0;
  const lo = Math.max(minTrain, from);
  const hi = Math.min(to, draws.length);

  for (let s = 0; s < sims; s++) {
    const r = rng(seed + s * 7919);
    for (let t = lo; t < hi; t++) {
      const pick = new Set();
      while (pick.size < PICK) pick.add(1 + Math.floor(r() * POOL));
      let m = 0;
      for (const x of pick) if (draws[t].includes(x)) m++;
      dist[m]++;
      matches += m;
      n++;
    }
  }
  return {
    sims, seed,
    sampleSize: n,
    averageMatches: n ? matches / n : 0,
    hit3PlusRate: n ? (dist[3] + dist[4] + dist[5] + dist[6]) / n : 0,
    hit4PlusRate: n ? (dist[4] + dist[5] + dist[6]) / n : 0,
    hit5PlusRate: n ? (dist[5] + dist[6]) / n : 0,
    // 균등 확률의 Brier/LogLoss 는 해석적으로 정해져 있어 시뮬레이션이 필요 없다
    brierScore: BASE_BRIER,
    logLoss: BASE_LOGLOSS,
    matchDistribution: dist,
  };
}

/* ── 구간 나누기 ── */

/** 시간순 60 / 20 / 20. 데이터가 짧으면 minTrain 을 지키도록 민다 */
export function makeSplit(total, minTrain = MIN_TRAIN) {
  const trainTo = Math.max(minTrain, Math.floor(total * 0.6));
  const validTo = Math.max(trainTo + 1, Math.floor(total * 0.8));
  return { trainTo, validTo, testTo: total, minTrain };
}

/* ── 본체 ── */

/** 프롬프트가 요구한 모델 비교 목록. 누적해서 쌓아 올린다. */
const MODEL_STACK = [
  ['빈도만', ['빈도']],
  ['빈도+최근', ['빈도', '최근']],
  ['빈도+전이', ['빈도', '전이', '이월', 'N-2']],
  ['빈도+전이+구간', ['빈도', '전이', '이월', 'N-2', '구간']],
  ['통계 전체', SIGNALS],
];

/**
 * 신호를 전부 검사하고 최종 가중치를 정한다.
 *
 * 무겁다. 브라우저에서 부르지 말고 scripts/lotto-verify.mjs 로 미리 돌린 뒤
 * 결과만 data/lotto-model.js 에 넣는다.
 */
export function verifySignals(draws, { minTrain = MIN_TRAIN } = {}) {
  if (!Array.isArray(draws) || draws.length < minTrain + 60) {
    return {
      ok: false,
      reason: `회차가 ${draws?.length ?? 0}개뿐입니다. 검증하려면 최소 ${minTrain + 60}개가 필요합니다.`,
      drawCount: draws?.length ?? 0,
      weights: {}, used: [], statWeight: 0, verdicts: [],
    };
  }

  const split = makeSplit(draws.length, minTrain);
  const { trainTo, validTo, testTo } = split;

  // 신호 × 세기 전부를 한 번에
  const configs = {};
  for (const name of SIGNALS) for (const s of SCALES) configs[`${name}@${s}`] = { [name]: s };

  const val = walkForward(draws, { from: trainTo, to: validTo, configs, minTrain });

  // 검증 구간을 셋으로 쪼개 "계속 나아지는지" 본다
  const step = Math.max(1, Math.floor((validTo - trainTo) / 3));
  const rolls = [
    walkForward(draws, { from: trainTo, to: trainTo + step, configs, minTrain }),
    walkForward(draws, { from: trainTo + step, to: trainTo + 2 * step, configs, minTrain }),
    walkForward(draws, { from: trainTo + 2 * step, to: validTo, configs, minTrain }),
  ];

  // 우연 수준 — 가짜 데이터에 똑같은 절차(그리드 최댓값 선택)를 돌린다
  const ceiling = Object.fromEntries(SIGNALS.map((n) => [n, 0]));
  for (let r = 0; r < NULL_SETS; r++) {
    const fake = fakeDraws(draws.length, 0x1234 + r * 7919);
    const m = walkForward(fake, { from: trainTo, to: validTo, configs, minTrain });
    for (const name of SIGNALS) {
      let best = -Infinity;
      for (const s of SCALES) best = Math.max(best, skill(m[`${name}@${s}`].brierScore));
      if (Number.isFinite(best)) ceiling[name] = Math.max(ceiling[name], best);
    }
  }

  const verdicts = [];
  const weights = {};
  for (const name of SIGNALS) {
    let bestScale = 0;
    let best = -Infinity;
    for (const s of SCALES) {
      const k = skill(val[`${name}@${s}`].brierScore);
      if (k > best) { best = k; bestScale = s; }
    }
    const beatsChance = best > ceiling[name];
    const wins = beatsChance
      ? rolls.filter((r) => skill(r[`${name}@${bestScale}`].brierScore) > 0).length
      : 0;
    const passed = beatsChance && wins === rolls.length;
    const credit = passed ? Math.min(1, (best - ceiling[name]) / FULL_CREDIT) : 0;
    weights[name] = credit * MAX_STAT_WEIGHT;

    verdicts.push({
      name, scale: bestScale, gain: best, chance: ceiling[name], rolls: wins,
      weight: weights[name],
      note: best <= 0 ? '무작위보다 나쁩니다'
        : !beatsChance ? '나아진 정도가 우연 수준을 넘지 못했습니다'
          : wins < rolls.length ? `세 구간 중 ${wins}곳에서만 나아졌습니다 — 한때만 맞은 것입니다`
            : '우연 수준을 넘어 세 구간 모두에서 나아졌습니다',
    });
  }

  // 합에 상한
  let total = SIGNALS.reduce((a, n) => a + weights[n], 0);
  if (total > MAX_STAT_WEIGHT) {
    for (const n of SIGNALS) weights[n] *= MAX_STAT_WEIGHT / total;
    total = MAX_STAT_WEIGHT;
  }

  // ── ablation ── 살아남은 신호를 하나씩 빼서 정말 기여하는지 본다.
  // 빼도 나빠지지 않으면 그 신호는 없는 게 낫다.
  const active = SIGNALS.filter((n) => weights[n] > 0);
  const ablation = [];
  if (active.length) {
    const cfg = { full: { ...weights } };
    for (const n of active) cfg[`-${n}`] = { ...weights, [n]: 0 };
    const m = walkForward(draws, { from: trainTo, to: validTo, configs: cfg, minTrain });
    const fullSkill = skill(m.full.brierScore);
    for (const n of active) {
      const s = skill(m[`-${n}`].brierScore);
      const delta = s - fullSkill;
      ablation.push({ removed: n, skill: s, delta });
      if (delta >= 0) weights[n] = 0; // 빼도 안 나빠짐 → 제거
    }
  }

  const used = SIGNALS.filter((n) => weights[n] > 0);
  const statWeight = SIGNALS.reduce((a, n) => a + weights[n], 0);

  // ── 모델 비교 ── 무작위부터 통계 전체까지 같은 자로 잰다
  const cmpCfg = { 무작위: {} };
  for (const [label, names] of MODEL_STACK) {
    const w = {};
    for (const n of names) w[n] = 0.1; // 비교용 고정 세기
    cmpCfg[label] = w;
  }
  if (used.length) cmpCfg['최종 채택'] = { ...weights };
  const cmpVal = walkForward(draws, { from: trainTo, to: validTo, configs: cmpCfg, minTrain });
  const baseVal = randomBaseline(draws, { from: trainTo, to: validTo, minTrain });
  const comparison = Object.entries(cmpVal).map(([label, m]) => ({
    label,
    averageMatches: m.averageMatches,
    hit3PlusRate: m.hit3PlusRate,
    brierScore: m.brierScore,
    logLoss: m.logLoss,
    skill: skill(m.brierScore),
  }));

  // ── 최종확인 ── 가중치를 다 정한 뒤 딱 한 번만 본다
  const finalCfg = { final: used.length ? { ...weights } : {} };
  const finalTest = walkForward(draws, { from: validTo, to: testTo, configs: finalCfg, minTrain }).final;
  const testBaseline = randomBaseline(draws, { from: validTo, to: testTo, minTrain });

  // ── 안정성 ── 마지막 20/50/100회만 따로
  const rolling = [20, 50, 100].map((w) => {
    const from = Math.max(trainTo, draws.length - w);
    const m = walkForward(draws, { from, to: draws.length, configs: finalCfg, minTrain }).final;
    return {
      window: w,
      sampleSize: m.sampleSize,
      averageMatches: m.averageMatches,
      hit3PlusRate: m.hit3PlusRate,
      skill: skill(m.brierScore),
    };
  });

  return {
    ok: true,
    modelVersion: MODEL_VERSION,
    drawCount: draws.length,
    split,
    weights,
    used,
    statWeight,
    verdicts,
    ablation,
    comparison,
    validationBaseline: baseVal,
    finalTest,
    testBaseline,
    rolling,
    reason: used.length
      ? `${used.join(', ')} 신호가 검사를 통과했습니다.`
      : `${SIGNALS.length}개 신호 모두 무작위를 이기지 못했습니다. 통계는 번호 선택에 쓰지 않습니다.`,
  };
}
