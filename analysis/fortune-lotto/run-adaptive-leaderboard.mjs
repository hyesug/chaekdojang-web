/*
 * 변동 순위표(리더보드) 연구(연구 전용). 절차는 ADAPTIVE_LEADERBOARD_PROTOCOL.md 에 결과 확인 전에 고정했다.
 * 입력: output/rule-revalidation/tickets.json(재검증의 표본 외 티켓) — 먼저 run-rule-revalidation.mjs 를 실행해야 한다.
 * 출력: output/adaptive-leaderboard/ 만. 운영 코드·저장 예측은 읽기만 한다.
 * 실행(저장소 루트): node analysis/fortune-lotto/run-adaptive-leaderboard.mjs
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXTRA_DRAWS, MEAN0, PMF, exactTail, hitCount, historyTicket, loadPredictor, normTicket, systemTicket, voteFamiliesWalkForward } from './run-rule-revalidation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'output', 'adaptive-leaderboard');
const PRIOR = join(HERE, 'output');
const NEXT = { round: 1246, drawDate: '2026-10-17', drawTime: '20:35' }; // 운영 기본 추첨 시각
const K = 100, MIN_N = 100, TOP = 5, DUP = 3, P0 = 6 / 45;
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const range45 = () => Array.from({ length: 45 }, (_, i) => i + 1);
const wrap = (n) => ((n - 1) % 45 + 45) % 45 + 1;
function mulberry32(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function randomTicket(rand) { const pool = range45(); for (let i = 0; i < 6; i++) { const j = i + Math.floor(rand() * (45 - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, 6); }

// ── 신규 규칙(매 회차 그 이전 정보만 사용)
/** N1: 슬롯별 적중률 축소 추정에서 기대(6/45)보다 높은 몫을 그 슬롯 번호에 더한다 */
export function n1Ticket(slotValues, slotStats) {
  const score = new Map(), votes = new Map();
  for (const [slot, n] of Object.entries(slotValues)) {
    const s = slotStats[slot] ?? { hits: 0, n: 0 }; const w = Math.max(0, (s.hits + 200 * P0) / (s.n + 200) - P0);
    score.set(n, (score.get(n) ?? 0) + w); votes.set(n, (votes.get(n) ?? 0) + 1);
  }
  return range45().sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || (votes.get(b) ?? 0) - (votes.get(a) ?? 0) || a - b).slice(0, 6);
}
/** N2: 최근 104회 슬롯 적중률 상위 5개 체계의 슬롯 득표, 부족하면 ±1, ±2 이웃 */
export function n2Ticket(slotValues, systemRank) {
  const top = systemRank.slice(0, 5); const base = [], votes = new Map();
  for (const sy of top) for (const [slot, n] of Object.entries(slotValues)) if (slot.split('.')[0] === sy) { votes.set(n, (votes.get(n) ?? 0) + 1); if (!base.includes(n)) base.push(n); }
  const out = [...base].sort((a, b) => votes.get(b) - votes.get(a) || base.indexOf(a) - base.indexOf(b)).slice(0, 6);
  for (let d = 1; out.length < 6; d++) for (const n of base) for (const m of [wrap(n + d), wrap(n - d)]) if (out.length < 6 && !out.includes(m)) out.push(m);
  return out;
}
const bucketVote = (v) => Math.min(v, 3);
const bucketFreq = (f) => f <= 4 ? 0 : f <= 6 ? 1 : f <= 8 ? 2 : 3;
const bucketGap = (g) => g <= 2 ? 0 : g <= 6 ? 1 : g <= 12 ? 2 : 3;
/** N3: 번호 특징(슬롯 득표·최근 52회 출현·미출현 간격) 구간별 과거 당첨 비율의 로그 오즈 합 */
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

