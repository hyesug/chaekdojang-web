/* Read-only extension of the committed A–F study.  New results only. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateTickets, seededPermutation } from './run-method-comparison.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'output', 'method-comparison');
const MATRIX = join(HERE, 'output');
const WRAP = (x) => ((Math.floor(x) - 1) % 45 + 45) % 45 + 1;
const scoreOrder = (a, b) => b.score - a.score || b.hist[6] - a.hist[6] || b.hist[5] - a.hist[5] || b.hist[4] - a.hist[4] || b.mean - a.mean;
const compareBest = (a, b) => scoreOrder(a, b) < 0;
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const save = async (p, x) => writeFile(p, `${JSON.stringify(x, null, 2)}\n`);
const indexOf = (manifest) => Object.fromEntries(manifest.map((x, i) => [x.id, i]));

function ticket(values) { const out = []; for (const value of values) { let n = WRAP(value); while (out.includes(n)) n = n === 45 ? 1 : n + 1; out.push(n); if (out.length === 6) break; } for (let n = 1; out.length < 6; n++) if (!out.includes(n)) out.push(n); return out; }
export function isAstronomyCoordinateId(id) { return /^astrology\.(?:.+_longitude_degree|ascendant_degree|midheaven_degree)$/.test(id); }
export function temporalNumberFeatures(rows, targetIndex, number) {
  const history = rows.slice(0, targetIndex); const positions = [];
  history.forEach((r, i) => { if (r.winning.includes(number)) positions.push(i); });
  const within = (n) => positions.filter((p) => p >= targetIndex - n).length;
  const last = positions.at(-1); const all_count = positions.length;
  const mean_gap = positions.length > 1 ? positions.slice(1).reduce((s, p, i) => s + p - positions[i], 0) / (positions.length - 1) : targetIndex;
  return { all_count, last_5: within(5), last_10: within(10), last_20: within(20), last_50: within(50), last_100: within(100), last_200: within(200), gap: last == null ? targetIndex : targetIndex - 1 - last, mean_gap, previous: history.at(-1)?.winning.includes(number) ? 1 : 0 };
}
export function hybridTicket(aTicket, eTicket, weights) {
  const scores = Array.from({ length: 45 }, (_, i) => ({ n: i + 1, score: 0 }));
  aTicket.forEach((n, i) => { scores[n - 1].score += weights.a + (6 - i) / 100; });
  eTicket.forEach((n, i) => { scores[n - 1].score += weights.e + (6 - i) / 100; });
  for (const n of aTicket) if (eTicket.includes(n)) scores[n - 1].score += weights.agreement;
  return scores.sort((x, y) => y.score - x.score || x.n - y.n).slice(0, 6).map((x) => x.n);
}
export function expandingSplits(length) {
  return [[600, 700], [700, 800], [800, 900], [900, 1000], [1000, 1100], [1100, 1200], [1200, length]].map(([endTrain, endTest]) => ({ train: Array.from({ length: endTrain }, (_, i) => i), test: Array.from({ length: endTest - endTrain }, (_, i) => endTrain + i), label: `${endTrain + 1}-${endTest}` }));
}
function forms(width, triples = false) {
  const out = []; for (let a = 0; a < width; a++) out.push({ a, op: 'one', c: 1 });
  for (let a = 0; a < width; a++) for (let b = a + 1; b < width; b++) for (const op of ['sum', 'diff', 'abs', 'a2b', 'mul', 'mean']) out.push({ a, b, op, c: op === 'mul' ? 4 : op === 'a2b' ? 3 : op === 'one' ? 1 : 2 });
  if (triples) for (let a = 0; a < Math.min(width, 16); a++) for (let b = a + 1; b < Math.min(width, 16); b++) for (let d = b + 1; d < Math.min(width, 16); d++) out.push({ a, b, d, op: 'abc', c: 3 });
  return out;
}
function formulaValue(f, values, row) { const a = values[row][f.a], b = f.b == null ? 0 : values[row][f.b], d = f.d == null ? 0 : values[row][f.d]; if (f.op === 'one') return a; if (f.op === 'sum') return a + b; if (f.op === 'diff') return a - b; if (f.op === 'abs') return Math.abs(a - b); if (f.op === 'a2b') return 2 * a + b; if (f.op === 'mul') return a * b; if (f.op === 'mean') return Math.floor((a + b) / 2); return a + b - d; }
function formulaLabel(f, names) { const a = names[f.a], b = f.b == null ? '' : names[f.b], d = f.d == null ? '' : names[f.d]; const e = { one: a, sum: `${a}+${b}`, diff: `${a}-${b}`, abs: `|${a}-${b}|`, a2b: `2*${a}+${b}`, mul: `${a}*${b}`, mean: `floor((${a}+${b})/2)`, abc: `${a}+${b}-${d}` }[f.op]; return `wrap45(${e})`; }
function ticketsFor(fs, values, indexes) { return indexes.map((row) => ticket(fs.map((f) => formulaValue(f, values, row)))); }
function rankForms(fs, values, rows, indexes) { return fs.map((f) => ({ f, hits: indexes.reduce((s, row) => s + Number(rows[row].winning.includes(WRAP(formulaValue(f, values, row)))), 0) })).sort((a, b) => b.hits - a.hits || a.f.c - b.f.c); }
function trainLanes(fs, values, rows, indexes, poolSize = 120) {
  const pool = rankForms(fs, values, rows, indexes).slice(0, poolSize).map((x) => x.f); const chosen = [];
  while (chosen.length < 6) { let best; for (const f of pool) { const stats = evaluateTickets(ticketsFor([...chosen, f], values, indexes), indexes.map((i) => rows[i])); if (!best || compareBest(stats, best.stats)) best = { f, stats }; } chosen.push(best.f); }
  return chosen;
}
function directCandidateTickets(candidateRows, specs, weights) {
  return candidateRows.map((values) => {
    const numbers = Array.from({ length: 45 }, (_, i) => ({ n: i + 1, score: 0 }));
    for (let i = 0; i < values.length; i++) numbers[values[i] - 1].score += weights[specs[i].system] ?? 1;
    return numbers.sort((a, b) => b.score - a.score || a.n - b.n).slice(0, 6).map((x) => x.n);
  });
}
function trainCandidateWeights(candidateRows, specs, rows, train) {
  const systems = [...new Set(specs.map((s) => s.system))]; const grids = [];
  for (const emphasis of systems) { const w = Object.fromEntries(systems.map((s) => [s, s === emphasis ? 3 : 1])); grids.push(w); }
  grids.push(Object.fromEntries(systems.map((s) => [s, 1]))); let best;
  for (const weights of grids) { const all = directCandidateTickets(candidateRows, specs, weights); const stats = evaluateTickets(train.map((i) => all[i]), train.map((i) => rows[i])); if (!best || compareBest(stats, best.stats)) best = { weights, stats, tickets: all }; }
  return best;
}
function temporalTable(rows) { return rows.map((_, i) => Array.from({ length: 45 }, (_, n) => ({ n: n + 1, ...temporalNumberFeatures(rows, i, n + 1) }))); }
function temporalTickets(table, weights) { return table.map((numbers) => numbers.map((x) => ({ n: x.n, score: weights.all * x.all_count + weights.r20 * x.last_20 + weights.r100 * x.last_100 + weights.gap * Math.min(x.gap, 30) + weights.prev * x.previous })).sort((a, b) => b.score - a.score || a.n - b.n).slice(0, 6).map((x) => x.n)); }
function trainTemporal(table, rows, train) { const configs = []; for (const all of [0, 0.25, 0.5, 1]) for (const r20 of [-1, 0, 1, 2, 3]) for (const r100 of [-1, 0, 1]) for (const gap of [-0.1, 0, 0.1, 0.2]) configs.push({ all, r20, r100, gap, prev: 0 }); let best;
  for (const weights of configs) { const allTickets = temporalTickets(table, weights); const stats = evaluateTickets(train.map((i) => allTickets[i]), train.map((i) => rows[i])); if (!best || compareBest(stats, best.stats)) best = { weights, stats, tickets: allTickets }; } return best; }
function kmeans(vectors, k, iterations = 12) { const centers = Array.from({ length: k }, (_, i) => [...vectors[Math.floor(i * vectors.length / k)]]); let labels = Array(vectors.length).fill(0); for (let it = 0; it < iterations; it++) { labels = vectors.map((v) => { let pick = 0, best = Infinity; centers.forEach((c, ci) => { const d = c.reduce((s, x, j) => s + (x - v[j]) ** 2, 0); if (d < best) { best = d; pick = ci; } }); return pick; }); for (let c = 0; c < k; c++) { const member = vectors.filter((_, i) => labels[i] === c); if (member.length) centers[c] = centers[c].map((_, j) => member.reduce((s, v) => s + v[j], 0) / member.length); } } return { centers, labels }; }
function nearest(v, centers) { let pick = 0, best = Infinity; centers.forEach((c, ci) => { const d = c.reduce((s, x, j) => s + (x - v[j]) ** 2, 0); if (d < best) { best = d; pick = ci; } }); return pick; }
function trainA(values, rows, train, moonGroups, rawForms) { const rules = new Map(); for (const g of [...new Set(train.map((i) => moonGroups[i]))]) { const local = train.filter((i) => moonGroups[i] === g); rules.set(g, trainLanes(rawForms, values, rows, local, 80)); } return rules; }
function aTickets(rules, values, moonGroups, indexes) { return indexes.map((i) => ticket((rules.get(moonGroups[i]) ?? [...rules.values()][0]).map((f) => formulaValue(f, values, i)))); }
function trainE(state, candidateValues, candidateForms, rows, train) { const trainVectors = train.map((i) => state[i]); const km = kmeans(trainVectors, 6); const labels = train.map((i) => nearest(state[i], km.centers)); const global = rankForms(candidateForms, candidateValues, rows, train).slice(0, 100).map((x) => x.f); const rules = Array.from({ length: 6 }, (_, c) => { const local = train.filter((_, j) => labels[j] === c); return trainLanes(global, candidateValues, rows, local.length >= 10 ? local : train, 100); }); return { centers: km.centers, rules }; }
function eTickets(model, state, candidateValues, indexes) { return indexes.map((i) => ticket(model.rules[nearest(state[i], model.centers)].map((f) => formulaValue(f, candidateValues, i)))); }
function fTickets(state, rows, indexes) { return indexes.map((i) => { const neighbors = Array.from({ length: i }, (_, j) => j).sort((a, b) => state[i].reduce((s, x, k) => s + Math.abs(x - state[a][k]), 0) - state[i].reduce((s, x, k) => s + Math.abs(x - state[b][k]), 0)).slice(0, 10); const score = Array(46).fill(0); neighbors.forEach((j) => rows[j].winning.forEach((n) => score[n]++)); return Array.from({ length: 45 }, (_, n) => n + 1).sort((a, b) => score[b] - score[a] || a - b).slice(0, 6); }); }
function randomTickets(count, seed) { let x = seed >>> 0; const random = () => ((x = (1664525 * x + 1013904223) >>> 0) / 4294967296); return Array.from({ length: count }, () => { const t = []; while (t.length < 6) { const n = Math.floor(random() * 45) + 1; if (!t.includes(n)) t.push(n); } return t; }); }
function summary(tickets, rows) { return evaluateTickets(tickets, rows); }
function aggregateSplits(parts) { const allTickets = parts.flatMap((x) => x.tickets); const allRows = parts.flatMap((x) => x.rows); return { ...summary(allTickets, allRows), splits: parts.map((x) => ({ range: x.label, ...summary(x.tickets, x.rows) })) }; }

async function main() {
  const [rows, manifest, candidateFile, priorComparison, aOld, bOld, cOld, dOld, eOld, fOld] = await Promise.all([
    read(join(MATRIX, 'feature_matrix_time_refined.json')), read(join(MATRIX, 'feature_manifest.json')), read(join(BASE, 'common_candidate_matrix.json')), read(join(BASE, 'comparison.json')),
    read(join(BASE, 'method_A.json')), read(join(BASE, 'method_B.json')), read(join(BASE, 'method_C.json')), read(join(BASE, 'method_D.json')), read(join(BASE, 'method_E.json')), read(join(BASE, 'method_F.json')),
  ]);
  const I = indexOf(manifest); const specs = candidateFile.manifest; const candidateNames = specs.map((x) => x.id); const candidateValues = candidateFile.rows.map((r) => candidateNames.map((n) => r.candidates[n]));
  const astroIds = manifest.filter((x) => isAstronomyCoordinateId(x.id)).map((x) => x.id); const astroValues = rows.map((r) => astroIds.map((id) => r.raw[I[id]]));
  const calendarNames = ['round', 'year', 'month', 'day', 'weekday', 'day_of_year']; const calendarValues = rows.map((r, i) => { const [year, month, day] = r.date.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day)); return [r.round, year, month, day, date.getUTCDay(), Math.floor((date - Date.UTC(year, 0, 0)) / 86400000)]; });
  const hNames = [...astroIds, ...calendarNames]; const hValues = astroValues.map((v, i) => [...v, ...calendarValues[i]]); const hForms = forms(hNames.length, true);
  const rawIds = ['saju.day_sexagenary','saju.hour_sexagenary','saju.solar_term_sector','jamidusu.myeong_palace','jamidusu.ziwei_palace','astrology.태양_longitude_degree','astrology.달_longitude_degree','vedic_sukyo_shared.nakshatra_index','juyeok.original_hexagram','juyeok.moving_line','yukim.month_general','yukim.first_transmission','yukim.last_transmission','hongguk.heaven_plate_center','hongguk.earth_plate_center','taeeul.cycle_position','gujeong.honmei_star','tojeong.괘','kabbalah.life_path','mahabote.eight_place','thai.weekday_index','tarot.생일_카드'];
  const rawValues = rows.map((r) => rawIds.map((id) => r.raw[I[id]])); const rawForms = forms(rawIds.length, false); const moonGroups = rows.map((r) => r.raw[I['astrology.달_sign']]);
  const stateIds = ['saju.day_sexagenary','saju.hour_sexagenary','saju.solar_term_sector','jamidusu.myeong_palace','astrology.태양_longitude_degree','astrology.달_longitude_degree','astrology.ascendant_degree','vedic_sukyo_shared.nakshatra_index','juyeok.original_hexagram','yukim.month_general','yukim.first_transmission','hongguk.heaven_plate_center','taeeul.cycle_position','gujeong.honmei_star','tojeong.괘','mahabote.eight_place','tarot.생일_카드'];
  const state = rows.map((r) => stateIds.map((id) => r.raw[I[id]] / manifest[I[id]].max)); const candidateForms = forms(candidateNames.length, true); const table = temporalTable(rows); const all = rows.map((_, i) => i);
  for (const dir of ['method-G','method-H','method-I','random-baseline','walk-forward']) await mkdir(join(BASE, dir), { recursive: true });

  const gRank = trainTemporal(table, rows, all); const gFormulaNames = ['round','year','month','day','weekday','previous_1','previous_2','previous_3','previous_4','previous_5','previous_6'];
  const gFormulaValues = rows.map((r, i) => { const [y,m,d] = r.date.split('-').map(Number); const previous = i ? rows[i - 1].winning : [0,0,0,0,0,0]; return [r.round,y,m,d,new Date(Date.UTC(y,m-1,d)).getUTCDay(),...previous]; }); const gFormulaForms = forms(gFormulaNames.length, true); const gFormula = trainLanes(gFormulaForms, gFormulaValues, rows, all, 180); const gFormulaTickets = ticketsFor(gFormula, gFormulaValues, all); const gChoice = [ { type: 'number_scoring', tickets: gRank.tickets, stats: summary(gRank.tickets, rows), weights: gRank.weights }, { type: 'symbolic_lanes', tickets: gFormulaTickets, stats: summary(gFormulaTickets, rows), formulas: gFormula.map((f) => formulaLabel(f, gFormulaNames)) } ].sort((a,b) => scoreOrder(a.stats,b.stats))[0];
  const G = { method: 'G', description: 'Pure draw-history/Gregorian statistical control. Every per-row feature is calculated from draws 1..r-1 only.', model: gChoice.type === 'number_scoring' ? { type: gChoice.type, weights: gChoice.weights } : { type: gChoice.type, formulas: gChoice.formulas }, score: gChoice.stats, complexity: gChoice.type === 'number_scoring' ? 5 : 6, tickets: gChoice.tickets, feature_policy: 'round, Gregorian date, weekday, and prior winners only' };
  const hLanes = trainLanes(hForms, hValues, rows, all, 180); const hTickets = ticketsFor(hLanes, hValues, all); const H = { method: 'H', description: 'Numerical astronomical/time coordinate control: longitude/ASC/MC values and Gregorian numeric time only; no sign, nakshatra, or divination interpretation.', model: { type: 'symbolic_coordinate_lanes', coordinate_ids: astroIds, formulas: hLanes.map((f) => formulaLabel(f, hNames)) }, score: summary(hTickets, rows), complexity: hLanes.reduce((s,f) => s + f.c, 0), tickets: hTickets };
  const hybridGrid = [{a:1,e:1,agreement:0},{a:1,e:1,agreement:1},{a:2,e:1,agreement:1},{a:1,e:2,agreement:1},{a:2,e:2,agreement:2}]; const iModels = hybridGrid.map((weights) => { const tickets = aOld.tickets.map((t,i) => hybridTicket(t,eOld.tickets[i],weights)); return { weights,tickets,stats:summary(tickets,rows) }; }).sort((a,b) => scoreOrder(a.stats,b.stats)); const IBest=iModels[0];
  const overlap = rows.map((r,i) => ({ round:r.round, a_hits:aOld.tickets[i].filter(n=>r.winning.includes(n)).length, e_hits:eOld.tickets[i].filter(n=>r.winning.includes(n)).length })); const countOverlap=(min)=>overlap.filter(x=>x.a_hits>=min&&x.e_hits>=min).length; const Hybrid={method:'I',description:'Deterministic A/E ticket-union ranking with global weights; no row winner selects A or E.',model:{weights:IBest.weights,rule:'A/E support + agreement bonus; top 6'},score:IBest.stats,complexity:3,tickets:IBest.tickets};
  const runs=10000, randomStats=[], wfIndexes=expandingSplits(rows.length).flatMap(x=>x.test); for(let seed=0;seed<runs;seed++){const ts=randomTickets(rows.length,900000+seed);const s=summary(ts,rows);const sw=summary(wfIndexes.map(i=>ts[i]),wfIndexes.map(i=>rows[i]));randomStats.push({score:s.score,mean:s.mean,ge3:s.ge3,ge4:s.ge4,fiveHit:s.fiveHit,sixHit:s.sixHit,wf:sw.score});} const sort=(a)=>[...a].sort((x,y)=>x-y);const quant=(a,q)=>sort(a)[Math.floor((a.length-1)*q)];const R={method:'R',description:'10,000 seeded uniform random six-number ticket runs.',score:{score:randomStats.reduce((s,x)=>s+x.score,0)/runs,mean:randomStats.reduce((s,x)=>s+x.mean,0)/runs,ge3:randomStats.reduce((s,x)=>s+x.ge3,0)/runs,ge4:randomStats.reduce((s,x)=>s+x.ge4,0)/runs,fiveHit:randomStats.reduce((s,x)=>s+x.fiveHit,0)/runs,sixHit:randomStats.reduce((s,x)=>s+x.sixHit,0)/runs},walk_forward_score:randomStats.reduce((s,x)=>s+x.wf,0)/runs,distribution:{runs,median_score:quant(randomStats.map(x=>x.score),.5),standard_deviation:Math.sqrt(randomStats.reduce((s,x)=>s+(x.score-randomStats.reduce((t,z)=>t+z.score,0)/runs)**2,0)/runs),p95_score:quant(randomStats.map(x=>x.score),.95),p99_score:quant(randomStats.map(x=>x.score),.99),max_score:Math.max(...randomStats.map(x=>x.score))}};

  const wf={A:[],B:[],C:[],D:[],E:[],F:[],G:[],H:[],I:[]};
  for (const split of expandingSplits(rows.length)) {
    const aRules = trainA(rawValues, rows, split.train, moonGroups, rawForms);
    const aTrain = aTickets(aRules, rawValues, moonGroups, split.train);
    const aTest = aTickets(aRules, rawValues, moonGroups, split.test);
    const bLanes = trainLanes(candidateForms, candidateValues, rows, split.train, 160);
    const bTrain = ticketsFor(bLanes, candidateValues, split.train);
    const bTest = ticketsFor(bLanes, candidateValues, split.test);
    const cModel = trainCandidateWeights(candidateValues, specs, rows, split.train);
    const dLanes = trainLanes(candidateForms, candidateValues, rows, split.train, 300);
    const dTrain = ticketsFor(dLanes, candidateValues, split.train);
    const dTest = ticketsFor(dLanes, candidateValues, split.test);
    const eModel = trainE(state, candidateValues, candidateForms, rows, split.train);
    const eTrain = eTickets(eModel, state, candidateValues, split.train);
    const eTest = eTickets(eModel, state, candidateValues, split.test);
    const fTest = fTickets(state, rows, split.test);
    const gModel = trainTemporal(table, rows, split.train);
    const hLanes = trainLanes(hForms, hValues, rows, split.train, 160);
    const hTest = ticketsFor(hLanes, hValues, split.test);
    const iCandidates = hybridGrid.map((weights) => ({
      weights,
      train: aTrain.map((t, j) => hybridTicket(t, eTrain[j], weights)),
      test: aTest.map((t, j) => hybridTicket(t, eTest[j], weights)),
    }));
    const iModel = iCandidates
      .map((x) => ({ ...x, stats: summary(x.train, split.train.map((i) => rows[i])) }))
      .sort((a, b) => scoreOrder(a.stats, b.stats))[0];
    const put = (name, tickets, model) => wf[name].push({ label: split.label, tickets, rows: split.test.map((i) => rows[i]), training: { from: 1, to: split.train.length, model } });
    put('A', aTest, { branches: aRules.size });
    put('B', bTest, { formulas: bLanes.map((f) => formulaLabel(f, candidateNames)) });
    put('C', split.test.map((i) => cModel.tickets[i]), { weights: cModel.weights });
    put('D', dTest, { formulas: dLanes.map((f) => formulaLabel(f, candidateNames)) });
    put('E', eTest, { k: 6, centroids: eModel.centers });
    put('F', fTest, { mode: 'past_only,k=10' });
    put('G', split.test.map((i) => gModel.tickets[i]), { weights: gModel.weights });
    put('H', hTest, { formulas: hLanes.map((f) => formulaLabel(f, hNames)) });
    put('I', iModel.test, { weights: iModel.weights });
  }
  const wfSummary=Object.fromEntries(Object.entries(wf).map(([name,parts])=>[name,aggregateSplits(parts)]));
  for(const [name,parts] of Object.entries(wf)) await save(join(BASE,'walk-forward',`method_${name}.json`),{method:name,protocol:'expanding train-only window; test winners are not used for selection',...wfSummary[name],splits:parts.map(x=>({range:x.label,training:x.training,stats:summary(x.tickets,x.rows),tickets:x.tickets}))});
  const nullRuns = []; const nullRawForms = rawForms.slice(0, 80), nullCandidateForms = candidateForms.slice(0, 80), nullHForms = hForms.slice(0, 80);
  for (let seed = 0; seed < 100; seed++) {
    const order = seededPermutation(rows.length, 202600 + seed);
    const perm = rows.map((r, i) => ({ ...r, winning: rows[order[i]].winning }));
    const a = rankForms(nullRawForms, rawValues, perm, all).slice(0, 60).map((x) => x.f);
    const e = rankForms(nullCandidateForms, candidateValues, perm, all).slice(0, 60).map((x) => x.f);
    const h = rankForms(nullHForms, hValues, perm, all).slice(0, 60).map((x) => x.f);
    const reduced = (pool, values) => { const lanes = trainLanes(pool, values, perm, all, 60); return summary(ticketsFor(lanes, values, all), perm).score; };
    nullRuns.push({ seed, A_reduced: reduced(a, rawValues), E_reduced: reduced(e, candidateValues), H_reduced: reduced(h, hValues), G_reduced: trainTemporal(table, perm, all).stats.score });
  }
  const nullSummary=Object.fromEntries(['A_reduced','E_reduced','H_reduced','G_reduced'].map(k=>[k,{mean:nullRuns.reduce((s,x)=>s+x[k],0)/nullRuns.length,p95:quant(nullRuns.map(x=>x[k]),.95),max:Math.max(...nullRuns.map(x=>x[k]))}]));
  await save(join(BASE,'method-G','statistical_features.json'),{policy:G.feature_policy,features:['all_count','last_5','last_10','last_20','last_50','last_100','last_200','gap','mean_gap','previous'],rows:table});await save(join(BASE,'method-G','best_statistical_model.json'),G);await save(join(BASE,'method-G','walk_forward.json'),wfSummary.G);await save(join(BASE,'method-G','tickets.json'),G.tickets);
  await save(join(BASE,'method-H','astronomical_features.json'),{policy:'numerical coordinates only',ids:astroIds,calendar_ids:calendarNames,rows:hValues});await save(join(BASE,'method-H','best_astronomical_model.json'),H);await save(join(BASE,'method-H','walk_forward.json'),wfSummary.H);await save(join(BASE,'method-H','tickets.json'),H.tickets);
  await save(join(BASE,'method-I','ae_overlap.json'),{rows:overlap,overlap_4_plus:countOverlap(4),overlap_5_plus:countOverlap(5),overlap_6:countOverlap(6),a_only_4_plus:overlap.filter(x=>x.a_hits>=4&&x.e_hits<4).length,e_only_4_plus:overlap.filter(x=>x.e_hits>=4&&x.a_hits<4).length});await save(join(BASE,'method-I','hybrid_models.json'),iModels.map(x=>({weights:x.weights,score:x.stats})));await save(join(BASE,'method-I','best_hybrid.json'),Hybrid);await save(join(BASE,'method-I','walk_forward.json'),wfSummary.I);await save(join(BASE,'method-I','tickets.json'),Hybrid.tickets);await save(join(BASE,'random-baseline','monte_carlo.json'),R);
  const old = { A: aOld, B: bOld, C: cOld, D: dOld, E: eOld, F: fOld };
  const allModels = { ...old, G, H, I: Hybrid, R };
  const extended = Object.fromEntries(Object.entries(allModels).map(([name, model]) => [name, {
    in_sample: name === 'R' ? R.score.score : model.score.score,
    walk_forward: name === 'R' ? R.walk_forward_score : wfSummary[name].score,
    mean: name === 'R' ? R.score.mean : model.score.mean,
    ge4: name === 'R' ? R.score.ge4 : model.score.ge4,
    five_hit: name === 'R' ? R.score.fiveHit : model.score.fiveHit,
    six_hit: name === 'R' ? R.score.sixHit : model.score.sixHit,
    complexity: model.complexity ?? 'Monte Carlo',
    training_search_size: name === 'R' ? runs : name === 'G' ? gFormulaForms.length : name === 'H' ? hForms.length : name === 'I' ? hybridGrid.length : 'preserved A-F / train-only rerun',
  }]));
  await save(join(BASE,'search-adjusted-null.json'),{runs:100,procedure:'Reduced train-on-permuted-winners formula search; no event keys. Formula pools are 80 forms each, so this is a calibrated lower-complexity control rather than equal-search-space equivalence.',results:nullRuns,summary:nullSummary});await save(join(BASE,'comparison_extended.json'),{base_commit:'fcb0414',comparison:extended,search_adjusted_null:nullSummary,existing_AF_preserved:true});
  const bestIn=Object.entries(extended).filter(([k])=>k!=='R').sort((a,b)=>b[1].in_sample-a[1].in_sample)[0];const bestWf=Object.entries(extended).filter(([k])=>k!=='R').sort((a,b)=>b[1].walk_forward-a[1].walk_forward)[0];const rowsMd=Object.entries(extended).map(([n,x])=>`| ${n} | ${Number(x.in_sample).toFixed(2)} | ${Number(x.walk_forward).toFixed(2)} | ${Number(x.mean).toFixed(4)} | ${(x.ge4*100).toFixed(2)}% | ${Number(x.five_hit).toFixed(2)} | ${Number(x.six_hit).toFixed(2)} | ${x.complexity} |`).join('\n');await writeFile(join(BASE,'report_extended.md'),`# A–I / R extended comparison\n\nExisting A–F artifacts were read, not modified. All results use the committed 1–1242 common matrix and evaluator.\n\n| Method | In-sample score | Walk-forward score | Mean | 4+ | 5-hit | 6-hit | Complexity |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${rowsMd}\n\n- In-sample leader: **${bestIn[0]}** (${bestIn[1].in_sample.toFixed(2)}).\n- Walk-forward leader: **${bestWf[0]}** (${bestWf[1].walk_forward.toFixed(2)}).\n- I vs A: ${Hybrid.score.score} vs ${aOld.score.score}; I ${Hybrid.score.score>aOld.score.score?'exceeds':'does not exceed'} A in-sample.\n- G vs fortune in-sample: ${G.score.score} vs A ${aOld.score.score}; H vs fortune: ${H.score.score} vs A ${aOld.score.score}.\n- Search-adjusted null is deliberately reduced and reported only as a calibrated control: see \`search-adjusted-null.json\`.\n\n## Leakage constraints\n\nG per-row features use only draws 1..r-1. H uses numerical longitude/ASC/MC coordinates and Gregorian numbers, never signs or fortune interpretation. A and E walk-forward rules are retrained only on each train split. I ranks ticket union with preselected train/global weights, never current winners.\n`);
  console.log(JSON.stringify({G:G.score,H:H.score,I:Hybrid.score,R:R.score,walk_forward:Object.fromEntries(Object.entries(wfSummary).map(([k,v])=>[k,v.score])),best_in_sample:bestIn[0],best_walk_forward:bestWf[0]},null,2));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(e=>{console.error(e);process.exitCode=1;});
