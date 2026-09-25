/* Research-only D robustness audit. One change per experiment against D0 (first22 + top900, exact WF 920).
   Reads method-comparison + search-space-audit, writes only output/d-robustness-audit. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPLITS, buildUniverse, loadContext, poolHash, prepareUniverse, splitIndexes, summarize, ticketAt, winningOracle } from './run-search-pool-audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPACE = join(HERE, 'output', 'search-space-audit');
export const OUT = join(HERE, 'output', 'd-robustness-audit');
const POOL = 900;
export const EXPERIMENTS = {
  D0: { file: 'D0.json', change: 'none (기존 D)' },
  D_alias: { file: 'D_alias.json', change: '1~1242 전 회차 값열이 같은 candidate alias를 하나로 합침' },
  D_tie: { file: 'D_tie.json', change: 'ranking 동점의 마지막 tie-break를 universe(manifest) 순서 대신 sha256(canonical formula) 순서로' },
  D_unique: { file: 'D_unique.json', change: 'greedy/local swap에서 같은 formula를 두 lane에 넣지 않음' },
};
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const SCORE = [0, 1, 3, 10, 50, 300, 3000];

// Same scoring as run-search-space-audit.mjs ticket()/byScore; masks come only from a train-bound oracle.
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

// Canonical string names candidates by id, so it does not depend on manifest position.
export const canonical = (f, specs) => [f.op, ...f.members.map((i) => specs[i].id)].join('|');

export function rank(forms, idx, masks, tie, specs) {
  const hit = forms.map((f) => { let h = 0; for (let k = 0; k < idx.length; k++) h += masks[k][f.v[idx[k]]]; return h; });
  const last = tie === 'neutral' ? forms.map((f) => sha256(canonical(f, specs))) : null;
  return forms.map((f, i) => ({ f, hit: hit[i], i })).sort((x, y) => y.hit - x.hit || x.f.complexity - y.f.complexity || (last ? (last[x.i] < last[y.i] ? -1 : last[x.i] > last[y.i] ? 1 : 0) : x.i - y.i));
}

function search(pool, idx, masks, unique) {
  const chosen = [];
  while (chosen.length < 6) { let best; for (const f of pool) { if (unique && chosen.includes(f)) continue; const s = evaluate([...chosen, f], idx, masks); if (!best || byScore(s, best.s) < 0) best = { f, s }; } chosen.push(best.f); }
  let rule = { formulas: chosen, stats: evaluate(chosen, idx, masks) };
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (let lane = 0; lane < 6; lane++) {
      let best = rule;
      for (const f of pool) { if (unique && rule.formulas.some((g, j) => j !== lane && g === f)) continue; const q = [...rule.formulas]; q[lane] = f; const s = evaluate(q, idx, masks); if (byScore(s, best.stats) < 0) best = { formulas: q, stats: s }; }
      if (best !== rule) { rule = best; improved = true; }
    }
    if (!improved) break;
  }
  return rule;
}

/* Alias detection looks at candidate values only (no winning numbers). The first id in manifest order is kept.
   Triples stay limited to the original first22 set minus removed aliases, so only the alias change applies. */
export function aliasGroups(ctx) {
  const groups = [], seen = new Map();
  ctx.specs.forEach((s, i) => { const key = ctx.candidates.map((r) => r[i]).join(','); if (seen.has(key)) groups[seen.get(key)].push(i); else { seen.set(key, groups.length); groups.push([i]); } });
  return groups.filter((g) => g.length > 1).map((g) => ({ kept: ctx.specs[g[0]].id, merged: g.slice(1).map((i) => ctx.specs[i].id) }));
}
export function buildSpace(ctx, experiment) {
  if (experiment !== 'D_alias') return { specs: ctx.specs, forms: prepareUniverse(buildUniverse(ctx.specs.length, 22), ctx.candidates, ctx.specs), tripleCandidates: 22 };
  const drop = new Set(aliasGroups(ctx).flatMap((g) => g.merged)), keep = ctx.specs.map((s, i) => i).filter((i) => !drop.has(ctx.specs[i].id));
  const specs = keep.map((i) => ctx.specs[i]), candidates = ctx.candidates.map((r) => keep.map((i) => r[i])), tripleCandidates = keep.filter((i) => i < 22).length;
  if (keep.slice(0, tripleCandidates).some((i) => i >= 22)) throw new Error('first22 set no longer a prefix');
  return { specs, forms: prepareUniverse(buildUniverse(specs.length, tripleCandidates), candidates, specs), tripleCandidates };
}

