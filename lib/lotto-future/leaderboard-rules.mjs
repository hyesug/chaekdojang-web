// 변동 순위표 규칙 계산(순수 함수). analysis/fortune-lotto/run-rule-revalidation.mjs·run-adaptive-leaderboard.mjs 와
// 같은 계산이어야 한다 — 1246회 산출이 연구 결과와 같은지 tests/lotto-leaderboard.test.mjs 가 검사한다.
const P0 = 6 / 45;
const range45 = () => Array.from({ length: 45 }, (_, i) => i + 1);
const wrap = (n) => ((n - 1) % 45 + 45) % 45 + 1;
const systemOf = (slot) => slot.split('.')[0];

/** 체계 단독: 그 체계 슬롯 번호(슬롯 순서) → 모자라면 각 번호의 ±1, ±2 … 이웃으로 채운다 */
export function systemTicket(candidates, system) {
  const base = []; for (const [slot, n] of Object.entries(candidates)) if (systemOf(slot) === system && !base.includes(n)) base.push(n);
  if (!base.length) throw new Error(`No candidate slots for system: ${system}`);
  const out = base.slice(0, 6);
  for (let d = 1; out.length < 6; d++) for (const n of base) for (const m of [wrap(n + d), wrap(n - d)]) if (out.length < 6 && !out.includes(m)) out.push(m);
  return out;
}

/** 당첨 이력 통계. rows 는 대상 회차 이전 당첨번호(오래된 순) */
export function historyTicket(kind, rows) {
  if (!rows.length) return [1, 2, 3, 4, 5, 6];
  if (kind === 'repeat') return rows[rows.length - 1];
  const recent = kind === 'hot52' || kind === 'cold52' ? rows.slice(-52) : rows;
  const freq = Array(46).fill(0), last = Array(46).fill(-1);
  recent.forEach((r) => r.forEach((n) => { freq[n]++; })); rows.forEach((r, i) => r.forEach((n) => { last[n] = i; }));
  const key = { hotAll: (n) => -freq[n], hot52: (n) => -freq[n], cold52: (n) => freq[n], overdue: (n) => last[n] }[kind];
  return range45().sort((a, b) => key(a) - key(b) || a - b).slice(0, 6);
}

// ── 득표 규칙군(창마다 학습 구간 끝 200회로 설정 선택 → 학습 구간 전체로 재적합)
function ruleTicket(candidates, config) {
  const score = new Map(); const systems = new Map(); const votes = new Map();
  const add = (n, w) => { const k = wrap(n); score.set(k, (score.get(k) ?? 0) + w); };
  for (const [slot, number] of Object.entries(candidates)) {
    const system = systemOf(slot); if (config.systems && !config.systems.includes(system)) continue;
    const w = config.key === 'slotWeight' ? (config.weights[slot] ?? 0) : config.key === 'systemWeight' ? (config.weights[system] ?? 0) : 1;
    votes.set(number, (votes.get(number) ?? 0) + 1); systems.set(number, (systems.get(number) ?? new Set()).add(system));
    if (config.key !== 'support') { add(number, w); for (let d = 1; d <= (config.spread ?? 0); d++) { add(number - d, w * config.alpha); add(number + d, w * config.alpha); } }
  }
  if (config.key === 'support') for (const [n, set] of systems) score.set(n, set.size + votes.get(n) / 100);
  return range45().sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || a - b).slice(0, 6).sort((a, b) => a - b);
}
const hitCount = (t, w) => t.filter((n) => w.includes(n)).length;
function buildConfigs(cands, trainDraws) {
  const slots = Object.keys(cands[trainDraws[0].round]); const sysAll = [...new Set(slots.map(systemOf))]; const k = 200;
  const slotHit = Object.fromEntries(slots.map((s) => [s, trainDraws.filter((d) => d.numbers.includes(cands[d.round][s])).length]));
  const shrink = (hits, n) => (hits + k * P0) / (n + k) - P0;
  const slotW = Object.fromEntries(slots.map((s) => [s, Math.max(0, shrink(slotHit[s], trainDraws.length))]));
  const sysW = Object.fromEntries(sysAll.map((sy) => { const ss = slots.filter((s) => systemOf(s) === sy); return [sy, Math.max(0, shrink(ss.reduce((t, s) => t + slotHit[s], 0), ss.length * trainDraws.length))]; }));
  const meanOf = (config) => trainDraws.reduce((t, d) => t + hitCount(ruleTicket(cands[d.round], config), d.numbers), 0) / trainDraws.length;
  const forward = []; let chosen = [];
  while (chosen.length < sysAll.length) { let best = null; for (const s of sysAll.filter((x) => !chosen.includes(x))) { const v = meanOf({ key: 'votes', systems: [...chosen, s] }); if (!best || v > best.v) best = { s, v }; } chosen = [...chosen, best.s]; forward.push([...chosen]); }
  const exps = [{ spread: 0, alpha: 0 }, { spread: 1, alpha: 0.25 }, { spread: 1, alpha: 0.5 }];
  const configs = [];
  for (const systems of forward) { for (const e of exps) configs.push({ family: '득표', name: `득표·체계${systems.length}·확장${e.alpha}`, key: 'votes', systems, ...e }); configs.push({ family: '체계지지', name: `체계지지·체계${systems.length}`, key: 'support', systems }); }
  for (const e of exps) { configs.push({ family: '슬롯가중', name: `슬롯가중·확장${e.alpha}`, key: 'slotWeight', weights: slotW, ...e }); configs.push({ family: '체계가중', name: `체계가중·확장${e.alpha}`, key: 'systemWeight', weights: sysW, ...e }); }
  return configs;
}
/** cands: 회차→슬롯값(대상 회차 포함), past: 대상 이전 회차 {round, numbers} 오래된 순. 규칙군별 대상 회차 티켓과 고른 설정 */
export function voteFamilyTickets(cands, past, target, families) {
  const fit = past.slice(0, -200), inner = past.slice(-200);
  const meanOn = (config, rows) => rows.reduce((t, d) => t + hitCount(ruleTicket(cands[d.round], config), d.numbers), 0) / rows.length;
  const scored = buildConfigs(cands, fit).map((c) => ({ c, v: meanOn(c, inner) })); const refitPool = buildConfigs(cands, past);
  return Object.fromEntries(families.map((f) => {
    const best = scored.filter(({ c }) => f === '전체' || c.family === f).sort((a, b) => b.v - a.v)[0].c; const refit = refitPool.find((c) => c.name === best.name);
    return [f, { ticket: ruleTicket(cands[target], refit), config: best.name }];
  }));
}

