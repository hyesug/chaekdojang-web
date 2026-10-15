// 로또 순위표용 고전점성술 후보 슬롯: 추첨 순간(서울)의 로트·2하우스 주인을 1–45로 편다.
// 최신 운세 엔진(public/unse/src/hires/classical.js)을 그대로 쓴다. 고정 엔진에는 이 체계가 없다.
import { normalizeBirth } from '../../public/unse/src/core/time.js';
import { findCity } from '../../public/unse/src/core/place.js';
import { planetPositions, houses } from '../../public/unse/src/core/planets.js';
import { sectOf, lots, SEVEN, DOMICILE } from '../../public/unse/src/hires/classical.js';
import { signOf } from '../../public/unse/src/systems/astrology.js';

const SEOUL = findCity('서울');
const spread = (raw, max) => Math.min(45, Math.max(1, Math.floor((((raw - 1) % max + max) % max) / max * 45) + 1));

export function classicalSlots({ year, month, day, hour, minute }) {
  const birth = normalizeBirth({ year, month, day, hour, minute, place: SEOUL });
  const pos = planetPositions(birth.jdUT);
  const h = houses(birth.jdUT, SEOUL.lat, SEOUL.lon);
  const raw = lots(pos, h, sectOf(pos, h));
  const deg = (lon) => Math.floor(lon) + 1;
  return {
    'classical.c1_lot_fortune': spread(deg(raw.fortune), 360),
    'classical.c2_lot_spirit': spread(deg(raw.spirit), 360),
    'classical.c3_lot_substance': spread(deg(raw.substance), 360),
    'classical.c4_second_lord': spread(SEVEN.indexOf(DOMICILE[signOf(h.cusps[2])]) + 1, 7),
  };
}
