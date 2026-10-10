import methodA from "../../analysis/fortune-lotto/output/method-comparison/method_A.json";
import methodD from "../../analysis/fortune-lotto/output/method-comparison/method_D.json";
import methodE from "../../analysis/fortune-lotto/output/method-comparison/method_E.json";
import stateMatrix from "../../analysis/fortune-lotto/output/method-comparison/method-E/state_matrix.json";
import commonDataset from "../../analysis/fortune-lotto/output/method-comparison/common_dataset.json";
import { eventFeatures, spread, wrap45 } from "./event-features.mjs";

type Event = { round: number; drawDate: string; drawTime: string };
type History = Event & { numbers: number[] };
type FeatureSet = {
  values: Record<string, number>;
  max: Record<string, number>;
  input: { year: number; month: number; day: number; hourBranch: number };
};
const MODEL_VERSION = "future-validation-frozen-70a3d85-v2";
const SOURCE_COMMIT = "70a3d85";
const stateIds = stateMatrix.feature_ids as string[];
const stateVectors = stateMatrix.vectors as number[][];
const baseHistory = (commonDataset.rows as Array<{ round: number; date: string; time: string; winning: number[] }>).map((row) => ({ round: row.round, drawDate: row.date, drawTime: row.time, numbers: row.winning }));

