import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('공개 운세 결과 화면은 로또 UI를 렌더링하지 않는다', async () => {
  const source = await readFile(new URL('../../public/unse-8f3k2m/src/ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /pickNumbers/);
  assert.doesNotMatch(source, /lottoSection/);
  assert.doesNotMatch(source, /data-lt/);
});