// ── 신규 N1–N3(매 회차 그 이전 결과로 다시 학습)
export function n1Ticket(slotValues, slotStats) {
  const score = new Map(), votes = new Map();
  for (const [slot, n] of Object.entries(slotValues)) {
    const s = slotStats[slot] ?? { hits: 0, n: 0 }; const w = Math.max(0, (s.hits + 200 * P0) / (s.n + 200) - P0);
    score.set(n, (score.get(n) ?? 0) + w); votes.set(n, (votes.get(n) ?? 0) + 1);
  }
  return range45().sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || (votes.get(b) ?? 0) - (votes.get(a) ?? 0) || a - b).slice(0, 6);
}
export function n2Ticket(slotValues, systemRank) {
  const top = systemRank.slice(0, 5); const base = [], votes = new Map();
  for (const sy of top) for (const [slot, n] of Object.entries(slotValues)) if (systemOf(slot) === sy) { votes.set(n, (votes.get(n) ?? 0) + 1); if (!base.includes(n)) base.push(n); }
  const out = [...base].sort((a, b) => votes.get(b) - votes.get(a) || base.indexOf(a) - base.indexOf(b)).slice(0, 6);
  for (let d = 1; out.length < 6; d++) for (const n of base) for (const m of [wrap(n + d), wrap(n - d)]) if (out.length < 6 && !out.includes(m)) out.push(m);
  return out;
}
const bucketVote = (v) => Math.min(v, 3);
const bucketFreq = (f) => f <= 4 ? 0 : f <= 6 ? 1 : f <= 8 ? 2 : 3;
const bucketGap = (g) => g <= 2 ? 0 : g <= 6 ? 1 : g <= 12 ? 2 : 3;
export function n3Features(slotValues, past) {
  const votes = Array(46).fill(0); for (const n of Object.values(slotValues)) votes[n]++;
  const f52 = Array(46).fill(0); past.slice(-52).forEach((r) => r.forEach((n) => { f52[n]++; }));
  const gap = Array(46).fill(past.length + 1); past.forEach((r, i) => r.forEach((n) => { gap[n] = past.length - 1 - i; }));
  return range45().map((n) => [bucketVote(votes[n]), bucketFreq(f52[n]), bucketGap(gap[n])]);
}
const logit = (p) => Math.log(p / (1 - p));
export function n3Ticket(features, table) {
  const score = features.map((fs, i) => ({ n: i + 1, s: fs.reduce((t, b, f) => { const c = table[f][b]; return t + logit((c.w + 10 * P0) / (c.t + 10)) - logit(P0); }, 0) }));
  return score.sort((a, b) => b.s - a.s || a.n - b.n).slice(0, 6).map((x) => x.n);
}
// ── 매주 재탐색 체계 조합식(C1 누적, C2 최근 300회). analysis/fortune-lotto/COMBINATION_RULES_PROTOCOL.md
export const SLOT_LABELS = {
  'saju.c1_year_sexagenary': '사주 연주', 'saju.c2_month_sexagenary': '사주 월주', 'saju.c3_day_sexagenary': '사주 일주', 'saju.c4_hour_sexagenary': '사주 시주',
  'jamidusu.c1_myeong': '자미두수 명궁', 'jamidusu.c2_sin': '자미두수 신궁', 'jamidusu.c3_jaebaek': '자미두수 재백궁',
  'astrology.c1_sun_longitude': '서양점성 태양 황경', 'astrology.c2_moon_longitude': '서양점성 달 황경', 'astrology.c3_sun_sign': '서양점성 태양 별자리',
  'vedic.c1_nakshatra': '베딕 나크샤트라', 'vedic.c2_nakshatra_pada': '베딕 나크샤트라·파다', 'juyeok.c1_hexagram': '주역 본괘', 'juyeok.c2_moving_line': '주역 동효',
  'yukim.c1_month_general_point_hour': '육임 월장·시', 'yukim.c2_day_stem_gigung': '육임 일간 기궁', 'yukim.c3_first_transmission': '육임 초전', 'yukim.c4_middle_transmission': '육임 중전', 'yukim.c5_last_transmission': '육임 말전',
  'hongguk.c1_heaven_earth': '홍국기문 천지반', 'hongguk.c2_plate_mix': '홍국기문 천반·지반', 'taeeul.c1_cycle': '태을신수 주기', 'gujeong.c1_honmei_getsumei': '구성학 본명·월명성', 'gujeong.c2_honmei': '구성학 본명성',
  'sukyo.c1_nakshatra': '숙요 27숙', 'sukyo.c2_nakshatra_pada': '숙요 숙·파다', 'tojeong.c1_hexagram': '토정 괘', 'tojeong.c2_upper_middle': '토정 상·중괘',
  'kabbalah.c1_life_birthday': '카발라 라이프패스·생일수', 'kabbalah.c2_personal_year': '카발라 개인년', 'mahabote.c1_eight_place': '마하보테 자리', 'thai.c1_weekday_buddhist': '태국점성 요일·불기', 'tarot.c1_birth_card': '타로 생일카드',
  'classical.c1_lot_fortune': '고전점성 포르투나 로트', 'classical.c2_lot_spirit': '고전점성 스피릿 로트', 'classical.c3_lot_substance': '고전점성 재물 로트', 'classical.c4_second_lord': '고전점성 2하우스 주인',
};
/** 슬롯 목록으로 조합식을 만든다(한 식 안은 서로 다른 체계). f = { t: 슬롯 번호들, s: 부호들, abs } */
export function combinationFormulas(slotNames) {
  const sys = slotNames.map(systemOf), n = slotNames.length, out = [];
  for (let a = 0; a < n; a++) out.push({ t: [a], s: [1], abs: false });
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (sys[a] !== sys[b]) {
    out.push({ t: [a, b], s: [1, 1], abs: false }, { t: [a, b], s: [1, -1], abs: false }, { t: [a, b], s: [-1, 1], abs: false }, { t: [a, b], s: [1, -1], abs: true });
  }
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) if (sys[a] !== sys[b] && sys[a] !== sys[c] && sys[b] !== sys[c]) {
    out.push({ t: [a, b, c], s: [1, 1, 1], abs: false }, { t: [a, b, c], s: [1, 1, -1], abs: false }, { t: [a, b, c], s: [1, -1, 1], abs: false }, { t: [a, b, c], s: [-1, 1, 1], abs: false });
  }
  return out;
}
const formulaValue = (f, v) => { let x = 0; for (let i = 0; i < f.t.length; i++) x += f.s[i] * v[f.t[i]]; return wrap(f.abs ? Math.abs(x) : x); };
export function formulaLabel(f, slotNames) {
  const name = (i) => SLOT_LABELS[slotNames[i]] ?? slotNames[i];
  if (f.abs) return `|${name(f.t[0])} − ${name(f.t[1])}|`;
  return f.t.map((t, i) => `${i === 0 ? (f.s[i] < 0 ? '−' : '') : f.s[i] < 0 ? ' − ' : ' + '}${name(t)}`).join('');
}
/** 적중 수가 많은 식부터(동률은 목록 순서) 이번 회차 번호를 겹치지 않게 6개 담는다. 모든 식의 관측 수가 같아 축소 추정 순서와 같다 */
function pickFormulas(formulas, hits, values) {
  const order = []; const K = 80;
  for (let i = 0; i < formulas.length; i++) {
    if (order.length === K && hits[i] <= hits[order[K - 1]]) continue;
    let j = order.length; while (j > 0 && hits[order[j - 1]] < hits[i]) j--; order.splice(j, 0, i); if (order.length > K) order.pop();
  }
  const ticket = [], chosen = [];
  for (const i of order) { const n = formulaValue(formulas[i], values); if (!ticket.includes(n)) { ticket.push(n); chosen.push(i); } if (ticket.length === 6) break; }
  for (let n = 1; ticket.length < 6; n++) if (!ticket.includes(n)) ticket.push(n);
  return { ticket, chosen };
}
/**
 * rows: 회차 1..target 의 슬롯값 배열(slotNames 순서), winners: 회차→당첨. onRound(r, {C1, C2}) 로 각 회차 표본 외 선택을 받는다.
 * 회차 r 의 선택은 r 이전 결과만 쓴다. 반환: target 회차의 C1·C2.
 */
