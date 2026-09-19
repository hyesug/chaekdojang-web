#!/usr/bin/env node
/**
 * lotto-verify.mjs — 통계 신호가 쓸 만한지 검증하고 결과를 박아 넣는다
 *
 *   node scripts/lotto-verify.mjs
 *
 * 무겁다. 회차 천 개면 수십 초 걸린다. 그래서 화면에서 돌리지 않고
 * 여기서 한 번 돌린 뒤 결과만 data/lotto-model.js 에 적는다.
 * 새 회차가 쌓이면 다시 돌리면 된다.
 *
 * 나오는 답은 거의 확실히 "쓸 만한 신호 없음"이다. 그게 정상이고, 그렇게
 * 나와야 맞다. 로또는 매 회차가 독립 시행이라 과거에서 다음을 읽을 수 없다.
 * 이 스크립트가 하는 일은 그 사실을 **말로 하지 않고 수치로 보이는 것**이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/unse-8f3k2m/src');
const OUT = path.join(SRC, 'data/lotto-model.js');

const { DRAWS } = await import(`file://${path.join(SRC, 'data/draws.js')}`);
const { verifySignals } = await import(`file://${path.join(SRC, 'lotto-stats.js')}`);

console.log(`회차 ${DRAWS.length}개로 검증합니다…`);
const t0 = Date.now();
const r = verifySignals(DRAWS);
const secs = ((Date.now() - t0) / 1000).toFixed(1);

if (!r.ok) {
  console.log(`\n${r.reason}`);
} else {
  console.log(`\n구간: 학습 ~${r.split.trainTo} / 검증 ~${r.split.validTo} / 최종확인 ~${r.split.testTo}`);
  console.log('\n신호별 판정');
  for (const v of r.verdicts) {
    const mark = v.weight > 0 ? '○' : '×';
    console.log(`  ${mark} ${v.name.padEnd(3)} 세기 ${String(v.scale).padEnd(5)} ` +
      `개선 ${v.gain.toExponential(2).padStart(10)} / 우연 ${v.chance.toExponential(2).padStart(10)} ` +
      `→ 비중 ${v.weight.toFixed(4)}`);
    console.log(`      ${v.note}`);
  }
  console.log(`\n${r.reason}`);
  console.log(`통계 비중 합계: ${r.statWeight.toFixed(4)}  (나머지는 명반과 무작위 몫)`);
}
console.log(`\n${secs}초 걸렸습니다.`);

const header = fs.readFileSync(OUT, 'utf8').split('export const LOTTO_MODEL')[0];
fs.writeFileSync(OUT, `${header}export const LOTTO_MODEL = ${JSON.stringify({
  drawCount: r.drawCount,
  used: r.used ?? [],
  weights: r.weights ?? {},
  statWeight: r.statWeight ?? 0,
  verdicts: r.verdicts ?? [],
  reason: r.reason,
  verifiedAt: new Date().toISOString().slice(0, 10),
}, null, 2)};
`);
console.log(`\n${path.relative(ROOT, OUT)} 를 갱신했습니다.`);
