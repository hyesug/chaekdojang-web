/*
 * 최신 운세 엔진 기반 신규 로또 규칙 연구(연구 전용). 운영 코드·고정 엔진·저장 데이터는 읽기만 한다.
 *
 * 기존 연구와 같게 유지: 점수 벡터 [0,1,3,10,50,300,3000], 평균 적중·3+·4+·5·6개 적중,
 * 확장형 walk-forward 시험 창 601-700 … 1101-1200, 1201-1242 (+ 미래검증 1243-1245).
 *
 * 사전 등록한 절차(결과를 보기 전에 고정):
 * - 개발 구간: 시험 창 601-700 … 1001-1100. 신규 규칙군 설계·비교는 여기 결과만 본다.
 * - 독립 검증: 1101-1200, 1201-1242, 1243-1245. 마지막에 한 번만 평가한다.
 * - 각 시험 창마다 그 이전 회차만으로 학습한다. 학습 창 안에서 마지막 200회를 내부 검증으로 떼어
 *   설정을 고른 뒤, 학습 창 전체로 다시 맞춰 시험 창을 예측한다(시험 창 당첨번호는 선택에 쓰지 않음).
 * - 탐색 보정 null: 당첨번호를 회차 간에 섞은 데이터로 같은 절차 전체를 반복한다.
 * - 채택 기준: 독립 검증에서 기준 8개 모델 최고값과 무작위 95% 상한을 모두 넘고, 탐색 보정 null 대비 p<0.05 일 때만 권장.
 */
