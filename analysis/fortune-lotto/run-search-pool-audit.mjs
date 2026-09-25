/* Research-only D search-pool audit. Reads method-comparison + search-space-audit, writes only output/search-pool-audit.
   Same D algorithm (train-only ranking → pool → greedy 6 lanes → whole-ticket local swap ≤2 pass); only universe/pool differ. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'output', 'method-comparison');
const SPACE = join(HERE, 'output', 'search-space-audit');
export const OUT = join(HERE, 'output', 'search-pool-audit');
const SCORE = [0, 1, 3, 10, 50, 300, 3000];
const PAIR_OPS = ['sum', 'diff', 'rdiff', 'abs', 'a2b', 'twoab', 'twoMinus', 'minusTwo', 'mul', 'mean'];
const TRIPLE_OPS = ['abcSum', 'abcSub', 'abPlusC', 'abMinusC', 'twoABC', 'aTwoBC', 'abTwoC', 'absPlusC'];
export const NEW_TRIPLE_SYSTEMS = ['gujeong', 'sukyo', 'tojeong', 'kabbalah', 'mahabote', 'thai', 'tarot'];
export const SPLITS = [[600, 700], [700, 800], [800, 900], [900, 1000], [1000, 1100], [1100, 1200], [1200, 1242]];
const D_BASE_RATIO = 900 / 17633;
export const VARIANTS = {
  D1: { file: 'D_first22_top900.json', triples: 'first22', pool: 'top', size: 900, label: 'first22 + top900 (기존 D)' },
  D2: { file: 'D_all33_top2500.json', triples: 'all33', pool: 'top', size: 2500, label: 'triple_all + global top2500' },
  D3: { file: 'D_all33_diverse2500.json', triples: 'all33', pool: 'diverse', size: 2500, label: 'triple_all + system round-robin diverse2500' },
};

const wrap45 = (x) => ((Math.floor(x) - 1) % 45 + 45) % 45 + 1;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const formulaKey = (f) => `${f.a}|${f.b ?? ''}|${f.c ?? ''}|${f.op}`;
const OPS = { one: (a) => a, sum: (a, b) => a + b, diff: (a, b) => a - b, rdiff: (a, b) => b - a, abs: (a, b) => Math.abs(a - b), a2b: (a, b) => 2 * a + b, twoab: (a, b) => a + 2 * b, twoMinus: (a, b) => 2 * a - b, minusTwo: (a, b) => a - 2 * b, mul: (a, b) => a * b, mean: (a, b) => Math.floor((a + b) / 2), abcSum: (a, b, c) => a + b + c, abcSub: (a, b, c) => a + b - c, abPlusC: (a, b, c) => a - b + c, abMinusC: (a, b, c) => a - b - c, twoABC: (a, b, c) => 2 * a + b - c, aTwoBC: (a, b, c) => a + 2 * b - c, abTwoC: (a, b, c) => a + b - 2 * c, absPlusC: (a, b, c) => Math.abs(a - b) + c };

// Identical order/complexity to run-search-space-audit.mjs universe(); tripleLimit=22 is the old first22 restriction.
export function buildUniverse(count, tripleLimit) {
  const out = [];
  for (let a = 0; a < count; a++) out.push({ a, op: 'one', complexity: 1 });
  for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) for (const op of PAIR_OPS) out.push({ a, b, op, complexity: op === 'mul' ? 4 : op === 'mean' ? 3 : ['sum', 'diff', 'rdiff', 'abs'].includes(op) ? 2 : 3 });
  for (let a = 0; a < tripleLimit; a++) for (let b = a + 1; b < tripleLimit; b++) for (let c = b + 1; c < tripleLimit; c++) for (const op of TRIPLE_OPS) out.push({ a, b, c, op, complexity: 3 });
  return out;
}

export function prepareUniverse(forms, candidates, specs) {
  for (const f of forms) {
    const v = new Uint8Array(candidates.length), fn = OPS[f.op];
    for (let i = 0; i < candidates.length; i++) v[i] = wrap45(fn(candidates[i][f.a], f.b == null ? 0 : candidates[i][f.b], f.c == null ? 0 : candidates[i][f.c]));
    const members = [f.a, f.b, f.c].filter(Number.isInteger);
    Object.assign(f, { v, key: formulaKey(f), members, systems: [...new Set(members.map((i) => specs[i].system))], lineages: [...new Set(members.map((i) => specs[i].lineage))] });
  }
  return forms;
}

/* Winning numbers are only reachable through an oracle bound to an allowed index set; any other index throws.
   Every stage records what it read so the audit can prove test rounds were never touched before evaluation. */
