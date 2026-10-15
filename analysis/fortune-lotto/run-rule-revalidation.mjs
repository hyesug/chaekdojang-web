/*
 * 로또 전체 규칙 재검증(연구 전용). 절차는 RULE_REVALIDATION_PROTOCOL.md 에 결과를 보기 전에 고정했다.
 * - 운영 predictor·고정 엔진(unse-c991927)·최신 엔진(public/unse/src)·기존 산출물은 읽기만 한다.
 * - 쓰는 곳: output/rule-revalidation/ 만.
 * 실행(저장소 루트): node analysis/fortune-lotto/run-rule-revalidation.mjs
 *   LATEST_WF=1 이면 최신 엔진 A–I walk-forward 를 임시 폴더에서 다시 돌려 티켓을 저장한다(수 분).
 */
import { mkdir, readFile, writeFile, rm, mkdtemp, copyFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(HERE, 'output', 'rule-revalidation');
const PRIOR = join(HERE, 'output');
export const SCORE = [0, 1, 3, 10, 50, 300, 3000];
export const EXTRA_DRAWS = [ // run-latest-engine-research.mjs 와 같은 공개 기록
  { round: 1243, drawDate: '2026-09-26', drawTime: '21:30', numbers: [9, 18, 24, 38, 43, 44] },
  { round: 1244, drawDate: '2026-10-03', drawTime: '21:35', numbers: [1, 13, 18, 26, 34, 38] },
  { round: 1245, drawDate: '2026-10-10', drawTime: '20:35', numbers: [4, 5, 25, 28, 32, 42] },
];
export const PERIODS = { early: [1, 600], dev: [601, 1100], holdout: [1101, 1245], full: [1, 1245] };
export const WINDOWS = [[1, 600], [601, 700], [701, 800], [801, 900], [901, 1000], [1001, 1100], [1101, 1200], [1201, 1242], [1243, 1245]];
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const exists = (p) => access(p).then(() => true, () => false);

// ── 초기하 기준(공정 추첨이면 추첨 전에 정한 어떤 6개든 이 분포)
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
export const PMF = Array.from({ length: 7 }, (_, k) => C(6, k) * C(39, 6 - k) / C(45, 6));
export const MEAN0 = 0.8, VAR0 = PMF.reduce((s, p, k) => s + p * (k - 0.8) ** 2, 0);
const tailCache = new Map();
/** n 회 합계 적중이 h 이상일 정확 확률 */
export function exactTail(n, hits) {
  if (!tailCache.has(n)) {
    let dist = Float64Array.of(1);
    for (let i = 0; i < n; i++) { const next = new Float64Array(dist.length + 6); for (let a = 0; a < dist.length; a++) if (dist[a]) for (let k = 0; k <= 6; k++) next[a + k] += dist[a] * PMF[k]; dist = next; }
    const tail = new Float64Array(dist.length + 1); for (let a = dist.length - 1; a >= 0; a--) tail[a] = tail[a + 1] + dist[a];
    tailCache.set(n, tail);
  }
  const t = tailCache.get(n); return hits <= 0 ? 1 : hits >= t.length ? 0 : Math.min(1, t[hits]);
}
const PGE3 = PMF[3] + PMF[4] + PMF[5] + PMF[6];
function binomTail(n, x, p) { let s = 0; for (let k = x; k <= n; k++) s += Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p)); return Math.min(1, s); }
function lgamma(x) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x); x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); }

