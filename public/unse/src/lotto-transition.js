/**
 * lotto-transition.js — 직전 회차가 다음 회차에 남기는 흔적이 있는가
 *
 * 빈도보다 한 단계 위의 질문이다. "13이 자주 나온다"가 아니라
 * "13이 나온 다음 회차에 27이 유독 잘 나온다" 같은 것.
 *
 * 【희소성이 함정이다】 45×45 = 2,025칸인데 회차는 천이백뿐이고, 한 회차가 만드는
 * (i→j) 쌍은 36개다. 칸마다 기대 표본이 20개 남짓이라 아무 데이터에서나
 * "유독 잘 나오는 조합"이 보인다. 그래서 두 겹으로 막는다.
 *   1. Laplace smoothing — 가상 관측을 섞어 균등 쪽으로 끌어당긴다
 *   2. 최소 표본 threshold — 표본이 모자란 행은 아예 균등으로 되돌린다
 * 그러고도 남는 신호만 백테스트로 보낸다.
 */
import { POOL, PICK, BASE, normalize } from './lotto-statistics.js';

/** 이 수보다 적게 관측된 행은 신호로 쓰지 않는다 */
export const MIN_ROW_SAMPLES = 30;
/** 가상 관측 수. 클수록 균등 쪽으로 강하게 수축한다 */
export const SMOOTHING = 20;

/**
 * P(j가 t회차에 등장 | i가 t-1회차에 등장).
 * 1-indexed 로 쓴다. p[i][j].
 */
export function buildTransition(history) {
  const co = Array.from({ length: POOL + 1 }, () => new Array(POOL + 1).fill(0));
  const rowCount = new Array(POOL + 1).fill(0);

  for (let t = 1; t < history.length; t++) {
    for (const i of history[t - 1]) {
      rowCount[i]++;
      for (const j of history[t]) co[i][j]++;
    }
  }

  const p = Array.from({ length: POOL + 1 }, () => new Array(POOL + 1).fill(BASE));
  for (let i = 1; i <= POOL; i++) {
    const n = rowCount[i];
    if (n < MIN_ROW_SAMPLES) continue; // 표본 부족 → 균등 유지(신호 없음)
    for (let j = 1; j <= POOL; j++) {
      p[i][j] = (co[i][j] + SMOOTHING * BASE) / (n + SMOOTHING);
    }
  }
  return { p, rowCount };
}

/**
 * follower 신호 — 직전 회차 여섯 개에서 본 조건부 확률의 평균이
 * 균등에서 얼마나 벗어나는가. 신호가 없으면 0 벡터가 된다.
 */
export function followerSignal(history) {
  const out = new Array(POOL).fill(0);
  if (history.length < 2) return out;
  const { p } = buildTransition(history);
  const prev = history[history.length - 1];
  for (let j = 1; j <= POOL; j++) {
    let s = 0;
    for (const i of prev) s += p[i][j];
    out[j - 1] = s / prev.length - BASE;
  }
  return normalize(out);
}

/* ── 이월(carry) ── */

/** 이월 개수를 상태로. 균등 가정의 기대 이월은 6×6/45 = 0.8개다 */
export function carryState(k) {
  if (k <= 0) return 'LOW_REPEAT';
  if (k >= 2) return 'HIGH_REPEAT';
  return 'NORMAL_REPEAT';
}

/**
 * 직전 회차 여섯 개 중 몇 개가 다음 회차에 다시 나오는가.
 * 전체 분포뿐 아니라 **직전 이월 상태별로도** 나눠 센다 —
 * "많이 이월된 다음에는 적게 이월된다" 같은 말이 사실인지 보려는 것이다.
 */
export function carryStats(history) {
  const dist = new Array(PICK + 1).fill(0);
  const sum = { LOW_REPEAT: 0, NORMAL_REPEAT: 0, HIGH_REPEAT: 0 };
  const cnt = { LOW_REPEAT: 0, NORMAL_REPEAT: 0, HIGH_REPEAT: 0 };

  const overlaps = [];
  for (let t = 1; t < history.length; t++) {
    const prev = new Set(history[t - 1]);
    const k = history[t].filter((n) => prev.has(n)).length;
    overlaps.push(k);
    dist[k]++;
  }
  for (let t = 1; t < overlaps.length; t++) {
    const s = carryState(overlaps[t - 1]);
    sum[s] += overlaps[t];
    cnt[s]++;
  }

  const total = overlaps.reduce((a, b) => a + b, 0);
  return {
    dist,                                   // 0,1,2,…,6 개 이월이 각각 몇 회였나
    samples: overlaps.length,
    mean: overlaps.length ? total / overlaps.length : PICK * BASE,
    byPrevState: {
      LOW_REPEAT: cnt.LOW_REPEAT ? sum.LOW_REPEAT / cnt.LOW_REPEAT : null,
      NORMAL_REPEAT: cnt.NORMAL_REPEAT ? sum.NORMAL_REPEAT / cnt.NORMAL_REPEAT : null,
      HIGH_REPEAT: cnt.HIGH_REPEAT ? sum.HIGH_REPEAT / cnt.HIGH_REPEAT : null,
    },
    stateCounts: cnt,
  };
}

/**
 * 이월 신호 — 지금 상태에서 기대되는 이월량이 균등 기대(0.8개)보다 크면
 * 직전 회차 번호에 (+), 작으면 (−). 상태별 표본이 모자라면 전체 평균을 쓴다.
 */
export function carrySignal(history) {
  const out = new Array(POOL).fill(0);
  if (history.length < 3) return out;

  const stats = carryStats(history);
  const a = new Set(history[history.length - 2]);
  const lastOverlap = history[history.length - 1].filter((n) => a.has(n)).length;
  const st = carryState(lastOverlap);

  const expected = stats.stateCounts[st] >= MIN_ROW_SAMPLES
    ? stats.byPrevState[st]
    : stats.mean;
  const delta = (expected - PICK * BASE) / PICK;

  const prev = new Set(history[history.length - 1]);
  for (let n = 1; n <= POOL; n++) {
    // 합이 0이 되도록 나머지 번호에 반대 부호를 나눠 준다
    out[n - 1] = prev.has(n) ? delta : -delta * (PICK / (POOL - PICK));
  }
  return normalize(out);
}

/**
 * N-2 신호 — 두 회차 전 번호가 다시 나오는 경향.
 * follower 와 같은 논리를 한 칸 더 과거에 적용한다.
 */
export function lag2Signal(history) {
  const out = new Array(POOL).fill(0);
  if (history.length < 4) return out;

  let hit = 0;
  let samples = 0;
  for (let t = 2; t < history.length; t++) {
    const back2 = new Set(history[t - 2]);
    hit += history[t].filter((n) => back2.has(n)).length;
    samples++;
  }
  if (samples < MIN_ROW_SAMPLES) return out;

  const delta = hit / (samples * PICK) - BASE;
  const back2 = new Set(history[history.length - 2]);
  for (let n = 1; n <= POOL; n++) {
    out[n - 1] = back2.has(n) ? delta : -delta * (PICK / (POOL - PICK));
  }
  return normalize(out);
}