export function winningOracle(rows, allowed, log, stage) {
  const ok = new Set(allowed), seen = new Set();
  log[stage] = { reads: 0, min: null, max: null, indexes: seen };
  return (i) => {
    if (!ok.has(i)) throw new Error(`leakage: ${stage} tried to read round index ${i}`);
    seen.add(i); const s = log[stage]; s.reads++; s.min = s.min == null ? i : Math.min(s.min, i); s.max = s.max == null ? i : Math.max(s.max, i);
    const mask = new Uint8Array(46); for (const n of rows[i].winning) mask[n] = 1; return mask;
  };
}

// Same number resolution as run-search-space-audit.mjs ticket(): wrap45, +1 cyclic on duplicate, pad with smallest free numbers.
export function ticketAt(forms, i, audit) {
  const t = [];
  for (const f of forms) { let n = f.v[i], steps = 0; while (t.includes(n) && steps++ < 45) n = n === 45 ? 1 : n + 1; if (steps && audit) audit.adjustments++; if (!t.includes(n)) t.push(n); if (t.length === 6) return t; }
  for (let n = 1; t.length < 6; n++) if (!t.includes(n)) t.push(n);
  return t;
}

const mark = new Int32Array(46); let stamp = 0;
function histOf(forms, idx, masks) {
  const hist = [0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k], w = masks[k]; stamp++; let count = 0, hit = 0;
    for (const f of forms) { let n = f.v[i], steps = 0; while (mark[n] === stamp && steps++ < 45) n = n === 45 ? 1 : n + 1; if (mark[n] !== stamp) { mark[n] = stamp; count++; hit += w[n]; } if (count === 6) break; }
    for (let n = 1; count < 6; n++) if (mark[n] !== stamp) { mark[n] = stamp; count++; hit += w[n]; }
    hist[hit]++;
  }
  return hist;
}
export function summarize(hist) {
  const rounds = hist.reduce((s, n) => s + n, 0), hits = hist.reduce((s, n, k) => s + n * k, 0), c = (k) => hist.slice(k).reduce((s, n) => s + n, 0);
  return { score: hist.reduce((s, n, k) => s + n * SCORE[k], 0), hist, hits, mean: hits / rounds, ge3: c(3) / rounds, ge4: c(4) / rounds, ge3Count: c(3), ge4Count: c(4), ge5Count: c(5), fiveHit: hist[5], sixHit: hist[6], rounds };
}
// Same ordering as byScore in run-search-space-audit.mjs; negative means a is better.
const byScore = (a, b) => b.score - a.score || b.hist[6] - a.hist[6] || b.hist[5] - a.hist[5] || b.hist[4] - a.hist[4] || b.ge3Count - a.ge3Count || b.mean - a.mean;

export function rankFormulas(forms, idx, masks) {
  const hit = new Int32Array(forms.length);
  for (let f = 0; f < forms.length; f++) { const v = forms[f].v; let h = 0; for (let k = 0; k < idx.length; k++) h += masks[k][v[idx[k]]]; hit[f] = h; }
  return forms.map((f, i) => ({ f, hit: hit[i], i })).sort((x, y) => y.hit - x.hit || x.f.complexity - y.f.complexity || x.i - y.i);
}

/* D3 pool: systems in fixed alphabetical order take turns adding their best not-yet-pooled formula (train ranking),
   cycling until size; if round-robin runs dry the rest comes from the global ranking. No lineage quota. */
export function diversePool(ranking, specs, size) {
  const names = [...new Set(specs.map((s) => s.system))].sort();
  const lists = Object.fromEntries(names.map((n) => [n, ranking.filter((x) => x.f.systems.includes(n))]));
  const pos = Object.fromEntries(names.map((n) => [n, 0])), seen = new Set(), pool = [], source = { round_robin: 0, global_fill: 0 }, turns = Object.fromEntries(names.map((n) => [n, 0]));
  while (pool.length < size) {
    let added = false;
    for (const n of names) {
      while (pos[n] < lists[n].length && seen.has(lists[n][pos[n]].f.key)) pos[n]++;
      if (pos[n] >= lists[n].length) continue;
      const f = lists[n][pos[n]++].f; seen.add(f.key); pool.push(f); source.round_robin++; turns[n]++; added = true;
      if (pool.length === size) break;
    }
    if (!added) break;
  }
  for (const x of ranking) { if (pool.length >= size) break; if (!seen.has(x.f.key)) { seen.add(x.f.key); pool.push(x.f); source.global_fill++; } }
  return { pool, source, system_order: names, round_robin_picks_by_system: turns };
}

