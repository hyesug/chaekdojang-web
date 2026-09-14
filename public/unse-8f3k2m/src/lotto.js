/**
 * lotto.js — 명반에서 로또 번호 뽑기
 *
 * 먼저 분명히 해둘 것: 로또는 어떤 방법으로도 예측되지 않는다.
 * 매 회차가 독립 시행이라 지난 회차 통계도, 명반도, 그 무엇도
 * 다음 추첨에 대해 아무것도 말해주지 않는다.
 *
 * 그래서 이건 "맞히는 방법"이 아니라 "고르는 방법"이다.
 * 아무 번호나 찍는 대신 자기 명반에서 나온 번호로 고르는 것 —
 * 딱 그만큼의 의미다. 대신 그 대신을 제대로 한다:
 * 번호마다 어느 체계의 무엇에서 나왔는지를 전부 밝힌다.
 *
 * 두 가지를 낸다.
 *   평생 번호 — 명반만으로 뽑는다. 평생 바뀌지 않는다.
 *   이번 주 번호 — 명반에 회차를 섞는다. 회차마다 바뀌고, 같은 회차에는 늘 같다.
 *
 * 회차는 바깥에서 받아오지 않고 날짜로 계산한다.
 * 1회차 추첨이 2002년 12월 7일 토요일 저녁이고 그 뒤로 매주 토요일이다.
 */

import { sexagenaryIndex, STEMS_KR, BRANCHES_KR, ELEMENTS, STEM_ELEMENT } from './core/ganzhi.js';
import { planetPositions } from './core/planets.js';
import { nakshatraOf } from './systems/sukyo.js';
import { starOfYear } from './systems/gujeong.js';
import { hexOf } from './systems/juyeok.js';
import { modFrom1, digitRoot, weekdayFromJDN, WEEKDAY_KR } from './systems/_base.js';
import { toJDN } from './core/astro.js';

// ─────────────────────────────────────────────────────────────
// 회차
// ─────────────────────────────────────────────────────────────

/** 1회차 추첨 순간 — 2002-12-07(토) 20:45 KST */
const FIRST_DRAW = Date.UTC(2002, 11, 7, 11, 45);
const WEEK = 7 * 86400000;

/**
 * 지금 사려는 회차. 아직 추첨하지 않은 가장 빠른 회차다.
 *
 * 토요일 0시가 아니라 추첨이 끝나는 순간에 넘어가야 한다.
 * 토요일 낮에 보러 온 사람은 그날 밤 추첨분을 사려는 것이기 때문이다.
 */
export function currentRound(now = Date.now()) {
  const t = now instanceof Date ? now.getTime() : now;
  const done = Math.floor((t - FIRST_DRAW) / WEEK) + 1;
  const round = Math.max(1, done + 1);
  return { round, drawAt: new Date(FIRST_DRAW + (round - 1) * WEEK) };
}