function uniqueTicket(values: number[]) {
  const result: number[] = [];
  for (const value of values) {
    let number = wrap45(value); let guard = 0;
    while (result.includes(number) && guard++ < 45) number = number === 45 ? 1 : number + 1;
    if (!result.includes(number)) result.push(number);
  }
  for (let number = 1; result.length < 6; number++) if (!result.includes(number)) result.push(number);
  return result;
}
function value(features: FeatureSet, id: string, layer = "raw") {
  const raw = features.values[id]; if (!Number.isFinite(raw)) throw new Error(`Frozen model feature is unavailable: ${id}`);
  return layer === "spread" ? spread(raw, features.max[id]) : raw;
}
function aLane(formula: string, features: FeatureSet): number {
  const direct = formula.match(/^([\w가-힣.]+)\.(raw|spread)$/); if (direct) return value(features, direct[1], direct[2]);
  const call = formula.match(/^(diff|abs|sum|a2b|mul)\((.+),(.+)\)$/); if (!call) throw new Error(`Unsupported frozen A formula: ${formula}`);
  const left = aLane(call[2], features), right = aLane(call[3], features);
  return call[1] === "diff" ? left - right : call[1] === "abs" ? Math.abs(left - right) : call[1] === "sum" ? left + right : call[1] === "a2b" ? 2 * left + right : left * right;
}
function candidateValues(features: FeatureSet) {
  const raw = (id: string) => value(features, id);
  const direct = (id: string, max: number) => spread(raw(id), max);
  return {
    "saju.c1_year_sexagenary": direct("saju.year_sexagenary", 60), "saju.c2_month_sexagenary": direct("saju.month_sexagenary", 60), "saju.c3_day_sexagenary": direct("saju.day_sexagenary", 60), "saju.c4_hour_sexagenary": direct("saju.hour_sexagenary", 60),
    "jamidusu.c1_myeong": direct("jamidusu.myeong_palace", 12), "jamidusu.c2_sin": direct("jamidusu.sin_palace", 12), "jamidusu.c3_jaebaek": spread(raw("jamidusu.myeong_palace") + 8, 12),
    "astrology.c1_sun_longitude": direct("astrology.태양_longitude_degree", 360), "astrology.c2_moon_longitude": direct("astrology.달_longitude_degree", 360), "astrology.c3_sun_sign": direct("astrology.태양_sign", 12),
    "vedic.c1_nakshatra": direct("vedic_sukyo_shared.nakshatra_index", 27), "vedic.c2_nakshatra_pada": spread((raw("vedic_sukyo_shared.nakshatra_index") - 1) * 4 + raw("vedic_sukyo_shared.nakshatra_pada"), 108),
    "juyeok.c1_hexagram": direct("juyeok.original_hexagram", 64), "juyeok.c2_moving_line": direct("juyeok.moving_line", 6),
    "yukim.c1_month_general_point_hour": spread((raw("yukim.month_general") - 1) * 12 + features.input.hourBranch + 1, 144), "yukim.c2_day_stem_gigung": direct("yukim.day_stem_gigung", 12), "yukim.c3_first_transmission": direct("yukim.first_transmission", 12), "yukim.c4_middle_transmission": direct("yukim.middle_transmission", 12), "yukim.c5_last_transmission": direct("yukim.last_transmission", 12),
    "hongguk.c1_heaven_earth": spread((raw("hongguk.heaven_plate_center") - 1) * 9 + raw("hongguk.earth_plate_center"), 81), "hongguk.c2_plate_mix": spread(raw("hongguk.heaven_plate_center") * 5 + raw("hongguk.earth_plate_center"), 54), "taeeul.c1_cycle": direct("taeeul.cycle_position", 24),
    "gujeong.c1_honmei_getsumei": spread((raw("gujeong.honmei_star") - 1) * 9 + raw("gujeong.getsumei_star"), 81), "gujeong.c2_honmei": direct("gujeong.honmei_star", 9),
    "sukyo.c1_nakshatra": direct("vedic_sukyo_shared.nakshatra_index", 27), "sukyo.c2_nakshatra_pada": spread((raw("vedic_sukyo_shared.nakshatra_index") - 1) * 4 + raw("vedic_sukyo_shared.nakshatra_pada"), 108),
    "tojeong.c1_hexagram": direct("tojeong.괘", 144), "tojeong.c2_upper_middle": spread(raw("tojeong.상괘") * 10 + raw("tojeong.중괘"), 86),
    "kabbalah.c1_life_birthday": spread(((raw("kabbalah.life_path") - 1) % 9) * 9 + raw("kabbalah.birthday_number"), 81), "kabbalah.c2_personal_year": spread(raw("kabbalah.personal_year"), 9), "mahabote.c1_eight_place": direct("mahabote.eight_place", 8),
    "thai.c1_weekday_buddhist": spread((raw("thai.weekday_index") - 1) * 100 + raw("thai.buddhist_era_mod100"), 700), "tarot.c1_birth_card": direct("tarot.생일_카드", 78),
  } as Record<string, number>;
}
function candidateFormula(formula: string, candidates: Record<string, number>) {
  const expression = formula.replace(/^wrap45\(/, "").replace(/\)$/, "")
    .replace(/[a-z]+\.[a-z0-9_]+/g, (name) => `c[${JSON.stringify(name)}]`)
    .replace(/\|([^|]+)\|/g, "Math.abs($1)").replace(/floor\(/g, "Math.floor(");
  return Function("c", `return ${expression}`)(candidates) as number;
}
function kmeans(vectors: number[][]) {
  const centroids = Array.from({ length: 12 }, (_, index) => [...vectors[Math.floor(index * vectors.length / 12)]]);
  for (let iteration = 0; iteration < 18; iteration++) {
    const assignments = vectors.map((vector) => centroids.reduce((best, centroid, index) => {
      const distance = centroid.reduce((sum, coordinate, i) => sum + (coordinate - vector[i]) ** 2, 0); return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Infinity }).index);
    // The frozen Method E tickets use this final assignment phase before its centroid update.
    if (iteration === 17) return centroids;
    for (let cluster = 0; cluster < 12; cluster++) { const members = vectors.filter((_, index) => assignments[index] === cluster); if (members.length) centroids[cluster] = centroids[cluster].map((_, i) => members.reduce((sum, row) => sum + row[i], 0) / members.length); }
  }
  return centroids;
}
const centroids = kmeans(stateVectors);
function state(features: FeatureSet) { return stateIds.map((id) => value(features, id) / features.max[id]); }
function nearestCluster(vector: number[]) { return centroids.reduce((best, centroid, index) => { const distance = centroid.reduce((sum, coordinate, i) => sum + (coordinate - vector[i]) ** 2, 0); return distance < best.distance ? { index, distance } : best; }, { index: 0, distance: Infinity }).index; }
export function pastOnlyFSelection(event: Event, history: History[]) {
  const current = eventFeatures({ ...dateParts(event.drawDate), ...timeParts(event.drawTime) }) as unknown as FeatureSet;
  const extra = history.filter((row) => row.round > 1242 && row.round < event.round).map((row) => ({ vector: state(eventFeatures({ ...dateParts(row.drawDate), ...timeParts(row.drawTime) }) as unknown as FeatureSet), numbers: row.numbers, round: row.round }));
  const all = baseHistory.filter((row) => row.round < event.round).map((row) => ({ vector: stateVectors[row.round - 1], numbers: row.numbers, round: row.round })).concat(extra); const currentState = state(current);
  const distance = (left: number[], right: number[]) => left.reduce((sum, coordinate, i) => { const delta = Math.abs(coordinate - right[i]); return sum + (/longitude|sexagenary|nakshatra|hexagram|cycle/.test(stateIds[i]) ? Math.min(delta, 1 - delta) : delta); }, 0) / left.length;
  const neighbors = all.sort((a, b) => distance(currentState, a.vector) - distance(currentState, b.vector) || a.round - b.round).slice(0, 10);
  const scores = Array(46).fill(0); neighbors.forEach((neighbor) => neighbor.numbers.forEach((number) => { scores[number]++; }));
  return { ticket: Array.from({ length: 45 }, (_, index) => index + 1).sort((a, b) => scores[b] - scores[a] || a - b).slice(0, 6), neighbors };
}
function dateParts(drawDate: string) { const [year, month, day] = drawDate.split("-").map(Number); return { year, month, day }; }
function timeParts(drawTime: string) { const [hour, minute] = drawTime.slice(0, 5).split(":").map(Number); return { hour, minute }; }
export function generateFrozenPredictions(event: Event, history: History[]) {
  const features = eventFeatures({ ...dateParts(event.drawDate), ...timeParts(event.drawTime) }) as unknown as FeatureSet; const candidates = candidateValues(features);
  const branch = String(value(features, "astrology.달_sign")); const aRules = (methodA.model.branches as Record<string, string[]>)[branch];
  if (!aRules) throw new Error(`Frozen A branch is unavailable: ${branch}`);
  const cluster = nearestCluster(state(features)); const eRules = (methodE.model.cluster_rules as string[][])[cluster];
  const h = features; const weekday = h.values["thai.weekday_index"] - 1; const dayOfYear = Math.floor((Date.UTC(h.input.year, h.input.month - 1, h.input.day) - Date.UTC(h.input.year, 0, 0)) / 86400000);
  return { predictions: { A: uniqueTicket(aRules.map((formula) => aLane(formula, features))), D: uniqueTicket((methodD.model.genome as string[]).map((formula) => candidateFormula(formula, candidates))), E: uniqueTicket(eRules.map((formula) => candidateFormula(formula, candidates))), F: pastOnlyFSelection(event, history).ticket, H: uniqueTicket([
    value(h, "astrology.금성_longitude_degree") * value(h, "astrology.라후_longitude_degree"), value(h, "astrology.달_longitude_degree"), Math.floor((value(h, "astrology.금성_longitude_degree") + h.input.day) / 2), value(h, "astrology.천왕성_longitude_degree") * weekday, 2 * h.input.day + dayOfYear, value(h, "astrology.목성_longitude_degree") * value(h, "astrology.토성_longitude_degree")
  ]) }, modelVersion: MODEL_VERSION, sourceCommit: SOURCE_COMMIT };
}