export function buildPool(variant, ranking, specs) {
  if (variant.pool === 'top') return { pool: ranking.slice(0, variant.size).map((x) => x.f), source: { global_top: variant.size } };
  return diversePool(ranking, specs, variant.size);
}
export const poolHash = (pool) => sha256(pool.map((f) => f.key).join(';'));

function search(pool, idx, masks) {
  const evaluate = (forms) => summarize(histOf(forms, idx, masks));
  const chosen = [];
  while (chosen.length < 6) { let best; for (const f of pool) { const s = evaluate([...chosen, f]); if (!best || byScore(s, best.s) < 0) best = { f, s }; } chosen.push(best.f); }
  let rule = { formulas: chosen, stats: evaluate(chosen) }, passes = 0;
  for (let pass = 0; pass < 2; pass++) {
    let improved = false; passes++;
    for (let lane = 0; lane < 6; lane++) {
      let best = rule;
      for (const f of pool) { const q = [...rule.formulas]; q[lane] = f; const s = evaluate(q); if (byScore(s, best.stats) < 0) best = { formulas: q, stats: s }; }
      if (best !== rule) { rule = best; improved = true; }
    }
    if (!improved) break;
  }
  return { ...rule, swap_passes: passes };
}

// Full D training on `train` only. Every winning-number read goes through a train-bound oracle per stage.
export function trainD(ctx, variantName, train) {
  const variant = VARIANTS[variantName], forms = ctx.universes[variant.triples], access = {};
  const rankRead = winningOracle(ctx.rows, train, access, 'ranking');
  const ranking = rankFormulas(forms, train, train.map(rankRead));
  const built = buildPool(variant, ranking, ctx.specs); access.pool = { reads: 0, min: null, max: null, indexes: new Set(), note: 'pool built from train ranking only' };
  const searchRead = winningOracle(ctx.rows, train, access, 'greedy_local_swap');
  const rule = search(built.pool, train, train.map(searchRead));
  const cutoffHit = ranking[variant.size - 1].hit, inPool = new Set(built.pool.map((f) => f.key)), tied = ranking.filter((x) => x.hit === cutoffHit);
  const cutoff = { cutoff_hit: cutoffHit, top_hit: ranking[0].hit, tied_at_cutoff: tied.length, tied_included: tied.filter((x) => inPool.has(x.f.key)).length };
  return { rule, pool: built.pool, pool_source: built.source, pool_meta: built, cutoff, universe: forms.length, access };
}

const name = (f, specs) => { const a = specs[f.a].id, b = f.b == null ? '' : specs[f.b].id, c = f.c == null ? '' : specs[f.c].id; return `wrap45(${({ one: a, sum: `${a}+${b}`, diff: `${a}-${b}`, rdiff: `${b}-${a}`, abs: `|${a}-${b}|`, a2b: `2*${a}+${b}`, twoab: `${a}+2*${b}`, twoMinus: `2*${a}-${b}`, minusTwo: `${a}-2*${b}`, mul: `${a}*${b}`, mean: `floor((${a}+${b})/2)`, abcSum: `${a}+${b}+${c}`, abcSub: `${a}+${b}-${c}`, abPlusC: `${a}-${b}+${c}`, abMinusC: `${a}-${b}-${c}`, twoABC: `2*${a}+${b}-${c}`, aTwoBC: `${a}+2*${b}-${c}`, abTwoC: `${a}+${b}-2*${c}`, absPlusC: `|${a}-${b}|+${c}` })[f.op]})`; };

