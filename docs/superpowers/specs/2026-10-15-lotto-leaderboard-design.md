# 로또 미래검증 변동 순위표 설계

## 목적

기존 8개 모델(A·D·E·F·H·S1–S3)의 생성·저장·화면은 그대로 둔다. 연구(`analysis/fortune-lotto/ADAPTIVE_LEADERBOARD_PROTOCOL.md`)에서 정한 후보 규칙 57개를 매 회차 추첨 전에 계산하고, 그때까지의 성적으로 순위를 매겨 상위 5개를 관리자 "로또 미래검증" 화면에 보여 준다. 순위는 누적 성적이며 당첨 확률이 아니다(과거 검증에서 무작위와 차이 없음).

## 흐름

1. API 회차 생성(월 08:00 자동·관리자 버튼) → 기존 8개 저장 후 웹 `POST /api/internal/lotto-future-leaderboard` 호출.
2. 요청: 회차·추첨일시·당첨 이력(기존과 같음) + 1246회 이후 저장된 순위표 티켓과 당첨번호(`results`).
3. 웹: 1–1245회 기준선(`lib/lotto-future/leaderboard-baseline.json`, 연구 산출물에서 생성) + `results` 로 규칙별 누적 성적·규칙 간 공통 번호를 갱신 → 57개 티켓 계산 → 축소 평균 점수(K=100, 기록 100회 이상) 순위 → 같은 번호를 내는 규칙(과거 평균 공통 3개 이상)은 건너뛰며 상위 5개.
4. API: `lotto_future_leaderboard_entries` 에 규칙별 1행 저장(revision·active, 기존 예측과 같은 규칙). 생성 실패는 로그만 남기고 기존 8개 저장은 유지.
5. 추첨 시각 이전 생성분만 정식 성적. 추첨 후 당첨번호 입력 시 적중은 조회 때 계산.

## 저장 구조

`lotto_future_leaderboard_entries(prediction_round_id, revision, rule_id, numbers, rank, score, record_rounds, record_mean, recent_mean, top5_rank, model_version, engine_version, generated_at, active)`, `(prediction_round_id, rule_id, revision)` 유일, 활성 행 `(prediction_round_id, rule_id)` 유일.

## 계약 변경(추가만)

- 웹 내부 API 신설(같은 토큰).
- API 조회 `RoundResponse` 에 `leaderboard` 목록 추가(기존 필드 유지).
- API 관리자 `POST /api/admin/lotto-future-validations/{round}/leaderboard`: 추첨 전 회차의 순위표 (재)생성.
- 설정: `app.lotto-future.leaderboard-url`(비면 generator-url 의 `lotto-future-predictions` 를 `lotto-future-leaderboard` 로 바꿔 사용).

## 규칙 갱신

- N1–N4·득표 규칙군은 매 회차 새 당첨번호로 다시 학습한다. 최신 엔진 규칙은 그 시점 `public/unse/src` 로 계산하고 엔진 버전을 저장한다.
- 1–1245 기준선은 연구 시점 값으로 고정한다. 저장된 과거 티켓·순위는 다시 계산하지 않는다.
- 새 규칙 추가는 연구에서 walk-forward 기록 100회 이상을 만든 뒤 기준선을 다시 만들어 넣는다.

## 화면

이번 회차 상위 5개(규칙 설명명·순위 점수·누적 평균·번호·적중), 전체 순위 접기, 정식(추첨 전) 상위 5개 누적 성적과 무작위 기대 0.8 비교, 추첨 전 회차 "순위표 생성" 버튼. "순위 = 지금까지 성적, 예측력 미입증" 안내 고정.
