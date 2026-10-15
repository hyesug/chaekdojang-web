import test from 'node:test';
import assert from 'node:assert/strict';
import { PMF, MEAN0, exactTail, systemTicket, historyTicket, normTicket, hitCount } from './run-rule-revalidation.mjs';

test('초기하 기준: 확률 합 1, 평균 0.8, 1회 꼬리확률 일치', () => {
  assert.ok(Math.abs(PMF.reduce((s, x) => s + x, 0) - 1) < 1e-12);
  assert.ok(Math.abs(PMF.reduce((s, x, k) => s + x * k, 0) - MEAN0) < 1e-12);
  assert.ok(Math.abs(exactTail(1, 3) - (PMF[3] + PMF[4] + PMF[5] + PMF[6])) < 1e-12);
  assert.equal(exactTail(10, 0), 1);
  // 평균(8) 이상일 확률은 절반 안팎
  assert.ok(exactTail(10, 8) > 0.4 && exactTail(10, 8) < 0.6);
});

test('체계 단독 규칙: 그 체계 슬롯만 쓰고 이웃으로 6개를 채운다', () => {
  const c = { 'taeeul.c1_cycle': 45, 'saju.c1': 3, 'saju.c2': 3 };
  assert.deepEqual(systemTicket(c, 'taeeul'), [45, 1, 44, 2, 43, 3]);
  assert.deepEqual(systemTicket(c, 'saju'), [3, 4, 2, 5, 1, 6]);
  assert.deepEqual(normTicket(systemTicket(c, 'taeeul')), [1, 2, 3, 43, 44, 45]);
});

test('이력 통계 규칙은 넘겨받은 과거 회차만 본다', () => {
  const rows = [[1, 2, 3, 4, 5, 6], [1, 2, 3, 7, 8, 9]];
  assert.deepEqual(historyTicket('repeat', rows), [1, 2, 3, 7, 8, 9]);
  assert.deepEqual(historyTicket('hotAll', rows).slice(0, 3), [1, 2, 3]);
  assert.ok(historyTicket('overdue', rows).every((n) => n >= 10));
  assert.equal(hitCount([1, 2, 3, 4, 5, 6], [4, 5, 6, 7, 8, 9]), 3);
});

test('잘못된 티켓은 거부한다', () => {
  assert.throws(() => normTicket([1, 1, 2, 3, 4, 5]));
  assert.throws(() => normTicket([0, 1, 2, 3, 4, 5]));
});