function coverage(pool, specs) {
  const systems = [...new Set(specs.map((s) => s.system))], lineages = [...new Set(specs.map((s) => s.lineage))];
  return {
    systems: Object.fromEntries(systems.map((n) => [n, pool.filter((f) => f.systems.includes(n)).length])),
    lineages: Object.fromEntries(lineages.map((n) => [n, pool.filter((f) => f.lineages.includes(n)).length])),
    distinct_value_vectors: new Set(pool.map((f) => sha256(Buffer.from(f.v)))).size,
  };
}
function blockedCandidates(pool, specs) {
  return Object.fromEntries(specs.slice(22).map((s, k) => { const ci = 22 + k, inPool = pool.filter((f) => f.members.includes(ci)); return [s.id, { system: s.system, total: inPool.length, single: inPool.filter((f) => f.op === 'one').length, pair: inPool.filter((f) => f.members.length === 2).length, triple: inPool.filter((f) => f.members.length === 3).length }]; }));
}
function newSystemStatus(pool, formulas) {
  return Object.fromEntries(NEW_TRIPLE_SYSTEMS.map((n) => { const p = pool.filter((f) => f.systems.includes(n)).length, fin = formulas.filter((f) => f.systems.includes(n)).length, tripleFin = formulas.filter((f) => f.systems.includes(n) && f.members.length === 3).length; return [n, { pool_formula_count: p, pool_triple_count: pool.filter((f) => f.systems.includes(n) && f.members.length === 3).length, final_formula_count: fin, final_triple_count: tripleFin, status: fin ? 'final' : p ? 'pool_only_dropped' : 'absent_from_pool' }]; }));
}
function describeRule(trained, specs, idx) {
  const f = trained.rule.formulas, audit = { adjustments: 0 }; idx.forEach((i) => ticketAt(f, i, audit));
  const systems = [...new Set(f.flatMap((x) => x.systems))], lineages = [...new Set(f.flatMap((x) => x.lineages))];
  return { formulas: f.map((x) => name(x, specs)), formula_keys: f.map((x) => x.key), duplicate_formula_count: f.length - new Set(f.map((x) => x.key)).size, system_count: systems.length, systems, lineage_count: lineages.length, lineages, cyclic_increment_count: audit.adjustments, cyclic_increment_rate: audit.adjustments / (idx.length * 6) };
}
const accessSummary = (access, testSet) => Object.fromEntries(Object.entries(access).map(([k, v]) => [k, { reads: v.reads, min: v.min, max: v.max, test_indexes_read: [...v.indexes].filter((i) => testSet.has(i)).length, ...(v.note ? { note: v.note } : {}) }]));

export async function loadContext() {
  const [matrix, dataset] = await Promise.all([readFile(join(BASE, 'common_candidate_matrix.json'), 'utf8').then(JSON.parse), readFile(join(BASE, 'common_dataset.json'), 'utf8').then(JSON.parse)]);
  const specs = matrix.manifest, candidates = matrix.rows.map((r) => specs.map((s) => r.candidates[s.id]));
  if (matrix.rows.some((r, i) => r.round !== dataset.rows[i].round)) throw new Error('round mismatch');
  return { specs, rows: dataset.rows, candidates, universes: {} };
}
export function ensureUniverse(ctx, triples) {
  if (!ctx.universes[triples]) ctx.universes[triples] = prepareUniverse(buildUniverse(ctx.specs.length, triples === 'first22' ? 22 : ctx.specs.length), ctx.candidates, ctx.specs);
  return ctx.universes[triples];
}
export const splitIndexes = ([end, testEnd]) => ({ label: `1-${end} → ${end + 1}-${testEnd}`, train: Array.from({ length: end }, (_, i) => i), test: Array.from({ length: testEnd - end }, (_, i) => end + i) });