import { mkdir, readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(HERE, 'output', 'latest-engine-research');
export const SCORE = [0, 1, 3, 10, 50, 300, 3000];
export const WINDOWS = [[601, 700], [701, 800], [801, 900], [901, 1000], [1001, 1100], [1101, 1200], [1201, 1242], [1243, 1245]];
export const DEV = WINDOWS.slice(0, 5), HOLDOUT = WINDOWS.slice(5);
const INNER = 200;
const EXTRA_DRAWS = [ // 공개 당첨번호(동행복권), 추첨 시각은 미래검증 기록값
  { round: 1243, drawDate: '2026-09-26', drawTime: '21:30', numbers: [9, 18, 24, 38, 43, 44] },
  { round: 1244, drawDate: '2026-10-03', drawTime: '21:35', numbers: [1, 13, 18, 26, 34, 38] },
  { round: 1245, drawDate: '2026-10-10', drawTime: '20:35', numbers: [4, 5, 25, 28, 32, 42] },
];

// ── 번들: latest 면 고정 엔진 import 를 public/unse/src 로 교체(운영 파일은 그대로)
async function loadPredictor(engine, directory) {
  const plugins = [{
    name: 'research-hooks',
    setup(b) {
      if (engine === 'latest') b.onResolve({ filter: /^\.\/engine-c991927\// }, (args) => ({ path: join(ROOT, 'public/unse/src', args.path.replace('./engine-c991927/', '')) }));
      b.onLoad({ filter: /lib[\\/]lotto-future[\\/]predictor\.ts$/ }, async (args) => ({
        contents: `${await readFile(args.path, 'utf8')}\nexport { candidateValues as __candidateValues, state as __state, eventFeatures as __eventFeatures };\n`,
        loader: 'ts', resolveDir: dirname(args.path),
      }));
    },
  }];
  const outfile = join(directory, `predictor-${engine}.mjs`);
  const result = await build({ entryPoints: [join(ROOT, 'lib/lotto-future/predictor.ts')], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent', plugins, metafile: true });
  const inputs = Object.keys(result.metafile.inputs).map((p) => p.replaceAll('\\', '/'));
  const usesLatest = inputs.some((p) => p.includes('public/unse/src')), usesFrozen = inputs.some((p) => p.includes('engine-c991927'));
  if (engine === 'latest' ? (!usesLatest || usesFrozen) : (usesLatest || !usesFrozen)) throw new Error(`engine wiring mismatch for ${engine}`);
  return import(pathToFileURL(outfile));
}

// ── 평가(기존 연구 지표)
export const hitCount = (ticket, winning) => ticket.filter((n) => winning.includes(n)).length;
export function stats(tickets, draws) {
  const hist = Array(7).fill(0); let hits = 0, score = 0;
  for (const d of draws) { const k = hitCount(tickets[d.round], d.numbers); hist[k]++; hits += k; score += SCORE[k]; }
  const n = draws.length;
  return { rounds: n, score, mean: hits / n, ge3: (hist[3] + hist[4] + hist[5] + hist[6]) / n, ge4: (hist[4] + hist[5] + hist[6]) / n, fiveHit: hist[5], sixHit: hist[6], hist };
}
function mulberry32(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function randomTicket(rand) { const pool = Array.from({ length: 45 }, (_, i) => i + 1); for (let i = 0; i < 6; i++) { const j = i + Math.floor(rand() * (45 - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, 6); }
function randomDistribution(draws, sims = 10000, seed = 20261011) {
  const rand = mulberry32(seed); const means = [], scores = [], ge3s = [];
  for (let s = 0; s < sims; s++) { let hits = 0, score = 0, ge3 = 0; for (const d of draws) { const k = hitCount(randomTicket(rand), d.numbers); hits += k; score += SCORE[k]; if (k >= 3) ge3++; } means.push(hits / draws.length); scores.push(score); ge3s.push(ge3 / draws.length); }
  const q = (arr, p) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length * p)];
  const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
  return { sims, mean: avg(means), meanP95: q(means, 0.95), meanP975: q(means, 0.975), score: avg(scores), scoreP95: q(scores, 0.95), ge3: avg(ge3s), ge3P95: q(ge3s, 0.95), means, scores };
}
const pGE = (arr, x) => (arr.filter((v) => v >= x).length + 1) / (arr.length + 1);

// ── 득표 규칙군
const systemOf = (slot) => slot.split('.')[0];
export function ruleTicket(candidates, config) {
  const score = new Map(); const systems = new Map(); const votes = new Map();
  const add = (n, w) => { const k = ((n - 1) % 45 + 45) % 45 + 1; score.set(k, (score.get(k) ?? 0) + w); };
  for (const [slot, number] of Object.entries(candidates)) {
    const system = systemOf(slot);
    if (config.systems && !config.systems.includes(system)) continue;
    const w = config.key === 'slotWeight' ? (config.weights[slot] ?? 0) : config.key === 'systemWeight' ? (config.weights[system] ?? 0) : 1;
    votes.set(number, (votes.get(number) ?? 0) + 1); systems.set(number, (systems.get(number) ?? new Set()).add(system));
    if (config.key !== 'support') { add(number, w); for (let d = 1; d <= (config.spread ?? 0); d++) { add(number - d, w * config.alpha); add(number + d, w * config.alpha); } }
  }
  if (config.key === 'support') for (const [n, set] of systems) score.set(n, set.size + votes.get(n) / 100);
  return Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || a - b).slice(0, 6).sort((a, b) => a - b);
}
// 학습 회차만으로 설정 후보를 만든다(가중치는 축소 추정: 사전 6/45, 강도 200회)
function buildConfigs(cands, trainDraws) {
  const slots = Object.keys(cands[trainDraws[0].round]); const sysAll = [...new Set(slots.map(systemOf))]; const base = 6 / 45, k = 200;
  const slotHit = Object.fromEntries(slots.map((s) => [s, trainDraws.filter((d) => d.numbers.includes(cands[d.round][s])).length]));
  const shrink = (hits, n) => (hits + k * base) / (n + k) - base;
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
// 한 시험 창: 학습 창 안 내부 검증으로 고르고 학습 창 전체로 다시 맞춘다
function walkForwardWindow(cands, draws, [from, to], families) {
  const train = draws.filter((d) => d.round < from); const test = draws.filter((d) => d.round >= from && d.round <= to);
  const fit = train.slice(0, -INNER), inner = train.slice(-INNER);
  const meanOn = (config, rows) => rows.reduce((t, d) => t + hitCount(ruleTicket(cands[d.round], config), d.numbers), 0) / rows.length;
  const picks = {};
  const scored = buildConfigs(cands, fit).map((c) => ({ c, v: meanOn(c, inner) }));
  const refitPool = buildConfigs(cands, train);
  for (const family of families) {
    const best = scored.filter(({ c }) => family === '전체' || c.family === family).sort((a, b) => b.v - a.v)[0].c;
    const refit = refitPool.find((c) => c.name === best.name); // 같은 설정 이름을 학습 창 전체 통계로 다시 만든다
    picks[family] = { name: best.name, tickets: Object.fromEntries(test.map((d) => [d.round, ruleTicket(cands[d.round], refit)])) };
  }
  return picks;
}
function runProtocol(cands, draws, families, windows = WINDOWS) {
  const tickets = Object.fromEntries(families.map((f) => [f, {}])); const chosen = Object.fromEntries(families.map((f) => [f, []]));
  for (const w of windows) { const picks = walkForwardWindow(cands, draws, w, families); for (const f of families) { Object.assign(tickets[f], picks[f].tickets); chosen[f].push(`${w[0]}-${w[1]}: ${picks[f].name}`); } }
  return { tickets, chosen };
}
function permuteWinners(draws, seed) {
  const rand = mulberry32(seed); const nums = draws.map((d) => d.numbers);
  for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
  return draws.map((d, i) => ({ ...d, numbers: nums[i] }));
}

export async function main() {
  const directory = await mkdtemp(join(tmpdir(), 'lotto-latest-research-'));
  try {
    const [frozen, latest] = await Promise.all([loadPredictor('frozen', directory), loadPredictor('latest', directory)]);
    const dataset = JSON.parse(await readFile(join(HERE, 'output/method-comparison/common_dataset.json'), 'utf8'));
    const draws = dataset.rows.map((r) => ({ round: r.round, drawDate: r.date, drawTime: r.time, numbers: r.winning })).concat(EXTRA_DRAWS);
    const inRange = ([a, b]) => draws.filter((d) => d.round >= a && d.round <= b);
    const union = (ws) => ws.flatMap(inRange);

    // 1) 두 엔진의 15체계 후보·상태벡터 + 기준 8개 모델 티켓
    const cands = { frozen: {}, latest: {} }, states = { frozen: {}, latest: {} }, models = { frozen: {}, latest: {} };
    for (const [engine, m] of [['frozen', frozen], ['latest', latest]]) {
      for (const d of draws) {
        const [year, month, day] = d.drawDate.split('-').map(Number); const [hour, minute] = d.drawTime.slice(0, 5).split(':').map(Number);
        const fs = m.__eventFeatures({ year, month, day, hour, minute });
        cands[engine][d.round] = m.__candidateValues(fs); states[engine][d.round] = m.__state(fs);
        models[engine][d.round] = m.generateFrozenPredictions(d, EXTRA_DRAWS.filter((x) => x.round < d.round)).predictions;
      }
    }
    // F 는 과거 상태벡터도 같은 엔진으로 계산한 과거 전용 10-NN (운영 pastOnlyFSelection 과 같은 거리)
    const stateIds = JSON.parse(await readFile(join(HERE, 'output/method-comparison/method-E/state_matrix.json'), 'utf8')).feature_ids;
    const cyclic = stateIds.map((id) => /longitude|sexagenary|nakshatra|hexagram|cycle/.test(id));
    const dist = (a, b) => a.reduce((s, x, i) => { const t = Math.abs(x - b[i]); return s + (cyclic[i] ? Math.min(t, 1 - t) : t); }, 0) / a.length;
    const fTickets = (engine) => Object.fromEntries(draws.map((d) => {
      const nb = draws.filter((p) => p.round < d.round).map((p) => ({ p, v: dist(states[engine][d.round], states[engine][p.round]) })).sort((a, b) => a.v - b.v || a.p.round - b.p.round).slice(0, 10);
      const c = Array(46).fill(0); nb.forEach(({ p }) => p.numbers.forEach((n) => { c[n]++; }));
      return [d.round, Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => c[b] - c[a] || a - b).slice(0, 6)];
    }));
    const fFrozen = fTickets('frozen'); const fRepro = draws.filter((d) => JSON.stringify(fFrozen[d.round]) !== JSON.stringify(models.frozen[d.round].F)).length;
    if (fRepro) throw new Error(`F 재구현이 운영 F 와 ${fRepro}회 다르다`);
    const fLatest = fTickets('latest'); draws.forEach((d) => { models.latest[d.round].F = fLatest[d.round]; });
    const slotIds = Object.keys(cands.latest[1]);
    const changedSlots = Object.fromEntries(slotIds.map((s) => [s, draws.filter((d) => cands.frozen[d.round][s] !== cands.latest[d.round][s]).length]).filter(([, n]) => n));

    // 2)~4) 신규 규칙: 사전 등록 절차로 walk-forward
    const families = ['전체', '득표', '체계지지', '슬롯가중', '체계가중'];
    const newLatest = runProtocol(cands.latest, draws, families);
    const newFrozen = runProtocol(cands.frozen, draws, ['전체']);

    // 무작위·평가표
    const periods = { dev: union(DEV), holdout: union(HOLDOUT), ...Object.fromEntries(WINDOWS.map((w) => [`${w[0]}-${w[1]}`, inRange(w)])) };
    const random = Object.fromEntries(['dev', 'holdout'].map((p, i) => [p, randomDistribution(periods[p], 10000, 20261011 + i)]));
    const row = (group, name, tickets, note) => {
      const r = { group, name, note };
      for (const p of Object.keys(periods)) r[p] = stats(tickets, periods[p]);
      for (const p of ['dev', 'holdout']) { r[p].pRandomMean = pGE(random[p].means, r[p].mean); r[p].pRandomScore = pGE(random[p].scores, r[p].score); }
      return r;
    };
    const rows = [];
    const as = (engine, model) => Object.fromEntries(draws.map((d) => [d.round, models[engine][d.round][model]]));
    for (const model of ['A', 'D', 'E', 'F', 'H', 'S1', 'S2', 'S3']) {
      const note = ['S1', 'S2', 'S3'].includes(model) ? '학습 없는 고정 규칙' : model === 'F' ? '과거 전용 이웃(학습 없음)' : '1–1242 전체로 적합 → 1–1242 구간은 학습 데이터 재사용';
      rows.push(row('기준(고정 엔진·운영)', model, as('frozen', model), note));
      rows.push(row('기준 모델에 최신 엔진 적용', model, as('latest', model), note));
    }
    for (const f of families) rows.push(row('신규(최신 엔진, walk-forward)', f === '전체' ? '신규 통합(전 규칙군 중 선택)' : `신규 ${f}`, newLatest.tickets[f], '창마다 이전 회차만으로 선택·적합'));
    rows.push(row('신규(고정 엔진, walk-forward)', '신규 통합(고정 엔진 후보)', newFrozen.tickets['전체'], '엔진 수정 효과 비교용'));

    // 탐색 보정 null: 당첨번호를 섞은 데이터로 같은 절차 반복(신규 통합)
    const NULL_RUNS = Number(process.env.NULL_RUNS ?? 20);
    const nullRuns = [];
    for (let s = 0; s < NULL_RUNS; s++) {
      const permuted = permuteWinners(draws, 7000 + s); const pr = runProtocol(cands.latest, permuted, ['전체']);
      const pp = (ws) => ws.flatMap(([a, b]) => permuted.filter((d) => d.round >= a && d.round <= b));
      nullRuns.push({ seed: 7000 + s, dev: stats(pr.tickets['전체'], pp(DEV)).mean, holdout: stats(pr.tickets['전체'], pp(HOLDOUT)).mean });
    }
    const newMain = rows.find((r) => r.name === '신규 통합(전 규칙군 중 선택)');
    const nullP = { dev: pGE(nullRuns.map((x) => x.dev), newMain.dev.mean), holdout: pGE(nullRuns.map((x) => x.holdout), newMain.holdout.mean) };
    const baselineBest = Math.max(...rows.filter((r) => r.group === '기준(고정 엔진·운영)').map((r) => r.holdout.mean));
    const decision = { holdoutMean: newMain.holdout.mean, baselineBestHoldout: baselineBest, randomP975: random.holdout.meanP975, nullP: nullP.holdout,
      adopt: newMain.holdout.mean > baselineBest && newMain.holdout.mean > random.holdout.meanP975 && nullP.holdout < 0.05 };

    // 기존 연구 walk-forward(고정 엔진) 참고값
    const priorWf = {};
    for (const m of ['A', 'D', 'E', 'F', 'H']) { const w = JSON.parse(await readFile(join(HERE, `output/method-comparison/walk-forward/method_${m}.json`), 'utf8')); priorWf[m] = { score: w.score, mean: w.mean, ge3: w.ge3, ge4: w.ge4, splits: w.splits.map((s) => ({ range: s.range, score: s.stats.score, mean: s.stats.mean })) }; }

    const result = { generatedAt: new Date().toISOString(), protocol: { score: SCORE, windows: WINDOWS, dev: DEV, holdout: HOLDOUT, innerValidation: INNER, nullRuns: NULL_RUNS },
      candidateChanges: { changedSlots }, random: Object.fromEntries(Object.entries(random).map(([k, v]) => [k, { sims: v.sims, mean: v.mean, meanP95: v.meanP95, meanP975: v.meanP975, score: v.score, scoreP95: v.scoreP95, ge3: v.ge3, ge3P95: v.ge3P95 }])),
      rows, chosen: newLatest.chosen, chosenFrozen: newFrozen.chosen, nullRuns, nullP, decision, priorWalkForwardFrozen: priorWf };
    await mkdir(OUT, { recursive: true });
    await writeFile(join(OUT, 'candidates_latest.json'), JSON.stringify(Object.fromEntries(draws.map((d) => [d.round, cands.latest[d.round]]))));
    await writeFile(join(OUT, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ decision, nullP, random: result.random }, null, 2));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