export async function main() {
  await mkdir(OUT, { recursive: true });
  const dir = await mkdtemp(join(tmpdir(), 'lotto-leaderboard-'));
  try {
    const dataset = await json(join(PRIOR, 'method-comparison/common_dataset.json'));
    const draws = dataset.rows.map((r) => ({ round: r.round, drawDate: r.date, drawTime: r.time, numbers: r.winning })).concat(EXTRA_DRAWS);
    const events = draws.concat([{ ...NEXT, numbers: [] }]);
    const LAST = 1245, win = (r) => draws[r - 1].numbers;

    // 1) 두 엔진 후보 슬롯·상태, 1246 운영 고정 티켓
    const [frozen, latest] = await Promise.all([loadPredictor('frozen', dir), loadPredictor('latest', dir)]);
    const cands = { frozen: {}, latest: {} }, states = { latest: {} };
    for (const [engine, m] of [['frozen', frozen], ['latest', latest]]) for (const d of events) {
      const [year, month, day] = d.drawDate.split('-').map(Number); const [hour, minute] = d.drawTime.split(':').map(Number);
      const fs = m.__eventFeatures({ year, month, day, hour, minute }); cands[engine][d.round] = m.__candidateValues(fs); if (engine === 'latest') states.latest[d.round] = m.__state(fs);
    }
    const op1246 = frozen.generateFrozenPredictions(NEXT, EXTRA_DRAWS).predictions;
    const vote1246 = frozen.voteStrategyTickets(cands.latest[1246]);

    // 2) 라이브 풀: 재검증 표본 외 티켓 + 1246 티켓
    const prior = await json(join(PRIOR, 'rule-revalidation/tickets.json'));
    const revalidation = await json(join(PRIOR, 'rule-revalidation/results.json'));
    const meta = Object.fromEntries(revalidation.rules.map((r) => [r.id, r]));
    const liveIds = Object.keys(prior).filter((id) => /^(OP-|SYS-|L-|LV-|FV-|HS-)/.test(id));
    const series = Object.fromEntries(liveIds.map((id) => [id, new Map(Object.entries(prior[id]).map(([k, t]) => [Number(k), t]))]));
    for (const c of ['A', 'D', 'E', 'H', 'F', 'S1', 'S2', 'S3']) series[`OP-${c}`].set(1246, op1246[c]);
    for (const c of ['S1', 'S2', 'S3']) series[`L-${c}`].set(1246, vote1246[c]);
    for (const id of liveIds.filter((x) => x.startsWith('SYS-'))) series[id].set(1246, systemTicket(cands[id[4] === 'F' ? 'frozen' : 'latest'][1246], id.slice(6)));
    for (const id of liveIds.filter((x) => x.startsWith('HS-'))) series[id].set(1246, historyTicket(id.slice(3), draws.map((d) => d.numbers)));
    // L-F: 최신 엔진 상태의 과거 전용 10-NN(재검증과 같은 거리)
    const stateIds = (await json(join(PRIOR, 'method-comparison/method-E/state_matrix.json'))).feature_ids;
    const cyclic = stateIds.map((id) => /longitude|sexagenary|nakshatra|hexagram|cycle/.test(id));
    const dist = (a, b) => a.reduce((s, x, i) => { const t = Math.abs(x - b[i]); return s + (cyclic[i] ? Math.min(t, 1 - t) : t); }, 0) / a.length;
    { const nb = draws.map((p) => ({ p, v: dist(states.latest[1246], states.latest[p.round]) })).sort((a, b) => a.v - b.v || a.p.round - b.p.round).slice(0, 10);
      const c = Array(46).fill(0); nb.forEach(({ p }) => p.numbers.forEach((n) => { c[n]++; })); series['L-F'].set(1246, range45().sort((a, b) => c[b] - c[a] || a - b).slice(0, 6)); }
    // 득표 규칙군: 1–1245 로 다시 학습해 1246 티켓
    const famIds = liveIds.filter((x) => x.startsWith('LV-')).map((x) => x.slice(3));
    const lv = voteFamiliesWalkForward(cands.latest, events, famIds, [[1246, 1246]]), fv = voteFamiliesWalkForward(cands.frozen, events, ['전체'], [[1246, 1246]]);
    famIds.forEach((f) => series[`LV-${f}`].set(1246, lv.tickets[f].get(1246))); series['FV-전체'].set(1246, fv.tickets['전체'].get(1246));
    const famChoice1246 = { ...Object.fromEntries(famIds.map((f) => [`LV-${f}`, lv.chosen[f][0]])), 'FV-전체': fv.chosen['전체'][0] };

    // 3) 신규 N1–N3(102회부터, 그 이전 회차만으로 매회 갱신)
    for (const id of ['N1', 'N2', 'N3', 'N4']) series[id] = new Map();
    const slotStats = {}; const sysHist = {}; const table = [0, 1, 2].map(() => Array.from({ length: 4 }, () => ({ w: 0, t: 0 })));
    const slots66 = (r) => ({ ...Object.fromEntries(Object.entries(cands.frozen[r]).map(([s, n]) => [`F:${s}`, n])), ...Object.fromEntries(Object.entries(cands.latest[r]).map(([s, n]) => [`L:${s}`, n])) });
    const systems = [...new Set(Object.keys(cands.latest[1]).map((s) => s.split('.')[0]))];
    const n3Past = [];
    for (const d of events) {
      const r = d.round; const past = n3Past;
      const feats = n3Features(cands.frozen[r], past);
      if (r >= 102) {
        series.N1.set(r, n1Ticket(slots66(r), slotStats));
        const sysRank = [...systems].sort((a, b) => { const ra = (sysHist[a] ?? []).slice(-104), rb = (sysHist[b] ?? []).slice(-104); const m = (x) => x.reduce((s, v) => s + v, 0) / Math.max(1, x.length); return m(rb) - m(ra) || systems.indexOf(a) - systems.indexOf(b); });
        series.N2.set(r, n2Ticket(cands.latest[r], sysRank));
        series.N3.set(r, n3Ticket(feats, table));
      }
      if (r > LAST) break;
      const w = win(r); // 회차 r 결과는 r 티켓을 만든 뒤에만 반영
      for (const [s, n] of Object.entries(slots66(r))) { const st = slotStats[s] ??= { hits: 0, n: 0 }; st.n++; if (w.includes(n)) st.hits++; }
      for (const sy of systems) { const ss = Object.entries(cands.latest[r]).filter(([s]) => s.split('.')[0] === sy); (sysHist[sy] ??= []).push(ss.filter(([, n]) => w.includes(n)).length / ss.length); }
      feats.forEach((fs, i) => fs.forEach((b, f) => { table[f][b].t++; if (w.includes(i + 1)) table[f][b].w++; }));
      n3Past.push(w);
    }

    // 4) 순위표 루프(102–1246). 회차 r 순위·N4 는 r 이전 결과만 사용
    const ids = [...liveIds, 'N1', 'N2', 'N3', 'N4']; const idx = Object.fromEntries(ids.map((id, i) => [id, i]));
    const cum = ids.map(() => ({ hits: 0, n: 0, recent: [] }));
    const common = ids.map(() => new Float64Array(ids.length)), commonN = ids.map(() => new Int32Array(ids.length));
    const rankBy = (scoreFn, r, exclude = []) => ids.filter((id) => !exclude.includes(id) && cum[idx[id]].n >= MIN_N && series[id].get(r)).map((id) => ({ id, s: scoreFn(cum[idx[id]]) })).sort((a, b) => b.s - a.s || a.id.localeCompare(b.id));
    const pickTop = (ranked) => { const out = []; for (const x of ranked) { if (out.length >= TOP) break; const i = idx[x.id]; if (out.every((y) => { const j = idx[y.id]; return !commonN[i][j] || common[i][j] / commonN[i][j] < DUP; })) out.push(x); } return out; };
    const SCORERS = { shrunk: (c) => (c.hits + K * MEAN0) / (c.n + K), recent104: (c) => { const x = c.recent.slice(-104); return (x.reduce((s, v) => s + v, 0) + K * MEAN0) / (x.length + K); }, plain: (c) => c.hits / c.n };
    const log = [];
    for (let r = 102; r <= 1246; r++) {
      const ranked10 = rankBy(SCORERS.shrunk, r, ['N4']).slice(0, 10);
      if (ranked10.length) { const v = new Map(); ranked10.forEach((x, k) => series[x.id].get(r).forEach((n) => { const e = v.get(n) ?? { c: 0, best: k }; e.c++; v.set(n, e); })); series.N4.set(r, [...v.entries()].sort((a, b) => b[1].c - a[1].c || a[1].best - b[1].best || a[0] - b[0]).slice(0, 6).map(([n]) => n)); }
      const picks = Object.fromEntries(Object.entries(SCORERS).map(([k, fn]) => [k, pickTop(rankBy(fn, r))]));
      const tick = (id) => normTicket(series[id].get(r), `${id} ${r}`);
      const entry = { round: r, picks: Object.fromEntries(Object.entries(picks).map(([k, list]) => [k, list.map((x) => ({ id: x.id, score: x.s, ticket: tick(x.id) }))])) };
      if (r <= LAST) {
        const w = win(r);
        for (const k of Object.keys(entry.picks)) entry.picks[k].forEach((x) => { x.hits = hitCount(x.ticket, w); });
        // 순위 점수와 이번 적중의 순위상관(전체 순위 대상)
        const full = rankBy(SCORERS.shrunk, r); if (full.length >= 10) { const h = full.map((x) => hitCount(series[x.id].get(r), w)); const n = h.length; const rk = (a) => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const out = Array(n); let i = 0; while (i < n) { let j = i; while (j + 1 < n && s[j + 1][0] === s[i][0]) j++; for (let t = i; t <= j; t++) out[s[t][1]] = (i + j) / 2; i = j + 1; } return out; }; const a = rk(full.map((x) => x.s)), b = rk(h); const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } entry.rankCorr = va && vb ? c / Math.sqrt(va * vb) : 0; }
        // 결과 반영
        const tickets = ids.map((id) => series[id].get(r) ? normTicket(series[id].get(r)) : null);
        tickets.forEach((t, i) => { if (!t) return; const k = hitCount(t, w); cum[i].hits += k; cum[i].n++; cum[i].recent.push(k); });
        for (let i = 0; i < ids.length; i++) if (tickets[i]) for (let j = i + 1; j < ids.length; j++) if (tickets[j]) { const c = hitCount(tickets[i], tickets[j]); common[i][j] += c; common[j][i] += c; commonN[i][j]++; commonN[j][i]++; }
      }
      log.push(entry);
      // 운영 순위표 기준선: 1245회 결과까지 반영한 상태(lib/lotto-future/leaderboard.ts 가 읽는다)
      if (r === LAST) {
        const slotNames = { frozen: Object.keys(cands.frozen[1]), latest: Object.keys(cands.latest[1]) };
        const rows = (engine) => draws.map((d) => slotNames[engine].map((s) => cands[engine][d.round][s]));
        const engineTree = revalidation.engines.latest.tree;
        await writeFile(join(OUT, 'baseline.json'), JSON.stringify({ lastRound: LAST, engineTree, settings: { K, MIN_N, TOP, DUP },
          ruleIds: ids, records: cum.map((c) => ({ hits: c.hits, n: c.n, recent: c.recent.slice(-104) })),
          common: common.map((row) => Array.from(row)), commonN: commonN.map((row) => Array.from(row)),
          slotNames, cands: { frozen: rows('frozen'), latest: rows('latest') }, latestStates: draws.map((d) => states.latest[d.round]),
          draws: draws.map((d) => ({ round: d.round, drawDate: d.drawDate, drawTime: d.drawTime, numbers: d.numbers })) }));
      }
    }

    // 5) 순위표 방식 평가(701–1100, 1101–1245): 고른 티켓은 고정, 당첨만 가상 공정 추첨으로 바꿔 귀무분포
    const evalPeriod = (from, to, key) => {
      const rows = log.filter((e) => e.round >= from && e.round <= to);
      const obs = { top1: 0, top5: 0, best5ge3: 0, rounds: rows.length };
      rows.forEach((e) => { const p = e.picks[key]; obs.top1 += p[0].hits; obs.top5 += p.reduce((s, x) => s + x.hits, 0) / p.length; if (Math.max(...p.map((x) => x.hits)) >= 3) obs.best5ge3++; });
      const rand = mulberry32(from * 7 + key.length); const sims = 10000; let geTop5 = 0, geBest = 0, geTop1 = 0;
      for (let s = 0; s < sims; s++) { let t1 = 0, t5 = 0, b3 = 0; for (const e of rows) { const w = randomTicket(rand); const p = e.picks[key]; const hs = p.map((x) => hitCount(x.ticket, w)); t1 += hs[0]; t5 += hs.reduce((a, b) => a + b, 0) / hs.length; if (Math.max(...hs) >= 3) b3++; } if (t5 >= obs.top5 - 1e-9) geTop5++; if (b3 >= obs.best5ge3) geBest++; if (t1 >= obs.top1) geTop1++; }
      return { rounds: rows.length, top1Mean: obs.top1 / rows.length, top5Mean: obs.top5 / rows.length, best5Ge3Rate: obs.best5ge3 / rows.length, pTop1: exactTail(rows.length, obs.top1), pTop5Sim: (geTop5 + 1) / (sims + 1), pBest5Sim: (geBest + 1) / (sims + 1), pTop1Sim: (geTop1 + 1) / (sims + 1),
        meanRankCorr: rows.reduce((s, e) => s + (e.rankCorr ?? 0), 0) / rows.length };
    };
    const periods = { dev: [701, 1100], holdout: [1101, 1245], all: [701, 1245] };
    const leaderboardEval = Object.fromEntries(Object.keys(SCORERS).map((k) => [k, Object.fromEntries(Object.entries(periods).map(([p, [a, b]]) => [p, evalPeriod(a, b, k)]))]));
    const effective = leaderboardEval.shrunk.dev.pTop5Sim < 0.05 && leaderboardEval.shrunk.holdout.pTop5Sim < 0.05;
    const ruleUse = {}; log.filter((e) => e.round >= 701 && e.round <= LAST).forEach((e) => e.picks.shrunk.forEach((x) => { ruleUse[x.id] = (ruleUse[x.id] ?? 0) + 1; }));
    const leaderChanges = log.filter((e) => e.round > 701 && e.round <= 1246).filter((e, i, a) => i && e.picks.shrunk[0]?.id !== a[i - 1].picks.shrunk[0]?.id).length;

    // 6) 신규 규칙 개별 성적(표본 외)
    const statOf = (id, a, b) => { let h = 0, n = 0, g3 = 0; const hist = Array(7).fill(0); for (let r = a; r <= b; r++) { const t = series[id].get(r); if (!t) continue; const k = hitCount(t, win(r)); h += k; n++; hist[k]++; if (k >= 3) g3++; } return n ? { rounds: n, mean: h / n, ge3Rate: g3 / n, hist, p: exactTail(n, h) } : null; };
    const newRules = Object.fromEntries(['N1', 'N2', 'N3', 'N4'].map((id) => [id, { dev: statOf(id, 601, 1100), holdout: statOf(id, 1101, 1245), all: statOf(id, 102, 1245) }]));

    // 7) 1246 순위표
    const final = log.find((e) => e.round === 1246);
    const board = rankBy(SCORERS.shrunk, 1246).map((x, k) => { const c = cum[idx[x.id]]; const rec = c.recent.slice(-104); return { rank: k + 1, id: x.id, score: x.s, rounds: c.n, mean: c.hits / c.n, recent104: rec.reduce((s, v) => s + v, 0) / rec.length, ticket: normTicket(series[x.id].get(1246)), name: meta[x.id]?.name ?? { N1: '슬롯 적중률 가중(두 엔진 66슬롯, 매회 갱신)', N2: '최근 104회 강세 체계 5개 득표', N3: '번호 특징 나이브 베이즈(득표·52회 빈도·간격)', N4: '순위표 상위 10개 규칙 합의' }[x.id], engine: meta[x.id]?.engine ?? (x.id === 'N2' ? 'latest' : x.id === 'N3' ? 'unse-c991927' : '두 엔진'), origin: meta[x.id]?.origin ?? '신규(이번 연구)' }; });
    const result = { generatedAt: new Date().toISOString(), protocol: 'ADAPTIVE_LEADERBOARD_PROTOCOL.md', next: NEXT, settings: { K, MIN_N, TOP, DUP }, random: { mean: MEAN0, best5Ge3Note: 'pBest5Sim 은 실제로 고른 5장의 겹침을 반영한 시뮬레이션' , pmf: PMF },
      liveRules: ids.length, leaderboardEval, effective, ruleUse, leaderChanges, newRules, top5For1246: final.picks.shrunk, variantsFor1246: { recent104: final.picks.recent104, plain: final.picks.plain }, board, famChoice1246,
      log: log.filter((e) => e.round >= 701).map((e) => ({ round: e.round, top5: e.picks.shrunk.map((x) => [x.id, x.hits ?? null]), rankCorr: e.rankCorr ?? null })) };
    await writeFile(join(OUT, 'results.json'), JSON.stringify(result, null, 2));
    await writeFile(join(OUT, 'new_rule_tickets.json'), JSON.stringify(Object.fromEntries(['N1', 'N2', 'N3', 'N4'].map((id) => [id, Object.fromEntries(series[id])]))));
    console.log(JSON.stringify({ effective, eval: leaderboardEval.shrunk, newRules: Object.fromEntries(Object.entries(newRules).map(([k, v]) => [k, { dev: v.dev?.mean, ho: v.holdout?.mean, pDev: v.dev?.p, pHo: v.holdout?.p }])), top5: final.picks.shrunk.map((x) => [x.id, x.ticket.join(',')]) }, null, 1));
  } finally { await rm(dir, { recursive: true, force: true }); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
