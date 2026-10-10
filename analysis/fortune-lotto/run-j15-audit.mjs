/* Research-only: J15 (6 formulas must jointly cover all 15 systems) vs U33 (free choice).
   Shared: all33 1/2/3-term universe, top2500 by train hits with neutral SHA256 tie-break (aac0151), greedy 6 lanes + local swap 2 pass,
   exact WF 7 splits, every winning-number read through a train-bound oracle. Writes only output/j15-audit. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPLITS, ensureUniverse, loadContext, poolHash, randomReference, splitIndexes, summarize, ticketAt, winningOracle } from './run-search-pool-audit.mjs';
import { rank } from './run-d-robustness-audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, 'output', 'j15-audit');
const POOL = 2500, MAX_USES = 2;

// Same ticket/score/ordering as the existing D runners.
const mark = new Int32Array(46); let stamp = 0;
function evaluate(forms, idx, masks) {
  const hist = [0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k], w = masks[k]; stamp++; let count = 0, hit = 0;
    for (const f of forms) { let n = f.v[i], steps = 0; while (mark[n] === stamp && steps++ < 45) n = n === 45 ? 1 : n + 1; if (mark[n] !== stamp) { mark[n] = stamp; count++; hit += w[n]; } if (count === 6) break; }
    for (let n = 1; count < 6; n++) if (mark[n] !== stamp) { mark[n] = stamp; count++; hit += w[n]; }
    hist[hit]++;
  }
  return summarize(hist);
}
const byScore = (a, b) => b.score - a.score || b.hist[6] - a.hist[6] || b.hist[5] - a.hist[5] || b.hist[4] - a.hist[4] || b.ge3Count - a.ge3Count || b.mean - a.mean;

/* J15 constraint state. Systems are bits 0..14 (alphabetical). A formula is eligible only with 2-3 distinct systems.
   feasible(uncovered, saturated, lanesLeft) asks whether the pool's system-sets can still cover every uncovered system
   without any system exceeding 2 uses; memoised on (uncovered, saturated, lanes), which fully determines the answer. */
export function makeJ15(pool, systemNames) {
  const bit = Object.fromEntries(systemNames.map((n, i) => [n, 1 << i])), ALL = (1 << systemNames.length) - 1;
  const maskOf = (f) => f.systems.reduce((m, s) => m | bit[s], 0);
  for (const f of pool) f.sysMask = maskOf(f);
  const sets = [...new Set(pool.filter((f) => f.systems.length >= 2 && f.systems.length <= 3).map((f) => f.sysMask))];
  const memo = new Map();
  const feasible = (uncovered, saturated, lanes) => {
    if (lanes === 0) return uncovered === 0;
    if (popcount(uncovered) > 3 * lanes) return false;
    const key = uncovered * 2 ** 20 + saturated * 8 + lanes; if (memo.has(key)) return memo.get(key);
    const low = uncovered & -uncovered; let ok = false;
    for (const m of sets) {
      if (m & saturated || (low && !(m & low))) continue;
      const used = ALL & ~uncovered, nextSat = saturated | (m & used); // a covered, unsaturated system reaches its 2nd use
      if (feasible(uncovered & ~m, nextSat, lanes - 1)) { ok = true; break; }
    }
    memo.set(key, ok); return ok;
  };
  const state = (forms) => { let uncovered = ALL, saturated = 0; const uses = {}; for (const f of forms) { for (const s of f.systems) uses[s] = (uses[s] ?? 0) + 1; uncovered &= ~f.sysMask; } for (const [s, n] of Object.entries(uses)) if (n >= MAX_USES) saturated |= bit[s]; return { uncovered, saturated, uses }; };
  const lawful = (forms) => forms.every((f) => f.systems.length >= 2 && f.systems.length <= 3) && new Set(forms).size === forms.length && Object.values(state(forms).uses).every((n) => n <= MAX_USES);
  return {
    // Greedy: adding f to `chosen` must keep the partial rule lawful and full coverage reachable with the lanes left.
    canAdd: (chosen, f) => { const q = [...chosen, f]; if (!lawful(q)) return false; const s = state(q); return feasible(s.uncovered, s.saturated, 6 - q.length); },
    complete: (forms) => forms.length === 6 && lawful(forms) && state(forms).uncovered === 0,
    ALL,
  };
}
const popcount = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

