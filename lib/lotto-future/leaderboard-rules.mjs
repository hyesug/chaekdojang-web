// 변동 순위표 규칙 계산(순수 함수). analysis/fortune-lotto/run-rule-revalidation.mjs·run-adaptive-leaderboard.mjs 와
// 같은 계산이어야 한다 — 1246회 산출이 연구 결과와 같은지 tests/lotto-leaderboard.test.mjs 가 검사한다.
const P0 = 6 / 45;
const range45 = () => Array.from({ length: 45 }, (_, i) => i + 1);
const wrap = (n) => ((n - 1) % 45 + 45) % 45 + 1;
const systemOf = (slot) => slot.split('.')[0];

/** 체계 단독: 그 체계 슬롯 번호(슬롯 순서) → 모자라면 각 번호의 ±1, ±2 … 이웃으로 채운다 */
export function systemTicket(candidates, system) {
  const base = []; for (const [slot, n] of Object.entries(candidates)) if (systemOf(slot) === system && !base.includes(n)) base.push(n);
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
  return { N1: n1Ticket(slots66(target), slotStats), N2: n2Ticket(latest[target], sysRank), N3: n3Ticket(n3Features(frozen[target], past), table) };
}
