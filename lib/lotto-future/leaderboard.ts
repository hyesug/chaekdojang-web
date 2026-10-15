import baseline from "../../analysis/fortune-lotto/output/adaptive-leaderboard/baseline.json";
import stateMatrix from "../../analysis/fortune-lotto/output/method-comparison/method-E/state_matrix.json";
import { eventFeatures, ENGINE_VERSION } from "./event-features.mjs";
import { eventFeatures as latestEventFeatures, LATEST_ENGINE_VERSION } from "./event-features-latest.mjs";
import { candidateValues, generateFrozenPredictions, state, voteStrategyTickets, type FeatureSet } from "./predictor";
import { historyTicket, newRuleTickets, systemTicket, voteFamilyTickets } from "./leaderboard-rules.mjs";

// 변동 순위표: 연구(analysis/fortune-lotto/ADAPTIVE_LEADERBOARD_PROTOCOL.md)의 후보 규칙을 매 회차 계산하고
// 그 회차 이전 표본 외 성적(1–1245 기준선 + 이후 저장된 순위표 티켓)으로 순위를 매긴다. 순위는 성적이지 확률이 아니다.
export const LEADERBOARD_VERSION = "leaderboard-v1";
type Event = { round: number; drawDate: string; drawTime: string };
type History = Event & { numbers: number[] };
export type LeaderboardResult = { round: number; actual: number[]; tickets: Record<string, number[]> };
export type LeaderboardEntry = { ruleId: string; numbers: number[]; rank: number | null; score: number | null; recordRounds: number; recordMean: number | null; recentMean: number | null; top5Rank: number | null };
type Baseline = { lastRound: number; settings: { K: number; MIN_N: number; TOP: number; DUP: number }; ruleIds: string[]; records: Array<{ hits: number; n: number; recent: number[] }>;
  common: number[][]; commonN: number[][]; slotNames: { frozen: string[]; latest: string[] }; cands: { frozen: number[][]; latest: number[][] }; latestStates: number[][]; draws: History[] };
const base = baseline as unknown as Baseline;
const { K, MIN_N, TOP, DUP } = base.settings;
const MEAN0 = 0.8;
const cyclic = (stateMatrix.feature_ids as string[]).map((id) => /longitude|sexagenary|nakshatra|hexagram|cycle/.test(id));
const sorted = (t: number[]) => [...t].sort((a, b) => a - b);
const hitCount = (t: number[], w: number[]) => t.filter((n) => w.includes(n)).length;
const toSlots = (names: string[], values: number[]) => Object.fromEntries(names.map((s, i) => [s, values[i]]));
function parts(event: Event) {
  const [year, month, day] = event.drawDate.split("-").map(Number); const [hour, minute] = event.drawTime.slice(0, 5).split(":").map(Number);
  return { year, month, day, hour, minute };
}
function requireTicket(t: number[] | undefined, where: string): number[] {
  if (!t || t.length !== 6 || new Set(t).size !== 6 || t.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) throw new Error(`Leaderboard ticket is invalid: ${where}`);
  return sorted(t);
}

