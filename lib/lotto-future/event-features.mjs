import { normalizeBirth } from '../../public/unse/src/core/time.js';
import { solarToLunar } from '../../public/unse/src/core/lunar.js';
import { computeFourPillars, sexagenaryIndex, elementDistribution } from '../../public/unse/src/core/ganzhi.js';
import { toJDN } from '../../public/unse/src/core/astro.js';
import { planetPositions, PLANET_ORDER, houses, toSidereal } from '../../public/unse/src/core/planets.js';
import { findCity } from '../../public/unse/src/core/place.js';
import { nakshatraOf } from '../../public/unse/src/systems/sukyo.js';
import { hexOf } from '../../public/unse/src/systems/juyeok.js';
import { monthGeneral, analyze as yukimAnalyze } from '../../public/unse/src/systems/yukim.js';
import { analyze as honggukAnalyze } from '../../public/unse/src/systems/hongguk.js';
import { starOfYear } from '../../public/unse/src/systems/gujeong.js';
import { analyze as tojeongAnalyze } from '../../public/unse/src/systems/tojeong.js';
import { analyze as tarotAnalyze } from '../../public/unse/src/systems/tarot.js';

const SEOUL = findCity('서울');
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
export const wrap45 = (x) => ((Math.floor(x) - 1) % 45 + 45) % 45 + 1;
export const spread = (raw, max) => Math.min(45, Math.max(1, Math.floor((((raw - 1) % max + max) % max) / max * 45) + 1));
const branch = (value) => Math.max(0, BRANCHES.indexOf(String(value).match(/[子丑寅卯辰巳午未申酉戌亥]/)?.[0]));
const number = (value) => Number(String(value).match(/\d+/)?.[0] ?? 0);
const fact = (result, label) => result.facts.find((entry) => entry.label === label)?.value ?? '';
const digitRoot = (value, keepMaster = true) => { let n = Math.abs(Math.trunc(value)); while (n > 9 && !(keepMaster && (n === 11 || n === 22))) n = String(n).split('').reduce((sum, digit) => sum + Number(digit), 0); return n; };