function search(pool, idx, masks, j15) {
  const chosen = [];
  while (chosen.length < 6) {
    let best;
    for (const f of pool) { if (j15 && !j15.canAdd(chosen, f)) continue; const s = evaluate([...chosen, f], idx, masks); if (!best || byScore(s, best.s) < 0) best = { f, s }; }
    if (!best) throw new Error('J15 greedy dead end');
    chosen.push(best.f);
  }
  if (j15 && !j15.complete(chosen)) throw new Error('J15 greedy produced an incomplete rule');
  let rule = { formulas: chosen, stats: evaluate(chosen, idx, masks) };
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (let lane = 0; lane < 6; lane++) {
      let best = rule;
      for (const f of pool) { const q = [...rule.formulas]; q[lane] = f; if (j15 && !j15.complete(q)) continue; const s = evaluate(q, idx, masks); if (byScore(s, best.stats) < 0) best = { formulas: q, stats: s }; }
      if (best !== rule) { rule = best; improved = true; }
    }
    if (!improved) break;
  }
  return rule;
}

export function train(ctx, model, idx) {
  const forms = ensureUniverse(ctx, 'all33'), access = {}, names = [...new Set(ctx.specs.map((s) => s.system))].sort();
  const rankRead = winningOracle(ctx.rows, idx, access, 'ranking');
  const pool = rank(forms, idx, idx.map(rankRead), 'neutral', ctx.specs).slice(0, POOL).map((x) => x.f);
  const searchRead = winningOracle(ctx.rows, idx, access, 'greedy_local_swap');
  const rule = search(pool, idx, idx.map(searchRead), model === 'J15' ? makeJ15(pool, names) : null);
  return { rule, pool, access };
}

const label = (f, specs) => `${f.op}(${f.members.map((i) => specs[i].id).join(',')})`;
function describe(rule, specs) {
  const systems = [...new Set(rule.formulas.flatMap((f) => f.systems))].sort(), lineages = [...new Set(rule.formulas.flatMap((f) => f.lineages))].sort();
  const uses = {}; for (const f of rule.formulas) for (const s of f.systems) uses[s] = (uses[s] ?? 0) + 1;
  return { formulas: rule.formulas.map((f) => label(f, specs)), system_count: systems.length, systems, system_uses: uses, unique_lineage_count: lineages.length, lineages, duplicate_formula_count: 6 - new Set(rule.formulas).size };
}

export function runModel(ctx, model) {
  const all = ctx.rows.map((_, i) => i), full = train(ctx, model, all);
  const splits = SPLITS.map((range) => {
    const z = splitIndexes(range), t = train(ctx, model, z.train), read = winningOracle(ctx.rows, z.test, {}, 'evaluation');
    const tickets = z.test.map((i) => ticketAt(t.rule.formulas, i));
    for (const tk of tickets) if (tk.length !== 6 || new Set(tk).size !== 6 || tk.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) throw new Error('invalid ticket');
    const access = Object.fromEntries(Object.entries(t.access).map(([k, v]) => [k, { reads: v.reads, max: v.max, test_indexes_read: [...v.indexes].filter((i) => i >= z.test[0]).length }]));
    const stats = evaluate(t.rule.formulas, z.test, z.test.map(read));
    return { label: z.label, rounds: z.test.length, score: stats.score, hist: stats.hist, ...describe(t.rule, ctx.specs), pool_hash: poolHash(t.pool), stage_access: access, leakage_check: Object.values(access).every((a) => a.test_indexes_read === 0), tickets };
  });
  const hist = [0, 0, 0, 0, 0, 0, 0]; splits.forEach((s) => s.hist.forEach((n, k) => { hist[k] += n; }));
  const wf = summarize(hist), perRound = randomReference(1).expected_score;
  // Concentration: each split's share of total WF score and of excess over the random expectation.
  const excess = splits.map((s) => s.score - perRound * s.rounds), totalExcess = excess.reduce((a, b) => a + b, 0);
  const concentration = { random_expected_per_round: perRound, total_excess_over_random: totalExcess, splits: splits.map((s, k) => ({ label: s.label, score: s.score, score_share: s.score / wf.score, round_share: s.rounds / wf.rounds, excess: excess[k] })), wf_without_best_split: wf.score - Math.max(...splits.map((s) => s.score)) };
  const top = concentration.splits.reduce((a, b) => (b.excess > a.excess ? b : a));
  concentration.top_split = top.label; concentration.top_split_excess_share = totalExcess > 0 ? top.excess / totalExcess : null;
  concentration.concentrated = totalExcess > 0 ? top.excess / totalExcess > 0.5 : null;
  return { model, universe_size: ensureUniverse(ctx, 'all33').length, pool_size: POOL, in_sample: { stats: full.rule.stats, ...describe(full.rule, ctx.specs) }, exact_walk_forward: { stats: wf, all_leakage_checks: splits.every((s) => s.leakage_check), splits, concentration } };
}