export function generateLeaderboard(event: Event, history: History[], results: LeaderboardResult[]) {
  if (event.round <= base.lastRound) throw new Error(`Leaderboard starts after round ${base.lastRound}`);
  // 1) 당첨 이력: 기준선 1–1245 + 그 뒤 확정 회차. 빈 회차가 있으면 이력 규칙이 틀어지므로 생성하지 않는다.
  const draws: History[] = [...base.draws];
  for (let r = base.lastRound + 1; r < event.round; r++) {
    const row = history.find((h) => h.round === r); if (!row) throw new Error(`Leaderboard needs confirmed result for round ${r}`);
    draws.push({ ...row, numbers: requireTicket(row.numbers, `history ${r}`) });
  }
  const events = [...draws, { ...event, numbers: [] }];
  // 2) 두 엔진 후보 슬롯·최신 엔진 상태(기준선 이후 회차는 지금 계산)
  const frozen: Record<number, Record<string, number>> = {}, latest: Record<number, Record<string, number>> = {}, latestStates: Record<number, number[]> = {};
  base.draws.forEach((d, i) => { frozen[d.round] = toSlots(base.slotNames.frozen, base.cands.frozen[i]); latest[d.round] = toSlots(base.slotNames.latest, base.cands.latest[i]); latestStates[d.round] = base.latestStates[i]; });
  for (const d of events.filter((e) => e.round > base.lastRound)) {
    frozen[d.round] = candidateValues(eventFeatures(parts(d)) as unknown as FeatureSet);
    const lf = latestEventFeatures(parts(d)) as unknown as FeatureSet; latest[d.round] = candidateValues(lf); latestStates[d.round] = state(lf);
  }
  // 3) 규칙별 기록: 기준선 + 저장된 순위표 결과(기준선 이후·대상 이전 회차만)
  const ids = base.ruleIds, idx = Object.fromEntries(ids.map((id, i) => [id, i]));
  const rec = base.records.map((r) => ({ hits: r.hits, n: r.n, recent: [...r.recent] }));
  const common = base.common.map((row) => [...row]), commonN = base.commonN.map((row) => [...row]);
  for (const result of [...results].filter((x) => x.round > base.lastRound && x.round < event.round).sort((a, b) => a.round - b.round)) {
    const actual = requireTicket(result.actual, `result ${result.round}`);
    const tickets = ids.map((id) => result.tickets[id] ? requireTicket(result.tickets[id], `${id} ${result.round}`) : null);
    tickets.forEach((t, i) => { if (!t) return; const k = hitCount(t, actual); rec[i].hits += k; rec[i].n++; rec[i].recent = [...rec[i].recent, k].slice(-104); });
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = tickets[i], b = tickets[j]; if (!a || !b) continue; const c = hitCount(a, b); common[i][j] += c; common[j][i] += c; commonN[i][j]++; commonN[j][i]++; }
  }
  // 4) 대상 회차 티켓
  const past = draws.filter((d) => d.round < event.round);
  const tickets: Record<string, number[]> = {};
  const op = generateFrozenPredictions(event, history.filter((h) => h.round < event.round)).predictions as Record<string, number[]>;
  for (const code of ["A", "D", "E", "F", "H", "S1", "S2", "S3"]) tickets[`OP-${code}`] = op[code];
  const lv = voteStrategyTickets(latest[event.round]); for (const code of ["S1", "S2", "S3"] as const) tickets[`L-${code}`] = lv[code];
  for (const id of ids.filter((x) => x.startsWith("SYS-"))) tickets[id] = systemTicket(id[4] === "F" ? frozen[event.round] : latest[event.round], id.slice(6));
  for (const id of ids.filter((x) => x.startsWith("HS-"))) tickets[id] = historyTicket(id.slice(3), past.map((d) => d.numbers));
  { const dist = (a: number[], b: number[]) => a.reduce((s, x, i) => { const t = Math.abs(x - b[i]); return s + (cyclic[i] ? Math.min(t, 1 - t) : t); }, 0) / a.length;
    const nb = past.map((p) => ({ p, v: dist(latestStates[event.round], latestStates[p.round]) })).sort((a, b) => a.v - b.v || a.p.round - b.p.round).slice(0, 10);
    const c = Array(46).fill(0); nb.forEach(({ p }) => p.numbers.forEach((n) => { c[n]++; })); tickets["L-F"] = Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => c[b] - c[a] || a - b).slice(0, 6); }
  const families = ids.filter((x) => x.startsWith("LV-")).map((x) => x.slice(3));
  const lvt = voteFamilyTickets(latest, past, event.round, families); families.forEach((f) => { tickets[`LV-${f}`] = lvt[f].ticket; });
  tickets["FV-전체"] = voteFamilyTickets(frozen, past, event.round, ["전체"])["전체"].ticket;
  const winners = Object.fromEntries(past.map((d) => [d.round, d.numbers]));
  Object.assign(tickets, newRuleTickets(frozen, latest, winners, event.round));
  // 5) 순위(축소 평균, 기록 100회 이상) → N4(상위 10개 합의) → 같은 번호 규칙을 건너뛰며 상위 5개
  const scoreOf = (i: number) => (rec[i].hits + K * MEAN0) / (rec[i].n + K);
  const rankAll = (exclude: string[] = []) => ids.filter((id) => !exclude.includes(id) && rec[idx[id]].n >= MIN_N && tickets[id]).map((id) => ({ id, s: scoreOf(idx[id]) })).sort((a, b) => b.s - a.s || a.id.localeCompare(b.id));
  const votes = new Map<number, { c: number; best: number }>();
  rankAll(["N4"]).slice(0, 10).forEach((x, k) => tickets[x.id].forEach((n) => { const e = votes.get(n) ?? { c: 0, best: k }; e.c++; votes.set(n, e); }));
  tickets.N4 = [...votes.entries()].sort((a, b) => b[1].c - a[1].c || a[1].best - b[1].best || a[0] - b[0]).slice(0, 6).map(([n]) => n);
  const ranked = rankAll(); const top: string[] = [];
  for (const x of ranked) { if (top.length >= TOP) break; const i = idx[x.id]; if (top.every((y) => { const j = idx[y]; return !commonN[i][j] || common[i][j] / commonN[i][j] < DUP; })) top.push(x.id); }
  const entries: LeaderboardEntry[] = ids.map((id) => {
    const i = idx[id], r = rec[i], k = ranked.findIndex((x) => x.id === id);
    return { ruleId: id, numbers: requireTicket(tickets[id], `${id} ${event.round}`), rank: k < 0 ? null : k + 1, score: k < 0 ? null : ranked[k].s, recordRounds: r.n,
      recordMean: r.n ? r.hits / r.n : null, recentMean: r.recent.length ? r.recent.reduce((s, v) => s + v, 0) / r.recent.length : null, top5Rank: top.includes(id) ? top.indexOf(id) + 1 : null };
  });
  return { round: event.round, modelVersion: LEADERBOARD_VERSION, engineVersion: `${ENGINE_VERSION}+${LATEST_ENGINE_VERSION}`, entries };
}
