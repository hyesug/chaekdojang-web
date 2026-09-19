/**
 * draws.js — 로또 6/45 과거 당첨번호
 *
 * 이 사이트는 정적 파일로만 돌아간다. 서버도 DB도 없어서 회차 데이터를
 * 자바스크립트 모듈로 그냥 들고 있는다. 천이백 회차라도 30KB 남짓이다.
 *
 * 형식: 오래된 회차부터, 한 줄에 한 회차. 여섯 개는 오름차순.
 *   [회차, 'YYYY-MM-DD', n1, n2, n3, n4, n5, n6]
 *
 * ── 채우는 방법 ──
 * 동행복권의 비공식 JSON 주소(common.do?method=getLottoNumber)는 2026년
 * 사이트 개편 이후 JSON 대신 HTML 을 돌려준다. 자동 수집이 막혀 있다.
 * 동행복권 홈페이지에서 회차별 당첨번호를 내려받아
 *   node scripts/lotto-import.mjs <파일.csv>
 * 를 돌리면 이 파일이 채워진다. 그다음
 *   node scripts/lotto-verify.mjs
 * 로 검증을 돌려 data/lotto-model.js 를 갱신한다.
 *
 * 비어 있어도 사이트는 그대로 돌아간다. 통계만 꺼진다.
 */

/** @type {Array<[number, string, number, number, number, number, number, number]>} */
export const DRAW_ROWS = [];

/** 검증·통계가 쓰는 형태 — 번호 여섯 개 배열만, 오래된 것부터 */
export const DRAWS = DRAW_ROWS.map((r) => r.slice(2));

/** 가장 최근 회차 번호. 없으면 0 */
export const LATEST_ROUND = DRAW_ROWS.length ? DRAW_ROWS[DRAW_ROWS.length - 1][0] : 0;