export function runVariant(ctx, variantName) {
  const variant = VARIANTS[variantName], specs = ctx.specs; ensureUniverse(ctx, variant.triples);
  const all = ctx.rows.map((_, i) => i), full = trainD(ctx, variantName, all);
  const splits = SPLITS.map((range) => {
    const z = splitIndexes(range), t = trainD(ctx, variantName, z.train), testSet = new Set(z.test), access = accessSummary(t.access, testSet);
    const evalLog = {}, evalRead = winningOracle(ctx.rows, z.test, evalLog, 'evaluation'), audit = { adjustments: 0 };
    const tickets = z.test.map((i) => ticketAt(t.rule.formulas, i, audit)), stats = summarize(histOf(t.rule.formulas, z.test, z.test.map(evalRead)));
    for (const tk of tickets) if (tk.length !== 6 || new Set(tk).size !== 6 || tk.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) throw new Error('invalid ticket');
    return { label: z.label, train_range: [1, z.train.length], test_range: [z.test[0] + 1, z.test.at(-1) + 1], stats, train_stats: t.rule.stats, ...describeRule(t, specs, z.test), pool_size: t.pool.length, pool_hash: poolHash(t.pool), pool_source: t.pool_source, pool_cutoff: t.cutoff, pool_keys: t.pool.map((f) => f.key), new_system_status: newSystemStatus(t.pool, t.rule.formulas), blocked_candidate_pool_counts: blockedCandidates(t.pool, specs), stage_access: access, leakage_check: Object.values(access).every((a) => a.test_indexes_read === 0 && (a.max == null || a.max < z.test[0])), tickets };
  });
  const wfHist = [0, 0, 0, 0, 0, 0, 0]; for (const s of splits) s.stats.hist.forEach((n, k) => { wfHist[k] += n; });
  const inCov = coverage(full.pool, specs);
  return {
    variant: variantName, label: variant.label, universe_triples: variant.triples, pool_rule: variant.pool === 'top' ? `global train-ranking top${variant.size}` : `system round-robin (alphabetical) top${variant.size} + global fill`,
    universe_size: full.universe, pool_size: full.pool.length, pool_ratio: full.pool.length / full.universe, base_D_ratio: D_BASE_RATIO,
    in_sample: { train_range: [1, all.length], stats: full.rule.stats, ...describeRule(full, specs, all), swap_passes: full.rule.swap_passes, pool_hash: poolHash(full.pool), pool_source: full.pool_source, pool_cutoff: full.cutoff, pool_keys: full.pool.map((f) => f.key), ...(full.pool_meta.round_robin_picks_by_system ? { system_order: full.pool_meta.system_order, round_robin_picks_by_system: full.pool_meta.round_robin_picks_by_system } : {}), pool_coverage: inCov, universe_distinct_value_vectors: new Set(ctx.universes[variant.triples].map((f) => sha256(Buffer.from(f.v)))).size, new_system_status: newSystemStatus(full.pool, full.rule.formulas), blocked_candidate_pool_counts: blockedCandidates(full.pool, specs) },
    exact_walk_forward: { protocol: 'expanding train 1..N → next block; ranking/pool/greedy/swap on train only (oracle-enforced)', stats: summarize(wfHist), all_leakage_checks: splits.every((s) => s.leakage_check), splits },
  };
}

// Analytic single-ticket expectation (hypergeometric 6/45) as a scale reference for WF scores; not a significance test.
export function randomReference(rounds) {
  const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  const p = [0, 1, 2, 3, 4, 5, 6].map((k) => C(6, k) * C(39, 6 - k) / C(45, 6)), e = p.reduce((s, x, k) => s + x * SCORE[k], 0), e2 = p.reduce((s, x, k) => s + x * SCORE[k] ** 2, 0);
  return { rounds, expected_score: e * rounds, sd_score: Math.sqrt((e2 - e * e) * rounds), expected_ge4: (p[4] + p[5] + p[6]) * rounds, note: 'independent-round approximation; heavy-tailed (5/6-hit dominate variance)' };
}