export function eventFeatures({ year, month, day, hour, minute }) {
  const birth = normalizeBirth({ year, month, day, hour, minute, place: SEOUL });
  const chart = computeFourPillars(birth.jdUT, birth.jdTST, { timeKnown: true });
  const lunar = solarToLunar(year, month, day);
  const input = { y: year, m: month, d: day, year, month, day, hour, minute, place: SEOUL, timeKnown: true, jdUT: birth.jdUT, jdTST: birth.jdTST, lunar, chart,
    sajuYear: chart.sajuYear, sectorIndex: chart.sector.index, yearStem: chart.pillars.year.stem, yearBranch: chart.pillars.year.branch,
    monthStem: chart.pillars.month.stem, monthBranch: chart.pillars.month.branch, dayStem: chart.pillars.day.stem, dayBranch: chart.pillars.day.branch,
    hourStem: chart.pillars.hour.stem, hourBranch: chart.pillars.hour.branch, currentYear: chart.sajuYear, civilYear: year, age: 0, elapsedYears: 0, nowJD: birth.jdUT };
  const values = {}, max = {};
  const add = (id, raw, ceiling) => { values[id] = raw; max[id] = ceiling; };
  const p = chart.pillars;
  for (const key of ['year', 'month', 'day', 'hour']) {
    add(`saju.${key}_stem`, p[key].stem + 1, 10); add(`saju.${key}_branch`, p[key].branch + 1, 12);
    add(`saju.${key}_sexagenary`, sexagenaryIndex(p[key].stem, p[key].branch) + 1, 60);
  }
  elementDistribution(p).count.forEach((count, index) => add(`saju.element_${index}`, count, 8));
  add('saju.solar_term_sector', chart.sector.index + 1, 24);
  const lm = lunar.month, ld = lunar.day, hb = input.hourBranch;
  const myeong = ((lm + 1 - hb) % 12 + 12) % 12, sin = ((lm + 1 + hb) % 12 + 12) % 12;
  const yearStem = ((input.sajuYear - 4) % 10 + 10) % 10, inStem = ((yearStem % 5) * 2 + 2) % 10, myeongStem = ((inStem + myeong - 2) % 10 + 10) % 10;
  let sexa = 0; for (let index = 0; index < 60; index++) if (index % 10 === myeongStem && index % 12 === myeong) { sexa = index; break; }
  const nayeum = [3,1,0,2,3,1,4,2,3,0,4,2,1,0,4,3,1,0,2,3,1,4,2,3,0,4,2,1,0,4]; const guk = ({ 4: 2, 0: 3, 3: 4, 2: 5, 1: 6 })[nayeum[Math.floor(sexa / 2)]];
  const mok = Math.ceil(ld / guk), rem = mok * guk - ld, ziwei = ((mok + 1 + (rem % 2 === 0 ? rem : -rem)) % 12 + 12) % 12, tianfu = ((4 - ziwei) % 12 + 12) % 12;
  add('jamidusu.myeong_palace', myeong + 1, 12); add('jamidusu.sin_palace', sin + 1, 12); add('jamidusu.ziwei_palace', ziwei + 1, 12);
  [['tianji',-1],['tiantong',-5]].forEach(([name, offset]) => add(`jamidusu.${name}_palace`, ((ziwei + offset) % 12 + 12) % 12 + 1, 12));
  [['taiyin',1],['jumen',3],['tianxiang',4]].forEach(([name, offset]) => add(`jamidusu.${name}_palace`, ((tianfu + offset) % 12 + 12) % 12 + 1, 12));
  const positions = planetPositions(input.jdUT); for (const planet of PLANET_ORDER) { const longitude = positions[planet].lon; add(`astrology.${planet}_longitude_degree`, Math.floor(longitude) + 1, 360); add(`astrology.${planet}_sign`, Math.floor(longitude / 30) + 1, 12); }
  const house = houses(input.jdUT, SEOUL.lat, SEOUL.lon); add('astrology.ascendant_degree', Math.floor(house.asc) + 1, 360); add('astrology.midheaven_degree', Math.floor(house.mc) + 1, 360);
  const moonSidereal = toSidereal(positions.달.lon, input.jdUT), nakshatra = nakshatraOf(input.jdUT); add('vedic_sukyo_shared.nakshatra_index', nakshatra.index + 1, 27); add('vedic_sukyo_shared.nakshatra_pada', nakshatra.pada, 4);
  for (const planet of PLANET_ORDER) add(`vedic.${planet}_sidereal_sign`, Math.floor(toSidereal(positions[planet].lon, input.jdUT) / 30) + 1, 12);
  const hexagram = hexOf(input), base = input.yearBranch + 1 + lm + ld, hourNumber = hb + 1; add('juyeok.lower_trigram', hexagram.lower + 1, 8); add('juyeok.original_hexagram', hexagram.num, 64); add('juyeok.moving_line', ((base + hourNumber - 1) % 6 + 6) % 6 + 1, 6);
  const yukim = yukimAnalyze(input); add('yukim.month_general', branch(fact(yukim, '월장')) + 1, 12); add('yukim.first_transmission', branch(fact(yukim, '초전')) + 1, 12); add('yukim.middle_transmission', branch(fact(yukim, '중전')) + 1, 12); add('yukim.last_transmission', branch(fact(yukim, '말전')) + 1, 12); add('yukim.day_stem_gigung', branch(fact(yukim, '일간 기궁')) + 1, 12);
  const general = monthGeneral(input.jdUT); for (let index = 0; index < 12; index++) add(`yukim.heaven_plate_at_${index + 1}`, ((general + index - hb) % 12 + 12) % 12 + 1, 12);
  const hongguk = honggukAnalyze(input); add('hongguk.heaven_plate_center', number(fact(hongguk, '천반수')), 9); add('hongguk.earth_plate_center', number(fact(hongguk, '지반수')), 9); add('hongguk.year_palace', number(fact(hongguk, '세궁')), 9);
  add('taeeul.cycle_position', ((input.sajuYear - 4) % 24 + 24) % 24 + 1, 24);
  const honmei = starOfYear(input.sajuYear), monthBase = {1:8,4:8,7:8,2:2,5:2,8:2,3:5,6:5,9:5}[honmei], getsu = ((monthBase - input.sectorIndex - 1) % 9 + 9) % 9 + 1; add('gujeong.honmei_star', honmei, 9); add('gujeong.getsumei_star', getsu, 9);
  const tojeong = tojeongAnalyze(input); for (const [label, ceiling] of [['상괘',8],['중괘',6],['괘',144]]) { const value = fact(tojeong, label); if (value) add(`tojeong.${label}`, number(value) || 1, ceiling); }
  const life = digitRoot(String(year).split('').reduce((sum, digit) => sum + Number(digit), 0) + month + day); add('kabbalah.life_path', life, 22); add('kabbalah.birthday_number', digitRoot(day), 9); add('kabbalah.personal_year', digitRoot(month + day + year, false), 9);
  const jdn = toJDN(year, month, day), weekday = ((jdn + 1) % 7 + 7) % 7, remainder = ((year - 638) % 7 + 7) % 7; add('mahabote.eight_place', ((weekday + remainder) % 8) + 1, 8); add('thai.weekday_index', weekday + 1, 7); add('thai.buddhist_era_mod100', (year + 543) % 100 + 1, 100);
  const tarot = tarotAnalyze(input); add('tarot.생일_카드', number(fact(tarot, '생일 카드')) + 1, 78);
  return { values, max, input, positions, moonSidereal };
}
