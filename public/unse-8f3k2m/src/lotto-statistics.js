/**
 * lotto-statistics.js — 번호 1~45 마다 재는 것들
 *
 * 여기서는 재기만 한다. "많이 나온 번호가 또 나온다" 같은 규칙을 박아 넣지 않는다.
 * 어느 feature 가 쓸 만한지는 lotto-backtest.js 가 정하고, 못 쓴다고 판정되면
 * 가중치가 0이 되어 번호 선택에 관여하지 못한다.
 *
 * 【미래를 보지 않는다】 모든 함수는 인자로 받은 history 만 본다. 예측하려는 회차
 * 이후가 섞여 들어가면 검증이 통째로 거짓이 되므로, 호출하는 쪽이 자르는 책임을 지고
 * assertNoFuture() 로 확인할 수 있게 했다.
 */

export const POOL = 45;
export const PICK = 6;
/** 균등 추첨에서 번호 하나가 뽑힐 확률 */
export const BASE = PICK / POOL;

/** history 에 목표 회차 이후가 섞이지 않았는지. 섞였으면 던진다. */
export function assertNoFuture(history, targetIndex) {
  if (history.length > targetIndex) {
    throw new Error(`data leakage: history ${history.length}개가 목표 인덱스 ${targetIndex} 를 넘었습니다`);
  }
}

/** 최근 k회에서 번호 n이 나온 비율. 관측이 없으면 균등값 */
export function rate(history, n, k) {
  const obs = Math.min(k, history.length);
  if (!obs) return BASE;
  let c = 0;
  for (let i = history.length - obs; i < history.length; i++) {
    if (history[i].includes(n)) c++;
  }
  return c / obs;
}

/**
 * 번호별 원시 feature. 신호로 바꾸기 전 단계이고, 화면 설명에도 쓸 수 있다.
 * 프롬프트가 요구한 열세 가지를 그대로 담는다.
 */
export function featuresOf(history) {
  const len = history.length;
  const prev = len ? history[len - 1] : [];
  const prev2 = len > 1 ? history[len - 2] : [];
  const out = [];

  for (let n = 1; n <= POOL; n++) {
    // 나온 자리들 — 간격을 재려면 필요하다
    const at = [];
    for (let i = 0; i < len; i++) if (history[i].includes(n)) at.push(i);

    const gaps = [];
    for (let i = 1; i < at.length; i++) gaps.push(at[i] - at[i - 1]);

    const freqAll = len ? at.length / len : BASE;
    const freq20 = rate(history, n, 20);
    const freq100 = rate(history, n, 100);

    out.push({
      n,
      freqAll,                                   // 전체 누적 출현빈도
      freq10: rate(history, n, 10),
      freq20,
      freq50: rate(history, n, 50),
      freq100,
      freq300: rate(history, n, 300),
      deviation: rate(history, n, 50) - freqAll, // 장기 평균 대비 최근 출현률
      sinceLast: at.length ? len - 1 - at[at.length - 1] : len, // 마지막 출현 이후 경과
      meanGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : POOL / PICK,
      lastGap: gaps.length ? gaps[gaps.length - 1] : POOL / PICK,
      inPrev: prev.includes(n) ? 1 : 0,          // 직전 회차 포함
      inPrev2: prev2.includes(n) ? 1 : 0,        // N-2 회차 포함
      trend: freq20 - freq100,                   // 최근 추세 변화량
    });
  }
  return out;
}

/** 평균 0, 표준편차 1로 맞춘다. 전부 같은 값이면 0으로 */
export function normalize(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  return sd ? xs.map((x) => (x - m) / sd) : xs.map(() => 0);
}

/* ── feature 를 신호로 ──
 * 방향을 미리 정하지 않는다. 편차를 그대로 내고, 그 편차가 쓸모 있는지는
 * 백테스트가 판정한다. 부호가 반대로 유용하다면 가중치 탐색에서 걸러진다. */

/** 빈도 — 장기 출현률이 균등에서 얼마나 벗어났나 */
export const frequencySignal = (f) => normalize(f.map((x) => x.freqAll - BASE));

/** 최근 — 최근 20회가 장기 평균보다 뜨거운가 차가운가 */
export const recencySignal = (f) => normalize(f.map((x) => x.freq20 - x.freqAll));

/** 간격 — 평균 재출현 간격 대비 지금 얼마나 쉬었나 */
export const intervalSignal = (f) => normalize(f.map((x) => (x.meanGap > 0 ? x.sinceLast / x.meanGap : 0)));

/** 추세 — 최근 20회와 100회의 출현률 차이 */
export const trendSignal = (f) => normalize(f.map((x) => x.trend));
