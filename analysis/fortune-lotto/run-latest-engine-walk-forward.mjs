/*
 * 기존 연구 파이프라인(run-method-comparison → run-extended-comparison)을 최신 운세 엔진 특징값으로
 * 다시 돌려 A–I 탐색·walk-forward 를 재현한다(연구 전용).
 * - 기존 실행 코드를 임시 폴더에 복사해 돌리므로 이 저장소의 기존 산출물은 덮어쓰지 않는다.
 * - 특징값은 run-backtest.mjs 의 featuresFor 를 그대로 쓴다(원본처럼 위치 기준 배열).
 * - 결과: output/latest-engine-research/walk_forward_reproduction.json 만 쓴다.
 */
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(HERE, 'output', 'latest-engine-research');
const DEV = ['601-700', '701-800', '801-900', '901-1000', '1001-1100'], HOLDOUT = ['1101-1200', '1201-1242'];
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));

export function aggregate(splits, ranges) {
  const picked = splits.filter((s) => ranges.includes(s.range));
  const rounds = picked.reduce((t, s) => t + s.stats.rounds, 0);
  return { mean: picked.reduce((t, s) => t + s.stats.hits, 0) / rounds, ge3: picked.reduce((t, s) => t + s.stats.hist.slice(3).reduce((a, b) => a + b, 0), 0) / rounds };
}

export async function main() {
  const work = await mkdtemp(join(tmpdir(), 'lotto-latest-wf-'));
  try {
    const dir = join(work, 'analysis', 'fortune-lotto');
    await mkdir(join(dir, 'output', 'method-comparison'), { recursive: true });
    // 1) 최신 엔진 특징값: run-backtest 의 featuresFor 만 꺼내 쓴다(엔진 경로는 이 저장소의 public/unse/src)
    const backtest = (await readFile(join(HERE, 'run-backtest.mjs'), 'utf8'))
      .replaceAll("'../../public/unse/src/", `'${pathToFileURL(join(ROOT, 'public/unse/src')).href}/`)
      .replace(/^main\(\)\.catch.*$/m, 'export { featuresFor };');
    await writeFile(join(dir, 'backtest-features.mjs'), backtest);
    const { featuresFor } = await import(pathToFileURL(join(dir, 'backtest-features.mjs')));
    const old = await json(join(HERE, 'output', 'feature_matrix_time_refined.json'));
    const manifest = await json(join(HERE, 'output', 'feature_manifest.json'));
    const featureDiff = {};
    const rows = old.map((row) => {
      const f = featuresFor(row.round).features;
      f.forEach((x, i) => { if (x.raw !== row.raw[i]) featureDiff[manifest[i]?.id ?? i] = (featureDiff[manifest[i]?.id ?? i] ?? 0) + 1; });
      if (f.length !== row.raw.length) throw new Error(`feature length changed at round ${row.round}`);
      return { ...row, raw: f.map((x) => x.raw), spread: f.map((x) => x.spread) };
    });
    await writeFile(join(dir, 'output', 'feature_matrix_time_refined.json'), JSON.stringify(rows));
    await writeFile(join(dir, 'output', 'feature_matrix.json'), JSON.stringify(rows));
    for (const name of ['feature_manifest.json', 'tickets.json', 'best_rule.json']) await copyFile(join(HERE, 'output', name), join(dir, 'output', name));
    // 2) 기존 실행 코드를 그대로 돌린다
    for (const runner of ['run-method-comparison.mjs', 'run-extended-comparison.mjs']) {
      await copyFile(join(HERE, runner), join(dir, runner));
      execFileSync(process.execPath, [join(dir, runner)], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
    }
    // 3) 기존(고정 엔진) walk-forward 와 나란히 요약
    const walkForward = {};
    for (const model of 'ABCDEFGHI') {
      for (const [engine, base] of [['frozen', join(HERE, 'output')], ['latest', join(dir, 'output')]]) {
        const w = await json(join(base, 'method-comparison', 'walk-forward', `method_${model}.json`));
        const dev = aggregate(w.splits, DEV), holdout = aggregate(w.splits, HOLDOUT);
        walkForward[`${model}-${engine}`] = { score: w.score, mean: w.mean, ge3: w.ge3, devMean: dev.mean, devGe3: dev.ge3, holdoutMean: holdout.mean, holdoutGe3: holdout.ge3, splitMeans: w.splits.map((s) => +s.stats.mean.toFixed(3)) };
      }
    }
    await mkdir(OUT, { recursive: true });
    await writeFile(join(OUT, 'walk_forward_reproduction.json'), JSON.stringify({ walkForward, featureDiff }, null, 2));
    console.log(JSON.stringify(Object.fromEntries(Object.entries(walkForward).map(([k, v]) => [k, { score: v.score, devMean: +v.devMean.toFixed(4), holdoutMean: +v.holdoutMean.toFixed(4) }]))));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
