#!/usr/bin/env node
/**
 * lotto-import.mjs — 당첨번호 파일을 draws.js 로 넣는다
 *
 * 동행복권의 비공식 JSON 주소는 2026년 개편 이후 JSON 대신 HTML 을 돌려준다.
 * 자동 수집이 막혀 있어서, 홈페이지에서 회차별 당첨번호를 내려받아 이걸로 넣는다.
 *
 *   node scripts/lotto-import.mjs 로또당첨번호.csv
 *
 * CSV/TSV 를 읽는다. 엑셀(xlsx)이면 엑셀에서 "다른 이름으로 저장 → CSV" 한 번만
 * 거치면 된다. 열 이름을 찾아 맞추므로 열 순서는 달라도 된다.
 *
 * 찾는 열: 회차 / 추첨일 / 당첨번호 여섯 개
 *   - 회차, 회차번호, round, drwNo
 *   - 추첨일, 날짜, date, drwNoDate
 *   - 번호1~6, 당첨번호1~6, n1~n6, drwtNo1~6
 *
 * 읽은 뒤 검증한다. 1~45 밖이거나 중복이거나 회차가 겹치면 그 줄은 버리고 보고한다.
 * 쓰레기가 섞여 들어가면 그 뒤의 통계 검증이 전부 무의미해지기 때문이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/unse-8f3k2m/src/data/draws.js');

const src = process.argv[2];
if (!src) {
  console.error('사용법: node scripts/lotto-import.mjs <당첨번호.csv>');
  process.exit(1);
}

// ── 읽기 ──
let text = fs.readFileSync(src);
// 엑셀에서 저장한 CSV 는 대개 EUC-KR 이다. BOM 이 없고 한글이 깨지면 euc-kr 로 다시 읽는다.
let decoded = new TextDecoder('utf-8').decode(text);
if (/�/.test(decoded)) {
  try { decoded = new TextDecoder('euc-kr').decode(text); } catch { /* 그대로 둔다 */ }
}
const lines = decoded.split(/\r?\n/).filter((l) => l.trim());
if (!lines.length) { console.error('빈 파일입니다.'); process.exit(1); }

const split = (l) => (l.includes('\t') ? l.split('\t') : l.split(',')).map((c) => c.trim().replace(/^"|"$/g, ''));

// 헤더 줄 찾기 — 첫 스무 줄 안에 '회차' 비슷한 말이 있는 줄
const norm = (s) => s.replace(/\s/g, '').toLowerCase();
const ROUND_KEYS = ['회차', '회차번호', 'round', 'drwno'];
const DATE_KEYS = ['추첨일', '날짜', '추첨일자', 'date', 'drwnodate'];
const numKeys = (i) => [`번호${i}`, `당첨번호${i}`, `n${i}`, `drwtno${i}`, `${i}번`];

let headerAt = -1, cols = null;
for (let i = 0; i < Math.min(20, lines.length); i++) {
  const c = split(lines[i]).map(norm);
  if (c.some((x) => ROUND_KEYS.includes(x))) { headerAt = i; cols = c; break; }
}
if (headerAt < 0) {
  console.error('헤더에서 "회차" 열을 찾지 못했습니다. 파일 첫 줄을 확인해 주세요.');
  process.exit(1);
}

const find = (keys) => cols.findIndex((c) => keys.some((k) => c === norm(k)));
const iRound = find(ROUND_KEYS);
const iDate = find(DATE_KEYS);
const iNums = [1, 2, 3, 4, 5, 6].map((i) => find(numKeys(i)));
if (iNums.some((x) => x < 0)) {
  console.error('당첨번호 여섯 열을 찾지 못했습니다. 찾은 열:', cols.join(' | '));
  process.exit(1);
}

// ── 검증하며 담기 ──
const seen = new Set();
const rows = [];
const rejected = [];

for (let i = headerAt + 1; i < lines.length; i++) {
  const c = split(lines[i]);
  const round = Number(String(c[iRound]).replace(/[^\d]/g, ''));
  const nums = iNums.map((k) => Number(c[k]));
  const date = iDate >= 0 ? String(c[iDate]).replace(/[^\d]/g, '') : '';

  const bad =
    !Number.isInteger(round) || round < 1 ? '회차 없음'
      : seen.has(round) ? '회차 중복'
        : nums.some((n) => !Number.isInteger(n) || n < 1 || n > 45) ? '번호가 1~45 밖'
          : new Set(nums).size !== 6 ? '번호 중복'
            : null;
  if (bad) { if (c.join('').trim()) rejected.push(`${round || '?'}회: ${bad}`); continue; }

  seen.add(round);
  const iso = date.length === 8 ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : '';
  rows.push([round, iso, ...nums.sort((a, b) => a - b)]);
}

rows.sort((a, b) => a[0] - b[0]);

if (!rows.length) { console.error('쓸 수 있는 줄이 없습니다.'); process.exit(1); }

// 회차가 중간에 비었으면 알려준다 — 빠진 회차가 있으면 시계열 통계가 틀어진다
const gaps = [];
for (let i = 1; i < rows.length; i++) {
  if (rows[i][0] !== rows[i - 1][0] + 1) gaps.push(`${rows[i - 1][0]} → ${rows[i][0]}`);
}

// ── 쓰기 ──
const header = fs.readFileSync(OUT, 'utf8').split('/** @type')[0];
const body = rows.map((r) => `  [${r[0]}, '${r[1]}', ${r.slice(2).join(', ')}],`).join('\n');
fs.writeFileSync(OUT, `${header}/** @type {Array<[number, string, number, number, number, number, number, number]>} */
export const DRAW_ROWS = [
${body}
];

/** 검증·통계가 쓰는 형태 — 번호 여섯 개 배열만, 오래된 것부터 */
export const DRAWS = DRAW_ROWS.map((r) => r.slice(2));

/** 가장 최근 회차 번호. 없으면 0 */
export const LATEST_ROUND = DRAW_ROWS.length ? DRAW_ROWS[DRAW_ROWS.length - 1][0] : 0;
`);

console.log(`${rows.length}개 회차를 넣었습니다 (${rows[0][0]} ~ ${rows[rows.length - 1][0]}회).`);
if (rejected.length) console.log(`버린 줄 ${rejected.length}개:`, rejected.slice(0, 10).join(', '), rejected.length > 10 ? '…' : '');
if (gaps.length) console.log(`⚠ 빠진 회차가 있습니다: ${gaps.slice(0, 5).join(', ')}${gaps.length > 5 ? ' …' : ''}`);
console.log('다음: node scripts/lotto-verify.mjs');
