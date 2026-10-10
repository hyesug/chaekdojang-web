/*
 * Read-only fortune-engine lottery backtest spike.
 *
 * This script intentionally imports the staging engine but never writes under
 * public/unse/src.  It writes only analysis/fortune-lotto/output.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { analyze as taeeulAnalyze } from '../../public/unse/src/systems/taeeul.js';
import { starOfYear } from '../../public/unse/src/systems/gujeong.js';
import { analyze as tojeongAnalyze } from '../../public/unse/src/systems/tojeong.js';
import { analyze as mahaboteAnalyze } from '../../public/unse/src/systems/mahabote.js';
import { analyze as thaiAnalyze } from '../../public/unse/src/systems/thai.js';
import { analyze as tarotAnalyze } from '../../public/unse/src/systems/tarot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'output');
const CSV_URL = 'https://raw.githubusercontent.com/jdyang88/Korea_Lotto/master/Lotto_Numbers.csv';
const END_ROUND = 1242;
// The upstream CSV stops at 1231. These public result pages were fixed before
// calculation; they are result data only and never influence event-time input.
const RECENT_DRAWS = [
  [1232,[12,15,19,22,24,36],'2026-07-11'], [1233,[2,7,20,25,37,40],'2026-07-18'],
  [1234,[1,15,19,31,35,43],'2026-07-25'], [1235,[6,7,11,15,39,43],'2026-08-01'],
  [1236,[12,18,21,29,34,38],'2026-08-08'], [1237,[10,20,23,34,37,40],'2026-08-15'],
  [1238,[2,13,18,32,38,42],'2026-08-22'], [1239,[11,13,22,32,33,36],'2026-08-29'],
  [1240,[11,13,19,20,31,44],'2026-09-05'], [1241,[7,13,16,23,24,43],'2026-09-12'],
  [1242,[2,4,10,16,31,41],'2026-09-19'],
].map(([round,winning,date]) => ({ round, winning, date, source_url: `https://www.todaylotto.kr/draws/${round}` }));
const SCHEDULE_SOURCE = 'https://www.mt.co.kr/amp/industry/2022/04/18/2022041810445230719';
// The original six-lane A was re-run before the expanded conditional search.
// It uses the same fixed 20:45/20:35 schedule and remains a stable comparison,
// rather than reading the immediately preceding search winner on later reruns.
const ORIGINAL_A_FIXED_SCHEDULE = { score: 5901, hist: [324,525,302,82,7,1,1], hits: 1414, mean: 1.1384863123993558, ge3: 0.07326892109500806, ge4: 0.007246376811594203, rounds: '1-1242', note: 'Original pre-expansion A; fixed official 20:45/20:35 schedule.' };
const SEOUL = findCity('서울');
const BRANCH_CHARS = '子丑寅卯辰巳午未申酉戌亥';
const SCORE = [0, 1, 3, 10, 50, 300, 3000];
const spread = (raw, max) => Math.min(45, Math.max(1, Math.floor((((raw - 1) % max + max) % max) / max * 45) + 1));
const mod45 = (x) => ((Math.floor(x) - 1) % 45 + 45) % 45 + 1;
const digitRoot = (n, keepMaster = true) => { let x = Math.abs(Math.trunc(n)); while (x > 9 && !(keepMaster && (x === 11 || x === 22))) x = String(x).split('').reduce((a, c) => a + +c, 0); return x; };
const num = (s) => Number(String(s).match(/\d+/)?.[0] ?? 0);
const branch = (s) => Math.max(0, BRANCH_CHARS.indexOf(String(s).match(/[子丑寅卯辰巳午未申酉戌亥]/)?.[0]));
const fact = (r, label) => r.facts.find((x) => x.label === label)?.value ?? '';

async function fetchCsv() {
  const r = await fetch(CSV_URL);
  if (!r.ok) throw new Error(`lotto CSV download failed: ${r.status}`);
  return r.text();
}
function parseCsv(text) {
  return text.trim().replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).map((line) => {
    const p = line.split(',').map(Number);
    return { round: p[0], winning: p.slice(1, 7) };
  }).filter((r) => r.round >= 1 && r.round <= END_ROUND && r.winning.length === 6);
}
function dateOf(round) { const d = new Date(Date.UTC(2002, 11, 7 + (round - 1) * 7)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
function drawClock(round, shift = 0) {
  // Public schedule changed from about 20:45 to about 20:35 on 2022-04-23.
  const dd = dateOf(round); const changed = Date.UTC(dd.y, dd.m - 1, dd.d) >= Date.UTC(2022, 3, 23);
  const minutes = (changed ? 20 * 60 + 35 : 20 * 60 + 45) + shift;
  return { ...dd, hour: Math.floor(minutes / 60), minute: ((minutes % 60) + 60) % 60, time_source: 'official_schedule', source_url: SCHEDULE_SOURCE, source_note: changed ? '2022-04-23 1012회부터 확인된 20:35 공식 방송 편성' : '2022-04-23 이전 일반 공식 방송 편성 20:45', draw_place: '서울', place_source: 'inferred_broadcast_studio_city' };
}
function eventInput(round, shift = 0) {
  const e = drawClock(round, shift);
  const birth = normalizeBirth({ year: e.y, month: e.m, day: e.d, hour: e.hour, minute: e.minute, place: SEOUL });
  const lunar = solarToLunar(e.y, e.m, e.d);
  const chart = computeFourPillars(birth.jdUT, birth.jdTST, { timeKnown: true });
  return {
    ...e, year: e.y, month: e.m, day: e.d, place: SEOUL, timeKnown: true, jdUT: birth.jdUT, jdTST: birth.jdTST, lunar,
    sajuYear: chart.sajuYear, sectorIndex: chart.sector.index,
    yearStem: chart.pillars.year.stem, yearBranch: chart.pillars.year.branch,
    monthStem: chart.pillars.month.stem, monthBranch: chart.pillars.month.branch,
    dayStem: chart.pillars.day.stem, dayBranch: chart.pillars.day.branch,
    hourStem: chart.pillars.hour.stem, hourBranch: chart.pillars.hour.branch,
    currentYear: chart.sajuYear, civilYear: e.y, age: 0, elapsedYears: 0, nowJD: birth.jdUT,
    chart,
  };
}
function featuresFor(round, shift = 0) {
  const x = eventInput(round, shift), f = [];
  const add = (system, key, raw, max, lineage, note = '') => f.push({ id: `${system}.${key}`, system, key, raw, spread: spread(raw, max), max, lineage, note });
  const p = x.chart.pillars;
  // 1. 사주: actual four-pillar structure (not interpretive ten-god/domain scores).
  for (const k of ['year', 'month', 'day', 'hour']) {
    add('saju', `${k}_stem`, p[k].stem + 1, 10, 'ganzhi.pillars');
    add('saju', `${k}_branch`, p[k].branch + 1, 12, 'ganzhi.pillars');
    add('saju', `${k}_sexagenary`, sexagenaryIndex(p[k].stem, p[k].branch) + 1, 60, 'ganzhi.pillars');
  }
  elementDistribution(p).count.forEach((v, i) => add('saju', `element_${i}`, v, 8, 'ganzhi.pillars.element_distribution'));
  add('saju', 'solar_term_sector', x.sectorIndex + 1, 24, 'astro.solar_term');
  // 2. 자미두수: native palace/star placement mathematics.
  const lm = x.lunar.month, ld = x.lunar.day, hb = x.hourBranch;
  const myeong = ((lm + 1 - hb) % 12 + 12) % 12, sin = ((lm + 1 + hb) % 12 + 12) % 12;
  const yearStem = ((x.sajuYear - 4) % 10 + 10) % 10, inStem = ((yearStem % 5) * 2 + 2) % 10;
  const myeongStem = ((inStem + myeong - 2) % 10 + 10) % 10;
  let sexa = 0; for (let i = 0; i < 60; i++) if (i % 10 === myeongStem && i % 12 === myeong) { sexa = i; break; }
  const nayeum = [3,1,0,2,3,1,4,2,3,0,4,2,1,0,4,3,1,0,2,3,1,4,2,3,0,4,2,1,0,4];
  const gukN = ({ 4: 2, 0: 3, 3: 4, 2: 5, 1: 6 })[nayeum[Math.floor(sexa / 2)]];
  const mok = Math.ceil(ld / gukN), rem = mok * gukN - ld;
  const ziwei = ((mok + 1 + (rem % 2 === 0 ? rem : -rem)) % 12 + 12) % 12, tianfu = ((4 - ziwei) % 12 + 12) % 12;
  add('jamidusu', 'myeong_palace', myeong + 1, 12, 'lunar.month+hour_branch'); add('jamidusu', 'sin_palace', sin + 1, 12, 'lunar.month+hour_branch');
  add('jamidusu', 'guk_number', gukN, 6, 'saju_year+palace.nayeum'); add('jamidusu', 'ziwei_palace', ziwei + 1, 12, 'lunar.day+guk'); add('jamidusu', 'tianfu_palace', tianfu + 1, 12, 'ziwei_palace');
  [['tianji',-1],['taiyang',-3],['wuqu',-4],['tiantong',-5],['lianzhen',-8]].forEach(([n,o]) => add('jamidusu', `${n}_palace`, ((ziwei+o)%12+12)%12+1,12,'ziwei.star_board'));
  [['taiyin',1],['tanlang',2],['jumen',3],['tianxiang',4],['tianliang',5],['qisha',6],['pojun',10]].forEach(([n,o]) => add('jamidusu', `${n}_palace`, ((tianfu+o)%12+12)%12+1,12,'ziwei.star_board'));
  // 3. western astrology; exact longitude is retained in matrix as raw, integral raw is used for discrete formulas.
  const pos = planetPositions(x.jdUT); for (const n of PLANET_ORDER) { const lon = pos[n].lon; add('astrology', `${n}_longitude_degree`, Math.floor(lon)+1,360,`astro.planet.${n}`, `exact_lon=${lon}`); add('astrology', `${n}_sign`, Math.floor(lon/30)+1,12,`astro.planet.${n}`); }
  const h = houses(x.jdUT, SEOUL.lat, SEOUL.lon); add('astrology','ascendant_degree',Math.floor(h.asc)+1,360,'astro.houses',`exact_lon=${h.asc}`); add('astrology','midheaven_degree',Math.floor(h.mc)+1,360,'astro.houses',`exact_lon=${h.mc}`);
  // 4 + 10. Vedic and Sukyo shared lunar sidereal source appears exactly once.
  const moonSid = toSidereal(pos.달.lon, x.jdUT), nak = nakshatraOf(x.jdUT); add('vedic_sukyo_shared','sidereal_moon_degree',Math.floor(moonSid)+1,360,'astro.moon+lahiri_ayanamsa',`exact_lon=${moonSid}`); add('vedic_sukyo_shared','nakshatra_index',nak.index+1,27,'astro.moon+lahiri_ayanamsa'); add('vedic_sukyo_shared','nakshatra_pada',nak.pada,4,'astro.moon+lahiri_ayanamsa');
  for (const n of PLANET_ORDER) { const sid = toSidereal(pos[n].lon,x.jdUT); add('vedic',`${n}_sidereal_sign`,Math.floor(sid/30)+1,12,`astro.planet.${n}+lahiri`); }
  // 5. Juyeok.
  const hx = hexOf(x), base = x.yearBranch + 1 + lm + ld, hourNum = hb + 1; add('juyeok','base',base,60,'ganzhi.year_branch+lunar'); add('juyeok','upper_trigram',hx.upper+1,8,'juyeok.base'); add('juyeok','lower_trigram',hx.lower+1,8,'juyeok.base+hour_branch'); add('juyeok','original_hexagram',hx.num,64,'juyeok.trigrams'); add('juyeok','moving_line',((base+hourNum-1)%6+6)%6+1,6,'juyeok.base+hour_branch');
  // 6. Yukim: the module is executed; branch-valued structural facts are parsed from its actual output.
  const yu = yukimAnalyze(x); add('yukim','month_general',branch(fact(yu,'월장'))+1,12,'astro.sun_longitude'); add('yukim','point_hour',hb+1,12,'ganzhi.hour_branch'); add('yukim','day_stem_gigung',branch(fact(yu,'일간 기궁'))+1,12,'ganzhi.day_stem'); add('yukim','first_transmission',branch(fact(yu,'초전'))+1,12,'yukim.four_courses'); add('yukim','middle_transmission',branch(fact(yu,'중전'))+1,12,'yukim.heaven_plate'); add('yukim','last_transmission',branch(fact(yu,'말전'))+1,12,'yukim.heaven_plate'); add('yukim','noble_ground',branch(fact(yu,'귀인').split('→')[1])+1,12,'yukim.noble');
  const wj = monthGeneral(x.jdUT); for (let i=0;i<12;i++) add('yukim',`heaven_plate_at_${i+1}`,((wj+i-hb)%12+12)%12+1,12,'yukim.month_general+hour_branch');
  // 7. Hongguk qimen (module facts are its calculated board centers and palaces).
  const hg = honggukAnalyze(x); add('hongguk','heaven_plate_center',num(fact(hg,'천반수')),9,'ganzhi.four_stems'); add('hongguk','earth_plate_center',num(fact(hg,'지반수')),9,'ganzhi.four_branches'); add('hongguk','my_palace',num(fact(hg,'내 궁')),9,'hongguk.day_stem'); add('hongguk','year_palace',num(fact(hg,'세궁')),9,'hongguk.year_branch'); add('hongguk','dun_direction',fact(hg,'둔').includes('양')?1:2,2,'astro.solar_term');
  // 8. Taeeul native cycle/palace facts.
  const te = taeeulAnalyze(x); for (const label of ['태을 궁','태을수','주기']) { const v=fact(te,label); if(v) add('taeeul',label.replaceAll(' ','_'),num(v)||1,24,'saju_year.24_cycle'); }
  add('taeeul','cycle_position',((x.sajuYear-4)%24+24)%24+1,24,'saju_year.24_cycle');
  // 9. Gujeong.
  const honmei=starOfYear(x.sajuYear), monthBase={1:8,4:8,7:8,2:2,5:2,8:2,3:5,6:5,9:5}[honmei], getsu=((monthBase-x.sectorIndex-1)%9+9)%9+1; add('gujeong','honmei_star',honmei,9,'saju_year'); add('gujeong','getsumei_star',getsu,9,'gujeong.honmei+solar_term');
  // 11. Tojeong structural trigrams from the executing module.
  const tj=tojeongAnalyze(x); for(const label of ['상괘','중괘','하괘','괘']) { const v=fact(tj,label); if(v) add('tojeong',label,num(v)||1,label==='괘'?144:(label==='상괘'?8:label==='중괘'?6:3),'lunar+ganzhi'); }
  // 12. Kabbalah date arithmetic (no semantic mapping scores).
  const life=digitRoot(String(x.y).split('').reduce((a,c)=>a+(+c),0)+x.m+x.d), birthday=digitRoot(x.d), personal=digitRoot(x.m+x.d+x.y,false); add('kabbalah','life_path',life,22,'civil_date'); add('kabbalah','birthday_number',birthday,9,'civil_date.day'); add('kabbalah','personal_year',personal,9,'civil_date');
  // 13. Mahabote module-derived 8-place signal.
  const mb=mahaboteAnalyze(x); for(const label of ['마하보테','출생요일','버마력']) { const v=fact(mb,label); if(v) add('mahabote',label,num(v)||1,label==='버마력'?3000:8,'civil_date'); }
  const jdn=toJDN(x.y,x.m,x.d), weekday=((jdn+1)%7+7)%7, remYear=((x.y-638)%7+7)%7; add('mahabote','eight_place',((weekday+remYear)%8)+1,8,'weekday+burmese_year');
  // 14. Thai module facts plus Buddhist era residue.
  const th=thaiAnalyze(x); for(const label of ['요일','불기']) { const v=fact(th,label); if(v) add('thai',label,num(v)||1,label==='불기'?3000:7,'civil_date'); } add('thai','weekday_index',weekday+1,7,'weekday'); add('thai','buddhist_era_mod100',(x.y+543)%100+1,100,'civil_year+543');
  // 15. Tarot: event-clock seed/cards from the module, not a person.
  const tr=tarotAnalyze(x); for(const q of tr.facts) { const v=num(q.value); if(v || q.label==='생일 카드') add('tarot',q.label.replaceAll(' ','_'),v+1,78,'civil_date+event_clock'); }
  return { event: x, features: f };
}
function conditionOf(row, kind) { if(!row._conditions){const x=row.event, pos=planetPositions(x.jdUT), moon=toSidereal(pos.달.lon,x.jdUT), daySex=x.dayStem*12+x.dayBranch, h=houses(x.jdUT,SEOUL.lat,SEOUL.lon), solarSector=Math.floor(x.sectorIndex/2), moonSector=Math.floor(pos.달.lon/30); row._conditions={ day_stem:x.dayStem, day_branch:x.dayBranch, hour_branch:x.hourBranch, lunar_month:x.lunar.month-1, lunar_day:x.lunar.day-1, solar_month:x.m-1, weekday:(toJDN(x.y,x.m,x.d)+1)%7, season:Math.floor((x.m%12)/3), solar_sector:solarSector, sun_sign:Math.floor(pos.태양.lon/30), moon_sector:moonSector, nakshatra_group:Math.floor((moon/(360/27))/3), asc_sign:Math.floor(h.asc/30), mc_sign:Math.floor(h.mc/30), day_branch_lunar_day:`${x.dayBranch}:${x.lunar.day}`, day_sexagenary_lunar_day:`${daySex}:${x.lunar.day}`, lunar_day_solar_sector:`${x.lunar.day}:${solarSector}`, moon_sector_day_branch:`${moonSector}:${x.dayBranch}`, event_signature:`${daySex}:${x.lunar.day}:${solarSector}:${moonSector}:${Math.floor(h.asc/30)}`};} return row._conditions[kind]; }
function prediction(formula,row) { const a=row.values[formula.a], b=formula.b==null?0:row.values[formula.b], c=formula.c==null?0:row.values[formula.c]; let x; if(formula.op==='one')x=a; else if(formula.op==='sum')x=a+b; else if(formula.op==='abs')x=Math.abs(a-b); else if(formula.op==='a2b')x=a+2*b; else if(formula.op==='2ab')x=2*a+b; else if(formula.op==='plus3')x=a+b+c; else if(formula.op==='minus3')x=a+b-c; return mod45(x); }
function formulaName(f, meta) { const layer=(slot)=>f.layers?.[slot]??f.layer; const n=(i,slot)=>meta[i].id+(layer(slot)==='spread'?'.spread':'.raw'); const a=n(f.a,0),b=f.b==null?'':n(f.b,1),c=f.c==null?'':n(f.c,2); return ({one:a,sum:`${a}+${b}`,diff:`${a}-${b}`,rdiff:`${b}-${a}`,abs:`|${a}-${b}|`,a2b:`${a}+2×${b}`,twoab:`2×${a}+${b}`,twoaMinusB:`2×${a}-${b}`,aMinusTwoB:`${a}-2×${b}`,twoTwo:`2×${a}+2×${b}`,mul:`${a}×${b}`,mean:`floor((${a}+${b})/2)`,plus3:`${a}+${b}+${c}`,minus3:`${a}+${b}-${c}`,aMinusBC:`${a}-${b}+${c}`,aMinusBMinusC:`${a}-${b}-${c}`,twoABMinusC:`2×${a}+${b}-${c}`,aTwoBMinusC:`${a}+2×${b}-${c}`,aBMinusTwoC:`${a}+${b}-2×${c}`,absPlusC:`|${a}-${b}|+${c}` })[f.op]; }
function candidateForms(n) { const o=[], atoms=[]; for(const layer of ['raw','spread'])for(let i=0;i<n;i++)atoms.push({i,layer}); for(const a of atoms)o.push({a:a.i,op:'one',layer:a.layer,layers:[a.layer],complexity:1}); for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){const a=atoms[i],b=atoms[j],base={a:a.i,b:b.i,layers:[a.layer,b.layer]}; for(const op of ['sum','diff','rdiff','abs','a2b','twoab','twoaMinusB','aMinusTwoB','twoTwo','mul','mean'])o.push({...base,op,layer:a.layer,complexity:op==='mul'?4:op==='mean'?3:op==='sum'||op==='diff'||op==='rdiff'||op==='abs'?2:3});} return o; }
function evaluateSingle(f, rows) { let hits=0; for(const r of rows) if(r.win.has(prediction(f,r)))hits++; return hits; }
function ticketStats(predictors, rows) { const hist=Array(7).fill(0); let hits=0,score=0; for(let i=0;i<rows.length;i++){ const nums=new Set(); for(const p of predictors){ let n=p.predict?p.predict(rows[i],i):pred(p,rows[i]); let guard=0; while(nums.has(n)&&guard++<45)n=n%45+1; nums.add(n); if(nums.size===6)break; } for(let fill=1;nums.size<6&&fill<=45;fill++)if(!nums.has(fill))nums.add(fill); const k=[...nums].filter(n=>rows[i].win.has(n)).length; hist[k]++;hits+=k;score+=SCORE[k]; } return {score,hist,hits,mean:hits/rows.length,ge3:(hist[3]+hist[4]+hist[5]+hist[6])/rows.length,ge4:(hist[4]+hist[5]+hist[6])/rows.length}; }
function compare(a,b){ for(const k of ['score'])if(b[k]!==a[k])return b[k]-a[k]; for(const k of [6,5,4])if(b.hist[k]!==a.hist[k])return b.hist[k]-a.hist[k]; const ag=a.hist[3]+a.hist[4]+a.hist[5]+a.hist[6],bg=b.hist[3]+b.hist[4]+b.hist[5]+b.hist[6]; return bg-ag||b.mean-a.mean; }
function greedyTicket(pool,rows) { const chosen=[]; while(chosen.length<6){ let best; for(const f of pool){ const s=ticketStats([...chosen,f],rows); if(!best||compare(best.s,s)>0)best={f,s}; } chosen.push(best.f); } return {chosen,stats:ticketStats(chosen,rows)}; }
function conditionalFormula(kind, pool, rows) { const groups=[...new Set(rows.map(r=>conditionOf(r,kind)))]; const by=new Map(); for(const g of groups){ const sub=rows.filter(r=>conditionOf(r,kind)===g); by.set(g,pool.reduce((best,f)=>!best||evaluateSingle(f,sub)>best.hits?{f,hits:evaluateSingle(f,sub)}:best,null).f); } return {kind,by,complexity:1+groups.length*3, predict:(r)=>prediction(by.get(conditionOf(r,kind)),r)}; }
function markdown(result, rows, meta, baseline, featureCount) {
  const r=(label,x,extra='')=>`| ${label} | ${x.stats.score} | ${x.stats.hist.join(' / ')} | ${x.stats.mean.toFixed(4)} | ${(x.stats.ge3*100).toFixed(2)}% | ${(x.stats.ge4*100).toFixed(2)}% | ${extra} |`;
  const formulas=(x)=>x.chosen.map((f,i)=>`${i+1}. ${f.kind?`if ${f.kind}: ${[...f.by.entries()].map(([g,z])=>`${g}→${formulaName(z,meta)}`).join('; ')}`:formulaName(f,meta)}`).join('<br>');
  const sections=[['A. 전체 역사 점수 최고',result.best],['B. 6개 적중 우선',result.bySix],['C. 5개 이상 우선',result.byFive],['D. 평균 적중 우선',result.byMean],['E. 단순식',result.simple]];
  return `# Lotto 6/45 fortune-engine historical search\n\nScope: rounds 1–${END_ROUND}; 6 main numbers only. Feature matrix: ${featureCount} structural signals. A ticket is six greedily selected formula lanes; duplicate lane outputs are advanced cyclically to the next unused 1–45 number.\n\n- Raw layer: the engine’s integer structural value (planetary angles use floor(longitude)+1 while exact longitude is retained in the matrix note).\n- Spread layer: exactly lotto.js \`spread(raw, max)\`.\n- Formula terminal: \`((floor(x)-1) mod 45)+1\`. Search: all singles/pairs over all retained signals; 3-signal formulas after top-36 univariate prefilter.\n- No result/synthesis domain scores or prose-derived numbers are features.\n- Vedic/Sukyo nakshatra/pada is a single shared-source feature family, not duplicated votes.\n\n| type | score | 0/1/2/3/4/5/6 hits | mean hits | >=3 | >=4 | vs random score |\n|---|---:|---|---:|---:|---:|---:|\n${sections.map(([l,x])=>r(l,x,`${(x.stats.score-baseline.score).toFixed(1)}`)).join('\n')}\n\n${sections.map(([l,x])=>`## ${l}\n\nComplexity: ${x.complexity}; condition: ${x.condition ?? 'none'}\n\n${formulas(x)}\n`).join('\n')}\n\n## Best-rule chronological stability\n\n${[ [1,600],[601,900],[901,1231] ].map(([a,b])=>{const s=ticketStats(result.best.chosen,rows.filter(x=>x.round>=a&&x.round<=b));return `- ${a}–${b}: score ${s.score}, mean ${s.mean.toFixed(4)}, ≥3 ${(s.ge3*100).toFixed(2)}%, distribution ${s.hist.join('/')}`;}).join('\n')}\n\n## Time sensitivity (best fixed formulas; all assumed-time rows shifted)\n\n${result.sensitivity.map(x=>`- ${x.shift>=0?'+':''}${x.shift} minutes: score ${x.stats.score}, mean ${x.stats.mean.toFixed(4)}, distribution ${x.stats.hist.join('/')}`).join('\n')}\n\n## Interpretation\n\nThis is explicitly in-sample optimization, not evidence of predictive ability. The search tests many correlated formula candidates and then chooses six lanes on the same outcomes, so the historical maximum is expected to be substantially overfit. The separately fixed validation hypotheses beginning round 1243 are not used or altered here.\n`;
}
async function main(){
  await mkdir(OUT,{recursive:true}); const csv=await fetchCsv(); const draws=[...parseCsv(csv),...RECENT_DRAWS].sort((a,b)=>a.round-b.round); if(draws.length!==END_ROUND||draws.at(-1).round!==END_ROUND)throw new Error(`expected complete 1-${END_ROUND} rows, got ${draws.length}`);
  const calculated=draws.map(d=>({round:d.round,winning:d.winning,...featuresFor(d.round)})); const meta=calculated[0].features; const ids=meta.map(x=>x.id); if(new Set(ids).size!==ids.length){ const duplicate=ids.find((id,i)=>ids.indexOf(id)!==i); throw new Error(`duplicate feature id: ${duplicate}`); }
  const rows=calculated.map(x=>({round:x.round,event:x.event,win:new Set(x.winning),values:x.features.map(f=>f.raw),spread:x.features.map(f=>f.spread)}));
  // switch layers by materializing exact lotto.js spread array in the same index position.
  for(const r of rows){ const raw=r.values; r.values=raw; r._spread=r.spread; }
  // Candidate evaluation reads the selected layer directly.  Reassigning a
  // property on every row/formula pair de-optimizes V8 and made the first
  // exhaustive attempt impractically slow.
  for(const r of rows)r.valuesRaw=r.values;
  const pred=(f,r)=>{const value=(index,slot)=>((f.layers?.[slot]??f.layer)==='spread'?r._spread:r.valuesRaw)[index];const a=value(f.a,0),b=f.b==null?0:value(f.b,1),c=f.c==null?0:value(f.c,2);let x;if(f.op==='one')x=a;else if(f.op==='sum')x=a+b;else if(f.op==='diff')x=a-b;else if(f.op==='rdiff')x=b-a;else if(f.op==='abs')x=Math.abs(a-b);else if(f.op==='a2b')x=a+2*b;else if(f.op==='twoab'||f.op==='2ab')x=2*a+b;else if(f.op==='twoaMinusB')x=2*a-b;else if(f.op==='aMinusTwoB')x=a-2*b;else if(f.op==='twoTwo')x=2*a+2*b;else if(f.op==='mul')x=a*b;else if(f.op==='mean')x=Math.floor((a+b)/2);else if(f.op==='plus3')x=a+b+c;else if(f.op==='aMinusBC')x=a-b+c;else if(f.op==='aMinusBMinusC')x=a-b-c;else if(f.op==='twoABMinusC')x=2*a+b-c;else if(f.op==='aTwoBMinusC')x=a+2*b-c;else if(f.op==='aBMinusTwoC')x=a+b-2*c;else if(f.op==='absPlusC')x=Math.abs(a-b)+c;else x=a+b-c;return mod45(x);};
  // Replace helpers locally through small wrappers to prevent any service-code alteration.
  const evalS=(f,rs)=>{let h=0;for(const r of rs)if(r.win.has(pred(f,r)))h++;return h;};
  const forms=candidateForms(meta.length); const singles=forms.filter(f=>f.op==='one'); const rankedSingles=singles.map(f=>({f,hits:evalS(f,rows)})).sort((a,b)=>b.hits-a.hits); const allowed=rankedSingles.slice(0,38).map(x=>({i:x.f.a,layer:x.f.layer}));
  const triples=[]; for(let i=0;i<allowed.length;i++)for(let j=i+1;j<allowed.length;j++)for(let k=j+1;k<allowed.length;k++){const a=allowed[i],b=allowed[j],c=allowed[k],base={a:a.i,b:b.i,c:c.i,layers:[a.layer,b.layer,c.layer],layer:a.layer};for(const op of ['plus3','minus3','aMinusBC','aMinusBMinusC','twoABMinusC','aTwoBMinusC','aBMinusTwoC','absPlusC'])triples.push({...base,op,complexity:op==='plus3'?3:op==='absPlusC'?4:op==='minus3'||op==='aMinusBC'?4:5});}
  const allForms=[...forms,...triples]; console.log(`evaluating ${allForms.length} formulas across ${rows.length} rounds`); const ranked=[]; for(let i=0;i<allForms.length;i++){ ranked.push({f:allForms[i],hits:evalS(allForms[i],rows)}); if((i+1)%5000===0)console.log(`formula progress ${i+1}/${allForms.length}`); } ranked.sort((a,b)=>b.hits-a.hits); const pool=ranked.slice(0,650).map(x=>x.f);
  // Greedy ticket selection is performed with exact requested nonlinear scoring using the adapted predictor.
  const numbersFor=(p,r)=>{const nums=new Set();for(const f of p){let n=f.predict?f.predict(r):pred(f,r),g=0;while(nums.has(n)&&g++<45)n=n%45+1;nums.add(n);if(nums.size===6)break;}for(let fill=1;nums.size<6&&fill<=45;fill++)if(!nums.has(fill))nums.add(fill);return [...nums].sort((a,b)=>a-b);};
  const ticket=(p,activeRows=rows)=>{const hist=Array(7).fill(0);let hits=0,score=0;for(const r of activeRows){const nums=numbersFor(p,r);const k=nums.filter(n=>r.win.has(n)).length;hist[k]++;hits+=k;score+=SCORE[k];}return{score,hist,hits,mean:hits/activeRows.length,ge3:(hist[3]+hist[4]+hist[5]+hist[6])/activeRows.length,ge4:(hist[4]+hist[5]+hist[6])/activeRows.length};};
  const legacyA = ORIGINAL_A_FIXED_SCHEDULE;
  const greedy=(candidatePool)=>{const chosen=[];while(chosen.length<6){let best=null;for(const f of candidatePool){const s=ticket([...chosen,f]);if(!best||compare(best.s,s)>0)best={f,s};}chosen.push(best.f);}return{chosen,stats:ticket(chosen)};};
  const conditionalKinds=['day_stem','day_branch','hour_branch','lunar_month','lunar_day','solar_month','weekday','season','solar_sector','sun_sign','moon_sector','nakshatra_group','asc_sign','mc_sign','day_branch_lunar_day','day_sexagenary_lunar_day','lunar_day_solar_sector','moon_sector_day_branch','event_signature'];
  const conditional=[], branch_diagnostics=[];
  for(const kind of conditionalKinds){const groups=[...new Set(rows.map(r=>conditionOf(r,kind)))],deep=groups.length>100,ranks=deep?6:2,candidates=pool.slice(0,deep?650:180),maps=Array.from({length:ranks},()=>new Map()),sizes=groups.map(g=>rows.reduce((n,r)=>n+(conditionOf(r,kind)===g),0));branch_diagnostics.push({kind,groups:groups.length,min_branch_size:Math.min(...sizes),max_branch_size:Math.max(...sizes),median_branch_size:[...sizes].sort((a,b)=>a-b)[Math.floor(sizes.length/2)],memorization_prone:Math.min(...sizes)<5});for(const g of groups){const sub=rows.filter(r=>conditionOf(r,kind)===g),ordered=candidates.map(f=>({f,h:evalS(f,sub)})).sort((a,b)=>b.h-a.h||a.f.complexity-b.f.complexity),seen=new Set();for(let rank=0;rank<ranks;rank++){const picked=ordered.find(({f})=>{const signature=sub.map(r=>pred(f,r)).join(',');if(seen.has(signature))return false;seen.add(signature);return true;})??ordered[rank];maps[rank].set(g,picked.f);}}for(let rank=0;rank<ranks;rank++){const by=maps[rank],conditionFormula={kind,rank,by,fallback: candidates[0],complexity:1+groups.length*3};conditionFormula.predict=r=>pred(by.get(conditionOf(r,kind)) ?? conditionFormula.fallback,r);conditional.push(conditionFormula);}}
  const allPool=[...pool,...conditional]; const initial=greedy(allPool); const simple=greedy(pool.filter(f=>f.complexity<=2));
  // Search a diversified set of greedy seeds to obtain the alternative objective leaders.
  const alternatives=[]; for(let offset=0;offset<80;offset+=10){const g=greedy(allPool.slice(offset,offset+120));alternatives.push(g);} const leaders=[initial,...alternatives];
  // A follows the requested score-first tie order, while B-D deliberately use their named objective.
  const best=leaders.slice().sort((a,b)=>compare(a.stats,b.stats))[0];
  const bySix={...leaders.slice().sort((a,b)=>b.stats.hist[6]-a.stats.hist[6]||compare(a.stats,b.stats))[0]};
  const byFive={...leaders.slice().sort((a,b)=>(b.stats.hist[5]+b.stats.hist[6])-(a.stats.hist[5]+a.stats.hist[6])||compare(a.stats,b.stats))[0]};
  const byMean={...leaders.slice().sort((a,b)=>b.stats.mean-a.stats.mean||compare(a.stats,b.stats))[0]};
  const baseline={score:0,hist:Array(7).fill(0),mean:0}; const denom=8145060; for(let k=0;k<=6;k++){/* exact hypergeometric */ let comb=(n,r)=>{let q=1;for(let i=1;i<=r;i++)q=q*(n-r+i)/i;return q;};const p=comb(6,k)*comb(39,6-k)/comb(45,6);baseline.hist[k]=p*rows.length;baseline.score+=p*rows.length*SCORE[k];baseline.mean+=p*k;}
  const result={best:{...best,complexity:best.chosen.reduce((s,f)=>s+(f.complexity||1),0),condition:best.chosen.some(f=>f.kind)?'included (see lane rules)':'none'},bySix:{...bySix,complexity:bySix.chosen.reduce((s,f)=>s+(f.complexity||1),0)},byFive:{...byFive,complexity:byFive.chosen.reduce((s,f)=>s+(f.complexity||1),0)},byMean:{...byMean,complexity:byMean.chosen.reduce((s,f)=>s+(f.complexity||1),0)},simple:{...simple,complexity:simple.chosen.reduce((s,f)=>s+(f.complexity||1),0)},baseline,legacyA,branch_diagnostics,sensitivity:[],stability:[],time_source_performance:{exact:{rounds:0,stats:null},official_schedule:{rounds:rows.length,stats:null}}};
  result.time_source_performance.official_schedule.stats=ticket(result.best.chosen,rows);
  for(const [a,b] of [[1,400],[401,800],[801,1231],[1000,1242]])result.stability.push({range:`${a}-${b}`,stats:ticket(result.best.chosen,rows.filter(r=>r.round>=a&&r.round<=b))});
  for(const shift of [-60,-30,30,60]){const shifted=draws.map(d=>({round:d.round,winning:d.winning,...featuresFor(d.round,shift)})).map(x=>({round:x.round,event:x.event,win:new Set(x.winning),valuesRaw:x.features.map(f=>f.raw),_spread:x.features.map(f=>f.spread)})); result.sensitivity.push({shift,stats:ticket(result.best.chosen,shifted)}); }
  let seed=0x9e3779b9; const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296); const randomScores=[]; for(let sim=0;sim<500;sim++){const hist=Array(7).fill(0);let score=0,hits=0;for(const row of rows){const nums=new Set();while(nums.size<6)nums.add(Math.floor(random()*45)+1);const k=[...nums].filter(n=>row.win.has(n)).length;hist[k]++;hits+=k;score+=SCORE[k];}randomScores.push({score,hits,mean:hits/rows.length,hist});}randomScores.sort((a,b)=>a.score-b.score);const nullSimulation={method:'500 deterministic Monte Carlo random six-number tickets; this is a lower bound and does not reproduce the adaptive search winner\'s curse',runs:randomScores.length,min:randomScores[0].score,median:randomScores[Math.floor(randomScores.length/2)].score,max:randomScores.at(-1).score,mean:randomScores.reduce((s,x)=>s+x.score,0)/randomScores.length,exceed_best:randomScores.filter(x=>x.score>=result.best.stats.score).length};
  // Persist raw + lotto.js transformed feature layers and provenance.
  await writeFile(join(OUT,'feature_manifest.json'),JSON.stringify(meta.map((f,i)=>({...f,index:i,shared_source:f.system==='vedic_sukyo_shared'})),null,2));
  const featureMatrix=calculated.map(x=>({round:x.round,date:`${x.event.y}-${String(x.event.m).padStart(2,'0')}-${String(x.event.d).padStart(2,'0')}`,time:`${String(x.event.hour).padStart(2,'0')}:${String(x.event.minute).padStart(2,'0')}`,time_source:x.event.time_source,place:x.event.draw_place,place_source:x.event.place_source,winning:x.winning,raw:x.features.map(f=>f.raw),spread:x.features.map(f=>f.spread)}));
  const drawTimes=calculated.map(x=>({round:x.round,draw_date:`${x.event.y}-${String(x.event.m).padStart(2,'0')}-${String(x.event.d).padStart(2,'0')}`,draw_time_local:`${String(x.event.hour).padStart(2,'0')}:${String(x.event.minute).padStart(2,'0')}`,draw_time_utc:`${String((x.event.hour-9+24)%24).padStart(2,'0')}:${String(x.event.minute).padStart(2,'0')}`,time_source:x.event.time_source,source_url:x.event.source_url,source_note:x.event.source_note,draw_place:x.event.draw_place,place_source:x.event.place_source}));
  await writeFile(join(OUT,'feature_matrix.json'),JSON.stringify(featureMatrix));
  await writeFile(join(OUT,'feature_matrix_time_refined.json'),JSON.stringify(featureMatrix));
  await writeFile(join(OUT,'draw_times.json'),JSON.stringify(drawTimes,null,2));
  const top20=ranked.slice(0,20).map((x,i)=>({rank:i+1,formula:formulaName(x.f,meta),complexity:x.f.complexity,individual_hits:x.hits,layer:x.f.layer,feature_lineage:[x.f.a,x.f.b,x.f.c].filter(v=>v!=null).map(v=>meta[v].lineage)})); await writeFile(join(OUT,'top20.json'),JSON.stringify(top20,null,2));
  const serialFormula=(f)=>f.kind?{...f,by:[...f.by.entries()].map(([group,formula])=>({group,formula}))}:f;
  const serialResult=Object.fromEntries(Object.entries(result).map(([key,value])=>value?.chosen? [key,{...value,chosen:value.chosen.map(serialFormula)}] : [key,value]));
  const displayFormula=(f)=>f.kind?{condition:f.kind,branches:[...f.by.entries()].map(([group,formula])=>({group,formula:formulaName(formula,meta)}))}:{formula:formulaName(f,meta)};
  const ruleTypes=[['A_score_max',result.best],['B_six_hits_max',result.bySix],['C_five_plus_max',result.byFive],['D_mean_hits_max',result.byMean],['E_simple',result.simple]];
  const ruleDetails=Object.fromEntries(ruleTypes.map(([name,x])=>[name,{complexity:x.complexity,condition:x.condition??'none',stats:x.stats,lanes:x.chosen.map(displayFormula)}]));
  const ticketOutput=Object.fromEntries(ruleTypes.map(([name,x])=>[name,rows.map(r=>{const numbers=numbersFor(x.chosen,r);return{round:r.round,numbers,hits:numbers.filter(n=>r.win.has(n)).length};})]));
  await writeFile(join(OUT,'results.json'),JSON.stringify({scope:{rounds:`1-${END_ROUND}`,time_source:'official_schedule',place:'서울',csv_source:CSV_URL},baseline,result:serialResult,top20},null,2));
  await writeFile(join(OUT,'rule_details.json'),JSON.stringify(ruleDetails,null,2));
  await writeFile(join(OUT,'tickets.json'),JSON.stringify(ticketOutput));
  const bestRule={version:'time-refined-historical-max-v1',scope:{rounds:`1-${END_ROUND}`,time_source_counts:{exact:0,official_schedule:rows.length},place:'서울'},formula_terminal:'((floor(x)-1) % 45 + 45) % 45 + 1',duplicate_rule:'evaluate lanes in listed order; if a number duplicates, increment cyclically until unused; then fill remaining slots in ascending 1..45 order',score:result.best.stats,complexity:result.best.complexity,branch_diagnostics,lanes:result.best.chosen.map(displayFormula),stability:result.stability,time_source_performance:result.time_source_performance,legacy_A_recomputed:legacyA};
  await writeFile(join(OUT,'best_rule.json'),JSON.stringify(bestRule,null,2));
  await writeFile(join(OUT,'sensitivity.json'),JSON.stringify(result.sensitivity,null,2));
  await writeFile(join(OUT,'null_simulation.json'),JSON.stringify(nullSimulation,null,2));
  const statRow=([name,x])=>`| ${name} | ${x.stats.score} | ${x.stats.hist.join(' / ')} | ${x.stats.mean.toFixed(4)} | ${(x.stats.ge3*100).toFixed(2)}% | ${(x.stats.ge4*100).toFixed(2)}% | ${x.complexity} | ${(x.stats.score-baseline.score).toFixed(1)} |`;
  const lanes=([name,x])=>`## ${name}\n\n${x.chosen.map((f,i)=>`${i+1}. ${f.kind?`${f.kind}: ${[...f.by.entries()].map(([g,z])=>`${g}→${formulaName(z,meta)}`).join('; ')}`:formulaName(f,meta)}`).join('\n\n')}`;
  await writeFile(join(OUT,'report.md'),`# Lotto 6/45 fortune-engine historical search\n\nScope: rounds 1-${END_ROUND}; Seoul; all draw times assumed. This is in-sample historical fitting only, not a predictive model. Formula terminal is \`((floor(x)-1) mod 45)+1\`; raw and \`lotto.js\` spread layers are both retained.\n\n| type | score | 0/1/2/3/4/5/6 | mean | ≥3 | ≥4 | complexity | vs random |\n|---|---:|---|---:|---:|---:|---:|---:|\n${ruleTypes.map(statRow).join('\n')}\n\nExact branch-expanded rules are in \`rule_details.json\`; per-round six unique generated numbers are in \`tickets.json\`.\n\n${ruleTypes.map(lanes).join('\n\n')}\n\n## Best fixed-rule stability\n\n${result.stability.map(x=>`- ${x.range}: score ${x.stats.score}; mean ${x.stats.mean.toFixed(4)}; distribution ${x.stats.hist.join('/')}`).join('\n')}\n\n## Time sensitivity\n\n${result.sensitivity.map(x=>`- ${x.shift>=0?'+':''}${x.shift} min: score ${x.stats.score}; mean ${x.stats.mean.toFixed(4)}; distribution ${x.stats.hist.join('/')}`).join('\n')}\n\n## Interpretation\n\nThis is intentionally in-sample and heavily overfit: thousands of correlated signals/formulas and conditional branches are selected using the same draws being scored. It is not evidence of future predictive power. The separate fixed round-1243 validation hypotheses were not used or modified.\n\n## TOP 20 individual lanes\n\n${top20.map(x=>`${x.rank}. ${x.formula} — hits ${x.individual_hits}, complexity ${x.complexity}`).join('\n')}\n`);
  await writeFile(join(OUT,'report_time_refined.md'),`# Time-refined historical maximum search\n\n- Incumbent prior score: 5,882\n- Current score: ${result.best.stats.score}\n- Recomputed incumbent under fixed official schedule: ${legacyA.unavailable?'unavailable':legacyA.score}\n- Exact mechanical draw-time rows: 0\n- Official-schedule rows: ${rows.length}\n- Search: ${ranked.length} arithmetic formulas, ${conditional.length} conditional lanes; branch diagnostics are in \`best_rule.json\`.\n- Null Monte Carlo random-ticket max: ${nullSimulation.max}; adaptive-search null was not simulated.\n\nThis maximizes historical in-sample score only. High-cardinality branches marked \`memorization_prone\` are lookup-like and must not be treated as forecast evidence.\n\n## Winner\n\n${result.best.chosen.map((f,i)=>`${i+1}. ${f.kind?`${f.kind} (rank ${f.rank}): ${[...f.by.entries()].map(([g,z])=>`${g}→${formulaName(z,meta)}`).join('; ')}`:formulaName(f,meta)}`).join('\n\n')}\n`);
  console.log(JSON.stringify({features:meta.length,formulas_tested:ranked.length,best_score:result.best.stats.score,best_mean:result.best.stats.mean,top20:top20.slice(0,3)},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
