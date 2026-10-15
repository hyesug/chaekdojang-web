/*
 * 순위 갱신 방식 비교(연구 전용). 절차: RANKING_METHODS_PROTOCOL.md(결과 확인 전 고정).
 * 입력: 기존 연구의 표본 외 티켓(rule-revalidation·combination-rules·adaptive-leaderboard). 출력: output/ranking-methods/ 만.
 * 실행(저장소 루트): node analysis/fortune-lotto/run-ranking-methods.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRIOR = join(HERE, 'output');
const OUT = join(PRIOR, 'ranking-methods');
const MIN_N = 100, DUP = 3, TOP = 5, FROM = 701, LAST = 1245, DEV = [701, 1100], HOLD = [1101, 1245];
const json = async (p) => JSON.parse(await readFile(join(PRIOR, p), 'utf8'));
function mulberry32(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hitCount = (t, w) => t.filter((n) => w.includes(n)).length;
const normalCdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const tTest = (xs) => { const n = xs.length, m = xs.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)); const z = m / (sd / Math.sqrt(n)); return { mean: m, z, p: 1 - normalCdf(z) }; };
function avgRanks(values) { const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const out = Array(values.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) out[idx[k][1]] = (i + j) / 2; i = j + 1; } return out; }
function spearman(a, b) { const ra = avgRanks(a), rb = avgRanks(b), n = a.length, ma = ra.reduce((s, v) => s + v, 0) / n, mb = rb.reduce((s, v) => s + v, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (ra[i] - ma) * (rb[i] - mb); va += (ra[i] - ma) ** 2; vb += (rb[i] - mb) ** 2; } return va && vb ? c / Math.sqrt(va * vb) : 0; }

export async function main() {
  await mkdir(OUT, { recursive: true });
  const base = await json('adaptive-leaderboard/baseline.json');
  const prior = await json('rule-revalidation/tickets.json'), combo = (await json('combination-rules/tickets.json')).series, newr = await json('adaptive-leaderboard/new_rule_tickets.json');
  const sources = { ...prior, ...combo, N1: newr.N1, N2: newr.N2, N3: newr.N3 };
  const ids = base.ruleIds.filter((id) => id !== 'N4'); // N4 는 순위 방식에 따라 티켓이 바뀌므로 제외
  const winners = base.draws.map((d) => d.numbers);
  const tickets = ids.map((id) => { const s = sources[id]; if (!s) throw new Error(`티켓 없음 ${id}`); return Array.from({ length: LAST }, (_, i) => s[i + 1] ?? null); });
  const H = tickets.map((ts) => ts.map((t, i) => t ? hitCount(t, winners[i]) : -1));

  // 방식 정의: state 를 회차 결과로 갱신하고 score(state) 로 점수
  const decay = (h) => ({ lam: Math.pow(0.5, 1 / h) });
  const METHODS = {
    'M-cum': { score: (s) => (s.sum + 100 * 0.8) / (s.n + 100) },
    'M-plain': { score: (s) => s.sum / s.n },
    ...Object.fromEntries([52, 104, 260].map((w) => [`M-win${w}`, { family: 'M-win', score: (s) => { const x = s.hist.slice(-w); return x.reduce((a, b) => a + b, 0) / x.length; } }])),
    ...Object.fromEntries([26, 52, 104, 260].map((h) => [`M-decay${h}`, { family: 'M-decay', decay: decay(h), score: (s, m) => s.ew[m] ? s.es[m] / s.ew[m] : 0 }])),
    'M-trend': { score: (s) => { const a = s.hist.slice(-52), b = s.hist.slice(-104, -52); return a.reduce((x, y) => x + y, 0) / a.length - (b.length ? b.reduce((x, y) => x + y, 0) / b.length : 0.8); } },
    'M-revert': { score: (s) => -METHODS['M-trend'].score(s) },
  };
  const names = Object.keys(METHODS);
  const RANDOM_SEEDS = 20;
  const st = ids.map(() => ({ sum: 0, n: 0, hist: [], es: {}, ew: {} }));
  const common = ids.map(() => new Float64Array(ids.length)), commonN = ids.map(() => new Int32Array(ids.length));
  const pickTop = (ranked) => { const out = []; for (const i of ranked) { if (out.length >= TOP) break; if (out.every((j) => !commonN[i][j] || common[i][j] / commonN[i][j] < DUP)) out.push(i); } return out; };
  const log = Object.fromEntries([...names, ...Array.from({ length: RANDOM_SEEDS }, (_, k) => `M-random#${k}`)].map((m) => [m, []]));
  const rands = Array.from({ length: RANDOM_SEEDS }, (_, k) => mulberry32(5000 + k));
  for (let r = 1; r <= LAST; r++) {
    const ri = r - 1;
    if (r >= FROM) {
      const eligible = ids.map((_, i) => i).filter((i) => st[i].n >= MIN_N && H[i][ri] >= 0);
      const hits = eligible.map((i) => H[i][ri]); const poolMean = hits.reduce((s, v) => s + v, 0) / hits.length;
      const record = (m, scores) => {
        const order = eligible.map((i, k) => ({ i, s: scores[k] })).sort((a, b) => b.s - a.s || ids[a.i].localeCompare(ids[b.i])).map((x) => x.i);
        const top = pickTop(order);
        log[m].push({ r, top, top5: top.reduce((s, i) => s + H[i][ri], 0) / top.length, top1: H[top[0]][ri], best: Math.max(...top.map((i) => H[i][ri])), poolMean, rho: spearman(scores, hits) });
      };
      for (const m of names) record(m, eligible.map((i) => METHODS[m].score(st[i], m)));
      rands.forEach((rand, k) => record(`M-random#${k}`, eligible.map(() => rand())));
    }
    // 회차 r 결과 반영
    for (let i = 0; i < ids.length; i++) { const h = H[i][ri]; if (h < 0) continue; const s = st[i]; s.sum += h; s.n++; s.hist.push(h); for (const m of names) if (METHODS[m].decay) { s.es[m] = (s.es[m] ?? 0) * METHODS[m].decay.lam + h; s.ew[m] = (s.ew[m] ?? 0) * METHODS[m].decay.lam + 1; } }
    for (let i = 0; i < ids.length; i++) if (tickets[i][ri]) for (let j = i + 1; j < ids.length; j++) if (tickets[j][ri]) { const c = hitCount(tickets[i][ri], tickets[j][ri]); common[i][j] += c; common[j][i] += c; commonN[i][j]++; commonN[j][i]++; }
  }

  // 지표
  const within = (rows, [a, b]) => rows.filter((x) => x.r >= a && x.r <= b);
  const randomAvg = (period) => { const per = Array.from({ length: RANDOM_SEEDS }, (_, k) => within(log[`M-random#${k}`], period)); return per[0].map((row, idx) => per.reduce((s, rows) => s + rows[idx].top5, 0) / RANDOM_SEEDS); };
  const relative = (m, period) => {
    const rows = within(log[m], period), rnd = randomAvg(period);
    const excess = tTest(rows.map((x) => x.top5 - x.poolMean)), rho = tTest(rows.map((x) => x.rho)), vsRandom = tTest(rows.map((x, k) => x.top5 - rnd[k]));
    let turnover = 0; rows.forEach((x, k) => { if (k) turnover += x.top.filter((i) => !rows[k - 1].top.includes(i)).length; });
    return { rounds: rows.length, excess, rankCorr: rho, vsRandom, turnover: turnover / Math.max(1, rows.length - 1), top5Mean: rows.reduce((s, x) => s + x.top5, 0) / rows.length, top1Mean: rows.reduce((s, x) => s + x.top1, 0) / rows.length, best5Ge3: rows.filter((x) => x.best >= 3).length / rows.length, poolMean: rows.reduce((s, x) => s + x.poolMean, 0) / rows.length };
  };
  const evalNames = [...names, 'M-random#0'];
  const rel = Object.fromEntries(evalNames.map((m) => [m, { dev: relative(m, DEV), holdout: relative(m, HOLD) }]));
  // 하이퍼파라미터: 개발 구간 초과 적중 최대
  const chooseFamily = (fam) => names.filter((m) => METHODS[m].family === fam).sort((a, b) => rel[b].dev.excess.mean - rel[a].dev.excess.mean)[0];
  const chosen = { 'M-win': chooseFamily('M-win'), 'M-decay': chooseFamily('M-decay') };
  const finalists = ['M-cum', 'M-plain', chosen['M-win'], chosen['M-decay'], 'M-trend', 'M-revert', 'M-random#0'];

  // 실제 예측 우위: 고른 티켓 고정, 당첨만 가상 공정 추첨(방식 전체 max-T)
  const mask = (t) => { let lo = 0, hi = 0; for (const n of t) { if (n <= 30) lo |= 1 << (n - 1); else hi |= 1 << (n - 31); } return [lo, hi]; };
  const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
  const absolute = (period, methods, sims = 10000, seed = 9) => {
    const rand = mulberry32(seed); const packs = methods.map((m) => within(log[m], period).map((x) => x.top.map((i) => mask(tickets[i][x.r - 1]))));
    const obs = methods.map((m) => within(log[m], period).reduce((s, x) => s + x.top5, 0) / within(log[m], period).length);
    const nR = packs[0].length; const ge = methods.map(() => 0); const maxGe = methods.map(() => 0); const ge3 = methods.map(() => 0);
    const obsBest = methods.map((m) => within(log[m], period).filter((x) => x.best >= 3).length);
    const pool = Array.from({ length: 45 }, (_, i) => i + 1);
    for (let s = 0; s < sims; s++) {
      const draws = Array.from({ length: nR }, () => { for (let i = 0; i < 6; i++) { const j = i + Math.floor(rand() * (45 - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; } return mask(pool.slice(0, 6)); });
      const vals = packs.map((rounds) => { let tot = 0, b3 = 0; rounds.forEach((top, k) => { const [wl, wh] = draws[k]; let sum = 0, best = 0; for (const [l, h] of top) { const c = pop(l & wl) + pop(h & wh); sum += c; if (c > best) best = c; } tot += sum / top.length; if (best >= 3) b3++; }); return { mean: tot / rounds.length, b3 }; });
      const mx = Math.max(...vals.map((v) => v.mean));
      vals.forEach((v, k) => { if (v.mean >= obs[k] - 1e-12) ge[k]++; if (mx >= obs[k] - 1e-12) maxGe[k]++; if (v.b3 >= obsBest[k]) ge3[k]++; });
    }
    return Object.fromEntries(methods.map((m, k) => [m, { top5Mean: obs[k], p: (ge[k] + 1) / (sims + 1), pMaxT: (maxGe[k] + 1) / (sims + 1), pBest5Ge3: (ge3[k] + 1) / (sims + 1) }]));
  };
  const abs = { dev: absolute(DEV, evalNames, 10000, 11), holdout: absolute(HOLD, finalists, 10000, 12) };
  const verdict = Object.fromEntries(finalists.filter((m) => !m.startsWith('M-random')).map((m) => {
    const h = rel[m].holdout; return [m, { algorithm: h.excess.mean > 0 && h.excess.p < 0.05 && h.excess.mean > rel['M-cum'].holdout.excess.mean, prediction: abs.holdout[m].pMaxT < 0.05 }];
  }));
  const result = { generatedAt: new Date().toISOString(), protocol: 'RANKING_METHODS_PROTOCOL.md', pool: ids.length, periods: { dev: DEV, holdout: HOLD }, chosen, finalists, relative: rel, absolute: abs, verdict };
  await writeFile(join(OUT, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ chosen, verdict, dev: Object.fromEntries(evalNames.map((m) => [m, [+rel[m].dev.excess.mean.toFixed(4), +rel[m].dev.top5Mean.toFixed(3)]])), holdout: Object.fromEntries(finalists.map((m) => [m, [+rel[m].holdout.excess.mean.toFixed(4), +rel[m].holdout.top5Mean.toFixed(3), +abs.holdout[m].pMaxT.toFixed(3)]])) }, null, 1));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