async function main() {
  const ctx = await loadContext(); await mkdir(OUT, { recursive: true });
  const R = { U33: runModel(ctx, 'U33'), J15: runModel(ctx, 'J15') };
  for (const [m, x] of Object.entries(R)) await writeFile(join(OUT, `${m}.json`), `${JSON.stringify(x, null, 2)}\n`);
  const row = (m) => { const x = R[m], w = x.exact_walk_forward.stats; return `| ${m} | ${x.in_sample.stats.score} | ${w.score} | ${w.mean.toFixed(4)} | ${w.ge3Count} | ${w.ge4Count} | ${w.ge5Count} | ${w.sixHit} | ${x.exact_walk_forward.splits.map((s) => s.score).join(' / ')} | ${x.in_sample.system_count} | ${x.in_sample.unique_lineage_count} |`; };
  const c = R.J15.exact_walk_forward.concentration;
  const md = ['# J15 vs U33 (연구용)', '', 'all33 1/2/3항 · top2500 · 중립 SHA256 tie-break · greedy 6 lanes + local swap 2 pass · train-only exact WF 7 splits.', '',
    '| 모델 | in-sample | exact WF | WF mean | 3+ | 4+ | 5+ | 6-hit | split별 WF | in-sample system 수 | unique lineage |', '|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|', row('U33'), row('J15'), '',
    `J15 WF split별 system 수: ${R.J15.exact_walk_forward.splits.map((s) => s.system_count).join(' / ')} · unique lineage: ${R.J15.exact_walk_forward.splits.map((s) => s.unique_lineage_count).join(' / ')}`, '',
    `J15 split 쏠림: split별 WF 점수 비중 vs 회차 비중 = ${c.splits.map((x) => `${(x.score_share * 100).toFixed(1)}%/${(x.round_share * 100).toFixed(1)}%`).join(', ')}. 최고 split 제외 WF ${c.wf_without_best_split}. 무작위 기대(회당 ${c.random_expected_per_round.toFixed(3)}) 대비 초과분 합 ${c.total_excess_over_random.toFixed(1)}${c.top_split_excess_share == null ? ' — 초과분이 없어 초과분 쏠림은 해당 없음' : `, 최대 기여 ${c.top_split} ${(c.top_split_excess_share * 100).toFixed(0)}% (50% 초과면 쏠림: ${c.concentrated})`}.`,
    ...Object.entries(R).flatMap(([m, x]) => [`## ${m} in-sample 최종 6식`, '', ...x.in_sample.formulas.map((f) => `- \`${f}\``), '', `system ${x.in_sample.system_count}: ${x.in_sample.systems.join(', ')} · lineage ${x.in_sample.unique_lineage_count}`, '']),
  ].join('\n');
  await writeFile(join(OUT, 'report.md'), `${md}\n`);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(R).map(([m, x]) => [m, { in: x.in_sample.stats.score, wf: x.exact_walk_forward.stats.score, ge4: x.exact_walk_forward.stats.ge4Count, ge5: x.exact_walk_forward.stats.ge5Count, six: x.exact_walk_forward.stats.sixHit, splits: x.exact_walk_forward.splits.map((s) => s.score), sys: x.exact_walk_forward.splits.map((s) => s.system_count), lin: x.in_sample.unique_lineage_count, conc: x.exact_walk_forward.concentration.top_split_excess_share }]))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exitCode = 1; });
