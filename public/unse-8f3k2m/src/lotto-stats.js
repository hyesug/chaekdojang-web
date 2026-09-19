/**
 * lotto-stats.js — 과거 회차에 정말 쓸 만한 편향이 있는지 검증한다
 *
 * lotto.js 가 "로또는 예측되지 않는다"고 말한다. 이 파일은 그 말을 **확인**한다.
 * 믿어달라고 하는 대신 과거 회차로 직접 재어 보고, 그 결과를 숫자로 내놓는다.
 *
 * 흔히 파는 "핫 넘버", "이월수", "패턴 분석" 같은 것들을 그대로 구현해 두고
 * 각각이 무작위로 찍는 것보다 나은지 검사한다. 거의 확실히 나오는 답은 "아니다"다.
 * 그 답이 나오면 신호의 가중치가 0이 되고, 번호는 지금처럼 명반 겹침으로만 고른다.
 *
 * 만약 어떤 신호가 검사를 통과한다면 그때만 쓴다. 통과 기준은 아래 세 가지다.
 *
 *   1. 과거를 맞히는 게 아니라 **아직 안 본 회차**를 맞혀야 한다 (walk-forward)
 *   2. 공정한 추첨을 흉내 낸 가짜 데이터에 같은 절차를 돌려서 나오는
 *      **우연 수준을 넘어야** 한다 (널 보정)
 *   3. 한 구간이 아니라 **여러 구간에서 계속** 나아야 한다
 *
 * 2번이 중요하다. 신호 다섯 개 × 세기 네 단계 중 제일 좋은 걸 고르면,
 * 완전한 잡음에서도 "조금 나아 보이는 것"이 반드시 하나는 나온다.
 * 그래서 가짜 데이터에도 똑같이 골라 보고, 그보다 나을 때만 인정한다.
 */

const POOL = 45;
const PICK = 6;
/** 균등 추첨에서 번호 하나가 뽑힐 확률 */
const BASE = PICK / POOL;

/** 이만큼은 쌓여야 학습을 시작한다 */
export const MIN_TRAIN = 300;
/** 신호를 쓰더라도 이 이상은 싣지 않는다. 나머지는 명반과 무작위 몫이다. */
export const MAX_WEIGHT = 0.7;
/** 가짜 데이터를 몇 벌 만들어 우연 수준을 잴지 */
const NULL_SETS = 6;
/** 신호 세기 후보 */
const SCALES = [0.05, 0.1, 0.2, 0.4];
/** 이만큼 좋아지면 신뢰도 100%로 본다 */
const FULL_CREDIT = 0.01;

export const SIGNALS = ['빈도', '최근', '간격', '이월', '구간'];

// ─────────────────────────────────────────────────────────────
// 번호마다 재는 것들
// ─────────────────────────────────────────────────────────────

/** 최근 k회에서 번호 n이 나온 비율. 관측이 없으면 균등값 */
function rate(history, n, k) {
  const obs = Math.min(k, history.length);
  if (!obs) return BASE;
  let c = 0;
  for (let i = history.length - obs; i < history.length; i++) {
    if (history[i].includes(n)) c++;
  }
  return c / obs;
}

/** 평균을 0, 표준편차를 1로 맞춘다. 전부 같은 값이면 0으로 */
function normalize(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  return sd ? xs.map((x) => (x - m) / sd) : xs.map(() => 0);
}

/**
 * 번호 1~45의 신호 다섯 가지.
 * history 는 **예측하려는 회차보다 앞선 것만** 담겨 있어야 한다.
 */
