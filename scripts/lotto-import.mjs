#!/usr/bin/env node
/**
 * lotto-import.mjs — 당첨번호 파일을 draws.js 로 넣는다
 *
 * 동행복권의 비공식 JSON 주소도, 엑셀 내려받기 주소도 2026년 개편 이후 HTML 만
 * 돌려준다. 자동 수집이 막혀 있어서 파일을 받아 넣는다.
 *
 *   node scripts/lotto-import.mjs                  # 공개 데이터셋에서 받아온다
 *   node scripts/lotto-import.mjs lotto.json       # 내려받은 JSON
 *   node scripts/lotto-import.mjs 로또당첨번호.csv  # 동행복권 엑셀 → CSV 저장본
 *
 * 인자가 없으면 아래 공개 데이터셋(MIT)에서 받는다. 당첨번호는 사실 기록이라
 * 저작권 대상이 아니고, 이 데이터셋은 주 단위로 갱신된다.
 *   https://github.com/jeong760/lotto-data
 *
 * CSV 는 열 이름을 찾아 맞추므로 열 순서가 달라도 된다.
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

const DATASET = 'https://raw.githubusercontent.com/jeong760/lotto-data/main/data/lotto-history.json';
const src = process.argv[2];

// ── 읽기 ──
let text;
if (!src) {
  console.log(`공개 데이터셋에서 받는 중…\n  ${DATASET}`);
  const res = await fetch(DATASET);
  if (!res.ok) {
    console.error(`받지 못했습니다 (HTTP ${res.status}). 파일을 직접 받아 인자로 넘겨주세요.`);
    process.exit(1);
  }
  text = Buffer.from(await res.arrayBuffer());
} else {
  text = fs.readFileSync(src);
}
// 엑셀에서 저장한 CSV 는 대개 EUC-KR 이다. BOM 이 없고 한글이 깨지면 euc-kr 로 다시 읽는다.
let decoded = new TextDecoder('utf-8').decode(text);
if (/�/.test(decoded)) {
  try { decoded = new TextDecoder('euc-kr').decode(text); } catch { /* 그대로 둔다 */ }
}

let isJson = false;

// ── JSON 이면 여기서 끝난다 ──
// { data: [{ drawNo, date, numbers: [6개] }, …] } 또는 그 배열 자체를 받는다.
if (decoded.trimStart().startsWith('{') || decoded.trimStart().startsWith('[')) {
  const parsed = JSON.parse(decoded);
  const list = Array.isArray(parsed) ? parsed : parsed.data;
  if (!Array.isArray(list)) { console.error('JSON 에서 회차 배열을 찾지 못했습니다.'); process.exit(1); }
  const rows = [], rejected = [];
  const seen = new Set();
  for (const r of list) {
    const round = Number(r.drawNo ?? r.round ?? r.no);
    const nums = (r.numbers ?? r.nums ?? []).map(Number);
    const bad =
      !Number.isInteger(round) || round < 1 ? '회차 없음'
        : seen.has(round) ? '회차 중복'
          : nums.length !== 6 ? '번호 개수'
            : nums.some((n) => !Number.isInteger(n) || n < 1 || n > 45) ? '번호가 1~45 밖'
              : new Set(nums).size !== 6 ? '번호 중복' : null;
    if (bad) { rejected.push(`${round || '?'}회: ${bad}`); continue; }
    seen.add(round);
    rows.push([round, String(r.date ?? '').slice(0, 10), ...nums.sort((a, b) => a - b)]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  writeOut(rows, rejected);
  // process.exit 을 쓰지 않는다 — fetch 연결이 아직 열려 있는 상태에서 끊으면
  // 윈도우에서 libuv 가 assertion 으로 죽고 종료코드가 9가 된다.
  isJson = true;
}

if (!isJson) parseCsv(decoded);

/** 동행복권 엑셀을 CSV 로 저장한 파일을 읽는다. 열 이름을 찾아 맞춘다. */
function parseCsv(decoded) {
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
writeOut(rows, rejected);
}

/** draws.js 를 새로 쓴다. 머리말 주석은 그대로 두고 데이터만 갈아 끼운다. */
function writeOut(rows, rejected) {
  if (!rows.length) { console.error('쓸 수 있는 줄이 없습니다.'); process.exit(1); }

  // 회차가 중간에 비었으면 알려준다 — 빠진 회차가 있으면 시계열 통계가 틀어진다
  const gaps = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== rows[i - 1][0] + 1) gaps.push(`${rows[i - 1][0]} → ${rows[i][0]}`);
  }
  // 추첨일이 1회차(2002-12-07 토)부터의 주간 주기와 맞는지. 어긋나면 회차↔날짜가 틀어진 것이다.
  const FIRST = Date.UTC(2002, 11, 7), WEEK = 7 * 86400000;
  const offDate = rows.filter((r) => r[1] && Date.parse(`${r[1]}T00:00:00Z`) !== FIRST + (r[0] - 1) * WEEK);

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
  if (offDate.length) console.log(`⚠ 추첨일이 주간 주기와 어긋난 회차 ${offDate.length}개: ${offDate.slice(0, 5).map((r) => r[0]).join(', ')}`);
  if (!gaps.length && !offDate.length) console.log('회차 연속성과 추첨일 주기 모두 정상입니다.');
  console.log('다음: node scripts/lotto-verify.mjs');
}
