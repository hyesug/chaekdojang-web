/*
 * A–F historical comparison spike.  Reads only the cached time-refined
 * fortune matrix and writes analysis artifacts.  It intentionally never
 * imports or mutates service code, and never touches the fixed 1243+ study.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INPUT = join(HERE, 'output');
const OUT = join(INPUT, 'method-comparison');
const SCORE = [0, 1, 3, 10, 50, 300, 3000];
const PERIODS = [[1, 400], [401, 800], [801, 1200], [1201, 1242]];
const wrap45 = (x) => ((Math.floor(x) - 1) % 45 + 45) % 45 + 1;
const lottoSpread = (raw, max) => Math.min(45, Math.max(1, Math.floor((((raw - 1) % max + max) % max) / max * 45) + 1));
const stable = (x) => JSON.parse(JSON.stringify(x));
const byScore = (a, b) => b.score - a.score || b.hist[6] - a.hist[6] || b.hist[5] - a.hist[5] || b.hist[4] - a.hist[4] || (b.hist.slice(3).reduce((s, n) => s + n, 0) - a.hist.slice(3).reduce((s, n) => s + n, 0)) || b.mean - a.mean;

export function conditionalRuleIsAllowed({ branchCount, maxDepth, leafSizes, usesEventSignature = false }) {
  return !usesEventSignature && branchCount <= 20 && maxDepth <= 2 && leafSizes.every((n) => n >= 30);
}
export function completeFeatureIndexes(manifest, rows) {
  return manifest.map((_, index) => index).filter((index) => rows.every((row) => Number.isFinite(row.raw[index]) && Number.isFinite(row.spread[index])));
}

export function evaluateTickets(tickets, rows) {
  if (tickets.length !== rows.length) throw new Error(`ticket count ${tickets.length} != rows ${rows.length}`);
  const hist = Array(7).fill(0); let hits = 0; let score = 0;
  tickets.forEach((numbers, i) => {
    if (!Array.isArray(numbers) || numbers.length !== 6 || new Set(numbers).size !== 6) throw new Error(`round ${rows[i].round}: six unique numbers required`);
    if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) throw new Error(`round ${rows[i].round}: numbers must be integers in 1..45`);
    const h = numbers.filter((n) => rows[i].winning.includes(n)).length;
    hist[h]++; hits += h; score += SCORE[h];
  });
  return { score, hist, hits, mean: hits / rows.length, ge3: (hist[3] + hist[4] + hist[5] + hist[6]) / rows.length, ge4: (hist[4] + hist[5] + hist[6]) / rows.length, fiveHit: hist[5], sixHit: hist[6], rounds: rows.length };
}

function uniqueTicket(values) {
  const result = [];
  for (const value of values) {
    let n = wrap45(value); let steps = 0;
    while (result.includes(n) && steps++ < 45) n = n === 45 ? 1 : n + 1;
    if (!result.includes(n)) result.push(n);
    if (result.length === 6) return result;
  }
  for (let n = 1; result.length < 6 && n <= 45; n++) if (!result.includes(n)) result.push(n);
  return result;
}
function sliceStats(tickets, rows, predicate) {
  const indexes = rows.map((row, i) => predicate(row) ? i : -1).filter((i) => i >= 0);
  return indexes.length ? evaluateTickets(indexes.map((i) => tickets[i]), indexes.map((i) => rows[i])) : null;
}
function periodStats(tickets, rows) { return PERIODS.map(([from, to]) => ({ range: `${from}-${to}`, ...evaluateTickets(rows.filter((r) => r.round >= from && r.round <= to).map((r, i) => tickets[rows.findIndex((x) => x.round === r.round)]), rows.filter((r) => r.round >= from && r.round <= to)) })); }
function timeStats(tickets, rows) {
  const kinds = ['exact', 'official_schedule', 'inferred', 'assumed'];
  return Object.fromEntries(kinds.map((kind) => [kind, sliceStats(tickets, rows, (r) => r.time_source === kind)]).concat([
    ['exact_only', sliceStats(tickets, rows, (r) => r.time_source === 'exact')],
    ['non_assumed', sliceStats(tickets, rows, (r) => r.time_source !== 'assumed')],
    ['all', evaluateTickets(tickets, rows)],
  ]));
}
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function save(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`); }
function idx(manifest) { return Object.fromEntries(manifest.map((x, i) => [x.id, i])); }
function value(row, indexes, id, layer = 'raw') { return row[layer][indexes[id]]; }

// This is a deliberate, analysis-only replication of lotto.js candidate
// identities. Each candidate remains a fixed global identity across rounds.
function makeCandidateSpecs() {
  const direct = (id, system, lineage, rawId, max) => ({ id, system, lineage, source: rawId, evaluate: (row, I) => lottoSpread(value(row, I, rawId), max) });
  return [
    direct('saju.c1_year_sexagenary', 'saju', 'ganzhi.pillars', 'saju.year_sexagenary', 60), direct('saju.c2_month_sexagenary', 'saju', 'ganzhi.pillars', 'saju.month_sexagenary', 60), direct('saju.c3_day_sexagenary', 'saju', 'ganzhi.pillars', 'saju.day_sexagenary', 60), direct('saju.c4_hour_sexagenary', 'saju', 'ganzhi.pillars', 'saju.hour_sexagenary', 60),
    direct('jamidusu.c1_myeong', 'jamidusu', 'jamidusu.palaces', 'jamidusu.myeong_palace', 12), direct('jamidusu.c2_sin', 'jamidusu', 'jamidusu.palaces', 'jamidusu.sin_palace', 12), { id: 'jamidusu.c3_jaebaek', system: 'jamidusu', lineage: 'jamidusu.palaces', source: 'myeong_palace+8', evaluate: (r, I) => lottoSpread(value(r, I, 'jamidusu.myeong_palace') + 8, 12) },
    direct('astrology.c1_sun_longitude', 'astrology', 'astro.sun', 'astrology.태양_longitude_degree', 360), direct('astrology.c2_moon_longitude', 'astrology', 'astro.moon', 'astrology.달_longitude_degree', 360), direct('astrology.c3_sun_sign', 'astrology', 'astro.sun', 'astrology.태양_sign', 12),
    direct('vedic.c1_nakshatra', 'vedic', 'astro.sidereal_moon', 'vedic_sukyo_shared.nakshatra_index', 27), { id: 'vedic.c2_nakshatra_pada', system: 'vedic', lineage: 'astro.sidereal_moon', source: 'nakshatra_index,pada', evaluate: (r, I) => lottoSpread((value(r, I, 'vedic_sukyo_shared.nakshatra_index') - 1) * 4 + value(r, I, 'vedic_sukyo_shared.nakshatra_pada'), 108) },
    direct('juyeok.c1_hexagram', 'juyeok', 'juyeok.trigrams', 'juyeok.original_hexagram', 64), direct('juyeok.c2_moving_line', 'juyeok', 'juyeok.trigrams', 'juyeok.moving_line', 6),
    { id: 'yukim.c1_month_general_point_hour', system: 'yukim', lineage: 'yukim.month_general+hour_branch', source: 'month_general,point_hour', evaluate: (r, I) => lottoSpread((value(r, I, 'yukim.month_general') - 1) * 12 + value(r, I, 'yukim.point_hour'), 144) }, direct('yukim.c2_day_stem_gigung', 'yukim', 'yukim.day_stem_gigung', 'yukim.day_stem_gigung', 12), direct('yukim.c3_first_transmission', 'yukim', 'yukim.three_transmissions', 'yukim.first_transmission', 12), direct('yukim.c4_middle_transmission', 'yukim', 'yukim.three_transmissions', 'yukim.middle_transmission', 12), direct('yukim.c5_last_transmission', 'yukim', 'yukim.three_transmissions', 'yukim.last_transmission', 12),
    { id: 'hongguk.c1_heaven_earth', system: 'hongguk', lineage: 'hongguk.plate', source: 'heaven_plate_center,earth_plate_center', evaluate: (r, I) => lottoSpread((value(r, I, 'hongguk.heaven_plate_center') - 1) * 9 + value(r, I, 'hongguk.earth_plate_center'), 81) }, { id: 'hongguk.c2_plate_mix', system: 'hongguk', lineage: 'hongguk.plate', source: 'heaven_plate_center*5+earth_plate_center', evaluate: (r, I) => lottoSpread(value(r, I, 'hongguk.heaven_plate_center') * 5 + value(r, I, 'hongguk.earth_plate_center'), 54) },
    direct('taeeul.c1_cycle', 'taeeul', 'taeeul.cycle', 'taeeul.cycle_position', 24), { id: 'gujeong.c1_honmei_getsumei', system: 'gujeong', lineage: 'gujeong.stars', source: 'honmei_star,getsumei_star', evaluate: (r, I) => lottoSpread((value(r, I, 'gujeong.honmei_star') - 1) * 9 + value(r, I, 'gujeong.getsumei_star'), 81) }, direct('gujeong.c2_honmei', 'gujeong', 'gujeong.stars', 'gujeong.honmei_star', 9),
    direct('sukyo.c1_nakshatra', 'sukyo', 'astro.sidereal_moon', 'vedic_sukyo_shared.nakshatra_index', 27), { id: 'sukyo.c2_nakshatra_pada', system: 'sukyo', lineage: 'astro.sidereal_moon', source: 'nakshatra_index,pada', evaluate: (r, I) => lottoSpread((value(r, I, 'vedic_sukyo_shared.nakshatra_index') - 1) * 4 + value(r, I, 'vedic_sukyo_shared.nakshatra_pada'), 108) },
    direct('tojeong.c1_hexagram', 'tojeong', 'tojeong.trigrams', 'tojeong.괘', 144), { id: 'tojeong.c2_upper_middle', system: 'tojeong', lineage: 'tojeong.trigrams', source: '상괘,중괘', evaluate: (r, I) => lottoSpread(value(r, I, 'tojeong.상괘') * 10 + value(r, I, 'tojeong.중괘'), 86) },
    { id: 'kabbalah.c1_life_birthday', system: 'kabbalah', lineage: 'civil_date', source: 'life_path,birthday_number', evaluate: (r, I) => lottoSpread(((value(r, I, 'kabbalah.life_path') - 1) % 9) * 9 + value(r, I, 'kabbalah.birthday_number'), 81) }, direct('kabbalah.c2_personal_year', 'kabbalah', 'civil_date', 'kabbalah.personal_year', 9), direct('mahabote.c1_eight_place', 'mahabote', 'mahabote.eight_place', 'mahabote.eight_place', 8),
    { id: 'thai.c1_weekday_buddhist', system: 'thai', lineage: 'thai.calendar', source: 'weekday_index,buddhist_era_mod100', evaluate: (r, I) => lottoSpread((value(r, I, 'thai.weekday_index') - 1) * 100 + value(r, I, 'thai.buddhist_era_mod100'), 700) }, direct('tarot.c1_birth_card', 'tarot', 'tarot.cards', 'tarot.생일_카드', 78),
  ];
}
function formulaValue(formula, candidates, rowIndex) {
  const a = candidates[rowIndex][formula.a]; const b = formula.b == null ? 0 : candidates[rowIndex][formula.b]; const c = formula.c == null ? 0 : candidates[rowIndex][formula.c];
  switch (formula.op) {
    case 'one': return a; case 'sum': return a + b; case 'diff': return a - b; case 'rdiff': return b - a; case 'abs': return Math.abs(a - b); case 'a2b': return 2 * a + b; case 'twoab': return a + 2 * b; case 'twoMinus': return 2 * a - b; case 'minusTwo': return a - 2 * b; case 'mul': return a * b; case 'mean': return Math.floor((a + b) / 2);
    case 'abcSum': return a + b + c; case 'abcSub': return a + b - c; case 'abPlusC': return a - b + c; case 'abMinusC': return a - b - c; case 'twoABC': return 2 * a + b - c; case 'aTwoBC': return a + 2 * b - c; case 'abTwoC': return a + b - 2 * c; case 'absPlusC': return Math.abs(a - b) + c;
    default: throw new Error(`unknown formula ${formula.op}`);
  }
}
function formulaName(f, specs) { const n = (i) => specs[i].id; const b = f.b == null ? '' : n(f.b); const c = f.c == null ? '' : n(f.c); const t = { one: n(f.a), sum: `${n(f.a)}+${b}`, diff: `${n(f.a)}-${b}`, rdiff: `${b}-${n(f.a)}`, abs: `|${n(f.a)}-${b}|`, a2b: `2*${n(f.a)}+${b}`, twoab: `${n(f.a)}+2*${b}`, twoMinus: `2*${n(f.a)}-${b}`, minusTwo: `${n(f.a)}-2*${b}`, mul: `${n(f.a)}*${b}`, mean: `floor((${n(f.a)}+${b})/2)`, abcSum: `${n(f.a)}+${b}+${c}`, abcSub: `${n(f.a)}+${b}-${c}`, abPlusC: `${n(f.a)}-${b}+${c}`, abMinusC: `${n(f.a)}-${b}-${c}`, twoABC: `2*${n(f.a)}+${b}-${c}`, aTwoBC: `${n(f.a)}+2*${b}-${c}`, abTwoC: `${n(f.a)}+${b}-2*${c}`, absPlusC: `|${n(f.a)}-${b}|+${c}` };
  return `wrap45(${t[f.op]})`;
}
function makeFormulaUniverse(candidateCount) {
  const forms = []; for (let a = 0; a < candidateCount; a++) forms.push({ a, op: 'one', complexity: 1 });
  const pairOps = ['sum', 'diff', 'rdiff', 'abs', 'a2b', 'twoab', 'twoMinus', 'minusTwo', 'mul', 'mean'];
  for (let a = 0; a < candidateCount; a++) for (let b = a + 1; b < candidateCount; b++) for (const op of pairOps) forms.push({ a, b, op, complexity: op === 'mul' ? 4 : op === 'mean' ? 3 : ['sum', 'diff', 'rdiff', 'abs'].includes(op) ? 2 : 3 });
  const top = Math.min(22, candidateCount); const tripleOps = ['abcSum', 'abcSub', 'abPlusC', 'abMinusC', 'twoABC', 'aTwoBC', 'abTwoC', 'absPlusC'];
  for (let a = 0; a < top; a++) for (let b = a + 1; b < top; b++) for (let c = b + 1; c < top; c++) for (const op of tripleOps) forms.push({ a, b, c, op, complexity: 3 });
  return forms;
}
function formulaHits(formula, candidates, rows) { let hits = 0; for (let i = 0; i < rows.length; i++) if (rows[i].winning.includes(wrap45(formulaValue(formula, candidates, i)))) hits++; return hits; }
function ticketsFromFormulas(formulas, candidates) { return candidates.map((_, i) => uniqueTicket(formulas.map((f) => formulaValue(f, candidates, i)))); }
function greedyFormulaSet(pool, candidates, rows, subset = null) {
  const positions = subset ?? rows.map((_, i) => i); const chosen = [];
  const evaluate = (forms) => evaluateTickets(positions.map((i) => uniqueTicket(forms.map((f) => formulaValue(f, candidates, i)))), positions.map((i) => rows[i]));
  while (chosen.length < 6) { let best = null; for (const f of pool) { const s = evaluate([...chosen, f]); if (!best || byScore(s, best.stats) < 0) best = { formula: f, stats: s }; } chosen.push(best.formula); }
  return { formulas: chosen, localStats: evaluate(chosen) };
}
function numberRows(candidateRows, specs, formulaPool, rows) {
  return candidateRows.map((values, i) => Array.from({ length: 45 }, (_, j) => {
    const n = j + 1; const direct = specs.filter((_, k) => values[k] === n); const systems = new Set(direct.map((x) => x.system)); const lineages = new Set(direct.map((x) => x.lineage));
    let nearby = 0; for (const x of values) { const d = Math.min(Math.abs(x - n), 45 - Math.abs(x - n)); if (d === 1) nearby++; if (d === 2) nearby += 0.5; }
    let derived = 0; for (const f of formulaPool) if (wrap45(formulaValue(f, candidateRows, i)) === n) derived++;
    return { n, direct_candidates: direct.length, direct_systems: systems.size, independent_lineages: lineages.size, nearby_support: nearby, derived_formula_support: derived };
  }));
}
function rankingTickets(features, weights) {
  return features.map((row) => row.map((x) => ({ n: x.n, score: weights.systems * x.direct_systems + weights.candidates * x.direct_candidates + weights.lineages * x.independent_lineages + weights.nearby * x.nearby_support + weights.derived * x.derived_formula_support })).sort((a, b) => b.score - a.score || a.n - b.n).slice(0, 6).map((x) => x.n));
}
function selectState(manifest, rows) {
  const wanted = ['saju.day_sexagenary', 'saju.hour_sexagenary', 'saju.solar_term_sector', 'jamidusu.myeong_palace', 'jamidusu.ziwei_palace', 'astrology.태양_longitude_degree', 'astrology.달_longitude_degree', 'astrology.ascendant_degree', 'vedic_sukyo_shared.nakshatra_index', 'vedic_sukyo_shared.nakshatra_pada', 'juyeok.original_hexagram', 'juyeok.moving_line', 'yukim.month_general', 'yukim.first_transmission', 'yukim.middle_transmission', 'yukim.last_transmission', 'hongguk.heaven_plate_center', 'hongguk.earth_plate_center', 'taeeul.cycle_position', 'gujeong.honmei_star', 'tojeong.괘', 'kabbalah.life_path', 'mahabote.eight_place', 'thai.weekday_index', 'tarot.생일_카드'];
  const I = idx(manifest); const features = wanted.map((id) => manifest[I[id]]); const vectors = rows.map((r) => features.map((f) => value(r, I, f.id) / f.max));
  return { featureIds: wanted, features, vectors };
}
function distance(a, b, features) { let sum = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); const circular = /longitude|sexagenary|nakshatra|hexagram|cycle/.test(features[i].id); sum += circular ? Math.min(d, 1 - d) : d; } return sum / a.length; }
function kmeans(vectors, k, rounds = 18) { const centroids = Array.from({ length: k }, (_, i) => [...vectors[Math.floor(i * vectors.length / k)]]); let assignments = Array(vectors.length).fill(0); for (let it = 0; it < rounds; it++) { assignments = vectors.map((v) => { let pick = 0; let best = Infinity; centroids.forEach((c, ci) => { const d = c.reduce((s, x, j) => s + (x - v[j]) ** 2, 0); if (d < best) { best = d; pick = ci; } }); return pick; }); for (let c = 0; c < k; c++) { const member = vectors.filter((_, i) => assignments[i] === c); if (member.length) centroids[c] = centroids[c].map((_, j) => member.reduce((s, x) => s + x[j], 0) / member.length); } } return { assignments, centroids }; }
function seededRandom(seed) { let x = seed >>> 0; return () => ((x = (1664525 * x + 1013904223) >>> 0) / 4294967296); }
export function seededPermutation(length, seed) {
  const random = seededRandom(seed); const result = Array.from({ length }, (_, i) => i);
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function randomTickets(count, seed = 20260923) { const rnd = seededRandom(seed); return Array.from({ length: count }, () => { const out = []; while (out.length < 6) { const n = Math.floor(rnd() * 45) + 1; if (!out.includes(n)) out.push(n); } return out; }); }

async function main() {
  const [manifest, rows, oldTickets, oldBest] = await Promise.all([json(join(INPUT, 'feature_manifest.json')), json(join(INPUT, 'feature_matrix_time_refined.json')), json(join(INPUT, 'tickets.json')), json(join(INPUT, 'best_rule.json'))]);
  await mkdir(OUT, { recursive: true }); for (const d of ['method-B', 'method-C', 'method-D', 'method-E', 'method-F']) await mkdir(join(OUT, d), { recursive: true });
  const I = idx(manifest); const specs = makeCandidateSpecs(); const candidateRows = rows.map((row) => specs.map((s) => s.evaluate(row, I)));
  const candidateMatrix = rows.map((r, i) => ({ round: r.round, candidates: Object.fromEntries(specs.map((s, j) => [s.id, candidateRows[i][j]])) }));
  await save(join(OUT, 'common_dataset.json'), { scope: { rounds: '1-1242', place: '서울', exact: 0, official_schedule: rows.length }, rows: rows.map((r) => ({ round: r.round, date: r.date, time: r.time, time_source: r.time_source, place: r.place, winning: r.winning })) });
  await save(join(OUT, 'common_candidate_matrix.json'), { description: 'Analysis-only replication of fixed lotto.js candidate identities; no winner is used in candidate creation.', manifest: specs.map(({ evaluate, ...x }) => x), rows: candidateMatrix });

  // A1: constrained raw/spread feature conditional model (depth 1, <=12 leaves).
  const completeIndexes = completeFeatureIndexes(manifest, rows);
  const atoms = completeIndexes.flatMap((fi) => [{ fi, layer: 'raw', complexity: 1 }, { fi, layer: 'spread', complexity: 1 }]);
  const atomValue = (f, ri) => rows[ri][f.layer][f.fi]; const aSingles = atoms.map((a) => ({ ...a, op: 'one' }));
  const singleRank = aSingles.map((f) => ({ f, hit: rows.reduce((s, r, ri) => s + Number(r.winning.includes(wrap45(atomValue(f, ri)))), 0) })).sort((a, b) => b.hit - a.hit).slice(0, 48).map((x) => x.f);
  const aForms = [...aSingles]; for (let ai = 0; ai < singleRank.length; ai++) for (let bi = ai + 1; bi < singleRank.length; bi++) for (const op of ['sum', 'diff', 'abs', 'a2b', 'mul']) aForms.push({ a: singleRank[ai], b: singleRank[bi], op, complexity: op === 'mul' ? 4 : op === 'sum' || op === 'diff' || op === 'abs' ? 2 : 3 });
  const aValue = (f, ri) => { const a = atomValue(f.a ?? f, ri), b = f.b ? atomValue(f.b, ri) : 0; return f.op === 'one' ? a : f.op === 'sum' ? a + b : f.op === 'diff' ? a - b : f.op === 'abs' ? Math.abs(a - b) : f.op === 'a2b' ? 2 * a + b : a * b; };
  const aRank = aForms.map((f) => ({ f, hit: rows.reduce((s, r, ri) => s + Number(r.winning.includes(wrap45(aValue(f, ri)))), 0) })).sort((a, b) => b.hit - a.hit).slice(0, 240).map((x) => x.f);
  const aConditions = ['saju.day_stem', 'saju.day_branch', 'astrology.달_sign']; const aModels = [];
  for (const cid of aConditions) { const groups = [...new Set(rows.map((r) => value(r, I, cid)))]; const groupIndexes = groups.map((g) => rows.map((r, ri) => value(r, I, cid) === g ? ri : -1).filter((x) => x >= 0)); if (!conditionalRuleIsAllowed({ branchCount: groups.length, maxDepth: 1, leafSizes: groupIndexes.map((x) => x.length) })) continue;
    const rules = new Map(); for (let gi = 0; gi < groups.length; gi++) { const indices = groupIndexes[gi]; const local = []; for (let lane = 0; lane < 6; lane++) { let best = null; for (const f of aRank) { const t = indices.map((ri) => uniqueTicket([...local, f].map((z) => aValue(z, ri)))); const s = evaluateTickets(t, indices.map((ri) => rows[ri])); if (!best || byScore(s, best.s) < 0) best = { f, s }; } local.push(best.f); } rules.set(groups[gi], local); }
    const tickets = rows.map((r, ri) => uniqueTicket(rules.get(value(r, I, cid)).map((f) => aValue(f, ri)))); aModels.push({ condition: cid, groups, rules, tickets, stats: evaluateTickets(tickets, rows) }); }
  aModels.sort((a, b) => byScore(a.stats, b.stats)); const A = aModels[0];
  const aFormulaText = (f) => f.op === 'one' ? `${manifest[f.fi].id}.${f.layer}` : `${f.op}(${manifest[f.a.fi].id}.${f.a.layer},${manifest[f.b.fi].id}.${f.b.layer})`;
  const aOutput = { method: 'A', description: 'Constrained raw/spread feature conditional formula.  One natural condition only; no event signature, no unique key.', model: { condition: A.condition, depth: 1, branch_count: A.groups.length, leaf_sizes: A.groups.map((g) => A.rules.get(g).length && rows.filter((r) => value(r, I, A.condition) === g).length), leaf_minimum: 30, branch_maximum: 20, complete_raw_spread_features: completeIndexes.length, excluded_incomplete_features: manifest.filter((_, i) => !completeIndexes.includes(i)).map((f) => f.id), branches: Object.fromEntries(A.groups.map((g) => [g, A.rules.get(g).map(aFormulaText)])) }, score: A.stats, period_stability: periodStats(A.tickets, rows), time_quality: timeStats(A.tickets, rows), complexity: A.groups.length * 6 + A.rules.size, tickets: A.tickets, prior_A1_reference: { score: 5901, source: 'run-backtest.mjs ORIGINAL_A_FIXED_SCHEDULE', note: 'Earlier fixed schedule benchmark; current A1 is re-evaluated on common refined matrix.' }, excluded_theoretical_upper_bound: { score: oldBest.score.score, reason: 'event_signature makes near-unique per-round keys and is excluded from A–F.' } };

  // B: fixed candidate formula identities, with no routing.
  const universe = makeFormulaUniverse(specs.length); const ranking = universe.map((f) => ({ ...f, name: formulaName(f, specs), individual_hits: formulaHits(f, candidateRows, rows) })).sort((a, b) => b.individual_hits - a.individual_hits || a.complexity - b.complexity);
  const bPool = ranking.slice(0, 360); const BRule = greedyFormulaSet(bPool, candidateRows, rows); const BTickets = ticketsFromFormulas(BRule.formulas, candidateRows); const B = { method: 'B', description: 'Reverse search over fixed global candidate formula identities; winner data selects formulas globally but never routes a round.', model: { formulas: BRule.formulas.map((f) => formulaName(f, specs)), grammar: 'single; ten pair operations; eight triple operations; wrap45 terminal', routing: 'none' }, params: { universe: universe.length, selection_pool: bPool.length }, score: evaluateTickets(BTickets, rows), period_stability: periodStats(BTickets, rows), time_quality: timeStats(BTickets, rows), complexity: BRule.formulas.reduce((s, f) => s + f.complexity, 0), tickets: BTickets };
  await save(join(OUT, 'method-B', 'candidate_manifest.json'), specs.map(({ evaluate, ...x }) => x)); await save(join(OUT, 'method-B', 'formula_manifest.json'), { grammar: B.model.grammar, formula_count: universe.length }); await save(join(OUT, 'method-B', 'formula_hits.json'), ranking); await save(join(OUT, 'method-B', 'top100_single_formulas.json'), ranking.filter((f) => f.op === 'one').slice(0, 100)); await save(join(OUT, 'method-B', 'best_6_formula_rule.json'), B);

  // C: number scoring has only pre-draw candidate/formula support in each row.
  const cPool = ranking.slice(0, 80); const cFeatures = numberRows(candidateRows, specs, cPool, rows); const weightGrid = []; for (const systems of [1, 2, 3, 4]) for (const candidates of [0, 1, 2]) for (const lineages of [0, 1, 2]) for (const nearby of [0, 1]) for (const derived of [0, 1, 2]) weightGrid.push({ systems, candidates, lineages, nearby, derived });
  const cModels = weightGrid.map((weights) => { const tickets = rankingTickets(cFeatures, weights); return { weights, tickets, stats: evaluateTickets(tickets, rows) }; }).sort((a, b) => byScore(a.stats, b.stats)); const CBest = cModels[0]; const C = { method: 'C', description: 'Ranks every number 1..45 from pre-draw candidate support. Weights are optimized globally, but no row winner appears in a number feature.', model: { score_formula: 'systems*w1 + candidates*w2 + independent_lineages*w3 + nearby*w4 + derived_formula_support*w5', weights: CBest.weights, selected: 'top 6, score desc then number asc' }, score: CBest.stats, period_stability: periodStats(CBest.tickets, rows), time_quality: timeStats(CBest.tickets, rows), complexity: Object.values(CBest.weights).filter(Boolean).length, tickets: CBest.tickets };
  await save(join(OUT, 'method-C', 'number_features.json'), { feature_definitions: ['direct_candidates', 'direct_systems', 'independent_lineages', 'nearby_support', 'derived_formula_support'], rows: cFeatures.map((x, i) => ({ round: rows[i].round, numbers: x })) }); await save(join(OUT, 'method-C', 'best_scoring_rule.json'), C); await save(join(OUT, 'method-C', 'number_rankings.json'), CBest.tickets.map((t, i) => ({ round: rows[i].round, ticket: t, ranking: cFeatures[i].map((x) => ({ n: x.n, score: CBest.weights.systems * x.direct_systems + CBest.weights.candidates * x.direct_candidates + CBest.weights.lineages * x.independent_lineages + CBest.weights.nearby * x.nearby_support + CBest.weights.derived * x.derived_formula_support })).sort((a, b) => b.score - a.score || a.n - b.n) }))); await save(join(OUT, 'method-C', 'tickets.json'), CBest.tickets);

  // D: joint fixed-lane greedy start plus deterministic local swap search.
  const dPool = ranking.slice(0, 900); let DRule = greedyFormulaSet(dPool, candidateRows, rows); const dLog = [{ stage: 'greedy', score: DRule.localStats.score, formulas: DRule.formulas.map((f) => formulaName(f, specs)) }];
  for (let pass = 0; pass < 2; pass++) { let improved = false; for (let lane = 0; lane < 6; lane++) { let best = DRule; for (const replacement of dPool) { const proposal = [...DRule.formulas]; proposal[lane] = replacement; const tickets = ticketsFromFormulas(proposal, candidateRows); const stats = evaluateTickets(tickets, rows); if (byScore(stats, best.localStats) < 0) best = { formulas: proposal, localStats: stats }; } if (best !== DRule) { DRule = best; improved = true; dLog.push({ stage: `swap-${pass}-${lane}`, score: DRule.localStats.score, formulas: DRule.formulas.map((f) => formulaName(f, specs)) }); } } if (!improved) break; }
  const DTickets = ticketsFromFormulas(DRule.formulas, candidateRows); const D = { method: 'D', description: 'Joint six-formula optimization over the B universe using deterministic greedy start and whole-ticket local swaps.', model: { genome: DRule.formulas.map((f) => formulaName(f, specs)), duplicate_rule: 'cyclic increment to next unused number', routing: 'none' }, params: { universe: universe.length, search_pool: dPool.length, passes: 2 }, score: evaluateTickets(DTickets, rows), period_stability: periodStats(DTickets, rows), time_quality: timeStats(DTickets, rows), complexity: DRule.formulas.reduce((s, f) => s + f.complexity, 0), tickets: DTickets };
  await save(join(OUT, 'method-D', 'search_log.json'), dLog); await save(join(OUT, 'method-D', 'best_genomes.json'), dLog); await save(join(OUT, 'method-D', 'best_joint_6_formula.json'), D); await save(join(OUT, 'method-D', 'tickets.json'), DTickets);

  // E: automatic full-state clustering, then one fixed six-formula rule per cluster.
  const state = selectState(manifest, rows); const eModels = [];
  for (const k of [3, 6, 12]) { const km = kmeans(state.vectors, k); const rules = []; for (let c = 0; c < k; c++) { const subset = km.assignments.map((x, i) => x === c ? i : -1).filter((x) => x >= 0); rules[c] = greedyFormulaSet(bPool.slice(0, 180), candidateRows, rows, subset).formulas; }
    const tickets = rows.map((_, i) => uniqueTicket(rules[km.assignments[i]].map((f) => formulaValue(f, candidateRows, i)))); eModels.push({ k, assignments: km.assignments, centroids: km.centroids, rules, tickets, stats: evaluateTickets(tickets, rows) }); }
  eModels.sort((a, b) => byScore(a.stats, b.stats)); const EBest = eModels[0]; const E = { method: 'E', description: 'K-means fortune-state clustering with cluster-specific fixed candidate formula rules. Cluster inputs omit winners.', model: { k: EBest.k, state_features: state.featureIds, cluster_rules: EBest.rules.map((r) => r.map((f) => formulaName(f, specs))), assignment: 'nearest k-means centroid' }, score: EBest.stats, period_stability: periodStats(EBest.tickets, rows), time_quality: timeStats(EBest.tickets, rows), complexity: EBest.k * 6 + state.featureIds.length, tickets: EBest.tickets };
  await save(join(OUT, 'method-E', 'state_matrix.json'), { feature_ids: state.featureIds, vectors: state.vectors });
  await save(join(OUT, 'method-E', 'cluster_models.json'), eModels.map((x) => ({
    k: x.k, score: x.stats,
    cluster_sizes: Array.from({ length: x.k }, (_, c) => x.assignments.filter((a) => a === c).length),
  })));
  await save(join(OUT, 'method-E', 'cluster_assignments.json'), EBest.assignments.map((cluster, i) => ({ round: rows[i].round, cluster }))); await save(join(OUT, 'method-E', 'best_cluster_model.json'), E); await save(join(OUT, 'method-E', 'tickets.json'), EBest.tickets);

  // F: feature-aware distance. LOO includes future for historical structure; past-only is sequential.
  const distances = Array.from({ length: rows.length }, () => Array(rows.length).fill(Infinity)); for (let i = 0; i < rows.length; i++) for (let j = 0; j < i; j++) distances[i][j] = distances[j][i] = distance(state.vectors[i], state.vectors[j], state.features);
  function neighborTickets(mode, k, weighted) { const neighbors = []; const tickets = rows.map((_, i) => { const candidates = rows.map((_, j) => j).filter((j) => j !== i && (mode === 'loo' || j < i)).sort((a, b) => distances[i][a] - distances[i][b] || rows[a].round - rows[b].round).slice(0, k); neighbors[i] = candidates; const scores = Array(46).fill(0); candidates.forEach((j) => rows[j].winning.forEach((n) => { scores[n] += weighted ? 1 / Math.max(0.0001, distances[i][j]) : 1; })); return Array.from({ length: 45 }, (_, n) => n + 1).sort((a, b) => scores[b] - scores[a] || a - b).slice(0, 6); }); return { mode, k, weighted, neighbors, tickets, stats: evaluateTickets(tickets, rows) }; }
  const fModels = []; for (const mode of ['loo', 'past_only']) for (const k of [5, 10, 20, 50]) for (const weighted of [false, true]) fModels.push(neighborTickets(mode === 'loo' ? 'loo' : 'past', k, weighted)); fModels.sort((a, b) => byScore(a.stats, b.stats)); const FBest = fModels[0]; const F = { method: 'F', description: 'Nearest historical fortune states using mixed circular/categorical normalized distance. Self is excluded; best LOO and past-only configurations are both retained.', model: { selected: { mode: FBest.mode === 'loo' ? 'leave-one-out all-history' : 'past-only', k: FBest.k, weighting: FBest.weighted ? 'inverse-distance' : 'frequency' }, state_features: state.featureIds, distance: 'circular normalized distance for longitude/cycle-like fields; normalized absolute distance otherwise', past_only_best: stable(fModels.filter((x) => x.mode === 'past').sort((a, b) => byScore(a.stats, b.stats))[0]) }, score: FBest.stats, period_stability: periodStats(FBest.tickets, rows), time_quality: timeStats(FBest.tickets, rows), complexity: state.featureIds.length + FBest.k, tickets: FBest.tickets };
  await save(join(OUT, 'method-F', 'state_matrix.json'), { feature_ids: state.featureIds, vectors: state.vectors }); await save(join(OUT, 'method-F', 'neighbor_configurations.json'), fModels.map((x) => ({ mode: x.mode, k: x.k, weighted: x.weighted, score: x.stats }))); await save(join(OUT, 'method-F', 'nearest_neighbors.json'), FBest.neighbors.map((list, i) => ({ round: rows[i].round, neighbors: list.map((j) => ({ round: rows[j].round, distance: distances[i][j] })) }))); await save(join(OUT, 'method-F', 'best_similarity_model.json'), F); await save(join(OUT, 'method-F', 'tickets.json'), FBest.tickets);

  const methods = { A: aOutput, B, C, D, E, F }; for (const [name, method] of Object.entries(methods)) await save(join(OUT, `method_${name}.json`), method);
  const coverage = Object.fromEntries([...new Set(specs.map((s) => s.system))].map((system) => { const is = specs.map((s, i) => s.system === system ? i : -1).filter((i) => i >= 0); const direct = rows.map((r, ri) => r.winning.filter((n) => is.some((i) => candidateRows[ri][i] === n)).length); return [system, { candidates_per_round: is.length, mean_winner_coverage: direct.reduce((s, x) => s + x, 0) / rows.length, ge1: direct.filter((x) => x >= 1).length / rows.length, ge2: direct.filter((x) => x >= 2).length / rows.length, ge3: direct.filter((x) => x >= 3).length / rows.length, shared_lineages: [...new Set(is.map((i) => specs[i].lineage))] }]; }));
  const role = rows.map((r, ri) => ({ round: r.round, winner_roles: r.winning.map((n) => ({ n, systems: [...new Set(specs.filter((_, ci) => candidateRows[ri][ci] === n).map((s) => s.system))], lineages: [...new Set(specs.filter((_, ci) => candidateRows[ri][ci] === n).map((s) => s.lineage))] })) }));
  const baselineTrials = Array.from({ length: 400 }, (_, i) => evaluateTickets(randomTickets(rows.length, 20260000 + i), rows)); const random = { trials: baselineTrials.length, mean_score: baselineTrials.reduce((s, x) => s + x.score, 0) / baselineTrials.length, mean_hits: baselineTrials.reduce((s, x) => s + x.mean, 0) / baselineTrials.length, min_score: Math.min(...baselineTrials.map((x) => x.score)), max_score: Math.max(...baselineTrials.map((x) => x.score)), expected_one_ticket_mean_hits: 6 * 6 / 45 };
  const nulls = Array.from({ length: 16 }, (_, seed) => { const order = seededPermutation(rows.length, seed + 17); const shuffled = rows.map((r, i) => ({ ...r, winning: rows[order[i]].winning })); const top = ranking.slice(0, 220); const rule = greedyFormulaSet(top, candidateRows, shuffled); return { seed, score: rule.localStats.score, formulas: rule.formulas.map((f) => formulaName(f, specs)) }; });
  const commonEvaluation = { evaluator: { score_vector: SCORE, requirement: 'exactly six unique integers in 1..45' }, invariant_results: Object.fromEntries(Object.entries(methods).map(([name, x]) => [name, { valid: x.tickets.length === rows.length && x.tickets.every((t) => t.length === 6 && new Set(t).size === 6 && t.every((n) => n >= 1 && n <= 45)), score: evaluateTickets(x.tickets, rows) }])), constrained_A_rule: { max_branches: 20, max_depth: 2, min_leaf_size: 30, event_signature_allowed: false } };
  const comparison = Object.fromEntries(Object.entries(methods).map(([name, x]) => [name, { structure: x.description, score: x.score.score, mean: x.score.mean, ge3: x.score.ge3, ge4: x.score.ge4, five_hit: x.score.fiveHit, six_hit: x.score.sixHit, complexity: x.complexity, vs_random_score: x.score.score - random.mean_score }]));
  await save(join(OUT, 'common_evaluation.json'), commonEvaluation); await save(join(OUT, 'system_coverage.json'), coverage); await save(join(OUT, 'role_analysis.json'), { description: 'Each actual winner’s direct candidate-system and lineage roles; shared Vedic/Sukyo origin remains one lineage.', rows: role }); await save(join(OUT, 'time_quality_analysis.json'), Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, v.time_quality]))); await save(join(OUT, 'period_stability.json'), Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, v.period_stability]))); await save(join(OUT, 'random_baseline.json'), random); await save(join(OUT, 'null_search_simulation.json'), { method: 'B-like global formula search against shuffled targets', trials: nulls, mean_score: nulls.reduce((s, x) => s + x.score, 0) / nulls.length, max_score: Math.max(...nulls.map((x) => x.score)), caveat: 'A theoretical event_signature upper bound is excluded because it is lookup-like.' }); await save(join(OUT, 'comparison.json'), { primary_objective: 'whole-history weighted score, in-sample only', comparison, excluded_upper_bound: aOutput.excluded_theoretical_upper_bound });
  const table = Object.entries(comparison).map(([m, x]) => `| ${m} | ${x.score} | ${x.mean.toFixed(4)} | ${(x.ge3 * 100).toFixed(2)}% | ${(x.ge4 * 100).toFixed(2)}% | ${x.five_hit} | ${x.six_hit} | ${x.complexity} |`).join('\n'); const best = Object.entries(methods).sort(([, a], [, b]) => byScore(a.score, b.score))[0];
  await writeFile(join(OUT, 'report.md'), `# Fortune-lotto A–F method comparison\n\nAll methods use the same cached time-refined Seoul dataset: rounds 1–1242, all marked \`official_schedule\` rather than exact draw times. This is a whole-history in-sample fit study, not evidence of future prediction.\n\n| Method | Score | Mean hits | 3+ | 4+ | 5-hit | 6-hit | Complexity |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${table}\n\n**Historical constrained winner: Method ${best[0]} (${best[1].score.score}).** Its exact reproducible rule is in \`method_${best[0]}.json\`.\n\n## Guardrails\n\n- A uses at most ${aOutput.model.branch_count} leaves, depth 1, and every branch has at least 30 rounds.\n- No A–F method uses \`event_signature\`, string-concatenated time keys, or round-specific winner routing.\n- The prior lookup-like score ${aOutput.excluded_theoretical_upper_bound.score} is preserved only as a non-comparable theoretical upper bound.\n- Vedic and Sukyo Nakshatra/Pada share the \`astro.sidereal_moon\` lineage in support analysis.\n- Fixed post-1242 future-validation hypotheses were neither used nor changed.\n\n## Time and stability\n\nThere are no exact-time rows in the shared data, so exact-only performance is \`null\` rather than fabricated. Per-method time-quality and four-period results are in \`time_quality_analysis.json\` and \`period_stability.json\`.\n\n## Overfitting warning\n\nAll model selection is in-sample. The random baseline and shuffled-target formula-search null results quantify only parts of winner’s-curse risk; they do not establish forecasting value.\n`);
  console.log(JSON.stringify({ output: OUT, methods: Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, v.score])), valid: commonEvaluation.invariant_results }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((error) => { console.error(error); process.exitCode = 1; });
