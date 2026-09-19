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
const { verifySignals } = await import(`file://${path.join(SRC, 'lotto-backtest.js')}`);

console.log(`회차 ${DRAWS.length}개로 검증합니다…`);
const t0 = Date.now();
const r = verifySignals(DRAWS);
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const pct = (x) => `${(x * 100).toFixed(2)}%`;

if (!r.ok) {
  console.log(`\n${r.reason}`);
} else {
  console.log(`\n구간: 학습 ~${r.split.trainTo} / 검증 ~${r.split.validTo} / 최종확인 ~${r.split.testTo}`);

  console.log('\n■ 신호별 판정');
  for (const v of r.verdicts) {
    console.log(`  ${v.weight > 0 ? '○' : '×'} ${v.name.padEnd(4)} 세기 ${String(v.scale).padEnd(5)} ` +
      `개선 ${v.gain.toExponential(2).padStart(10)} / 우연 ${v.chance.toExponential(2).padStart(10)} → 비중 ${v.weight.toFixed(4)}`);
    console.log(`       ${v.note}`);
  }

  console.log('\n■ 모델 비교 (검증 구간, 같은 자로 잰 값)');
  console.log('  모델             평균적중  3개이상   Brier        LogLoss    개선');
  for (const c of r.comparison) {
    console.log(`  ${c.label.padEnd(15)} ${c.averageMatches.toFixed(4)}  ${pct(c.hit3PlusRate).padStart(7)}  ` +
      `${c.brierScore.toExponential(4)}  ${c.logLoss.toFixed(5)}  ${c.skill.toExponential(2).padStart(10)}`);
  }
  const b = r.validationBaseline;
  console.log(`  ${'무작위(MC)'.padEnd(15)} ${b.averageMatches.toFixed(4)}  ${pct(b.hit3PlusRate).padStart(7)}  ` +
    `${b.brierScore.toExponential(4)}  ${b.logLoss.toFixed(5)}   (기준, ${b.sims}회 시뮬)`);

  if (r.ablation.length) {
    console.log('\n■ Ablation (신호를 빼면 나빠지는가)');
    for (const a of r.ablation) {
      console.log(`  ${a.removed} 제거 → 개선 ${a.skill.toExponential(2)} (차이 ${a.delta.toExponential(2)})` +
        `${a.delta >= 0 ? '  ← 빼도 안 나빠짐, 최종 모델에서 제거' : ''}`);
    }
  } else {
    console.log('\n■ Ablation — 살아남은 신호가 없어 생략');
  }

  console.log('\n■ 최종확인 구간 (가중치 확정 후 한 번만)');
  const f = r.finalTest, tb = r.testBaseline;
  console.log(`  모델    평균적중 ${f.averageMatches.toFixed(4)} · 3개이상 ${pct(f.hit3PlusRate)} · Brier ${f.brierScore.toExponential(4)} · LogLoss ${f.logLoss.toFixed(5)}`);
  console.log(`  무작위  평균적중 ${tb.averageMatches.toFixed(4)} · 3개이상 ${pct(tb.hit3PlusRate)} · Brier ${tb.brierScore.toExponential(4)}`);
  console.log(`  적중 분포 0~6개: ${f.matchDistribution.join(' / ')}`);

  console.log('\n■ 안정성 (마지막 N회)');
  for (const x of r.rolling) {
    console.log(`  최근 ${String(x.window).padStart(3)}회 · 표본 ${String(x.sampleSize).padStart(3)} · ` +
      `평균적중 ${x.averageMatches.toFixed(4)} · 3개이상 ${pct(x.hit3PlusRate).padStart(7)} · 개선 ${x.skill.toExponential(2)}`);
  }

  console.log(`\n${r.reason}`);
  console.log(`통계 비중 합계: ${r.statWeight.toFixed(4)}  (나머지는 명반 겹침과 무작위 몫)`);
}
console.log(`\n${secs}초 걸렸습니다.`);

const header = fs.readFileSync(OUT, 'utf8').split('export const LOTTO_MODEL')[0];
fs.writeFileSync(OUT, `${header}export const LOTTO_MODEL = ${JSON.stringify({
  modelVersion: r.modelVersion ?? null,
  drawCount: r.drawCount,
  used: r.used ?? [],
  weights: r.weights ?? {},
  statWeight: r.statWeight ?? 0,
  verdicts: r.verdicts ?? [],
  ablation: r.ablation ?? [],
  comparison: r.comparison ?? [],
  split: r.split ?? null,
  finalTest: r.finalTest ?? null,
  testBaseline: r.testBaseline ?? null,
  rolling: r.rolling ?? [],
  reason: r.reason,
  verifiedAt: new Date().toISOString().slice(0, 10),
}, null, 2)};
`);
console.log(`\n${path.relative(ROOT, OUT)} 를 갱신했습니다.`);
