/**
 * lotto-avoid.js — 남과 겹치는 번호 피하기
 *
 * 이건 당첨 확률과 아무 상관이 없다. 어떤 조합이든 당첨 확률은 똑같다.
 * 다만 당첨됐을 때 **나눠 갖는 사람 수**는 조합마다 다르다.
 * 1등이 한 명이면 전액, 열 명이면 십분의 일이다.
 *
 * 사람들이 유독 많이 고르는 모양이 있다. 생일로 만든 번호, 용지에 줄을 그은
 * 번호, 1-2-3-4-5-6 같은 것. 그런 번호로 당첨되면 같이 당첨된 사람이 많다.
 * 그래서 번호를 고를 때 그런 모양만 살짝 피한다.
 *
 * ⚠️ 여기 규칙은 전부 **추정**이다. 어떤 조합을 몇 명이 샀는지는 공개되지 않아
 * 검증할 방법이 없다. 그래서 "7이 인기 숫자" 같은 개별 숫자 선호는 넣지 않았다.
 * 넣은 것은 구조적으로 눈에 띄는 모양 — 생일 범위, 연속수, 등차수열,
 * 용지 위의 직선, 같은 끝자리, 대칭 — 뿐이다. 이건 "사람이 고르기 쉬운 모양"
 * 이라는 점에서 그나마 근거가 분명하다.
 */

/**
 * 로또 용지는 7칸씩 일곱 줄이다(마지막 줄은 43~45).
 * 세로줄·가로줄·대각선으로 찍는 사람이 많아서 자리를 알아야 한다.
 */
function cell(n) {
  return { row: Math.floor((n - 1) / 7), col: (n - 1) % 7 };
}

/**
 * 여섯 개 조합이 얼마나 '흔한 모양'인지. 0이면 평범, 1에 가까울수록 눈에 띈다.
 * 각 항목이 왜 걸렸는지도 함께 돌려준다 — 화면에서 이유를 보여주기 위해서다.
 */
export function splitRisk(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const hits = [];
  let score = 0;
  const flag = (w, why) => { score += w; hits.push(why); };

  // 생일 — 달력에 있는 숫자만 쓴 조합. 가장 흔한 모양이다.
  if (s.every((n) => n <= 31)) flag(0.25, '여섯 개가 모두 31 이하 — 생일로 고른 번호와 겹치기 쉽습니다');

  // 연속수
  let run = 0;
  for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] === 1) run++;
  if (run === s.length - 1) flag(0.30, '여섯 개가 모두 연속된 숫자입니다');

  // 등차수열 — 3, 8, 13, 18… 처럼 일정한 간격
  const step = s[1] - s[0];
  if (step > 0 && s.every((n, i) => i === 0 || n - s[i - 1] === step)) {
    flag(0.25, `${step}씩 일정하게 커지는 배열입니다`);
  }

  // 용지 위의 직선
  const cs = s.map(cell);
  const sameCol = new Set(cs.map((c) => c.col)).size === 1;
  const sameRow = new Set(cs.map((c) => c.row)).size === 1;
  const byRow = [...cs].sort((a, b) => a.row - b.row);
  const diag = (d) => byRow.every((c, i) => i === 0 ||
    (c.row - byRow[i - 1].row === 1 && (c.col - byRow[i - 1].col) === d));
  if (sameCol) flag(0.30, '용지에서 한 세로줄을 그은 모양입니다');
  else if (sameRow) flag(0.30, '용지에서 한 가로줄을 그은 모양입니다');
  else if (diag(1) || diag(-1)) flag(0.30, '용지에서 대각선을 그은 모양입니다');

  // 같은 끝자리
  const tails = new Map();
  for (const n of s) tails.set(n % 10, (tails.get(n % 10) ?? 0) + 1);
  const maxTail = Math.max(...tails.values());
  if (maxTail >= 4) flag(0.15, `끝자리가 같은 숫자가 ${maxTail}개입니다`);

  // 대칭 — 전부 (n, 46-n) 짝으로 맞물린 조합
  const set = new Set(s);
  if (s.every((n) => set.has(46 - n))) flag(0.15, '가운데를 기준으로 짝이 맞는 대칭 조합입니다');

  // 한 십의 자리에 몰림
  const dec = new Map();
  for (const n of s) dec.set(Math.floor(n / 10), (dec.get(Math.floor(n / 10)) ?? 0) + 1);
  if (Math.max(...dec.values()) >= 4) flag(0.10, '같은 십의 자리에 네 개 이상 몰려 있습니다');

  return { score: Math.min(1, score), hits };
}

/**
 * 뽑힌 여섯 개가 너무 흔한 모양이면, 후보 안에서 한 자리만 바꿔 본다.
 *
 * 번호를 통째로 다시 뽑지 않는 이유: 이 사이트의 번호는 "여러 체계가 겹쳐서
 * 낸 것"이라는 근거가 핵심이다. 그 근거를 버리면서까지 모양을 고칠 이유는 없다.
 * 그래서 겹침이 가장 약한 자리 하나만, 그것도 모양이 실제로 나아질 때만 바꾼다.
 *
 * @param {Array} picked  drawGame 이 고른 여섯 개
 * @param {Array} pool    쓰지 않은 후보들
 * @returns {{numbers: Array, before: object, after: object, swapped: object|null}}
 */
export function relaxShape(picked, pool) {
  const before = splitRisk(picked.map((x) => x.n));
  if (before.score < 0.25) return { numbers: picked, before, after: before, swapped: null };

  const used = new Set(picked.map((x) => x.n));
  // 겹침이 가장 약한 자리부터 후보로 삼는다 — 근거가 가장 얇은 번호다.
  const weakest = [...picked].sort((a, b) => a.overlap - b.overlap)[0];

  let best = null;
  for (const c of pool) {
    if (used.has(c.n)) continue;
    const trial = picked.map((x) => (x.n === weakest.n ? { ...x, n: c.n, overlap: c.overlap ?? 1, system: c.system, why: c.why } : x));
    const after = splitRisk(trial.map((x) => x.n));
    if (after.score < before.score && (!best || after.score < best.after.score)) {
      best = { trial, after, from: weakest.n, to: c.n };
    }
  }
  if (!best) return { numbers: picked, before, after: before, swapped: null };

  return {
    numbers: best.trial.sort((a, b) => a.n - b.n),
    before,
    after: best.after,
    swapped: { from: best.from, to: best.to },
  };
}