const pct = (x) => `${(x * 100).toFixed(2)}%`;
function report(results, d1Repro, generated, extra) {
  const V = ['D1', 'D2', 'D3'], r = results, wf = (v) => r[v].exact_walk_forward.stats, ins = (v) => r[v].in_sample.stats;
  const row = (v) => `| ${v} | ${r[v].label} | ${r[v].universe_size.toLocaleString()} | ${r[v].pool_size} | ${pct(r[v].pool_ratio)} | ${ins(v).score} | ${wf(v).score} | ${wf(v).hist.join('/')} | ${wf(v).mean.toFixed(4)} | ${wf(v).ge3Count} | ${wf(v).ge4Count} | ${wf(v).fiveHit} | ${wf(v).sixHit} |`;
  const lines = [
    '# D search-pool audit (연구용)', '',
    `생성: ${generated}. 기존 A~I, production predictor, 1243회 예측, method-comparison/**, search-space-audit/** 는 읽기만 했다.`, '',
    '## 요약 표', '', '| 방식 | 설정 | universe | pool | pool/universe | in-sample | exact WF | WF hist 0~6 | WF mean | WF 3+ | WF 4+ | WF 5-hit | WF 6-hit |', '|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|', ...V.map(row), '',
    `D1 재현: exact WF ${d1Repro.score} (기존 ${d1Repro.expected_score}) · split 티켓 일치 ${d1Repro.tickets_identical} · in-sample ${d1Repro.in_sample} (기존 ${d1Repro.expected_in_sample}).`, '',
    '## split별 exact WF', '', `| split | ${V.join(' | ')} |`, '|---|---:|---:|---:|',
    ...SPLITS.map((_, k) => `| ${r.D1.exact_walk_forward.splits[k].label} | ${V.map((v) => `${r[v].exact_walk_forward.splits[k].stats.score} (${r[v].exact_walk_forward.splits[k].stats.hist.join('/')})`).join(' | ')} |`), '',
    '## in-sample 최종 6식', '', ...V.flatMap((v) => [`### ${v}`, '', ...r[v].in_sample.formulas.map((f) => `- \`${f}\``), '', `system ${r[v].in_sample.system_count}개: ${r[v].in_sample.systems.join(', ')} · lineage ${r[v].in_sample.lineage_count}개: ${r[v].in_sample.lineages.join(', ')} · cyclic increment ${r[v].in_sample.cyclic_increment_count}회 (${pct(r[v].in_sample.cyclic_increment_rate)})`, '']),
    '## 새로 triple이 허용된 7개 system (in-sample pool / 최종 6식)', '', `| system | ${V.map((v) => `${v} pool (triple)`).join(' | ')} | ${V.map((v) => `${v} 최종`).join(' | ')} |`, '|---|---:|---:|---:|---|---|---|',
    ...NEW_TRIPLE_SYSTEMS.map((n) => `| ${n} | ${V.map((v) => `${r[v].in_sample.new_system_status[n].pool_formula_count} (${r[v].in_sample.new_system_status[n].pool_triple_count})`).join(' | ')} | ${V.map((v) => `${r[v].in_sample.new_system_status[n].status} ${r[v].in_sample.new_system_status[n].final_formula_count}`).join(' | ')} |`), '',
    'WF split 최종식 진입 횟수(7 split 중): ' + V.map((v) => `${v} ` + NEW_TRIPLE_SYSTEMS.map((n) => `${n}=${r[v].exact_walk_forward.splits.filter((s) => s.new_system_status[n].status === 'final').length}`).join(', ')).join(' · '), '',
    '## first22에서 triple이 막혔던 11개 candidate의 in-sample pool 포함 수 (전체 / triple)', '', `| candidate | ${V.join(' | ')} |`, '|---|---:|---:|---:|',
    ...Object.keys(r.D1.in_sample.blocked_candidate_pool_counts).map((id) => `| ${id} | ${V.map((v) => `${r[v].in_sample.blocked_candidate_pool_counts[id].total} / ${r[v].in_sample.blocked_candidate_pool_counts[id].triple}`).join(' | ')} |`), '',
    '## 중복 value vector (설계 점검)', '', ...V.map((v) => `- ${v}: universe ${r[v].universe_size} 중 서로 다른 값벡터 ${r[v].in_sample.universe_distinct_value_vectors}개, pool ${r[v].pool_size} 중 ${r[v].in_sample.pool_coverage.distinct_value_vectors}개`), '',
    `- D1 pool 900 중 cutoff 점수(${r.D1.in_sample.pool_cutoff.cutoff_hit}회)에 동점인 formula ${r.D1.in_sample.pool_cutoff.tied_at_cutoff}개 중 ${r.D1.in_sample.pool_cutoff.tied_included}개만 포함, D2는 ${r.D2.in_sample.pool_cutoff.tied_at_cutoff}개 중 ${r.D2.in_sample.pool_cutoff.tied_included}개. 동점은 complexity → universe 순서(=manifest 순서)로 잘린다.`,
    '- 입력 행렬에서 `vedic.c1 ≡ sukyo.c1`, `vedic.c2 ≡ sukyo.c2`, `jamidusu.c2_sin ≡ jamidusu.c3_jaebaek` 열이 1~1242 전 회차 동일하다. sukyo가 pool에 "들어간" 것은 vedic 식의 복제일 수 있다.', '',
    '## D2 vs D3 pool 겹침', '', `- in-sample pool 겹침 ${extra.overlap.in_sample}/2500. split별: ${extra.overlap.splits.map((x) => `${x.overlap}${x.same_final ? '(최종 6식 동일)' : '(최종 6식 다름)'}`).join(', ')}`, '',
    '## 무작위 1장 기준 (참고용 척도)', '', `- WF ${extra.random.rounds}회: 기대 점수 ${extra.random.expected_score.toFixed(0)}, 표준편차 ≈ ${extra.random.sd_score.toFixed(0)} (독립 회차 근사, 4·5·6-hit 때문에 꼬리가 두꺼움), 기대 4+ ${extra.random.expected_ge4.toFixed(2)}회. 유의성 검정이 아니라 눈금이다.`, '',
    '## 해석', '',
    `1. **search pool을 같은 비율(${pct(r.D2.pool_ratio)})로 맞춰도 all33은 first22를 이기지 못했다.** in-sample은 D2 ${ins('D2').score} > D1 ${ins('D1').score} (+${ins('D2').score - ins('D1').score})이지만 exact WF는 D2 ${wf('D2').score} < D1 ${wf('D1').score} (${wf('D2').score - wf('D1').score}). 앞선 search-space-audit의 triple_all+top900(WF 826)보다도 낮다 — pool을 키울수록 in-sample은 오르고 WF는 내려가는 과적합 방향이다. "D1이 pool 크기 때문에 불공정하게 이겼다"는 가설은 지지되지 않는다.`,
    `2. **diversity-aware pool(D3)은 개선이 아니다.** D3 in-sample/WF가 D2와 완전히 같다(${ins('D3').score} / ${wf('D3').score}). global top2500이 이미 15개 system을 폭넓게 담고 있어서 round-robin pool과 ${extra.overlap.in_sample}/2500이 겹치고, greedy가 고르는 상위 식은 양쪽 pool에 모두 있다. first22 제약이 막은 것은 triple universe였지 pool 순위가 아니었다.`,
    `3. **새로 triple이 허용된 7개 system은 pool에는 들어갔다.** D2 in-sample pool에서 각 ${Math.min(...NEW_TRIPLE_SYSTEMS.map((n) => r.D2.in_sample.new_system_status[n].pool_formula_count))}~${Math.max(...NEW_TRIPLE_SYSTEMS.map((n) => r.D2.in_sample.new_system_status[n].pool_formula_count))}개. 최종 6식 진입: ${NEW_TRIPLE_SYSTEMS.filter((n) => r.D2.in_sample.new_system_status[n].status === 'final').map((n) => `${n}(${r.D2.in_sample.new_system_status[n].final_formula_count}식)`).join('·') || '없음'}; pool에만 있고 탈락: ${NEW_TRIPLE_SYSTEMS.filter((n) => r.D2.in_sample.new_system_status[n].status === 'pool_only_dropped').join('·') || '없음'}. sukyo 식은 vedic과 값이 같은 열을 쓰므로 실질적으로 vedic 식이다.`,
    `4. D1의 WF ${wf('D1').score}도 무작위 눈금(${extra.random.expected_score.toFixed(0)} ± ${extra.random.sd_score.toFixed(0)})과 비교해 읽어야 하며, 여러 방식을 시도한 뒤 고른 값이므로 선택 편향이 있다. 이번 실험은 production D 변경 근거가 아니다.`, '',
    '## 설계 문제 (이번에 발견)', '',
    `- **중복 candidate 열**: sukyo.c1/c2 ≡ vedic.c1/c2, jamidusu.c3 ≡ jamidusu.c2. all33 universe ${r.D2.universe_size} 중 서로 다른 값벡터는 ${r.D2.in_sample.universe_distinct_value_vectors}개, D2 pool 2500 중 ${r.D2.in_sample.pool_coverage.distinct_value_vectors}개뿐 — pool 슬롯의 약 ${pct(1 - r.D2.in_sample.pool_coverage.distinct_value_vectors / 2500)}가 복제다. "pool/universe 5.10%"라는 비율도 중복을 세므로 실효 비율과 다르다.`,
    '- **cutoff 동점**: pool 경계에 동점이 수백 개 몰려 있고 manifest 순서로 잘린다. manifest 순서 편향은 triple 제한이 사라져도 이 경로로 남는다.',
    `- **greedy가 같은 formula를 여러 lane에 허용**: D1 첫 split이 같은 식을 3번 골랐다(중복 번호는 cyclic +1로 밀림). 이번 작업은 D 알고리즘을 바꾸지 않았으므로 그대로 두었다.`, '',
  ];
  return lines.join('\n');
}

