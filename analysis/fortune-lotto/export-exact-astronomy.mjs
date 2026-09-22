/* Preserve continuous astronomical values separately from integer formula signals. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBirth } from '../../public/unse-8f3k2m/src/core/time.js';
import { planetPositions, PLANET_ORDER, houses, toSidereal } from '../../public/unse-8f3k2m/src/core/planets.js';
import { findCity } from '../../public/unse-8f3k2m/src/core/place.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'output');
const SEOUL = findCity('서울');
const dateOf = (round) => { const d = new Date(Date.UTC(2002, 11, 7 + (round - 1) * 7)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
const clock = (round) => { const d = dateOf(round); const changed = Date.UTC(d.y, d.m - 1, d.d) >= Date.UTC(2022, 3, 23); return { ...d, hour: 20, minute: changed ? 35 : 45, time_source: 'assumed' }; };

await mkdir(OUT, { recursive: true });
const rows = [];
for (let round = 1; round <= 1231; round++) {
  const event = clock(round);
  const birth = normalizeBirth({ year: event.y, month: event.m, day: event.d, hour: event.hour, minute: event.minute, place: SEOUL });
  const positions = planetPositions(birth.jdUT);
  const h = houses(birth.jdUT, SEOUL.lat, SEOUL.lon);
  rows.push({
    round,
    date: `${event.y}-${String(event.m).padStart(2, '0')}-${String(event.d).padStart(2, '0')}`,
    time: `${String(event.hour).padStart(2, '0')}:${String(event.minute).padStart(2, '0')}`,
    time_source: event.time_source,
    place: '서울',
    tropical_longitude: Object.fromEntries(PLANET_ORDER.map((name) => [name, positions[name].lon])),
    sidereal_longitude: Object.fromEntries(PLANET_ORDER.map((name) => [name, toSidereal(positions[name].lon, birth.jdUT)])),
    ascendant: h.asc,
    midheaven: h.mc,
  });
}
await writeFile(join(OUT, 'exact_astronomical_matrix.json'), JSON.stringify(rows));