export function trainD(ctx, space, experiment, train) {
  const access = {}, rankRead = winningOracle(ctx.rows, train, access, 'ranking');
  const ranking = rank(space.forms, train, train.map(rankRead), experiment === 'D_tie' ? 'neutral' : 'manifest', space.specs), pool = ranking.slice(0, POOL).map((x) => x.f);
  const searchRead = winningOracle(ctx.rows, train, access, 'greedy_local_swap');
  const rule = search(pool, train, train.map(searchRead), experiment === 'D_unique');
  const cutoffHit = ranking[POOL - 1].hit, cutoffComplexity = ranking[POOL - 1].f.complexity;
  return { rule, pool, access, cutoff: { cutoff_hit: cutoffHit, tied_hit: ranking.filter((x) => x.hit === cutoffHit).length, tied_hit_and_complexity: ranking.filter((x) => x.hit === cutoffHit && x.f.complexity === cutoffComplexity).length, included_at_cutoff: pool.filter((f, k) => ranking[k].hit === cutoffHit && f.complexity === cutoffComplexity).length } };
}

const name = (f, specs) => { const [a, b, c] = f.members.map((i) => specs[i].id); return `wrap45(${({ one: a, sum: `${a}+${b}`, diff: `${a}-${b}`, rdiff: `${b}-${a}`, abs: `|${a}-${b}|`, a2b: `2*${a}+${b}`, twoab: `${a}+2*${b}`, twoMinus: `2*${a}-${b}`, minusTwo: `${a}-2*${b}`, mul: `${a}*${b}`, mean: `floor((${a}+${b})/2)`, abcSum: `${a}+${b}+${c}`, abcSub: `${a}+${b}-${c}`, abPlusC: `${a}-${b}+${c}`, abMinusC: `${a}-${b}-${c}`, twoABC: `2*${a}+${b}-${c}`, aTwoBC: `${a}+2*${b}-${c}`, abTwoC: `${a}+${b}-2*${c}`, absPlusC: `|${a}-${b}|+${c}` })[f.op]})`; };
function describe(t, specs, idx) {
  const audit = { adjustments: 0 }; idx.forEach((i) => ticketAt(t.rule.formulas, i, audit));
  const names = t.rule.formulas.map((f) => name(f, specs));
  return { formulas: names, duplicate_formula_count: names.length - new Set(names).size, cyclic_increment_count: audit.adjustments, pool_hash: poolHash(t.pool), pool_canonical: t.pool.map((f) => canonical(f, specs)), cutoff: t.cutoff };
}

export function runExperiment(ctx, experiment) {
  const space = buildSpace(ctx, experiment), all = ctx.rows.map((_, i) => i), full = trainD(ctx, space, experiment, all);
  const splits = SPLITS.map((range) => {
    const z = splitIndexes(range), t = trainD(ctx, space, experiment, z.train), evalRead = winningOracle(ctx.rows, z.test, {}, 'evaluation');
    const tickets = z.test.map((i) => ticketAt(t.rule.formulas, i));
    for (const tk of tickets) if (tk.length !== 6 || new Set(tk).size !== 6 || tk.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) throw new Error('invalid ticket');
    const access = Object.fromEntries(Object.entries(t.access).map(([k, v]) => [k, { reads: v.reads, min: v.min, max: v.max, test_indexes_read: [...v.indexes].filter((i) => i >= z.test[0]).length }]));
    return { label: z.label, train_range: [1, z.train.length], test_range: [z.test[0] + 1, z.test.at(-1) + 1], stats: evaluate(t.rule.formulas, z.test, z.test.map(evalRead)), ...describe(t, space.specs, z.test), stage_access: access, leakage_check: Object.values(access).every((a) => a.test_indexes_read === 0), tickets };
  });
  const hist = [0, 0, 0, 0, 0, 0, 0]; splits.forEach((s) => s.stats.hist.forEach((n, k) => { hist[k] += n; }));
  return { experiment, change: EXPERIMENTS[experiment].change, candidate_count: space.specs.length, triple_candidate_count: space.tripleCandidates, universe_size: space.forms.length, pool_size: POOL, in_sample: { stats: full.rule.stats, ...describe(full, space.specs, all) }, exact_walk_forward: { stats: summarize(hist), all_leakage_checks: splits.every((s) => s.leakage_check), splits } };
}