async function main() {
  const t0 = Date.now(), ctx = await loadContext(); await mkdir(OUT, { recursive: true });
  const results = {};
  for (const v of Object.keys(VARIANTS)) { results[v] = runVariant(ctx, v); console.error(`${v} in=${results[v].in_sample.stats.score} wf=${results[v].exact_walk_forward.stats.score} (${((Date.now() - t0) / 1000).toFixed(0)}s)`); }
  const oldD = JSON.parse(await readFile(join(SPACE, 'exact_walk_forward_D.json'), 'utf8')), oldCmp = JSON.parse(await readFile(join(SPACE, 'D_triple_all_comparison.json'), 'utf8'));
  const d1Repro = { score: results.D1.exact_walk_forward.stats.score, expected_score: oldD.exact.stats.score, hist_identical: JSON.stringify(results.D1.exact_walk_forward.stats.hist) === JSON.stringify(oldD.exact.stats.hist), tickets_identical: results.D1.exact_walk_forward.splits.every((s, k) => JSON.stringify(s.tickets) === JSON.stringify(oldD.splits[k].tickets)), formulas_identical: results.D1.exact_walk_forward.splits.every((s, k) => JSON.stringify(s.formulas) === JSON.stringify(oldD.splits[k].formulas)), in_sample: results.D1.in_sample.stats.score, expected_in_sample: oldCmp.in_sample.triple_first22.stats.score };
  results.D1.reproduction = d1Repro;
  for (const v of Object.keys(VARIANTS)) await writeFile(join(OUT, VARIANTS[v].file), `${JSON.stringify(results[v], null, 2)}\n`);
  const pick = (f) => Object.fromEntries(Object.keys(VARIANTS).map((v) => [v, { in_sample_pool: f(results[v].in_sample.pool_coverage), walk_forward_split_pools: results[v].exact_walk_forward.splits.map((s) => ({ label: s.label, pool_size: s.pool_size })) }]));
  await writeFile(join(OUT, 'pool_system_coverage.json'), `${JSON.stringify(pick((c) => c.systems), null, 2)}\n`);
  await writeFile(join(OUT, 'pool_lineage_coverage.json'), `${JSON.stringify(pick((c) => c.lineages), null, 2)}\n`);
  const brief = (x) => ({ score: x.score, hist: x.hist, mean: x.mean, ge3Count: x.ge3Count, ge4Count: x.ge4Count, ge5Count: x.ge5Count, fiveHit: x.fiveHit, sixHit: x.sixHit, rounds: x.rounds });
  const comparison = {
    note: 'research only; production D and 1243 prediction untouched. Primary comparison is exact walk-forward.',
    d1_reproduction: d1Repro,
    variants: Object.fromEntries(Object.entries(results).map(([v, x]) => [v, { label: x.label, universe_size: x.universe_size, pool_size: x.pool_size, pool_ratio: x.pool_ratio, in_sample: brief(x.in_sample.stats), exact_walk_forward: brief(x.exact_walk_forward.stats), split_scores: x.exact_walk_forward.splits.map((s) => ({ label: s.label, score: s.stats.score, hist: s.stats.hist })), in_sample_formulas: x.in_sample.formulas, systems: x.in_sample.systems, lineages: x.in_sample.lineages, cyclic_increment_count: x.in_sample.cyclic_increment_count, cyclic_increment_rate: x.in_sample.cyclic_increment_rate, pool_hash: x.in_sample.pool_hash, all_leakage_checks: x.exact_walk_forward.all_leakage_checks, new_system_status: x.in_sample.new_system_status, blocked_candidate_pool_counts: x.in_sample.blocked_candidate_pool_counts }])),
    deltas_vs_D1: { D2: { in_sample: results.D2.in_sample.stats.score - results.D1.in_sample.stats.score, exact_walk_forward: results.D2.exact_walk_forward.stats.score - results.D1.exact_walk_forward.stats.score }, D3: { in_sample: results.D3.in_sample.stats.score - results.D1.in_sample.stats.score, exact_walk_forward: results.D3.exact_walk_forward.stats.score - results.D1.exact_walk_forward.stats.score } },
  };
  const overlapOf = (a, b) => { const s = new Set(a); return b.filter((k) => s.has(k)).length; };
  const extra = { random: randomReference(results.D1.exact_walk_forward.stats.rounds), overlap: { in_sample: overlapOf(results.D2.in_sample.pool_keys, results.D3.in_sample.pool_keys), splits: results.D2.exact_walk_forward.splits.map((s, k) => ({ label: s.label, overlap: overlapOf(s.pool_keys, results.D3.exact_walk_forward.splits[k].pool_keys), same_final: JSON.stringify(s.formula_keys) === JSON.stringify(results.D3.exact_walk_forward.splits[k].formula_keys) })) } };
  comparison.D2_vs_D3_pool_overlap = extra.overlap; comparison.random_reference = extra.random;
  await writeFile(join(OUT, 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`);
  await writeFile(join(OUT, 'report.md'), `${report(results, d1Repro, new Date().toISOString().slice(0, 10), extra)}\n`);
  console.log(JSON.stringify({ d1Repro, ...comparison.deltas_vs_D1, secs: (Date.now() - t0) / 1000 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exitCode = 1; });