export function signalsOf(history) {
  const len = history.length;
  const prev = len ? history[len - 1] : [];
  const prev2 = len > 1 ? history[len - 2] : [];

  const all = [], recent = [], gapRatio = [], carry = [], zone = [];

  for (let n = 1; n <= POOL; n++) {
    // 나온 자리들 — 간격을 재려면 필요하다
    const at = [];
    for (let i = 0; i < len; i++) if (history[i].includes(n)) at.push(i);

    const gaps = [];
    for (let i = 1; i < at.length; i++) gaps.push(at[i] - at[i - 1]);
    const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : POOL / PICK;
    const since = at.length ? len - 1 - at[at.length - 1] : len;

    all.push((len ? at.length / len : BASE) - BASE);            // 빈도 — 장기 편차
    recent.push(rate(history, n, 20) - (len ? at.length / len : BASE)); // 최근 — 과열/냉각
    gapRatio.push(meanGap > 0 ? since / meanGap : 0);            // 간격 — 쉰 지 얼마나 됐나
    carry.push(prev.includes(n) ? 1 : (prev2.includes(n) ? 0.5 : 0)); // 이월 — 직전/전전 회차
    zone.push(n <= 22 ? 1 : -1);                                 // 구간 — 저/고
  }

  // 구간 신호는 최근 열 회의 저구간 쏠림만큼만 세운다
  let lowShare = 0;
  const w = history.slice(-10);
  for (const d of w) lowShare += d.filter((n) => n <= 22).length / PICK;
  const tilt = w.length ? lowShare / w.length - 22 / POOL : 0;

  return {
    빈도: normalize(all),
    최근: normalize(recent),
    간격: normalize(gapRatio),
    이월: normalize(carry),
    구간: zone.map((z) => z * tilt * 10),
  };
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

// ─────────────────────────────────────────────────────────────
// 채점
// ─────────────────────────────────────────────────────────────

/**
 * Brier 점수 — 확률을 매긴 것이 실제와 얼마나 가까웠나. 낮을수록 좋다.
 * 여섯 개를 맞혔나만 보면 운에 너무 흔들려서, 45개 전부의 확률을 채점한다.
 */
function brier(p, actual) {
  let s = 0;
  for (let i = 0; i < POOL; i++) {
    const y = actual.includes(i + 1) ? 1 : 0;
    s += (p[i] - y) ** 2;
  }
  return s / POOL;
}

/** 균등하게 찍었을 때의 Brier — 비교 기준 */
const BASE_BRIER = (PICK * (BASE - 1) ** 2 + (POOL - PICK) * BASE ** 2) / POOL;

/** 기준보다 얼마나 나아졌나. 0이면 같고, 음수면 더 나쁘다 */
const skill = (score) => 1 - score / BASE_BRIER;

/**
 * 시간 순서대로 한 회차씩 앞으로 가며 채점한다.
 * t 회차를 예측할 때 t 이후는 절대 보지 않는다 — 이게 이 검사의 전부다.
 */
function walkForward(draws, from, to, configs) {
  const acc = {};
  for (const k of Object.keys(configs)) acc[k] = 0;
  let n = 0;

  for (let t = Math.max(MIN_TRAIN, from); t < Math.min(to, draws.length); t++) {
    const history = draws.slice(Math.max(0, t - 600), t);
    if (history.length < MIN_TRAIN) continue;
    const sig = signalsOf(history);
    for (const [k, w] of Object.entries(configs)) {
      acc[k] += brier(probabilities(sig, w), draws[t]);
    }
    n++;
  }
  const out = {};
  for (const k of Object.keys(configs)) out[k] = n ? acc[k] / n : BASE_BRIER;
  out._n = n;
  return out;
}

/** 공정한 추첨을 흉내 낸 가짜 회차 — 우연 수준을 재는 데 쓴다 */
function fakeDraws(count, seed) {
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
    while (s.size < PICK) s.add(1 + Math.floor(rnd() * POOL));
    out.push([...s].sort((x, y) => x - y));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 검증
// ─────────────────────────────────────────────────────────────

/**
 * 신호 다섯 개를 각각 검사해 쓸 수 있는지 판정한다.
 * 무겁다(회차 천 개면 수십 초). 브라우저에서 부르지 말고 스크립트로 미리 돌린 뒤
 * 결과만 data/lotto-model.js 에 넣는다.
 *
 * @param {number[][]} draws  회차별 당첨번호 6개, 오래된 것부터
 */
export function verifySignals(draws) {
  if (!Array.isArray(draws) || draws.length < MIN_TRAIN + 60) {
    return {
      ok: false,
      reason: `회차가 ${draws?.length ?? 0}개뿐입니다. 검증하려면 최소 ${MIN_TRAIN + 60}개가 필요합니다.`,
      weights: {}, verdicts: [], drawCount: draws?.length ?? 0,
    };
  }

  // 시간 순으로 학습 / 검증 / 최종확인 구간을 나눈다.
  // 최종확인 구간은 가중치를 다 정한 뒤에 딱 한 번만 본다.
  const trainTo = Math.max(MIN_TRAIN, Math.floor(draws.length * 0.6));
  const validTo = Math.max(trainTo + 1, Math.floor(draws.length * 0.8));

  const configs = {};
  for (const name of SIGNALS) for (const s of SCALES) configs[`${name}@${s}`] = { [name]: s };

  const val = walkForward(draws, trainTo, validTo, configs);

  // 검증 구간을 셋으로 쪼개 "계속 나아지는지" 본다
  const step = Math.max(1, Math.floor((validTo - trainTo) / 3));
  const rolls = [
    walkForward(draws, trainTo, trainTo + step, configs),
    walkForward(draws, trainTo + step, trainTo + 2 * step, configs),
    walkForward(draws, trainTo + 2 * step, validTo, configs),
  ];

  // 우연 수준 — 가짜 데이터에 똑같은 절차를 돌린다
  const ceiling = Object.fromEntries(SIGNALS.map((n) => [n, 0]));
  for (let r = 0; r < NULL_SETS; r++) {
    const fake = fakeDraws(draws.length, 0x1234 + r * 7919);
    const m = walkForward(fake, trainTo, validTo, configs);
    for (const name of SIGNALS) {
      let best = -Infinity;
      for (const s of SCALES) best = Math.max(best, skill(m[`${name}@${s}`]));
      if (Number.isFinite(best)) ceiling[name] = Math.max(ceiling[name], best);
    }
  }

  const verdicts = [];
  const weights = {};
  for (const name of SIGNALS) {
    let bestScale = 0, best = -Infinity;
    for (const s of SCALES) {
      const k = skill(val[`${name}@${s}`]);
      if (k > best) { best = k; bestScale = s; }
    }
    const beatsChance = best > ceiling[name];
    const wins = beatsChance
      ? rolls.filter((r) => skill(r[`${name}@${bestScale}`]) > 0).length
      : 0;
    const passed = beatsChance && wins === 3;
    // 우연 수준을 넘은 만큼만 실력으로 친다
    const credit = passed ? Math.min(1, (best - ceiling[name]) / FULL_CREDIT) : 0;
    weights[name] = credit * MAX_WEIGHT;

    verdicts.push({
      name, scale: bestScale, gain: best, chance: ceiling[name], rolls: wins,
      weight: weights[name],
      note: best <= 0 ? '무작위보다 나쁩니다'
        : !beatsChance ? '나아진 정도가 우연 수준을 넘지 못했습니다'
          : wins < 3 ? `세 구간 중 ${wins}곳에서만 나아졌습니다 — 한때만 맞은 것입니다`
            : `우연 수준을 넘어 세 구간 모두에서 나아졌습니다`,
    });
  }

  // 가중치 합에 상한을 씌운다
  const total = SIGNALS.reduce((a, n) => a + weights[n], 0);
  if (total > MAX_WEIGHT) for (const n of SIGNALS) weights[n] *= MAX_WEIGHT / total;

  const used = SIGNALS.filter((n) => weights[n] > 0);
  return {
    ok: true,
    drawCount: draws.length,
    split: { trainTo, validTo, testTo: draws.length },
    weights,
    verdicts,
    used,
    statWeight: SIGNALS.reduce((a, n) => a + weights[n], 0),
    reason: used.length
      ? `${used.join(', ')} 신호가 검사를 통과했습니다.`
      : '다섯 신호 모두 무작위를 이기지 못했습니다. 통계는 번호 선택에 쓰지 않습니다.',
  };
}
