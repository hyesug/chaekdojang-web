/*
 * output/rule-revalidation/results.json → report.md (표 중심). 숫자는 결과 파일에서만 읽는다.
 * 실행(저장소 루트): node analysis/fortune-lotto/make-rule-revalidation-report.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'output', 'rule-revalidation');
const res = JSON.parse(await readFile(join(OUT, 'results.json'), 'utf8'));
const pairs = JSON.parse(await readFile(join(OUT, 'pairwise_similarity.json'), 'utf8'));
const byId = Object.fromEntries(res.rules.map((r) => [r.id, r]));
const f = (x, d = 3) => x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d);
const pct = (x, d = 1) => x == null ? '—' : `${(x * 100).toFixed(d)}%`;
const p = (x) => x == null ? '—' : x < 0.001 ? '<0.001' : x.toFixed(3);
const cell = (s) => String(s ?? '—').replaceAll('|', '/');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

// 핵심 계산식(코드·기존 산출물 기준 요약)
const FORMULA = {
  'OP-A': '추첨 시각 달의 황도 별자리(12분기)로 나눈 뒤, 분기마다 1–1242에서 고른 특징식 6개(차·절댓값차·합·2a+b·곱; raw/spread 층) → wrap45, 중복은 +1',
  'OP-D': '15체계 후보 슬롯 33개 중 22개로 만든 1–3항 식 17,633개에서 상위 900개 → 탐욕 6레인 + 교체 2회로 1–1242 점수 최대 6식 고정',
  'OP-E': '운세 상태 특징 31개를 0–1 정규화 → k-means 12군집 → 군집마다 1–1242에서 고른 후보식 6개',
  'OP-F': '같은 상태벡터(주기형은 원형 거리)로 그 이전 회차 중 가장 비슷한 10회 → 그 당첨번호 출현 최다 6개(동률 작은 번호)',
  'OP-H': '금성×라후 황경, 달 황경, ⌊(금성 황경+일)/2⌋, 천왕성 황경×요일, 2×일+연중일수, 목성×토성 황경 → 각각 wrap45',
  'OP-S1': '33개 슬롯 번호의 득표수 내림차순 상위 6(동률 작은 번호)',
  'OP-S2': '2표 이상 번호 우선 → 그룹 안 득표수 → 작은 번호',
  'OP-S3': '그 번호를 낸 서로 다른 체계 수 → 득표수 → 작은 번호',
  'M-B': '후보식 17,633개 중 단독 성적 상위 식 6개를 레인별로 고정',
  'M-C': '번호별 점수 = 체계수×1 + 이웃 지지×1 + 파생식 지지×2 → 상위 6',
  'M-G': '직전 회차 번호·날짜·회차 번호로 만든 기호식 6개(운세 미사용 대조군)',
  'M-I': 'A·E 티켓 합집합에서 A 2점·E 1점·일치 1점 가중 상위 6',
  'V-Dexact': 'D와 같은 탐색, 정확 walk-forward 재실행', 'V-Aexact': 'A와 같은 탐색, 정확 walk-forward 재실행', 'V-Eexact': 'E와 같은 탐색, 정확 walk-forward 재실행',
  'V-Dalias': 'D에서 값열이 같은 후보를 하나로 합침', 'V-Dtie': 'D에서 동점을 해시 순으로 자름', 'V-Dunique': 'D에서 같은 식의 레인 중복 금지', 'V-D4term': 'D에 4항 식 추가',
  'V-J15': '15체계를 모두 한 번 이상 쓰도록 강제한 6식', 'V-U33': '33개 후보 전부에서 자유 선택한 6식', 'V-Dall33': 'D 탐색 풀을 33후보 상위 2,500식으로', 'V-Ddiverse': '체계별 균형 라운드로빈 풀 2,500식',
  'L-S1': 'S1 규칙 그대로, 슬롯만 최신 엔진', 'L-S2': 'S2 규칙 그대로, 슬롯만 최신 엔진', 'L-S3': 'S3 규칙 그대로, 슬롯만 최신 엔진', 'L-F': 'F 규칙 그대로, 상태벡터만 최신 엔진',
  'LV-전체': '창마다 학습 구간 끝 200회로 득표·지지·슬롯가중·체계가중 66개 설정 중 선택 후 재적합', 'LV-득표': '체계를 전진선택으로 늘리며 득표(±1 확장 0/0.25/0.5) 설정 선택',
  'LV-체계지지': '전진선택 체계 집합의 체계 지지수 순위', 'LV-슬롯가중': '학습 구간 슬롯 적중률(축소 추정) 가중 득표', 'LV-체계가중': '학습 구간 체계 적중률(축소 추정) 가중 득표',
  'FV-전체': 'LV-전체와 같은 절차, 고정 엔진 슬롯', 'HS-hotAll': '이전 전 회차 출현 최다 6', 'HS-hot52': '직전 52회 출현 최다 6', 'HS-cold52': '직전 52회 출현 최소 6', 'HS-overdue': '가장 오래 안 나온 6', 'HS-repeat': '직전 회차 6개 그대로', RND: '고정 시드 무작위 6개',
};
const formulaOf = (r) => FORMULA[r.id] ?? (r.id.startsWith('SYS-') ? `${r.name.replace(' 단독(슬롯+이웃 채움)', '')} 슬롯 번호(슬롯 순서) → 6개 미만이면 각 번호의 ±1, ±2… 이웃으로 채움` : r.id.startsWith('LM-') ? `${r.code} 방법론을 최신 엔진 특징값으로 처음부터 재탐색(창마다 이전 회차만)` : r.name);

const evalRules = res.rules.filter((r) => r.id !== 'RND');
const L = [];
L.push('# 로또 전체 규칙 재검증 보고서 (연구 전용)', '');
L.push(`생성: ${res.generatedAt.slice(0, 10)} · 절차: \`${res.protocol}\`(실행 전 고정) · 코드: \`run-rule-revalidation.mjs\``, '');
L.push('> 운영 모델·고정 엔진·저장 예측·운영 화면은 읽기만 했다. 이 보고서의 어떤 수치도 미래 당첨 예측력의 증거로 쓰지 않는다.', '');

// 0. 결론
const rel = res.reliable.map((id) => byId[id]); const mon = res.monitor.map((id) => byId[id]);
const best = (k) => [...evalRules].filter((r) => r.stats[k]).sort((a, b) => b.stats[k].z - a.stats[k].z)[0];
L.push('## 0. 결론', '');
L.push(`- 평가한 규칙 ${res.rules.length}개(무작위 대조 1개 포함). **사전 기준을 모두 통과한 신뢰 규칙: ${rel.length}개.**${rel.length < 5 ? ' 5개를 억지로 채우지 않는다.' : ''}`);
L.push(`- 최종 평가 구간(1101–1245) 최고 규칙은 ${best('holdout').id}(${best('holdout').name}) 평균 ${f(best('holdout').stats.holdout.mean)}개, 다중검정 보정 p=${p(best('holdout').stats.holdout.pMaxT)}. 무작위 기대 0.800개.`);
L.push(`- 고정 시드 무작위 티켓(RND)도 개발 구간에서 평균 ${f(byId.RND.stats.dev.mean)}개(p=${p(byId.RND.stats.dev.pMean)})로 대부분의 규칙보다 높았다 — 이 정도 차이는 우연으로 흔히 생긴다.`);
L.push(`- 운영 교체 권고 없음. 아래 "전향 관찰 후보"는 예측력이 입증된 규칙이 아니라, 1246회부터 추첨 전 저장으로 비교해 볼 만한 서로 다른 규칙 ${mon.length}개다.`, '');

// 1. 엔진 구분
L.push('## 1. 엔진 구분', '');
L.push(table(['구분', '내용'], [
  ['고정 엔진', `${res.engines.frozen} — 운영 A·D·E·F·H·S1–S3 와 기존 연구 산출물`],
  ['최신 엔진', `public/unse/src 트리 ${res.engines.latest.tree.slice(0, 12)}${res.engines.latest.dirty ? ' (작업 중 변경 있음)' : ''} — 신규 후보 전용`],
  ['같은 조건 아님', '두 엔진의 후보 슬롯·상태값이 다르므로 성적을 같은 규칙의 반복 측정으로 합치지 않는다'],
]), '');
L.push('최신 엔진에서 값이 바뀐 15체계 후보 슬롯(1–1245회 중):', '');
L.push(table(['슬롯', '바뀐 회차 수'], Object.entries(res.engineDiff).map(([k, v]) => [k, v])), '');
L.push('운영 고정 공식에 최신 엔진 입력을 넣으면 티켓이 달라지는 회차 수(그래서 운영은 고정 엔진 유지):', '');
L.push(table(['모델', '다른 티켓 회차'], Object.entries(res.ticketDiff).map(([k, v]) => [k, v])), '');

// 2. 전체 규칙 목록
L.push('## 2. 전체 규칙 목록과 핵심 계산식', '');
L.push(table(['ID', '이전 이름', '설명형 이름', '구분', '엔진', '기존/신규', '학습', '공정 평가 방식', '핵심 계산식'],
  res.rules.map((r) => [r.id, r.code, r.name, r.group, r.engine, r.origin, r.trained ? '있음' : '없음', r.evaluation, formulaOf(r)])), '');
L.push('평가 없이 제외한 연구:', '');
L.push(table(['ID', '규칙', '제외 이유', '출처', '표본 내 참고'], res.excludedWithoutEvaluation.map((x) => [x.id, x.name, x.reason, x.source, x.inSample ? `1–1242 평균 ${f(x.inSample.mean)}(학습 재사용)` : '—'])), '');

// 3. 성과
const head = ['ID', '설명형 이름', '개발 601–1100 평균', '개발 3+', '개발 p', '최종 1101–1245 평균', '최종 3+', '최종 p', '최종 보정 p(max-T)', '최종 Holm p', '점수(최종)', '무작위 점수 기대'];
L.push('## 3. 과거 적중 성과(표본 외만)', '');
L.push('p 는 공정 추첨에서 그 평균 이상이 나올 단측 확률(정확 초기하). 보정 p 는 같은 구간에서 평가한 모든 규칙 중 최고값 분포(가상 공정 추첨 1만 회)로 다중검정을 반영한 값.', '');
L.push(table(head, evalRules.concat([byId.RND]).map((r) => { const d = r.stats.dev, h = r.stats.holdout; return [r.id, r.name, f(d?.mean), pct(d?.ge3Rate), p(d?.pMean), f(h?.mean), pct(h?.ge3Rate), p(h?.pMean), p(h?.pMaxT), p(h?.pHolm), h?.score, f(h?.randomScore, 0)]; })), '');
L.push('### 3-1. 학습 없는 규칙의 전 구간(1–1245) 성과', '');
L.push(table(['ID', '설명형 이름', '회차', '평균', '0/1/2/3/4/5/6', '3+', '3+ p', 'p', '보정 p(max-T)', '1–600 평균'], res.rules.filter((r) => r.fullEligible).map((r) => { const s = r.stats.full; return [r.id, r.name, s.rounds, f(s.mean), s.hist.join('/'), pct(s.ge3Rate), p(s.pGe3), p(s.pMean), p(s.pMaxT), f(r.stats.early?.mean)]; })), '');
L.push('### 3-2. 최종 평가 구간 적중 분포(0–6개)', '');
L.push(table(['ID', '회차', '0', '1', '2', '3', '4', '5', '6', '3+ 횟수', '3+ p'], evalRules.filter((r) => r.stats.holdout).map((r) => { const s = r.stats.holdout; return [r.id, s.rounds, ...s.hist, s.ge3, p(s.pGe3)]; })), '');
L.push(`무작위 기대 분포(1회): ${res.random.pmf.map((x, k) => `${k}개 ${pct(x, 3)}`).join(' · ')}. 3개 이상 ${pct(res.random.ge3, 2)}.`, '');
L.push('### 3-3. 학습형 규칙의 표본 내(1–1242) 성적 — 참고만', '');
L.push('같은 데이터로 식을 고르고 같은 데이터로 채점한 값이라 예측력 근거가 아니다. 표본 외 값과의 차이가 과최적화 크기다.', '');
L.push(table(['ID', '설명형 이름', '표본 내 평균', '표본 내 3+', '표본 외 평균(WF 전체)', '차이'], res.rules.filter((r) => r.inSampleStats).map((r) => [r.id, r.name, f(r.inSampleStats.mean), pct(r.inSampleStats.ge3Rate), f(r.stats.full?.mean), f(r.inSampleStats.mean - (r.stats.full?.mean ?? NaN))])), '');

// 4. Walk-forward·안정성
L.push('## 4. 창별 성과와 안정성', '');
const wr = res.windows.map(([a, b]) => `${a}-${b}`);
L.push(table(['ID', ...wr, '0.8 초과 창 / 평가 창'], evalRules.concat([byId.RND]).map((r) => { const ws = r.windows.filter((w) => w.rounds); return [r.id, ...r.windows.map((w) => w.rounds ? f(w.mean, 2) : '—'), `${ws.filter((w) => w.mean > 0.8).length}/${ws.length}`]; })), '');
// 개발 성적이 최종 성적을 예측하는가
const both = evalRules.filter((r) => r.stats.dev && r.stats.holdout);
const rank = (arr) => { const s = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = Array(arr.length); s.forEach(([, i], k) => { r[i] = k; }); return r; };
const rd = rank(both.map((r) => r.stats.dev.mean)), rh = rank(both.map((r) => r.stats.holdout.mean));
const n = both.length, mean = (a) => a.reduce((s, v) => s + v, 0) / a.length; const md = mean(rd), mh = mean(rh);
const rho = rd.reduce((s, v, i) => s + (v - md) * (rh[i] - mh), 0) / Math.sqrt(rd.reduce((s, v) => s + (v - md) ** 2, 0) * rh.reduce((s, v) => s + (v - mh) ** 2, 0));
const zs = both.map((r) => r.stats.holdout.z);
const top10 = [...both].sort((a, b) => b.stats.dev.mean - a.stats.dev.mean).slice(0, 10);
L.push('### 4-1. 개발 구간 성적이 최종 구간 성적을 예측하는가(과최적화 점검)', '');
L.push(table(['항목', '값', '해석'], [
  ['개발 평균 순위 ↔ 최종 평균 순위 스피어만 상관', f(rho), `규칙 ${n}개. 0 근처면 개발에서 좋았던 규칙이 최종에서도 좋다는 근거가 없음`],
  ['개발 상위 10개 규칙의 개발 평균', f(mean(top10.map((r) => r.stats.dev.mean))), '선택된 값이라 위로 치우침'],
  ['같은 10개 규칙의 최종 평균', f(mean(top10.map((r) => r.stats.holdout.mean))), '무작위 0.800과 비교'],
  ['최종 구간 z 값 평균 / 표준편차', `${f(mean(zs), 2)} / ${f(Math.sqrt(mean(zs.map((z) => (z - mean(zs)) ** 2))), 2)}`, '규칙들이 서로 겹쳐 독립이 아님. 무작위면 평균 0 근처'],
  ['가족 단위 5% 임계 z(개발 / 최종 / 전 구간)', `${f(res.multi.dev.maxZ95, 2)} / ${f(res.multi.holdout.maxZ95, 2)} / ${f(res.multi.full.maxZ95, 2)}`, '이 이상이어야 여러 규칙을 시험한 우연을 넘음'],
]), '');

// 5. 슬롯 단위
L.push('## 5. 15체계 후보 슬롯 단위 검정', '');
L.push('슬롯 번호 1개가 그 회차 당첨 6개 안에 들 확률은 공정 추첨에서 6/45=13.33%. 1–1245 전 회차 기준, 66개(33슬롯×2엔진) 본페로니 보정.', '');
const slots = ['frozen', 'latest'].flatMap((e) => res.slotTests[e].map((s) => ({ ...s, engine: e })));
L.push(table(['엔진', '슬롯', '전 구간 포함률', '개발', '최종', 'p', '보정 p'], slots.sort((a, b) => a.pFull - b.pFull).slice(0, 15).map((s) => [s.engine === 'frozen' ? '고정' : '최신', s.slot, pct(s.full, 2), pct(s.dev, 2), pct(s.holdout, 2), p(s.pFull), p(s.pBonferroni)])), '');
L.push(`보정 p<0.05 슬롯: ${slots.filter((s) => s.pBonferroni < 0.05).length}개 (상위 15개만 표시).`, '');

// 6. 중복·유사
L.push('## 6. 중복·유사 규칙', '');
L.push('최종 평가 구간에서 같은 회차 티켓의 평균 공통 번호 수(무작위끼리 기대 0.80). 3 이상이면 사실상 같은 규칙으로 본다.', '');
const dup = pairs.filter((x) => x.meanCommon >= 3 && x.a !== 'RND' && x.b !== 'RND').sort((a, b) => b.meanCommon - a.meanCommon);
L.push(table(['규칙 A', '규칙 B', '평균 공통 번호', '완전 동일 티켓', '회차별 적중 상관'], dup.map((x) => [x.a, x.b, f(x.meanCommon, 2), pct(x.identical), f(x.hitCorr, 2)])), '');
L.push('### 6-1. 규칙별 후보번호 중복률', '');
L.push(table(['ID', '가장 비슷한 규칙', '평균 공통 번호', '동일 티켓', '다른 규칙과 겹치는 번호 비율'], evalRules.map((r) => [r.id, r.nearest?.id, f(r.nearest?.meanCommon, 2), pct(r.nearest?.identical), pct(r.sharedRate)])), '');

// 7. 최종 선정
L.push('## 7. 최종 선정', '');
L.push(`### 7-1. 신뢰 규칙: ${rel.length}개`, '');
if (!rel.length) L.push('사전 기준(개발 p<0.05 + 최종 보정 p<0.05 + 학습 없는 규칙은 전 구간 보정 p<0.05)을 모두 통과한 규칙이 없다. 따라서 "예측력이 있는 5개"는 선정하지 않는다.', '');
else L.push(table(['ID', '이름', '개발 평균', '최종 평균', '최종 보정 p'], rel.map((r) => [r.id, r.name, f(r.stats.dev.mean), f(r.stats.holdout.mean), p(r.stats.holdout.pMaxT)])), '');
L.push(`### 7-2. 전향 관찰 후보 ${mon.length}개(예측력 미입증, 1246회부터 비교용)`, '');
L.push('선정은 개발 구간 정보만 사용: 과최적화 위험 낮은 순 → 개발 평균 높은 순 → 이미 고른 후보와 평균 공통 번호 1.5 미만. 최종 구간 값은 선정 후 보고만 했다.', '');
L.push(table(['순서', 'ID', '설명형 이름', '엔진', '학습', '개발 평균(p)', '최종 평균(보정 p)', '전 구간 평균', '선정 이유', '주의'], mon.map((r, i) => [i + 1, r.id, r.name, r.engine, r.trained ? '있음' : '없음', `${f(r.stats.dev.mean)} (${p(r.stats.dev.pMean)})`, `${f(r.stats.holdout?.mean)} (${p(r.stats.holdout?.pMaxT)})`, f(r.stats.full?.mean),
  `학습 없음·재현 쉬움, 개발 평균 ≥ 0.8, 다른 후보와 번호가 거의 안 겹침`, r.stats.dev.pMean < 0.05 ? '개발만 유의' : '개발 구간도 무작위와 구별 안 됨'])), '');
L.push('선정 과정 기록:', '');
L.push(table(['검토 순서', 'ID', '위험', '개발 평균', '기존 후보와 최대 공통', '선정'], res.monitorLog.map((x, i) => [i + 1, x.id, x.risk, f(x.devMean), f(x.maxOverlapWithChosen, 2), x.picked ? '선정' : '중복으로 제외'])), '');
L.push('### 7-3. 탈락 규칙과 이유', '');
L.push(table(['ID', '설명형 이름', '탈락 이유'], evalRules.filter((r) => !res.reliable.includes(r.id) && !res.monitor.includes(r.id)).map((r) => [r.id, r.name, r.verdict + (r.nearest?.meanCommon >= 3 ? ` · ${r.nearest.id}와 사실상 중복` : '')])), '');

// 8. 향후 검증
L.push('## 8. 실제 회차 전향 검증 방법', '');
L.push(table(['항목', '방법'], [
  ['저장', '추첨 전에 티켓·엔진 버전·코드 커밋을 저장(현행 운영 방식). 저장 후 변경 금지'],
  ['비교 대상', '운영 8개(A·D·E·F·H·S1–S3) + 승인 시 전향 관찰 후보. 같은 회차에 무작위 티켓 1장도 함께 저장해 대조'],
  ['판정 지표', '누적 평균 적중과 정확 초기하 단측 p. 규칙 수만큼 Holm 보정'],
  ['필요 회차', `평균 0.1개 개선(0.9 vs 0.8)을 5% 유의·80% 검정력으로 확인하려면 약 ${Math.ceil(((1.645 + 0.842) ** 2 * res.random.variance) / 0.01)}회(약 ${Math.round(((1.645 + 0.842) ** 2 * res.random.variance) / 0.01 / 52)}년). 0.05개 개선이면 약 4배`],
  ['사전 고정', '판정 시점(예: 100회·250회·500회)과 기준을 지금 정하고 중간에 바꾸지 않는다'],
  ['중단·교체 규칙', '보정 p<0.05 를 넘기 전에는 어떤 규칙도 "예측력 있음"으로 표시하지 않는다'],
]), '');

L.push('## 9. 한계', '');
L.push('- 1101–1242 는 이전 연구에서 이미 여러 번 본 구간이다. 진짜 미관측 검증은 1246회 이후뿐이다.');
L.push('- 학습형 규칙의 표본 외 성적은 기존에 저장된 walk-forward 티켓을 사용했다(기존 결과 재계산·수정 없음). A·D·E·H 의 1243–1245 는 2026-09-23 고정본의 전향 티켓, S1–S3 의 1243–1245 는 10-11 추가라 사후 재계산이다.');
L.push('- DB 에 저장된 운영 예측값은 직접 읽지 않고 고정 엔진으로 다시 계산했다(F 는 1–1245 전 회차 운영 코드와 일치 검사 통과).');
L.push('- 추첨 시각은 공식 편성 시각이며 실제 기계 추첨 순간이 아니다.', '');
L.push('## 재현', '', '```bash', 'LATEST_WF=1 node analysis/fortune-lotto/run-rule-revalidation.mjs   # 결과 JSON (수 분)', 'node analysis/fortune-lotto/make-rule-revalidation-report.mjs      # 이 보고서', '```', '');
L.push('무작위 시드가 고정돼 있어 같은 엔진 트리에서는 같은 결과가 나온다(generatedAt 만 다름).');
await writeFile(join(OUT, 'report.md'), L.join('\n'));
console.log('report.md', L.length, 'lines');
