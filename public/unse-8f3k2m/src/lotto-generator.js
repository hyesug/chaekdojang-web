/**
 * lotto-generator.js — 후보를 잔뜩 만들어 놓고 그중에서 고른다
 *
 * 여섯 자리를 하나씩 욕심껏 채우지 않는다. 그렇게 하면 앞에서 고른 번호가
 * 뒤를 가둬서 늘 비슷한 모양이 나온다. 대신 완성된 조합을 수만 개 만들어
 * 통째로 점수 매기고, 상위권에서 씨앗으로 하나를 뽑는다.
 *
 * 최고점 하나를 무조건 고르지도 않는다. 그러면 통계 상태가 같은 사람들이
 * 전부 같은 번호를 받게 된다 — 당첨돼도 나눠 갖는다.
 *
 * 점수는 두 층으로 나눈다.
 *
 *   PredictionScore = 겹침(명반) + 검증 통과한 통계 신호 + 구조 신호
 *   Utility         = PredictionScore − λ × 공동당첨 위험
 *
 * 공동당첨 위험을 PredictionScore 안에 섞지 않는다. 그건 맞힐 확률과 아무
 * 상관이 없고, 당첨된 뒤의 몫에 관한 이야기라서 섞으면 둘 다 흐려진다.
 */
import { POOL, PICK, BASE } from './lotto-statistics.js';
import { featuresOf as comboFeatures, structureScore } from './lotto-combination.js';
import { splitRisk } from './lotto-avoid.js';

/** 공동당첨 위험을 Utility 에서 얼마나 무겁게 볼지 */
export const LAMBDA = 0.15;
/** 만들 후보 수. 45C6 은 814만이라 전수는 못 하고, 이만큼이면 상위 1%가 200개다 */
export const CANDIDATES = 20000;
/** 상위 몇 %에서 뽑을지 */
export const TOP_FRACTION = 0.01;
/**
 * 겹침 신호의 비중.
 *
 * 이건 통계적 주장이 아니다. "여러 체계가 같이 낸 번호를 고른다"는 이 사이트의
 * 선택 원칙 그 자체이고, 화면에서 그렇게 밝히고 있다. 그래서 검증 대상이 아니라
 * 고정값이다. 통계 신호와 달리 예측력을 주장하지 않는다.
 */
export const OVERLAP_WEIGHT = 1.0;

function rng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 후보 조합 하나를 만든다.
 *
 * 균등 무작위가 아니라 **체계가 낸 번호 풀에서** 뽑는다. 이 사이트는 번호마다
 * "어느 체계의 무엇에서 나왔는지"를 밝히는 게 핵심이라, 근거 없는 번호가
 * 섞이면 안 된다. 풀이 여섯 개를 못 채울 만큼 작으면 그때만 균등으로 메운다.
 */
function draw(pool, r) {
  const set = new Set();
  if (pool.length) {
    // 겹침이 많은 번호가 더 자주 뽑히도록 가중 추첨
    const total = pool.reduce((a, c) => a + c.mass, 0);
    let guard = 0;
    while (set.size < PICK && guard++ < 200) {
      let x = r() * total;
      for (const c of pool) { x -= c.mass; if (x <= 0) { set.add(c.n); break; } }
    }
  }
  let guard = 0;
  while (set.size < PICK && guard++ < 500) set.add(1 + Math.floor(r() * POOL));
  return [...set].sort((a, b) => a - b);
}

/**
 * @param {object} o
 * @param {Array}  o.pool          [{ n, mass }] — 체계가 낸 번호와 겹침 몫
 * @param {number[]} o.probabilities 번호별 확률(합 6). 통계 미사용이면 전부 6/45
 * @param {object} o.structure     lotto-combination.buildStructureModel 결과
 * @param {number[]} o.prev, o.prev2  직전·전전 회차 (조합 feature 용)
 * @param {string} o.seed          같은 씨앗이면 늘 같은 결과
 */
export function generate(o) {
  const r = rng(o.seed);
  const massOf = new Map(o.pool.map((c) => [c.n, c.mass]));
  const maxMass = Math.max(1, ...o.pool.map((c) => c.mass));
  const structureWeight = o.structure?.informative ? 0.1 : 0;

  const scored = [];
  const seen = new Set();
  for (let i = 0; i < (o.candidates ?? CANDIDATES); i++) {
    const nums = draw(o.pool, r);
    const key = nums.join(',');
    if (seen.has(key)) continue;
    seen.add(key);

    const f = comboFeatures(nums, o.prev, o.prev2);
    // 겹침 — 이 조합의 번호들이 몇 개 체계에서 나왔나 (0~1 로 정규화)
    const overlap = nums.reduce((a, n) => a + (massOf.get(n) ?? 0), 0) / (PICK * maxMass);
    // 통계 — 균등 대비 몇 배로 봤나
    const stat = nums.reduce((a, n) => a + (o.probabilities[n - 1] / BASE - 1), 0) / PICK;
    const struct = structureScore(f, o.structure);

    const predictionScore = OVERLAP_WEIGHT * overlap + stat + structureWeight * struct;
    const risk = splitRisk(nums);
    scored.push({
      numbers: nums,
      predictionScore,
      overlap,
      statScore: stat,
      structureScore: struct,
      popularityPenalty: risk.score,
      penaltyHits: risk.hits,
      utility: predictionScore - LAMBDA * risk.score,
    });
  }

  scored.sort((a, b) => b.utility - a.utility || a.numbers[0] - b.numbers[0]);
  const topSize = Math.max(20, Math.min(500, Math.floor(scored.length * TOP_FRACTION)));
  const top = scored.slice(0, topSize);

  // 상위권에서 utility 가중 추첨. 결정적이지만 최고점 하나에 고정되지 않는다.
  const min = Math.min(...top.map((c) => c.utility));
  const w = top.map((c) => c.utility - min + 1e-3);
  const sum = w.reduce((a, b) => a + b, 0);
  const pickAt = rng(`${o.seed}#pick`)() * sum;
  let acc = 0;
  let chosen = top[0];
  for (let i = 0; i < top.length; i++) {
    acc += w[i];
    if (acc >= pickAt) { chosen = top[i]; break; }
  }

  return { chosen, poolSize: scored.length, topSize, structureWeight };
}
