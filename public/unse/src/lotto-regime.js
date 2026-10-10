/**
 * lotto-regime.js — 지금 추첨이 어떤 '상태'에 들어가 있나
 *
 * "요즘 저번호가 많이 나온다" 같은 말을 검사 가능한 형태로 바꾼 것이다.
 * HMM 같은 걸 쓰지 않는다. 최근 5/10/20회만 보고 세 축으로 굵게 나눈다.
 *
 * 상태를 나누는 것 자체는 쉽다. 어려운 건 **그 상태에서 다음 회차가 실제로
 * 달라지는가** 이고, 그건 여기서 판단하지 않는다. lotto-backtest.js 가
 * walk-forward 로 재고, 달라지지 않으면 가중치가 0이 된다.
 */
import { POOL, PICK, BASE, normalize } from './lotto-statistics.js';
import { carryState } from './lotto-transition.js';

/** 상태를 판정하려면 이만큼은 쌓여야 한다 */
const MIN_HISTORY = 20;
/** 상태별 조건부 통계를 믿으려면 이만큼의 관측이 필요하다 */
export const MIN_STATE_SAMPLES = 40;

/**
 * 빈도 상태 — 최근 20회에서 "두 번 이상 나온 번호"의 비율.
 * 특정 번호에 몰리면 HOT, 고르게 퍼지면 COLD. 기준은 이항분포 기대값이다.
 */
export function frequencyRegime(window) {
  if (window.length < 5) return 'NEUTRAL';
  const count = new Array(POOL + 1).fill(0);
  for (const d of window) for (const n of d) count[n]++;
  const repeated = count.slice(1).filter((c) => c >= 2).length / POOL;

  const k = window.length;
  const p = BASE;
  // P(X>=2), X~Bin(k, 6/45)
  const expected = 1 - (1 - p) ** k - k * p * (1 - p) ** (k - 1);
  if (repeated > expected * 1.15) return 'HOT';
  if (repeated < expected * 0.85) return 'COLD';
  return 'NEUTRAL';
}

/** 구간 상태 — 최근 10회에서 1~22 가 차지한 비율 (균등 기대 22/45 ≈ 0.489) */
export function rangeRegime(window) {
  let low = 0;
  let total = 0;
  for (const d of window) for (const n of d) { if (n <= 22) low++; total++; }
  if (!total) return 'BALANCED';
  const share = low / total;
  if (share > 0.60) return 'LOW_HEAVY';
  if (share < 0.39) return 'HIGH_HEAVY';
  return 'BALANCED';
}

/** 이월 상태 — 최근 10회의 평균 이월 개수 (균등 기대 0.8) */
export function repeatRegime(window) {
  if (window.length < 2) return 'NORMAL_REPEAT';
  let sum = 0;
  let n = 0;
  for (let i = 1; i < window.length; i++) {
    const prev = new Set(window[i - 1]);
    sum += window[i].filter((x) => prev.has(x)).length;
    n++;
  }
  return carryState(n ? Math.round(sum / n) : 1);
}

/** 지금 상태 세 축 */
export function classify(history) {
  if (history.length < MIN_HISTORY) {
    return { frequency: 'NEUTRAL', range: 'BALANCED', repeat: 'NORMAL_REPEAT' };
  }
  return {
    frequency: frequencyRegime(history.slice(-20)),
    range: rangeRegime(history.slice(-10)),
    repeat: repeatRegime(history.slice(-10)),
  };
}

/**
 * 구간 상태 신호.
 *
 * 학습 구간에서 "지금과 같은 구간 상태였을 때 다음 회차의 저구간 비율"을 모아,
 * 그 편중만큼 저/고 번호에 나눠 준다. 표본이 모자라면 0(미사용).
 *
 * 세 축 중 구간만 신호로 만드는 이유: 구간은 번호를 직접 가르는 축이라
 * 상태→번호 매핑이 자명하다. 빈도·이월 축은 이미 recency·carry 신호가
 * 담당하므로 같은 것을 두 번 세지 않는다(복잡성을 위한 복잡성 금지).
 */
export function regimeSignal(history) {
  const out = new Array(POOL).fill(0);
  if (history.length < MIN_HISTORY + 10) return out;

  const cur = classify(history).range;
  let lowShareSum = 0;
  let samples = 0;
  for (let t = MIN_HISTORY; t < history.length; t++) {
    if (rangeRegime(history.slice(Math.max(0, t - 10), t)) !== cur) continue;
    lowShareSum += history[t].filter((n) => n <= 22).length / PICK;
    samples++;
  }
  if (samples < MIN_STATE_SAMPLES) return out;

  const delta = lowShareSum / samples - 22 / POOL;
  for (let n = 1; n <= POOL; n++) out[n - 1] = n <= 22 ? delta : -delta * (22 / 23);
  return normalize(out);
}

/**
 * 상태별로 다음 회차가 실제로 달라졌는지 표로 낸다. 화면과 보고서용.
 * 값이 서로 비슷하면 "상태는 아무 말도 해주지 않는다"는 뜻이다.
 */
export function regimeTable(history) {
  const rows = { LOW_HEAVY: [], BALANCED: [], HIGH_HEAVY: [] };
  for (let t = MIN_HISTORY; t < history.length; t++) {
    const st = rangeRegime(history.slice(Math.max(0, t - 10), t));
    rows[st].push(history[t].filter((n) => n <= 22).length / PICK);
  }
  const out = {};
  for (const [st, xs] of Object.entries(rows)) {
    out[st] = {
      samples: xs.length,
      lowShare: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null,
    };
  }
  out._uniform = 22 / POOL;
  return out;
}