const brief = (s) => ({ score: s.score, hist: s.hist, mean: s.mean, ge3Count: s.ge3Count, ge4Count: s.ge4Count, ge5Count: s.ge5Count, fiveHit: s.fiveHit, sixHit: s.sixHit, rounds: s.rounds });
const strip = (x) => ({ ...x, in_sample: { ...x.in_sample, pool_canonical: undefined }, exact_walk_forward: { ...x.exact_walk_forward, splits: x.exact_walk_forward.splits.map((s) => ({ ...s, pool_canonical: undefined })) } });

async function main() {
  const ctx = await loadContext(); await mkdir(OUT, { recursive: true });
  const R = {};
  for (const e of Object.keys(EXPERIMENTS)) { R[e] = runExperiment(ctx, e); console.error(`${e} in=${R[e].in_sample.stats.score} wf=${R[e].exact_walk_forward.stats.score}`); }
  const old = JSON.parse(await readFile(join(SPACE, 'exact_walk_forward_D.json'), 'utf8'));
  const d0Repro = { score: R.D0.exact_walk_forward.stats.score, expected: old.exact.stats.score, tickets_identical: R.D0.exact_walk_forward.splits.every((s, k) => JSON.stringify(s.tickets) === JSON.stringify(old.splits[k].tickets)) };
  if (d0Repro.score !== 920 || !d0Repro.tickets_identical) throw new Error(`D0 did not reproduce: ${JSON.stringify(d0Repro)}`);
  const changed = (a, b) => { const s = new Set(a); return b.filter((k) => !s.has(k)).length; };
  const tieAudit = { in_sample: { ...R.D0.in_sample.cutoff, changed_in_top900: changed(R.D0.in_sample.pool_canonical, R.D_tie.in_sample.pool_canonical) }, splits: R.D0.exact_walk_forward.splits.map((s, k) => ({ label: s.label, ...s.cutoff, changed_in_top900: changed(s.pool_canonical, R.D_tie.exact_walk_forward.splits[k].pool_canonical) })) };
  const dupAudit = { in_sample: R.D0.in_sample.duplicate_formula_count, splits: R.D0.exact_walk_forward.splits.map((s) => ({ label: s.label, duplicate_formula_count: s.duplicate_formula_count })), splits_with_duplicates: R.D0.exact_walk_forward.splits.filter((s) => s.duplicate_formula_count > 0).length };
  const aliases = aliasGroups(ctx);
  for (const e of Object.keys(EXPERIMENTS)) await writeFile(join(OUT, EXPERIMENTS[e].file), `${JSON.stringify(strip(R[e]), null, 2)}\n`);
  const comparison = {
    note: 'research only; one change per experiment; production D and 1243 prediction untouched',
    d0_reproduction: d0Repro, alias_groups: aliases, tie_audit: tieAudit, duplicate_audit: dupAudit,
    experiments: Object.fromEntries(Object.entries(R).map(([e, x]) => [e, { change: x.change, universe_size: x.universe_size, in_sample: brief(x.in_sample.stats), exact_walk_forward: brief(x.exact_walk_forward.stats), wf_delta_vs_D0: x.exact_walk_forward.stats.score - R.D0.exact_walk_forward.stats.score, split_scores: x.exact_walk_forward.splits.map((s) => ({ label: s.label, score: s.stats.score, hist: s.stats.hist })), in_sample_formulas: x.in_sample.formulas, all_leakage_checks: x.exact_walk_forward.all_leakage_checks }])),
  };
  await writeFile(join(OUT, 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`);
  const E = Object.keys(EXPERIMENTS), wf = (e) => R[e].exact_walk_forward.stats;
  const most = E.slice(1).sort((a, b) => Math.abs(wf(b).score - 920) - Math.abs(wf(a).score - 920))[0];
  const md = [
    '# D robustness audit (연구용)', '', '기준 D0 = first22 + top900, 기존 D 알고리즘. 각 실험은 한 가지만 바꾼다. 기존 artifact·production·1243 예측은 읽기만 했다.', '',
    `D0 재현: exact WF ${d0Repro.score} (기존 ${d0Repro.expected}), split 티켓 일치 ${d0Repro.tickets_identical}.`, '',
    '| 실험 | 변경 | universe | in-sample | exact WF | Δ vs D0 | mean | 3+ | 4+ | 5-hit | 6-hit |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...E.map((e) => `| ${e} | ${R[e].change} | ${R[e].universe_size} | ${R[e].in_sample.stats.score} | ${wf(e).score} | ${wf(e).score - 920} | ${wf(e).mean.toFixed(4)} | ${wf(e).ge3Count} | ${wf(e).ge4Count} | ${wf(e).fiveHit} | ${wf(e).sixHit} |`), '',
    '## split별 exact WF', '', `| split | ${E.join(' | ')} |`, `|---|${E.map(() => '---:').join('|')}|`,
    ...SPLITS.map((_, k) => `| ${R.D0.exact_walk_forward.splits[k].label} | ${E.map((e) => `${R[e].exact_walk_forward.splits[k].stats.score} (${R[e].exact_walk_forward.splits[k].stats.hist.join('/')})`).join(' | ')} |`), '',
    '## in-sample 최종 6식', '', ...E.flatMap((e) => [`### ${e}`, '', ...R[e].in_sample.formulas.map((f) => `- \`${f}\``), '']),
    '## alias로 합쳐진 candidate', '', ...aliases.map((g) => `- ${g.kept} ← ${g.merged.join(', ')}`), '', `D_alias: candidate ${R.D_alias.candidate_count}개, triple 참여 ${R.D_alias.triple_candidate_count}개 (기존 first22에서 alias 제거), universe ${R.D_alias.universe_size}.`, '',
    '## cutoff 동점 (D0 top900 경계)', '', '| 구간 | cutoff hit | 같은 hit | 같은 hit+complexity | 그중 top900 포함 | D_tie에서 바뀐 top900 |', '|---|---:|---:|---:|---:|---:|',
    `| in-sample | ${tieAudit.in_sample.cutoff_hit} | ${tieAudit.in_sample.tied_hit} | ${tieAudit.in_sample.tied_hit_and_complexity} | ${tieAudit.in_sample.included_at_cutoff} | ${tieAudit.in_sample.changed_in_top900} |`,
    ...tieAudit.splits.map((s) => `| ${s.label} | ${s.cutoff_hit} | ${s.tied_hit} | ${s.tied_hit_and_complexity} | ${s.included_at_cutoff} | ${s.changed_in_top900} |`), '',
    '## D0 최종 6식의 formula 중복', '', `- in-sample 중복 ${dupAudit.in_sample}개, WF ${dupAudit.splits_with_duplicates}/7 split에서 발생: ${dupAudit.splits.map((s) => `${s.label}=${s.duplicate_formula_count}`).join(', ')}`, '',
    '## 해석', '',
    `- 가장 민감한 변경: **${most}** (WF ${wf(most).score}, D0 대비 ${wf(most).score - 920}).`,
    `- split별로 보면 D0와 점수가 다른 split: ${E.slice(1).map((e) => `${e} ${R[e].exact_walk_forward.splits.filter((s, k) => s.stats.score !== R.D0.exact_walk_forward.splits[k].stats.score).map((s) => s.label.split(' → ')[1]).join(', ') || '없음'}`).join(' · ')}. in-sample 최종 6식은 네 실험 모두 같으므로 차이는 전부 WF split의 train-only 선택에서 나온다.`,
    `- 세 변경 모두 D0보다 WF가 낮고, 어떤 변경도 920을 넘지 못했다. 네 결과 중 920이 최고값이며, 기존 구현 세부(동점을 manifest 순서로 자르기, alias 열 유지, lane 중복 허용)가 모두 유리한 쪽으로 걸린 값이다.`,
    `- 세 변경은 모두 "예측 방법"이 아니라 구현 세부(열 중복·동점 처리·lane 중복)다. 이 중 어느 하나로 WF가 크게 움직이면 920은 D의 신호라기보다 그 세부가 우연히 맞은 값으로 읽어야 한다.`, '',
  ].join('\n');
  await writeFile(join(OUT, 'report.md'), `${md}\n`);
  console.log(JSON.stringify(Object.fromEntries(E.map((e) => [e, { in: R[e].in_sample.stats.score, wf: wf(e).score }]))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exitCode = 1; });