export function combinationTickets(slotNames, rows, winners, target, onRound) {
  const formulas = combinationFormulas(slotNames);
  const all = new Int32Array(formulas.length), recent = new Int32Array(formulas.length), ring = []; let result = null;
  const describe = (p) => p && { ticket: p.ticket, formulas: p.chosen.map((i) => formulaLabel(formulas[i], slotNames)) };
  for (let r = 1; r <= target; r++) {
    const v = rows[r - 1];
    if (r === target || (onRound && r > 100)) {
      const pick = { C1: describe(pickFormulas(formulas, all, v)), C2: r > 300 ? describe(pickFormulas(formulas, recent, v)) : null };
      if (r === target) result = pick; else onRound(r, pick);
    }
    if (r === target) break;
    const w = winners[r]; const hitList = [];
    for (let i = 0; i < formulas.length; i++) if (w.includes(formulaValue(formulas[i], v))) { all[i]++; recent[i]++; hitList.push(i); }
    ring.push(hitList); if (ring.length > 300) for (const i of ring.shift()) recent[i]--;
  }
  return { ...result, formulaCount: formulas.length };
}

/** 회차 1..target-1 의 슬롯·당첨으로 N1–N3 를 다시 학습해 target 티켓을 낸다 */
export function newRuleTickets(frozen, latest, winners, target) {
  const slotStats = {}, sysHist = {}, table = [0, 1, 2].map(() => Array.from({ length: 4 }, () => ({ w: 0, t: 0 })));
  const systems = [...new Set(Object.keys(latest[1]).map(systemOf))];
  const slots66 = (r) => ({ ...Object.fromEntries(Object.entries(frozen[r]).map(([s, n]) => [`F:${s}`, n])), ...Object.fromEntries(Object.entries(latest[r]).map(([s, n]) => [`L:${s}`, n])) });
  const past = [];
  for (let r = 1; r < target; r++) {
    const w = winners[r]; const feats = n3Features(frozen[r], past);
    for (const [s, n] of Object.entries(slots66(r))) { const st = slotStats[s] ??= { hits: 0, n: 0 }; st.n++; if (w.includes(n)) st.hits++; }
    for (const sy of systems) { const ss = Object.entries(latest[r]).filter(([s]) => systemOf(s) === sy); (sysHist[sy] ??= []).push(ss.filter(([, n]) => w.includes(n)).length / ss.length); }
    feats.forEach((fs, i) => fs.forEach((b, f) => { table[f][b].t++; if (w.includes(i + 1)) table[f][b].w++; }));
    past.push(w);
  }
  const mean = (x) => x.reduce((s, v) => s + v, 0) / Math.max(1, x.length);
  const sysRank = [...systems].sort((a, b) => mean((sysHist[b] ?? []).slice(-104)) - mean((sysHist[a] ?? []).slice(-104)) || systems.indexOf(a) - systems.indexOf(b));
  return { N1: n1Ticket(slots66(target), slotStats), N2: n2Ticket(latest[target], sysRank), N3: n3Ticket(n3Features(frozen[target], past), table), n2Systems: sysRank.slice(0, 5) };
}
