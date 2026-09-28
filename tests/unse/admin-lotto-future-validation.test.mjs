import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("지난 추첨 회차에는 prediction revision 버튼을 렌더링하지 않는다", async () => {
  const source = await readFile(new URL("../../app/admin/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const drawHasPassed = hasLottoDrawPassed\(current\);/);
  assert.match(source, /!drawHasPassed && <>[\s\S]{0,500}?수정 모델 revision/);
  assert.match(source, /drawHasPassed && <button[\s\S]{0,500}?실제번호 입력/);
});