function mulberry32(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function randomTicket(rand) { const pool = Array.from({ length: 45 }, (_, i) => i + 1); for (let i = 0; i < 6; i++) { const j = i + Math.floor(rand() * (45 - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, 6); }

export function normTicket(t, where) {
  const s = [...t].map(Number).sort((a, b) => a - b);
  if (s.length !== 6 || new Set(s).size !== 6 || s.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) throw new Error(`잘못된 티켓 ${where}: ${JSON.stringify(t)}`);
  return s;
}
export const hitCount = (t, w) => t.filter((n) => w.includes(n)).length;
export function stats(series, draws) {
  const hist = Array(7).fill(0); let hits = 0, score = 0, n = 0;
  for (const d of draws) { const t = series.get(d.round); if (!t) continue; const k = hitCount(t, d.numbers); hist[k]++; hits += k; score += SCORE[k]; n++; }
  if (!n) return null;
  const ge3 = hist[3] + hist[4] + hist[5] + hist[6];
  return { rounds: n, hits, mean: hits / n, hist, ge3, ge3Rate: ge3 / n, score, randomScore: n * PMF.reduce((s, p, k) => s + p * SCORE[k], 0),
    z: (hits / n - MEAN0) / Math.sqrt(VAR0 / n), pMean: exactTail(n, hits), pGe3: binomTail(n, ge3, PGE3) };
}

// ── 예측기 번들(run-latest-engine-research.mjs 와 같은 방식: latest 면 고정 엔진 import 를 public/unse/src 로 교체)
export async function loadPredictor(engine, directory) {
  const plugins = [{ name: 'research-hooks', setup(b) {
    if (engine === 'latest') b.onResolve({ filter: /^\.\/engine-c991927\// }, (args) => ({ path: join(ROOT, 'public/unse/src', args.path.replace('./engine-c991927/', '')) }));
    b.onLoad({ filter: /lib[\\/]lotto-future[\\/]predictor\.ts$/ }, async (args) => ({ contents: `${await readFile(args.path, 'utf8')}\nexport { candidateValues as __candidateValues, state as __state, eventFeatures as __eventFeatures };\n`, loader: 'ts', resolveDir: dirname(args.path) }));
  } }];
  const outfile = join(directory, `predictor-${engine}.mjs`);
  const result = await build({ entryPoints: [join(ROOT, 'lib/lotto-future/predictor.ts')], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent', plugins, metafile: true });
  const inputs = Object.keys(result.metafile.inputs).map((p) => p.replaceAll('\\', '/'));
  const usesLatest = inputs.some((p) => p.includes('public/unse/src')), usesFrozen = inputs.some((p) => p.includes('engine-c991927'));
  if (engine === 'latest' ? (!usesLatest || usesFrozen) : (usesLatest || !usesFrozen)) throw new Error(`engine wiring mismatch for ${engine}`);
  return import(pathToFileURL(outfile));
}

// ── 규칙 정의(학습 없음)
const SYSTEM_LABEL = { saju: '사주', jamidusu: '자미두수', astrology: '서양점성', vedic: '베딕', juyeok: '주역', yukim: '육임', hongguk: '홍국기문', taeeul: '태을신수', gujeong: '구성학', sukyo: '숙요', tojeong: '토정비결', kabbalah: '카발라', mahabote: '마하보테', thai: '태국점성', tarot: '타로' };
const wrap = (n) => ((n - 1) % 45 + 45) % 45 + 1;
/** 체계 단독: 그 체계 슬롯 번호(슬롯 순서) → 모자라면 각 번호의 ±1, ±2 … 이웃으로 채운다(사전 고정) */
export function systemTicket(candidates, system) {
  const base = []; for (const [slot, n] of Object.entries(candidates)) if (slot.split('.')[0] === system && !base.includes(n)) base.push(n);
  const out = base.slice(0, 6);
  for (let d = 1; out.length < 6; d++) for (const n of base) for (const m of [wrap(n + d), wrap(n - d)]) if (out.length < 6 && !out.includes(m)) out.push(m);
  return out;
}
/** 당첨 이력 통계(비운세 대조군): rows 는 대상 회차 이전 당첨번호(오래된 순) */
export function historyTicket(kind, rows) {
  if (!rows.length) return [1, 2, 3, 4, 5, 6];
  if (kind === 'repeat') return rows[rows.length - 1];
  const recent = kind === 'hot52' || kind === 'cold52' ? rows.slice(-52) : rows;
  const freq = Array(46).fill(0), last = Array(46).fill(-1);
  recent.forEach((r) => r.forEach((n) => { freq[n]++; })); rows.forEach((r, i) => r.forEach((n) => { last[n] = i; }));
  const nums = Array.from({ length: 45 }, (_, i) => i + 1);
  const key = { hotAll: (n) => -freq[n], hot52: (n) => -freq[n], cold52: (n) => freq[n], overdue: (n) => last[n] }[kind];
  return nums.sort((a, b) => key(a) - key(b) || a - b).slice(0, 6);
}

// ── 최신 엔진 득표 규칙군 walk-forward(run-latest-engine-research.mjs 의 사전 등록 절차를 그대로 옮김)
const systemOf = (slot) => slot.split('.')[0];
function ruleTicket(candidates, config) {
  const score = new Map(); const systems = new Map(); const votes = new Map();
  const add = (n, w) => { const k = wrap(n); score.set(k, (score.get(k) ?? 0) + w); };
  for (const [slot, number] of Object.entries(candidates)) {
    const system = systemOf(slot); if (config.systems && !config.systems.includes(system)) continue;
    const w = config.key === 'slotWeight' ? (config.weights[slot] ?? 0) : config.key === 'systemWeight' ? (config.weights[system] ?? 0) : 1;
    votes.set(number, (votes.get(number) ?? 0) + 1); systems.set(number, (systems.get(number) ?? new Set()).add(system));
    if (config.key !== 'support') { add(number, w); for (let d = 1; d <= (config.spread ?? 0); d++) { add(number - d, w * config.alpha); add(number + d, w * config.alpha); } }
  }
  if (config.key === 'support') for (const [n, set] of systems) score.set(n, set.size + votes.get(n) / 100);
  return Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || a - b).slice(0, 6).sort((a, b) => a - b);
}
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
const VOTE_WINDOWS = [[601, 700], [701, 800], [801, 900], [901, 1000], [1001, 1100], [1101, 1200], [1201, 1242], [1243, 1245]];
export function voteFamiliesWalkForward(cands, draws, families, windows = VOTE_WINDOWS) {
  const tickets = Object.fromEntries(families.map((f) => [f, new Map()])), chosen = Object.fromEntries(families.map((f) => [f, []]));
  for (const [from, to] of windows) {
    const train = draws.filter((d) => d.round < from), test = draws.filter((d) => d.round >= from && d.round <= to);
    const fit = train.slice(0, -200), inner = train.slice(-200);
    const meanOn = (config, rows) => rows.reduce((t, d) => t + hitCount(ruleTicket(cands[d.round], config), d.numbers), 0) / rows.length;
    const scored = buildConfigs(cands, fit).map((c) => ({ c, v: meanOn(c, inner) })); const refitPool = buildConfigs(cands, train);
    for (const f of families) {
      const best = scored.filter(({ c }) => f === '전체' || c.family === f).sort((a, b) => b.v - a.v)[0].c; const refit = refitPool.find((c) => c.name === best.name);
      test.forEach((d) => tickets[f].set(d.round, ruleTicket(cands[d.round], refit))); chosen[f].push(`${from}-${to}: ${best.name}`);
    }
  }
  return { tickets, chosen };
}

// ── 최신 엔진 A–I walk-forward 재현(기존 실행 코드를 임시 폴더에서 그대로 돌리고 walk-forward 티켓만 가져온다)
async function latestMethodWalkForward() {
  const target = join(OUT, 'latest-engine-wf');
  if (await exists(join(target, 'method_I.json')) && !process.env.LATEST_WF) return target;
  if (!process.env.LATEST_WF) return null;
  const work = await mkdtemp(join(tmpdir(), 'lotto-revalidation-wf-'));
  try {
    const dir = join(work, 'analysis', 'fortune-lotto'); await mkdir(join(dir, 'output', 'method-comparison'), { recursive: true });
    const backtest = (await readFile(join(HERE, 'run-backtest.mjs'), 'utf8')).replaceAll("'../../public/unse/src/", `'${pathToFileURL(join(ROOT, 'public/unse/src')).href}/`).replace(/^main\(\)\.catch.*$/m, 'export { featuresFor };');
    await writeFile(join(dir, 'backtest-features.mjs'), backtest);
    const { featuresFor } = await import(pathToFileURL(join(dir, 'backtest-features.mjs')));
    const old = await json(join(PRIOR, 'feature_matrix_time_refined.json'));
    const rows = old.map((row) => { const f = featuresFor(row.round).features; if (f.length !== row.raw.length) throw new Error(`feature length changed at ${row.round}`); return { ...row, raw: f.map((x) => x.raw), spread: f.map((x) => x.spread) }; });
    await writeFile(join(dir, 'output', 'feature_matrix_time_refined.json'), JSON.stringify(rows)); await writeFile(join(dir, 'output', 'feature_matrix.json'), JSON.stringify(rows));
    for (const name of ['feature_manifest.json', 'tickets.json', 'best_rule.json']) await copyFile(join(PRIOR, name), join(dir, 'output', name));
    for (const runner of ['run-method-comparison.mjs', 'run-extended-comparison.mjs']) { await copyFile(join(HERE, runner), join(dir, runner)); execFileSync(process.execPath, [join(dir, runner)], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] }); }
    await mkdir(target, { recursive: true });
    for (const m of 'ABCDEFGHI') await copyFile(join(dir, 'output', 'method-comparison', 'walk-forward', `method_${m}.json`), join(target, `method_${m}.json`));
    return target;
  } finally { await rm(work, { recursive: true, force: true }); }
}

// ── 저장된 walk-forward 티켓 읽기
function splitSeries(splits, rangeOf) {
  const m = new Map();
  for (const s of splits) { const [a, b] = rangeOf(s).match(/(\d+)-(\d+)\s*$/).slice(1).map(Number); if (s.tickets.length !== b - a + 1) throw new Error(`split 길이 불일치 ${a}-${b}`); s.tickets.forEach((t, i) => m.set(a + i, normTicket(t, `${a + i}`))); }
  return m;
}

export async function main() {
  await mkdir(OUT, { recursive: true });
  const directory = await mkdtemp(join(tmpdir(), 'lotto-revalidation-'));
  try {
    // 1) 데이터 + 무결성
    const dataset = await json(join(PRIOR, 'method-comparison/common_dataset.json'));
    const draws = dataset.rows.map((r) => ({ round: r.round, drawDate: r.date, drawTime: r.time, numbers: r.winning })).concat(EXTRA_DRAWS);
    draws.forEach((d, i) => { if (d.round !== i + 1) throw new Error(`회차 순서 오류 ${d.round}`); normTicket(d.numbers, `당첨 ${d.round}`); });
    const { DRAW_ROWS } = await import(pathToFileURL(join(ROOT, 'public/unse/src/data/draws.js')));
    const mismatch = DRAW_ROWS.filter((r) => JSON.stringify([...r.slice(2)].sort((a, b) => a - b)) !== JSON.stringify([...draws[r[0] - 1].numbers].sort((a, b) => a - b)));
    if (mismatch.length) throw new Error(`당첨번호 원본 불일치 ${mismatch.length}건`);
    const R = (a, b) => draws.filter((d) => d.round >= a && d.round <= b);
    const engineTree = execFileSync('git', ['rev-parse', 'HEAD:public/unse/src'], { cwd: ROOT }).toString().trim();
    const engineDirty = execFileSync('git', ['status', '--porcelain', '--', 'public/unse/src', 'lib/lotto-future'], { cwd: ROOT }).toString().trim();

    // 2) 두 엔진 후보 슬롯·상태·운영 8개 티켓
    const [frozen, latest] = await Promise.all([loadPredictor('frozen', directory), loadPredictor('latest', directory)]);
    const cands = { frozen: {}, latest: {} }, states = { frozen: {}, latest: {} }, models = { frozen: {}, latest: {} }, latestErrors = {};
    for (const [engine, m] of [['frozen', frozen], ['latest', latest]]) for (const d of draws) {
      const [year, month, day] = d.drawDate.split('-').map(Number); const [hour, minute] = d.drawTime.slice(0, 5).split(':').map(Number);
      const fs = m.__eventFeatures({ year, month, day, hour, minute });
      cands[engine][d.round] = m.__candidateValues(fs); states[engine][d.round] = m.__state(fs);
      try { models[engine][d.round] = m.generateFrozenPredictions(d, EXTRA_DRAWS.filter((x) => x.round < d.round)).predictions; }
      catch (e) { latestErrors[e.message] = (latestErrors[e.message] ?? 0) + 1; models[engine][d.round] = null; }
    }
    // F: 같은 엔진 상태벡터의 과거 전용 10-NN(운영 pastOnlyFSelection 과 같은 거리). 고정 엔진은 운영 F 와 전부 같아야 한다.
    const stateIds = (await json(join(PRIOR, 'method-comparison/method-E/state_matrix.json'))).feature_ids;
    const cyclic = stateIds.map((id) => /longitude|sexagenary|nakshatra|hexagram|cycle/.test(id));
    const dist = (a, b) => a.reduce((s, x, i) => { const t = Math.abs(x - b[i]); return s + (cyclic[i] ? Math.min(t, 1 - t) : t); }, 0) / a.length;
    const fSeries = (engine) => new Map(draws.filter((d) => d.round > 10).map((d) => {
      const nb = draws.filter((p) => p.round < d.round).map((p) => ({ p, v: dist(states[engine][d.round], states[engine][p.round]) })).sort((a, b) => a.v - b.v || a.p.round - b.p.round).slice(0, 10);
      const c = Array(46).fill(0); nb.forEach(({ p }) => p.numbers.forEach((n) => { c[n]++; }));
      return [d.round, Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => c[b] - c[a] || a - b).slice(0, 6).sort((a, b) => a - b)];
    }));
    const fFrozen = fSeries('frozen');
    const fBad = draws.filter((d) => d.round > 10 && JSON.stringify(fFrozen.get(d.round)) !== JSON.stringify(normTicket(models.frozen[d.round].F))).length;
    if (fBad) throw new Error(`F 재구현이 운영 F 와 ${fBad}회 다르다`);
    const fLatest = fSeries('latest');

    // 3) 규칙 목록
    const rules = [];
    const add = (r) => { for (const [k, t] of r.series) r.series.set(k, normTicket(t, `${r.id} ${k}`)); if (r.inSample) for (const [k, t] of r.inSample) r.inSample.set(k, normTicket(t, `${r.id} in ${k}`)); rules.push(r); };
    const seriesOf = (fn, from = 1, to = 1245) => new Map(R(from, to).map((d) => [d.round, fn(d)]).filter(([, t]) => t));
    const opName = { A: '달 별자리 분기 6공식', D: '15체계 후보 6조합식', E: '운세상태 12군집별 6공식', F: '유사 운세상태 과거 10회 최다번호', H: '행성 경도·날짜 6공식', S1: '후보 슬롯 득표순', S2: '2표 이상 우선 득표', S3: '체계 지지수 우선' };
    const methodName = { A: '달 별자리 분기 6공식', B: '단일 공식 상위 6개', C: '번호별 운세 점수 순위', D: '15체계 후보 6조합식', E: '운세상태 12군집별 6공식', F: '유사 운세상태 과거 10회 최다번호', G: '당첨 이력 통계 공식(비운세 대조)', H: '행성 경도·날짜 6공식', I: 'A·E 티켓 합집합 가중' };
    const opTrained = { A: true, D: true, E: true, H: true };

    // 3-1) 운영 고정 8개(고정 엔진). 학습형은 1243–1245 만 표본 외, 1–1242 는 참고(학습 재사용)
    // 학습형 운영 모델의 공정 성적: 기존 train-only walk-forward(601–1242) + 운영 고정본 1243–1245 전향
    for (const code of ['A', 'D', 'E', 'H']) {
      const wf = await json(join(PRIOR, `method-comparison/walk-forward/method_${code}.json`));
      const series = splitSeries(wf.splits, (s) => s.range); for (const d of R(1243, 1245)) series.set(d.round, models.frozen[d.round][code]);
      add({ id: `OP-${code}`, code, name: opName[code], group: '운영 고정 모델', engine: 'unse-c991927', origin: '기존', trained: true, risk: 2, evaluation: 'walk-forward 601–1242 + 운영 고정본 전향 1243–1245',
        series, inSample: new Map(R(1, 1242).map((d) => [d.round, models.frozen[d.round][code]])) });
    }
    add({ id: 'OP-F', code: 'F', name: opName.F, group: '운영 고정 모델', engine: 'unse-c991927', origin: '기존', trained: false, risk: 0, evaluation: '학습 없음(과거 회차만 이웃으로 사용) 11–1245', series: fFrozen });
    for (const code of ['S1', 'S2', 'S3']) add({ id: `OP-${code}`, code, name: opName[code], group: '운영 고정 모델', engine: 'unse-c991927', origin: '기존', trained: false, risk: 0, evaluation: '학습 없음 1–1245(1243–1245 도 사후 재계산)', series: seriesOf((d) => models.frozen[d.round][code]) });

    // 3-2) 연구 방법 B·C·G·I(고정 엔진 특징값, walk-forward 601–1242)
    for (const code of ['B', 'C', 'G', 'I']) {
      const wf = await json(join(PRIOR, `method-comparison/walk-forward/method_${code}.json`));
      const ins = code === 'B' || code === 'C' ? (await json(join(PRIOR, `method-comparison/method_${code}.json`))).tickets : await json(join(PRIOR, `method-comparison/method-${code}/tickets.json`));
      add({ id: `M-${code}`, code, name: methodName[code], group: '과거 연구 방법(미채택)', engine: code === 'G' ? '엔진 무관' : 'unse-c991927', origin: '기존', trained: true, risk: 2, evaluation: 'walk-forward 601–1242', series: splitSeries(wf.splits, (s) => s.range), inSample: new Map(ins.map((t, i) => [i + 1, t])) });
    }
    // 3-3) D 변형·감사 규칙(정확 walk-forward 601–1242)
    const variants = [
      ['V-Dexact', 'search-space-audit/exact_walk_forward_D.json', (j) => j.splits, '15체계 후보 6조합식(정확 WF)'],
      ['V-Aexact', 'search-space-audit/exact_walk_forward_A.json', (j) => j.splits, '달 별자리 분기 6공식(정확 WF)'],
      ['V-Eexact', 'search-space-audit/exact_walk_forward_E.json', (j) => j.splits, '운세상태 군집별 6공식(정확 WF)'],
      ['V-Dalias', 'd-robustness-audit/D_alias.json', (j) => j.exact_walk_forward.splits, '조합식 D: 같은 값 후보 통합'],
      ['V-Dtie', 'd-robustness-audit/D_tie.json', (j) => j.exact_walk_forward.splits, '조합식 D: 동점 해시 정렬'],
      ['V-Dunique', 'd-robustness-audit/D_unique.json', (j) => j.exact_walk_forward.splits, '조합식 D: 같은 식 중복 금지'],
      ['V-D4term', 'd-4term-audit/D4term.json', (j) => j.exact_walk_forward.splits, '조합식 D: 4항 식 허용'],
      ['V-J15', 'j15-audit/J15.json', (j) => j.exact_walk_forward.splits, '15체계 전부 강제 사용 조합식'],
      ['V-U33', 'j15-audit/U33.json', (j) => j.exact_walk_forward.splits, '33개 후보 자유선택 조합식'],
      ['V-Dall33', 'search-pool-audit/D_all33_top2500.json', (j) => j.exact_walk_forward.splits, '조합식 D: 33후보 상위 2500 풀'],
      ['V-Ddiverse', 'search-pool-audit/D_all33_diverse2500.json', (j) => j.exact_walk_forward.splits, '조합식 D: 체계 균형 풀'],
    ];
    for (const [id, file, get, name] of variants) add({ id, code: id.slice(2), name, group: '과거 연구 변형(미채택)', engine: 'unse-c991927', origin: '기존', trained: true, risk: 2, evaluation: '정확 walk-forward 601–1242', series: splitSeries(get(await json(join(PRIOR, file))), (s) => s.label ?? s.range) });

    // 3-4) 15체계 단독 규칙(두 엔진), 학습 없음
    const systems = [...new Set(Object.keys(cands.frozen[1]).map(systemOf))];
    for (const engine of ['frozen', 'latest']) for (const sy of systems) add({ id: `SYS-${engine === 'frozen' ? 'F' : 'L'}-${sy}`, code: sy, name: `${SYSTEM_LABEL[sy]} 단독(슬롯+이웃 채움)`, group: engine === 'frozen' ? '15체계 단독(고정 엔진)' : '15체계 단독(최신 엔진)', engine: engine === 'frozen' ? 'unse-c991927' : `latest ${engineTree.slice(0, 12)}`, origin: engine === 'frozen' ? '기존 슬롯' : '신규', trained: false, risk: 0, evaluation: '학습 없음 1–1245', series: seriesOf((d) => systemTicket(cands[engine][d.round], sy)) });
    // 3-5) 최신 엔진 득표 전략(같은 S1–S3 규칙에 최신 슬롯)
    const voteLatest = Object.fromEntries(draws.map((d) => [d.round, frozen.voteStrategyTickets(cands.latest[d.round])]));
    for (const code of ['S1', 'S2', 'S3']) add({ id: `L-${code}`, code, name: `${opName[code]}(최신 엔진 슬롯)`, group: '최신 엔진 신규 후보', engine: `latest ${engineTree.slice(0, 12)}`, origin: '신규', trained: false, risk: 0, evaluation: '학습 없음 1–1245', series: seriesOf((d) => voteLatest[d.round][code]) });
    add({ id: 'L-F', code: 'F', name: `${opName.F}(최신 엔진 상태)`, group: '최신 엔진 신규 후보', engine: `latest ${engineTree.slice(0, 12)}`, origin: '신규', trained: false, risk: 0, evaluation: '학습 없음 11–1245', series: fLatest });
    // 3-6) 최신 엔진 득표 규칙군 walk-forward(10-11 연구의 사전 등록 절차, 현재 엔진으로 재실행)
    const famNames = { 전체: '득표 규칙군 통합(창마다 선택)', 득표: '체계 전진선택 득표', 체계지지: '체계 전진선택 지지수', 슬롯가중: '슬롯 적중률 가중 득표', 체계가중: '체계 적중률 가중 득표' };
    const fams = Object.keys(famNames);
    const vf = { latest: voteFamiliesWalkForward(cands.latest, draws, fams), frozen: voteFamiliesWalkForward(cands.frozen, draws, ['전체']) };
    for (const f of fams) add({ id: `LV-${f}`, code: f, name: famNames[f], group: '최신 엔진 신규 후보', engine: `latest ${engineTree.slice(0, 12)}`, origin: '신규(10-11 연구 재실행)', trained: true, risk: 1, evaluation: 'walk-forward 601–1245(창마다 이전 회차만, 내부검증 200회)', series: vf.latest.tickets[f], chosen: vf.latest.chosen[f] });
    add({ id: 'FV-전체', code: '전체', name: '득표 규칙군 통합(고정 엔진 슬롯)', group: '과거 연구 변형(미채택)', engine: 'unse-c991927', origin: '기존(10-11 연구 대조군)', trained: true, risk: 1, evaluation: 'walk-forward 601–1245', series: vf.frozen.tickets['전체'], chosen: vf.frozen.chosen['전체'] });
    // 3-7) 최신 엔진 A–I walk-forward(선택 실행)
    const latestWfDir = await latestMethodWalkForward();
    if (latestWfDir) for (const code of 'ABCDEFGHI') {
      if (code === 'G') continue; // G 는 운세 특징을 쓰지 않아 엔진과 무관(고정 엔진 결과와 동일)
      const wf = await json(join(latestWfDir, `method_${code}.json`));
      add({ id: `LM-${code}`, code, name: `${methodName[code]}(최신 엔진 재탐색)`, group: '최신 엔진 신규 후보', engine: `latest ${engineTree.slice(0, 12)}`, origin: '신규(기존 방법론 재탐색)', trained: code !== 'F', risk: code === 'F' ? 0 : 2, evaluation: 'walk-forward 601–1242', series: splitSeries(wf.splits, (s) => s.range) });
    }
    // 3-8) 당첨 이력 통계(비운세 대조군), 학습 없음
    const histNames = { hotAll: '누적 최다 출현 6개', hot52: '최근 52회 최다 출현 6개', cold52: '최근 52회 최소 출현 6개', overdue: '최장 미출현 6개', repeat: '직전 회차 번호 반복' };
    for (const [kind, name] of Object.entries(histNames)) add({ id: `HS-${kind}`, code: kind, name, group: '당첨 이력 통계(대조군)', engine: '엔진 무관', origin: '기존(lotto-stat 신호 대응)', trained: false, risk: 0, evaluation: '학습 없음 2–1245', series: seriesOf((d) => d.round > 1 ? historyTicket(kind, draws.slice(0, d.round - 1).map((x) => x.numbers)) : null) });
    // 3-9) 무작위 대조(고정 시드)
    const rr = mulberry32(20261015); add({ id: 'RND', code: 'R', name: '무작위 6개(고정 시드)', group: '무작위 대조', engine: '없음', origin: '대조', trained: false, risk: 0, evaluation: '1–1245', series: seriesOf(() => randomTicket(rr)) });

    // 4) 지표
    const P = Object.fromEntries(Object.entries(PERIODS).map(([k, [a, b]]) => [k, R(a, b)]));
    for (const r of rules) {
      r.stats = Object.fromEntries(Object.keys(P).map((k) => [k, stats(r.series, P[k])]));
      r.windows = WINDOWS.map(([a, b]) => ({ range: `${a}-${b}`, s: stats(r.series, R(a, b)) }));
      if (r.inSample) r.inSampleStats = stats(r.inSample, R(1, 1242));
      r.coverage = [Math.min(...r.series.keys()), Math.max(...r.series.keys())];
      r.fullEligible = r.coverage[0] <= 11 && !r.trained; // 전 구간 표본 외(학습 없음)
    }

    // 5) 다중검정: 가상 공정 추첨으로 max-T(규칙 간 상관 반영)
    const mask = (t) => { let lo = 0, hi = 0; for (const n of t) { if (n <= 30) lo |= 1 << (n - 1); else hi |= 1 << (n - 31); } return [lo, hi]; };
    const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
    function maxT(periodKey, ruleSet, sims = 10000, seed = 1) {
      const rows = P[periodKey]; const rand = mulberry32(seed);
      const packs = ruleSet.map((r) => { const idx = [], lo = [], hi = []; rows.forEach((d, i) => { const t = r.series.get(d.round); if (t) { const [a, b] = mask(t); idx.push(i); lo.push(a); hi.push(b); } }); return { n: idx.length, idx: Int32Array.from(idx), lo: Int32Array.from(lo), hi: Int32Array.from(hi), z: r.stats[periodKey].z }; });
      const maxes = new Float64Array(sims), wlo = new Int32Array(rows.length), whi = new Int32Array(rows.length);
      for (let s = 0; s < sims; s++) {
        for (let i = 0; i < rows.length; i++) { const [a, b] = mask(randomTicket(rand)); wlo[i] = a; whi[i] = b; }
        let mx = -Infinity;
        for (const p of packs) { let h = 0; for (let j = 0; j < p.n; j++) { const i = p.idx[j]; h += pop(p.lo[j] & wlo[i]) + pop(p.hi[j] & whi[i]); } const z = (h / p.n - MEAN0) / Math.sqrt(VAR0 / p.n); if (z > mx) mx = z; }
        maxes[s] = mx;
      }
      const sorted = [...maxes].sort((a, b) => a - b);
      ruleSet.forEach((r, i) => { r.stats[periodKey].pMaxT = (sorted.filter((x) => x >= packs[i].z - 1e-12).length + 1) / (sims + 1); });
      const ps = ruleSet.map((r) => r.stats[periodKey].pMean).map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p); let run = 0;
      ps.forEach(({ p, i }, k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); ruleSet[i].stats[periodKey].pHolm = run; });
      return { rules: ruleSet.length, sims, maxZ95: sorted[Math.floor(sims * 0.95)], maxZ99: sorted[Math.floor(sims * 0.99)] };
    }
    const evalRules = rules.filter((r) => r.id !== 'RND');
    const multi = {
      dev: maxT('dev', rules.filter((r) => r.stats.dev), 10000, 101),
      holdout: maxT('holdout', rules.filter((r) => r.stats.holdout), 10000, 202),
      full: maxT('full', rules.filter((r) => r.fullEligible), 5000, 303),
    };

    // 6) 중복·유사도(같은 회차 공통 번호 수, 동일 티켓 비율, 회차별 적중 상관) — 최종 평가 구간 기준
    const sim = (a, b, period = 'holdout') => {
      let common = 0, same = 0, n = 0; const ha = [], hb = [];
      for (const d of P[period]) { const x = a.series.get(d.round), y = b.series.get(d.round); if (!x || !y) continue; const c = hitCount(x, y); common += c; if (c === 6) same++; n++; ha.push(hitCount(x, d.numbers)); hb.push(hitCount(y, d.numbers)); }
      if (!n) return null; const ma = ha.reduce((s, v) => s + v, 0) / n, mb = hb.reduce((s, v) => s + v, 0) / n;
      let cov = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { cov += (ha[i] - ma) * (hb[i] - mb); va += (ha[i] - ma) ** 2; vb += (hb[i] - mb) ** 2; }
      return { rounds: n, meanCommon: common / n, identical: same / n, hitCorr: va && vb ? cov / Math.sqrt(va * vb) : null };
    };
    const pairs = [];
    for (let i = 0; i < rules.length; i++) for (let j = i + 1; j < rules.length; j++) { const s = sim(rules[i], rules[j]); if (s) pairs.push({ a: rules[i].id, b: rules[j].id, ...s }); }
    for (const r of rules) { const mine = pairs.filter((p) => p.a === r.id || p.b === r.id).sort((x, y) => y.meanCommon - x.meanCommon); r.nearest = mine[0] ? { id: mine[0].a === r.id ? mine[0].b : mine[0].a, meanCommon: mine[0].meanCommon, identical: mine[0].identical } : null; }
    // 후보번호 중복률: 그 규칙 번호 중 다른 규칙(무작위 대조 제외)도 같은 회차에 낸 번호 비율
    for (const r of rules) { let shared = 0, total = 0; for (const d of P.holdout) { const t = r.series.get(d.round); if (!t) continue; const others = new Set(rules.filter((o) => o !== r && o.id !== 'RND').flatMap((o) => o.series.get(d.round) ?? [])); shared += t.filter((n) => others.has(n)).length; total += 6; } r.sharedRate = total ? shared / total : null; }

    // 7) 슬롯 단위 적중(체계 근거 검정): 슬롯 번호가 당첨 6개에 들 확률 = 6/45
    const slotTests = {};
    for (const engine of ['frozen', 'latest']) slotTests[engine] = Object.keys(cands[engine][1]).map((slot) => {
      const rows = (a, b) => R(a, b).map((d) => d.numbers.includes(cands[engine][d.round][slot]) ? 1 : 0);
      const all = rows(1, 1245), dev = rows(601, 1100), ho = rows(1101, 1245); const sum = (x) => x.reduce((s, v) => s + v, 0);
      return { slot, system: systemOf(slot), full: sum(all) / all.length, dev: sum(dev) / dev.length, holdout: sum(ho) / ho.length, pFull: binomTail(all.length, sum(all), 6 / 45) };
    });
    const slotCount = slotTests.frozen.length * 2;
    for (const e of ['frozen', 'latest']) slotTests[e].forEach((s) => { s.pBonferroni = Math.min(1, s.pFull * slotCount); });
    const engineDiff = Object.fromEntries(Object.keys(cands.frozen[1]).map((s) => [s, draws.filter((d) => cands.frozen[d.round][s] !== cands.latest[d.round][s]).length]).filter(([, n]) => n));
    const ticketDiff = Object.fromEntries(['A', 'D', 'E', 'H', 'S1', 'S2', 'S3'].map((m) => [m, draws.filter((d) => models.latest[d.round] && JSON.stringify(normTicket(models.latest[d.round][m])) !== JSON.stringify(normTicket(models.frozen[d.round][m]))).length]));

    // 8) 사전 등록 선정 기준
    const reliable = [], monitor = [];
    const devOK = (r) => r.stats.dev && r.stats.dev.mean > MEAN0 && r.stats.dev.pMean < 0.05;
    const holdOK = (r) => r.stats.holdout && r.stats.holdout.mean > MEAN0 && r.stats.holdout.pMaxT < 0.05;
    const fullOK = (r) => !r.fullEligible || (r.stats.full.mean > MEAN0 && r.stats.full.pMaxT < 0.05);
    const overlapWith = (r, chosen) => Math.max(0, ...chosen.map((c) => sim(r, c, 'dev')?.meanCommon ?? 0));
    for (const r of evalRules.filter((x) => devOK(x) && holdOK(x) && fullOK(x)).sort((a, b) => b.stats.holdout.z - a.stats.holdout.z)) if (overlapWith(r, reliable) < 3) reliable.push(r);
    const monitorPool = evalRules.filter((r) => r.stats.dev && r.stats.dev.rounds >= 400 && r.stats.dev.mean >= MEAN0).sort((a, b) => a.risk - b.risk || b.stats.dev.mean - a.stats.dev.mean || a.id.localeCompare(b.id));
    const monitorLog = [];
    for (const r of monitorPool) { if (monitor.length >= 5) break; const ov = overlapWith(r, monitor); if (ov < 1.5) monitor.push(r); monitorLog.push({ id: r.id, risk: r.risk, devMean: r.stats.dev.mean, maxOverlapWithChosen: ov, picked: monitor.includes(r) }); }
    // 선정에서 빠진 이유
    for (const r of evalRules) r.verdict = reliable.includes(r) ? '신뢰 규칙' : monitor.includes(r) ? '전향 관찰 후보(예측력 미입증)' : [
      !r.stats.dev ? '개발 구간 표본 외 성적 없음' : !devOK(r) ? `개발 구간 무작위 대비 유의하지 않음(평균 ${r.stats.dev.mean.toFixed(3)}, p=${r.stats.dev.pMean.toFixed(2)})` : null,
      r.stats.holdout && !holdOK(r) ? `최종 평가 보정 p=${r.stats.holdout.pMaxT.toFixed(2)}` : null,
      r.fullEligible && !fullOK(r) ? `전 구간 보정 p=${r.stats.full.pMaxT.toFixed(2)}` : null,
      monitorPool.includes(r) ? '관찰 후보 우선순위·중복 기준에서 밀림' : r.stats.dev && r.stats.dev.mean < MEAN0 ? '개발 구간 평균이 무작위 기대(0.8) 미만' : null,
    ].filter(Boolean).join(' · ');

    // 9) 저장
    const slim = (r) => ({ id: r.id, code: r.code, name: r.name, group: r.group, engine: r.engine, origin: r.origin, trained: r.trained, risk: r.risk, evaluation: r.evaluation, coverage: r.coverage, fullEligible: r.fullEligible,
      stats: r.stats, windows: r.windows.map((w) => ({ range: w.range, mean: w.s?.mean ?? null, rounds: w.s?.rounds ?? 0 })), inSampleStats: r.inSampleStats ?? null, nearest: r.nearest, sharedRate: r.sharedRate, chosen: r.chosen ?? null, verdict: r.verdict ?? null });
    const result = { generatedAt: new Date().toISOString(), protocol: 'RULE_REVALIDATION_PROTOCOL.md', engines: { frozen: 'unse-c991927 (lib/lotto-future/engine-c991927)', latest: { tree: engineTree, dirty: engineDirty || null } }, latestErrors,
      random: { pmf: PMF, mean: MEAN0, variance: VAR0, ge3: PGE3 }, periods: PERIODS, windows: WINDOWS, multi,
      rules: rules.map(slim), reliable: reliable.map((r) => r.id), monitor: monitor.map((r) => r.id), monitorLog, engineDiff, ticketDiff, slotTests,
      excludedWithoutEvaluation: [
        { id: 'X-lookup', name: '회차 고유키 조회표(event_signature) 최대 점수 규칙', reason: '1–1242 전 회차 6개 적중 = 암기. 키가 미래에 반복되지 않아 적용 불가', source: 'output/report.md · best_rule.json' },
        { id: 'X-Esimple', name: '단순 식 탐색 최고점(E_simple, 1–1242 표본 내)', reason: 'walk-forward 티켓이 없음. 표본 내 탐색 결과라 공정 평가 불가', source: 'output/tickets.json', inSample: stats(new Map((await json(join(PRIOR, 'tickets.json'))).E_simple.map((t) => [t.round, t.numbers])), R(1, 1242)) },
        { id: 'X-statsig', name: '이력 통계 8신호(빈도·최근·간격·추세·전이·이월·N-2·구간)', reason: '2026-09-19 검증에서 8개 모두 무작위 이하로 탈락(weight 0). 대표 4개를 이력 통계 대조군으로 다시 평가', source: 'public/unse/src/data/lotto-model.js' },
        { id: 'X-personal', name: '개인 명반 겹침 번호(lotto.js pickNumbers)', reason: '사람의 생년월일 기반이라 회차 예측 규칙이 아님. 추첨 시각을 넣은 형태가 15체계 슬롯·S1–S3 로 이미 평가됨', source: 'public/unse/src/lotto.js' },
      ] };
    await writeFile(join(OUT, 'results.json'), JSON.stringify(result, null, 2));
    await writeFile(join(OUT, 'pairwise_similarity.json'), JSON.stringify(pairs));
    await writeFile(join(OUT, 'tickets.json'), JSON.stringify(Object.fromEntries(rules.map((r) => [r.id, Object.fromEntries(r.series)]))));
    console.log(JSON.stringify({ rules: rules.length, reliable: result.reliable, monitor: result.monitor, multi, latestErrors, ticketDiff }, null, 1));
    return result;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
