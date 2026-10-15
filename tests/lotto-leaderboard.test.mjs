import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = new URL('../', import.meta.url);
const HISTORY = [
  { round: 1243, drawDate: '2026-09-26', drawTime: '21:30', numbers: [9, 18, 24, 38, 43, 44] },
  { round: 1244, drawDate: '2026-10-03', drawTime: '21:35', numbers: [1, 13, 18, 26, 34, 38] },
  { round: 1245, drawDate: '2026-10-10', drawTime: '20:35', numbers: [4, 5, 25, 28, 32, 42] },
];
const NEXT = { round: 1246, drawDate: '2026-10-17', drawTime: '20:35' };

async function leaderboard() {
  const directory = await mkdtemp(join(tmpdir(), 'lotto-leaderboard-'));
  const outfile = join(directory, 'leaderboard.mjs');
  await build({ entryPoints: [fileURLToPath(new URL('../lib/lotto-future/leaderboard.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
  return { module: await import(`file://${outfile}`), cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test('운영 순위표는 1246회에서 연구 산출(순위·상위 5개·규칙별 번호)과 같다', async () => {
  const [{ module, cleanup }, research] = await Promise.all([leaderboard(), readFile(new URL('analysis/fortune-lotto/output/adaptive-leaderboard/results.json', ROOT), 'utf8').then(JSON.parse)]);
  try {
    const result = module.generateLeaderboard(NEXT, HISTORY, []);
    const byId = Object.fromEntries(result.entries.map((e) => [e.ruleId, e]));
    for (const row of research.board) {
      assert.deepEqual(byId[row.id].numbers, row.ticket, `${row.id} 번호`);
      assert.equal(byId[row.id].rank, row.rank, `${row.id} 순위`);
      assert.ok(Math.abs(byId[row.id].score - row.score) < 1e-12, `${row.id} 점수`);
    }
    const top = result.entries.filter((e) => e.top5Rank).sort((a, b) => a.top5Rank - b.top5Rank).map((e) => e.ruleId);
    assert.deepEqual(top, research.top5For1246.map((x) => x.id));
    assert.equal(result.entries.length, 57);
    assert.match(result.engineVersion, /^unse-c991927\+unse-latest/);
  } finally {
    await cleanup();
  }
});

test('저장된 순위표 결과를 반영하고, 확정 안 된 회차가 있으면 생성하지 않는다', async () => {
  const { module, cleanup } = await leaderboard();
  try {
    const first = module.generateLeaderboard(NEXT, HISTORY, []);
    const tickets = Object.fromEntries(first.entries.map((e) => [e.ruleId, e.numbers]));
    const actual = tickets['OP-A']; // OP-A 가 6개 모두 맞힌 가상 결과
    const next = { round: 1247, drawDate: '2026-10-24', drawTime: '20:35' };
    const history = [...HISTORY, { ...NEXT, numbers: actual }];
    const second = module.generateLeaderboard(next, history, [{ round: 1246, actual, tickets }]);
    const before = first.entries.find((e) => e.ruleId === 'OP-A'), after = second.entries.find((e) => e.ruleId === 'OP-A');
    assert.equal(after.recordRounds, before.recordRounds + 1);
    assert.ok(after.score > before.score);
    // 기준선 이전 회차 결과는 무시(이중 반영 금지)
    const ignored = module.generateLeaderboard(NEXT, HISTORY, [{ round: 1245, actual, tickets }]);
    assert.deepEqual(ignored.entries.map((e) => e.recordRounds), first.entries.map((e) => e.recordRounds));
    assert.throws(() => module.generateLeaderboard(next, HISTORY, []), /confirmed result for round 1246/);
    assert.throws(() => module.generateLeaderboard({ ...NEXT, round: 1245 }, HISTORY, []), /starts after round 1245/);
  } finally {
    await cleanup();
  }
});