/** 추첨일을 한국 시각으로 읽기 좋게 */
export function formatDraw(d) {
  const k = new Date(d.getTime() + 9 * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  const wd = ['일', '월', '화', '수', '목', '금', '토'][k.getUTCDay()];
  return `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 (${wd}) ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}

// ─────────────────────────────────────────────────────────────
// 체계마다 숫자 하나씩
// ─────────────────────────────────────────────────────────────

/** 제 범위 안의 값을 1~45로 고르게 펼친다 */
const spread = (raw, max) =>
  Math.min(45, Math.max(1, Math.floor(((raw - 1) % max) / max * 45) + 1));

/**
 * 열다섯 체계에서 후보 숫자를 하나씩 뽑는다.
 * 각 항목은 어디서 나온 숫자인지를 함께 들고 다닌다.
 */
function candidates(input, chart) {
  const out = [];
  const add = (system, raw, max, why) =>
    out.push({ system, n: spread(raw, max), raw, max, why });

  const { pillars, dayStem } = chart;
  const lunar = input.lunar;
  const hb = input.timeKnown ? input.hourBranch : 0;

  // 사주 — 일주의 육십갑자 순번
  const sexa = sexagenaryIndex(pillars.day.stem, pillars.day.branch) + 1;
  add('사주', sexa, 60,
    `일주 ${pillars.day.hanja}(${pillars.day.kr}) — 육십갑자 ${sexa}번째`);
  for (const [key, label] of [['year', '연주'], ['month', '월주'], ['hour', '시주']]) {
    const pl = pillars[key];
    if (!pl) continue;
    const ix = sexagenaryIndex(pl.stem, pl.branch) + 1;
    add('사주', ix, 60, `${label} ${pl.hanja}(${pl.kr}) — 육십갑자 ${ix}번째`);
  }

  // 자미두수 — 명궁이 앉은 자리
  const myeong = ((2 + lunar.month - 1 - hb) % 12 + 12) % 12;
  add('자미두수', myeong + 1, 12,
    `명궁 ${BRANCHES_KR[myeong]}(${'子丑寅卯辰巳午未申酉戌亥'[myeong]}) — 열두 궁 중 ${myeong + 1}번째`);
  const sin = ((2 + lunar.month - 1 + hb) % 12 + 12) % 12;
  add('자미두수', sin + 1, 12, `신궁 ${BRANCHES_KR[sin]} — 열두 궁 중 ${sin + 1}번째`);
  const jaebaek = (myeong + 8) % 12;
  add('자미두수', jaebaek + 1, 12, `재백궁 ${BRANCHES_KR[jaebaek]} — 재물을 보는 자리`);

  // 점성술 — 태양이 머문 자리의 도수
  const pos = planetPositions(input.jdUT);
  const sunDeg = Math.floor(pos.태양.lon) + 1;
  add('점성술', sunDeg, 360, `태양 황경 ${pos.태양.lon.toFixed(1)}도`);
  add('점성술', Math.floor(pos.달.lon) + 1, 360, `달 황경 ${pos.달.lon.toFixed(1)}도`);
  add('점성술', Math.floor(pos.태양.lon / 30) + 1, 12,
    `태양이 든 별자리 — 열둘 중 ${Math.floor(pos.태양.lon / 30) + 1}번째`);

  // 베딕 — 달이 든 나크샤트라
  const nak = nakshatraOf(input.jdUT);
  add('베딕', nak.index + 1, 27, `달의 나크샤트라 ${nak.index + 1}번째`);
  add('베딕', nak.index * 4 + nak.pada, 108,
    `나크샤트라 ${nak.index + 1}번째의 제${nak.pada}파다`);

  // 주역 — 본괘 번호
  const hex = hexOf(input);
  add('주역', hex.num, 64, `본괘 ${hex.num}번`);
  if (hex.line) add('주역', hex.line, 6, `동효 제${hex.line}효`);

  // 육임 — 달이 든 자리에 시지를 얹은 값
  add('육임', modFrom1(lunar.month * 12 + hb + 1, 144), 144,
    `음력 ${lunar.month}월 · ${BRANCHES_KR[hb]}시`);
  add('육임', lunar.day, 30, `음력 ${lunar.day}일`);

  // 홍국기문 — 천반수와 지반수
  const hs = modFrom1(pillars.year.stem + pillars.month.stem + pillars.day.stem +
    (input.timeKnown ? pillars.hour.stem : 0) + 4, 9);
  const es = modFrom1(pillars.year.branch + pillars.month.branch + pillars.day.branch + hb + 4, 9);
  add('홍국기문', (hs - 1) * 9 + es, 81, `천반수 ${hs} · 지반수 ${es}`);
  add('홍국기문', hs * 5 + es, 54, `천반수 ${hs}과 지반수 ${es}를 더한 자리`);

  // 태을신수 — 스물네 해 주기에서의 자리
  const cycle = ((chart.sajuYear - 4) % 24 + 24) % 24;
  add('태을신수', cycle + 1, 24, `태을 주기 ${cycle + 1}번째 해`);

  // 구성학 — 본명성과 월명성
  const honmei = starOfYear(chart.sajuYear);
  const base = { 1: 8, 4: 8, 7: 8, 2: 2, 5: 2, 8: 2, 3: 5, 6: 5, 9: 5 }[honmei];
  const getsu = ((base - chart.sector.index - 1) % 9 + 9) % 9 + 1;
  add('구성학', (honmei - 1) * 9 + getsu, 81, `본명성 ${honmei} · 월명성 ${getsu}`);
  add('구성학', honmei, 9, `본명성 ${honmei}번째 별`);

  // 숙요 — 스물일곱 숙에 파다까지
  add('숙요', nak.index * 4 + nak.pada, 108,
    `${nak.index + 1}번째 숙 · 제${nak.pada}파다`);
  add('숙요', nak.index + 1, 27, `스물일곱 숙 가운데 ${nak.index + 1}번째`);

  // 토정비결 — 상·중·하 세 수
  const age = input.currentYear - input.year + 1;
  const up = modFrom1(age + sexa, 8);
  const mid = modFrom1(lunar.month + (lunar.isBigMonth ? 30 : 29), 6);
  const low = modFrom1(lunar.day + sexa, 3);
  add('토정비결', (up - 1) * 18 + (mid - 1) * 3 + low, 144,
    `상괘 ${up} · 중괘 ${mid} · 하괘 ${low}`);
  add('토정비결', up * 10 + mid, 86, `상괘 ${up} · 중괘 ${mid}`);

  // 카발라 — 라이프 패스와 생일수
  const digits = String(input.year).split('').reduce((a, c) => a + Number(c), 0);
  const lp = digitRoot(digits + input.month + input.day);
  const bd = digitRoot(input.day);
  add('카발라', (lp % 9) * 9 + bd, 81, `라이프 패스 ${lp} · 생일수 ${bd}`);
  add('카발라', input.day, 31, `태어난 날짜 ${input.day}일`);

  // 마하보테 — 여덟 자리 중 어디인가
  const jdn = toJDN(input.year, input.month, input.day);
  const wd = weekdayFromJDN(jdn);
  const rem = (((input.year - 638) % 7) + 7) % 7;
  add('마하보테', ((wd + rem) % 8) + 1, 8, `여덟 자리 중 ${((wd + rem) % 8) + 1}번째`);

  // 태국 점성술 — 요일과 불기
  add('태국 점성술', wd * 100 + ((input.year + 543) % 100) + 1, 700,
    `${WEEKDAY_KR[wd]}요일 · 불기 ${input.year + 543}년`);

  // 타로 — 생일 카드
  let sum = input.month + input.day + input.year;
  while (sum > 22) sum = String(sum).split('').reduce((a, c) => a + Number(c), 0);
  const card = sum === 22 ? 0 : sum;
  add('타로', card + 1, 22, `생일 카드 ${card}번`);

  return out;
}

// ─────────────────────────────────────────────────────────────
// 뽑기
// ─────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 명반에서 씨앗 하나를 만든다. 같은 사람이면 늘 같은 값 */
function chartSeed(input, chart) {
  const parts = [
    input.year, input.month, input.day,
    input.timeKnown ? input.hour * 60 + input.minute : 9999,
    chart.pillars.day.stem, chart.pillars.day.branch,
    chart.pillars.year.stem, chart.pillars.year.branch,
    Math.round(input.place.lat * 100), Math.round(input.place.lon * 100),
  ];
  let h = 2166136261;
  for (const v of parts) {
    h ^= v >>> 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawGame(cands, rng) {
  // 여러 체계가 같은 번호를 냈다면 그게 가장 믿을 만한 번호다. 서로 다른
  // 전통이 다른 길로 걸어와 같은 자리에 선 것이기 때문이다. 그래서 무작위로
  // 섞지 않고 겹친 횟수가 많은 순서로 고른다.
  //
  // 겹침이 같으면 씨앗으로 정한다. 그래야 같은 사람은 늘 같은 번호가 나온다.
  const byNumber = new Map();
  for (const c of cands) {
    const e = byNumber.get(c.n) ?? { n: c.n, from: [], why: [] };
    e.from.push(c.system);
    e.why.push(c.why);
    byNumber.set(c.n, e);
  }

  const ranked = [...byNumber.values()]
    .map((e) => ({ ...e, overlap: e.from.length, tie: rng() }))
    .sort((a, b) => b.overlap - a.overlap || a.tie - b.tie);

  const picked = ranked.slice(0, 6).map((e) => ({
    n: e.n,
    overlap: e.overlap,
    system: e.from.join(', '),
    why: e.overlap > 1
      ? `${e.overlap}개 체계가 같이 낸 번호입니다 — ${e.why[0]}`
      : e.why[0],
  }));

  // 후보에 서로 다른 번호가 여섯 개도 안 되면 씨앗으로 채운다
  const used = new Set(picked.map((x) => x.n));
  while (picked.length < 6) {
    const n = Math.floor(rng() * 45) + 1;
    if (used.has(n)) continue;
    used.add(n);
    picked.push({ n, overlap: 0, system: '보충', why: '체계 후보가 모자라 씨앗으로 채운 자리' });
  }

  return picked.sort((a, b) => a.n - b.n);
}

/**
 * 번호를 뽑는다.
 *
 * 한 게임만 낸다. 후보가 열다섯 개뿐이라 여섯 개씩 여러 번 뽑으면
 * 게임끼리 번호가 심하게 겹친다. 다섯 게임을 만들어 봐야 같은 풀을
 * 다시 섞은 것일 뿐이라 근거의 의미만 흐려진다.
 * 대신 열다섯 후보를 전부 보여주고, 더 필요하면 직접 고르게 한다.
 *
 * @param {object} input  prepareInput이 만든 입력
 * @param {object} chart  computeFourPillars 결과
 * @param {'life'|'week'} mode  평생 번호 / 이번 주 번호
 */
export function pickNumbers(input, chart, mode = 'week') {
  const cands = candidates(input, chart);
  const base = chartSeed(input, chart);
  const info = currentRound();

  // 평생 번호는 명반만, 이번 주 번호는 거기에 회차를 섞는다
  const seed = mode === 'life' ? base : (base ^ Math.imul(info.round, 0x9E3779B1)) >>> 0;
  const picked = drawGame(cands, mulberry32(seed));
  const chosen = new Set(picked.map((x) => x.n));

  // 같은 번호를 몇 개 체계가 냈는지 세어 둔다. 화면에서 그 수를 보여준다.
  const overlapOf = new Map();
  for (const c of cands) overlapOf.set(c.n, (overlapOf.get(c.n) ?? 0) + 1);

  // 후보 전체 — 겹침이 많은 순, 같으면 번호 순
  const pool = cands
    .map((c) => ({ ...c, picked: chosen.has(c.n), overlap: overlapOf.get(c.n) }))
    .sort((a, b) => b.overlap - a.overlap || a.n - b.n);

  const distinct = new Set(cands.map((c) => c.n)).size;

  return {
    mode,
    numbers: picked,
    pool,
    distinct,
    round: info.round,
    drawAt: info.drawAt,
    drawText: formatDraw(info.drawAt),
  };
}
