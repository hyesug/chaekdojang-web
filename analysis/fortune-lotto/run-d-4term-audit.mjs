/* Research-only: does adding 4-term formulas to D improve exact WF? D3term = D_tie (aac0151), D4term = same + 4-term universe.
   Reuses D_tie training (neutral SHA256 tie-break, top900, greedy 6 lanes + local swap 2 pass). Writes only output/d-4term-audit. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPLITS, loadContext, splitIndexes, summarize, ticketAt, winningOracle } from './run-search-pool-audit.mjs';
import { buildSpace, trainD } from './run-d-robustness-audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, 'output', 'd-4term-audit');
const wrap45 = (x) => ((Math.floor(x) - 1) % 45 + 45) % 45 + 1;
const QUAD_OPS = {
  abcdSum: [(a, b, c, d) => a + b + c + d, (a, b, c, d) => `${a}+${b}+${c}+${d}`],
  abcSubD: [(a, b, c, d) => a + b + c - d, (a, b, c, d) => `${a}+${b}+${c}-${d}`],
  abSubCD: [(a, b, c, d) => a + b - c - d, (a, b, c, d) => `${a}+${b}-${c}-${d}`],
  twoABCSubD: [(a, b, c, d) => 2 * a + b + c - d, (a, b, c, d) => `2*${a}+${b}+${c}-${d}`],
  aTwoBCSubD: [(a, b, c, d) => a + 2 * b + c - d, (a, b, c, d) => `${a}+2*${b}+${c}-${d}`],
  absABPlusCSubD: [(a, b, c, d) => Math.abs(a - b) + c - d, (a, b, c, d) => `|${a}-${b}|+${c}-${d}`],
};

// 4 distinct candidates from first22, a<b<c<d, the six operators above only.
export function quadForms(ctx, specs) {
  const out = [];
  for (let a = 0; a < 22; a++) for (let b = a + 1; b < 22; b++) for (let c = b + 1; c < 22; c++) for (let d = c + 1; d < 22; d++) for (const [op, [fn]] of Object.entries(QUAD_OPS)) {
    const v = new Uint8Array(ctx.candidates.length);
    for (let i = 0; i < v.length; i++) { const r = ctx.candidates[i]; v[i] = wrap45(fn(r[a], r[b], r[c], r[d])); }
    const members = [a, b, c, d];
    out.push({ a, b, c, d, op, complexity: 4, v, key: `${a}|${b}|${c}|${d}|${op}`, members, systems: [...new Set(members.map((i) => specs[i].system))], lineages: [...new Set(members.map((i) => specs[i].lineage))] });
  }
  return out;
}

export function buildVariant(ctx, variant) {
  const space = buildSpace(ctx, 'D_tie');
  return variant === 'D4term' ? { ...space, forms: [...space.forms, ...quadForms(ctx, space.specs)] } : space;
}

const label = (f, specs) => {
  if (f.op in QUAD_OPS) return `wrap45(${QUAD_OPS[f.op][1](...f.members.map((i) => specs[i].id))})`;
  return `${f.op}(${f.members.map((i) => specs[i].id).join(',')})`;
};
function score(forms, idx, rows) {
  const read = winningOracle(rows, idx, {}, 'evaluation'), hist = [0, 0, 0, 0, 0, 0, 0], tickets = idx.map((i) => ticketAt(forms, i));
  tickets.forEach((t, k) => { if (t.length !== 6 || new Set(t).size !== 6 || t.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) throw new Error('invalid ticket'); const w = read(idx[k]); hist[t.reduce((s, n) => s + w[n], 0)]++; });
  return { stats: summarize(hist), tickets };
}
const brief = (s) => ({ score: s.score, hist: s.hist, mean: s.mean, ge3Count: s.ge3Count, ge4Count: s.ge4Count, ge5Count: s.ge5Count, sixHit: s.sixHit, rounds: s.rounds });

export function runVariant(ctx, variant) {
  const space = buildVariant(ctx, variant), all = ctx.rows.map((_, i) => i), full = trainD(ctx, space, 'D_tie', all);
  const splits = SPLITS.map((range) => {
    const z = splitIndexes(range), t = trainD(ctx, space, 'D_tie', z.train), { stats, tickets } = score(t.rule.formulas, z.test, ctx.rows);
    const access = Object.fromEntries(Object.entries(t.access).map(([k, v]) => [k, { reads: v.reads, max: v.max, test_indexes_read: [...v.indexes].filter((i) => i >= z.test[0]).length }]));
    return { label: z.label, score: stats.score, hist: stats.hist, formulas: t.rule.formulas.map((f) => label(f, space.specs)), four_term_count: t.rule.formulas.filter((f) => f.members.length === 4).length, stage_access: access, leakage_check: Object.values(access).every((a) => a.test_indexes_read === 0), tickets };
  });
  const hist = [0, 0, 0, 0, 0, 0, 0]; splits.forEach((s) => s.hist.forEach((n, k) => { hist[k] += n; }));
  return {
    variant, universe_size: space.forms.length,
    in_sample: { ...brief(full.rule.stats), formulas: full.rule.formulas.map((f) => label(f, space.specs)), four_term_count: full.rule.formulas.filter((f) => f.members.length === 4).length },
    exact_walk_forward: { ...brief(summarize(hist)), all_leakage_checks: splits.every((s) => s.leakage_check), splits },
  };
}

async function main() {
  const ctx = await loadContext(); await mkdir(OUT, { recursive: true });
  const R = { D3term: runVariant(ctx, 'D3term'), D4term: runVariant(ctx, 'D4term') };
  if (R.D3term.exact_walk_forward.score !== 835) throw new Error(`D3term did not reproduce D_tie 835: ${R.D3term.exact_walk_forward.score}`);
  for (const [v, x] of Object.entries(R)) await writeFile(join(OUT, `${v}.json`), `${JSON.stringify(x, null, 2)}\n`);
  const row = (v) => { const x = R[v], w = x.exact_walk_forward; return `| ${v} | ${x.universe_size} | ${x.in_sample.score} | ${w.score} | ${w.mean.toFixed(4)} | ${w.ge3Count} | ${w.ge4Count} | ${w.ge5Count} | ${w.sixHit} | ${w.splits.map((s) => s.score).join(' / ')} | ${x.in_sample.four_term_count} (WF split 합 ${w.splits.reduce((s, x) => s + x.four_term_count, 0)}/42) |`; };
  const md = ['# D 4항 감사 (연구용)', '', 'first22 · top900 · 중립 SHA256 tie-break · greedy 6 lanes + local swap 2 pass · train-only exact WF 7 splits. 한 가지 변경: 4항 universe 추가.', '',
    '| 방식 | universe | in-sample | exact WF | WF mean | 3+ | 4+ | 5+ | 6-hit | split별 WF | 최종 6식 중 4항 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|', row('D3term'), row('D4term'), '',
    ...Object.entries(R).flatMap(([v, x]) => [`## ${v} in-sample 최종 6식`, '', ...x.in_sample.formulas.map((f) => `- \`${f}\``), '']),
  ].join('\n');
  await writeFile(join(OUT, 'report.md'), `${md}\n`);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(R).map(([v, x]) => [v, { universe: x.universe_size, in: x.in_sample.score, wf: x.exact_walk_forward.score, ge4: x.exact_walk_forward.ge4Count, ge5: x.exact_walk_forward.ge5Count, six: x.exact_walk_forward.sixHit, quadIn: x.in_sample.four_term_count, quadWF: x.exact_walk_forward.splits.map((s) => s.four_term_count) }]))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exitCode = 1; });
