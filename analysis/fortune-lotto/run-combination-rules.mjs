/*
 * 매주 재탐색 체계 조합 규칙 연구(연구 전용). 절차: COMBINATION_RULES_PROTOCOL.md(결과 확인 전 고정).
 * 입력: output/adaptive-leaderboard/baseline.json(1–1245 최신 엔진 슬롯·당첨). 출력: output/combination-rules/ 만.
 * 계산 함수는 운영과 같은 lib/lotto-future/leaderboard-rules.mjs·classical-slots.mjs 를 쓴다.
 * 실행(저장소 루트): node analysis/fortune-lotto/run-combination-rules.mjs
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { exactTail, MEAN0 } from './run-rule-revalidation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(HERE, 'output', 'combination-rules');
const NEXT = { round: 1246, drawDate: '2026-10-17', drawTime: '20:35' };

async function bundle(entry, dir) {
  const outfile = join(dir, entry.replace(/[\\/]/g, '_') + '.mjs');
  await build({ entryPoints: [join(ROOT, entry)], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
  return import(pathToFileURL(outfile));
}
const parts = (d) => { const [year, month, day] = d.drawDate.split('-').map(Number); const [hour, minute] = d.drawTime.slice(0, 5).split(':').map(Number); return { year, month, day, hour, minute }; };

export async function main() {
  await mkdir(OUT, { recursive: true });
  const dir = await mkdtemp(join(tmpdir(), 'lotto-combination-'));
  try {
    const [{ classicalSlots }, rules] = await Promise.all([bundle('lib/lotto-future/classical-slots.mjs', dir), bundle('lib/lotto-future/leaderboard-rules.mjs', dir)]);
    const base = JSON.parse(await readFile(join(HERE, 'output/adaptive-leaderboard/baseline.json'), 'utf8'));
    const events = [...base.draws, { ...NEXT, numbers: [] }];
    const classical = events.map((d) => classicalSlots(parts(d)));
    const classicalNames = Object.keys(classical[0]);
    const latestFor = (i) => i < base.draws.length ? base.cands.latest[i] : null;
    // 1246 최신 엔진 슬롯은 기준선에 없으므로 연구용 번들로 계산
    const { candidateValues, __eventFeatures } = await (async () => {
      const outfile = join(dir, 'latest-features.mjs');
      await build({ stdin: { contents: `export { eventFeatures as __eventFeatures } from './lib/lotto-future/event-features-latest.mjs'; export { candidateValues } from './lib/lotto-future/predictor.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
      return import(pathToFileURL(outfile));
    })();
    const next = candidateValues(__eventFeatures(parts(NEXT)));
    const allNames = [...base.slotNames.latest, ...classicalNames];
    const allRows = events.map((d, i) => [...(latestFor(i) ?? base.slotNames.latest.map((s) => next[s])), ...classicalNames.map((s) => classical[i][s])]);
    // 1–1245 값이 완전히 같은 슬롯은 앞의 것만 남긴다
    const keep = [], aliases = {};
    allNames.forEach((name, j) => { const twin = keep.find((k) => base.draws.every((_, i) => allRows[i][k] === allRows[i][j])); if (twin == null) keep.push(j); else aliases[name] = allNames[twin]; });
    const slotNames = keep.map((j) => allNames[j]); const rows = allRows.map((row) => keep.map((j) => row[j]));
    const winners = Object.fromEntries(base.draws.map((d) => [d.round, d.numbers]));

    const series = { C1: {}, C2: {}, 'SYS-L-classical': {} }, chosen = { C1: {}, C2: {} };
    const started = Date.now();
    const final = rules.combinationTickets(slotNames, rows, winners, NEXT.round, (r, pick) => {
      for (const k of ['C1', 'C2']) if (pick[k]) { series[k][r] = [...pick[k].ticket].sort((a, b) => a - b); chosen[k][r] = pick[k].formulas; }
    });
    for (const k of ['C1', 'C2']) { series[k][NEXT.round] = [...final[k].ticket].sort((a, b) => a - b); chosen[k][NEXT.round] = final[k].formulas; }
    events.forEach((d, i) => { series['SYS-L-classical'][d.round] = [...rules.systemTicket(classical[i], 'classical')].sort((a, b) => a - b); });

    const statOf = (id, a, b) => { let h = 0, n = 0, g3 = 0; for (let r = a; r <= b; r++) { const t = series[id][r]; if (!t) continue; const k = t.filter((x) => winners[r].includes(x)).length; h += k; n++; if (k >= 3) g3++; } return n ? { rounds: n, mean: h / n, ge3Rate: g3 / n, p: exactTail(n, h) } : null; };
    const stats = Object.fromEntries(Object.keys(series).map((id) => [id, { dev: statOf(id, 601, 1100), holdout: statOf(id, 1101, 1245), all: statOf(id, 1, 1245) }]));
    // 어떤 체계 조합이 자주 뽑혔나(C1·C2, 101–1245)
    const systemUse = Object.fromEntries(['C1', 'C2'].map((k) => { const m = {}; Object.values(chosen[k]).flat().forEach((f) => { for (const label of Object.values(rules.SLOT_LABELS)) if (f.includes(label)) { const sy = label.split(' ')[0]; m[sy] = (m[sy] ?? 0) + 1; } }); return [k, Object.entries(m).sort((a, b) => b[1] - a[1])]; }));
    const result = { generatedAt: new Date().toISOString(), protocol: 'COMBINATION_RULES_PROTOCOL.md', formulaCount: final.formulaCount, slotNames, aliases, seconds: (Date.now() - started) / 1000,
      random: MEAN0, stats, next: NEXT, picks1246: { C1: final.C1, C2: final.C2, 'SYS-L-classical': series['SYS-L-classical'][NEXT.round] }, systemUse,
      sampleChoices: Object.fromEntries(['C1', 'C2'].map((k) => [k, Object.fromEntries([700, 1000, 1245].map((r) => [r, chosen[k][r]]))])) };
    await writeFile(join(OUT, 'results.json'), JSON.stringify(result, null, 2));
    await writeFile(join(OUT, 'tickets.json'), JSON.stringify({ series, chosen }));
    await writeFile(join(OUT, 'slots.json'), JSON.stringify({ classicalNames, classical: events.map((d, i) => classicalNames.map((s) => classical[i][s])), comboSlotNames: slotNames }));
    console.log(JSON.stringify({ formulaCount: result.formulaCount, seconds: result.seconds, aliases, stats, picks1246: result.picks1246 }, null, 1));
  } finally { await rm(dir, { recursive: true, force: true }); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
