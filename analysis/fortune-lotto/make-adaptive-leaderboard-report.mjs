/*
 * output/adaptive-leaderboard/results.json → report.md. 숫자는 결과 파일에서만 읽는다.
 * 실행(저장소 루트): node analysis/fortune-lotto/make-adaptive-leaderboard-report.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'output', 'adaptive-leaderboard');
const res = JSON.parse(await readFile(join(OUT, 'results.json'), 'utf8'));
const f = (x, d = 3) => x == null ? '—' : Number(x).toFixed(d);
const pct = (x) => x == null ? '—' : `${(x * 100).toFixed(1)}%`;
const p = (x) => x == null ? '—' : x < 0.001 ? '<0.001' : x.toFixed(3);
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map((c) => String(c ?? '—').replaceAll('|', '/')).join(' | ')} |`)].join('\n');
const nameOf = Object.fromEntries(res.board.map((b) => [b.id, b.name]));
const ev = res.leaderboardEval;
const L = [];
L.push('# 변동 순위표(리더보드) 연구 보고서 (연구 전용)', '');
L.push(`생성: ${res.generatedAt.slice(0, 10)} · 절차: \`${res.protocol}\`(실행 전 고정) · 코드: \`run-adaptive-leaderboard.mjs\``, '');
L.push('> 운영 모델·저장 예측·화면은 바꾸지 않았다. 순위는 과거 성적 기록이며 미래 적중 확률이 아니다.', '');
L.push('## 0. 결론', '');
L.push(`- 후보 규칙 ${res.liveRules}개(기존 고정·최신 엔진 + 신규 4개)를 매 회차 그때까지의 표본 외 성적으로 다시 순위 매기는 방식을 701–1245회에 그대로 적용해 봤다.`);
L.push(`- 상위 5개 규칙 평균 적중: 개발 701–1100 **${f(ev.shrunk.dev.top5Mean)}개**(p=${p(ev.shrunk.dev.pTop5Sim)}), 최종 1101–1245 **${f(ev.shrunk.holdout.top5Mean)}개**(p=${p(ev.shrunk.holdout.pTop5Sim)}). 무작위 기대 0.800개. **순위표 방식의 효과: ${res.effective ? '있음' : '확인되지 않음'}.**`);
L.push(`- 순위 점수와 바로 다음 회차 적중의 순위상관 평균: ${f(ev.shrunk.all.meanRankCorr)}. 0이면 "지금까지 잘 맞힌 규칙이 다음에도 잘 맞힌다"는 근거가 없다는 뜻이다.`);
L.push(`- 1위 규칙은 701–1246회 사이 ${res.leaderChanges}번 바뀌었다. 순위는 매주 갱신되지만, 그 변동은 우연한 적중의 흔들림과 구별되지 않는다.`, '');
L.push('## 1. 순위표 방식 과거 검증', '');
L.push('회차마다 그 이전 성적만으로 상위 5개를 고르고, 그 회차 적중을 기록. p 는 고른 티켓을 그대로 두고 당첨만 가상 공정 추첨으로 1만 번 바꿔 얻은 값.', '');
const label = { shrunk: '축소 누적 평균(주 기준)', recent104: '최근 104회 축소 평균(보조)', plain: '단순 누적 평균(보조)' };
L.push(table(['순위 기준', '구간', '회차', '1위 평균', '1위 p', '상위5 평균', '상위5 p', '5장 중 3+ 비율', '3+ p'], Object.entries(ev).flatMap(([k, per]) => Object.entries(per).map(([pk, s]) => [label[k], { dev: '701–1100', holdout: '1101–1245', all: '701–1245' }[pk], s.rounds, f(s.top1Mean), p(s.pTop1Sim), f(s.top5Mean), p(s.pTop5Sim), pct(s.best5Ge3Rate), p(s.pBest5Sim)]))), '');
L.push('## 2. 신규 규칙 4종(매 회차 그 이전 당첨번호로 다시 학습)', '');
const desc = { N1: '두 엔진 66개 슬롯마다 지금까지 슬롯 번호가 당첨에 든 비율을 축소 추정, 기대(6/45)보다 높은 몫을 그 번호 점수로', N2: '최근 104회 슬롯 적중률 상위 5개 체계의 슬롯 득표, 부족분 ±1·±2 이웃', N3: '번호별 (슬롯 득표 수·최근 52회 출현·미출현 간격) 구간의 과거 당첨 비율 로그 오즈 합 상위 6', N4: '그 회차 순위표 상위 10개 규칙 티켓의 다수결' };
L.push(table(['ID', '이름', '핵심 계산', '개발 601–1100 평균(p)', '최종 1101–1245 평균(p)', '102–1245 평균(p)', '102–1245 3+'], Object.entries(res.newRules).map(([id, s]) => [id, nameOf[id], desc[id], `${f(s.dev?.mean)} (${p(s.dev?.p)})`, `${f(s.holdout?.mean)} (${p(s.holdout?.p)})`, `${f(s.all?.mean)} (${p(s.all?.p)})`, pct(s.all?.ge3Rate)])), '');
L.push('신규 4개는 결과를 보기 전에 정했지만, 앞선 재검증 결과를 본 뒤 설계했다. 위 p 는 4개 각각의 값이며 다중검정 보정 전이다.', '');
L.push('## 3. 701–1245회에 상위 5개로 자주 뽑힌 규칙', '');
L.push(table(['규칙', '이름', '상위 5개에 든 회차'], Object.entries(res.ruleUse).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, n]) => [id, nameOf[id], n])), '');
L.push(`## 4. ${res.next.round}회(${res.next.drawDate} ${res.next.drawTime}) 순위표`, '');
L.push('### 4-1. 상위 5개 규칙과 번호', '');
L.push(table(['순위', '규칙', '이름', '엔진', '순위 점수', '표본 외 회차', '누적 평균', '최근 104회 평균', `${res.next.round}회 번호`], res.top5For1246.map((x, i) => { const b = res.board.find((y) => y.id === x.id); return [i + 1, x.id, b.name, b.engine, f(x.score, 4), b.rounds, f(b.mean), f(b.recent104), x.ticket.join(', ')]; })), '');
L.push('같은 번호를 내는 규칙은 하나만 남긴다(과거 평균 공통 번호 3개 이상이면 아래 순위로 넘어감).', '');
L.push('### 4-2. 전체 순위(상위 25)', '');
L.push(table(['순위', '규칙', '이름', '기존/신규', '점수', '회차', '누적 평균', '최근 104', '번호'], res.board.slice(0, 25).map((b) => [b.rank, b.id, b.name, b.origin, f(b.score, 4), b.rounds, f(b.mean), f(b.recent104), b.ticket.join(', ')])), '');
L.push('### 4-3. 보조 기준 상위 5개', '');
for (const [k, list] of Object.entries(res.variantsFor1246)) L.push(`- ${label[k]}: ${list.map((x) => `${x.id}(${x.ticket.join(',')})`).join(' · ')}`);
L.push('');
L.push('## 5. 운영에 넣는다면(승인 전 설계안)', '');
L.push(table(['단계', '내용'], [
  ['추첨 전', '후보 규칙 전부의 티켓 + 그 시점 순위 상위 5개 + 무작위 대조 1장을 엔진 버전·코드 커밋과 함께 저장. 저장 후 변경 금지'],
  ['추첨 후', '당첨번호 입력 → 모든 규칙 적중 기록 → 다음 회차 순위 자동 재계산'],
  ['규칙 갱신', 'N1–N4·득표 규칙군은 매 회차 새 당첨번호로 다시 학습(규칙 내용이 바뀜). 새 규칙은 과거 walk-forward 기록 100회 이상을 만든 뒤에만 순위에 들어감'],
  ['표시', '"순위 = 지금까지 성적"으로만 표시. 확률·당첨 가능성 표현 금지. 무작위 대조와 나란히 보여 줌'],
  ['판정', '상위 5개 누적 평균이 무작위 대비 보정 p<0.05 를 넘기 전까지 "예측력 있음" 표시 금지'],
]), '');
L.push('## 재현', '', '```bash', 'node analysis/fortune-lotto/run-rule-revalidation.mjs        # 먼저(표본 외 티켓)', 'node analysis/fortune-lotto/run-adaptive-leaderboard.mjs', 'node analysis/fortune-lotto/make-adaptive-leaderboard-report.mjs', '```');
await writeFile(join(OUT, 'report.md'), L.join('\n'));
console.log('report.md', L.length);
