// analysis/fortune-lotto/run-backtest.mjs
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// public/unse-8f3k2m/src/core/astro.js
var DEG = Math.PI / 180;
var sin = (d) => Math.sin(d * DEG);
function norm360(x) {
  return (x % 360 + 360) % 360;
}
function angleDiff(a, b) {
  return (a - b + 540) % 360 - 180;
}
function toJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
function toJD(y, m, d, h = 0, mi = 0, s = 0) {
  return toJDN(y, m, d) - 0.5 + (h + mi / 60 + s / 3600) / 24;
}
function fromJD(jd) {
  const z = Math.floor(jd + 0.5);
  let frac = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 186721625e-2) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const dd = Math.floor(365.25 * c);
  const e = Math.floor((b - dd) / 30.6001);
  const day = b - dd - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  let totalSec = Math.round(frac * 86400);
  const h = Math.floor(totalSec / 3600);
  const mi = Math.floor(totalSec % 3600 / 60);
  const s = totalSec % 60;
  return { y: year, m: month, d: day, h, mi, s };
}
function centuries(jd) {
  return (jd - 2451545) / 36525;
}
function deltaT(year) {
  let t, dt;
  if (year < 1900) {
    t = (year - 1860) / 1;
    dt = 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3 - 4473624e-10 * t ** 4 + t ** 5 / 233174;
  } else if (year < 1920) {
    t = year - 1900;
    dt = -2.79 + 1.494119 * t - 0.0598939 * t * t + 61966e-7 * t ** 3 - 197e-6 * t ** 4;
  } else if (year < 1941) {
    t = year - 1920;
    dt = 21.2 + 0.84493 * t - 0.0761 * t * t + 20936e-7 * t ** 3;
  } else if (year < 1961) {
    t = year - 1950;
    dt = 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547;
  } else if (year < 1986) {
    t = year - 1975;
    dt = 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718;
  } else if (year < 2005) {
    t = year - 2e3;
    dt = 63.86 + 0.3345 * t - 0.060374 * t * t + 17275e-7 * t ** 3 + 651814e-9 * t ** 4 + 2373599e-11 * t ** 5;
  } else if (year < 2050) {
    t = year - 2e3;
    dt = 62.92 + 0.32217 * t + 5589e-6 * t * t;
  } else {
    const u = (year - 1820) / 100;
    dt = -20 + 32 * u * u - 0.5628 * (2150 - year);
  }
  return dt;
}
function deltaTdays(jd) {
  const { y } = fromJD(jd);
  return deltaT(y) / 86400;
}
var EARTH_L0 = [
  [175347046, 0, 0],
  [3341656, 4.6692568, 6283.07585],
  [34894, 4.6261, 12566.1517],
  [3497, 2.7441, 5753.3849],
  [3418, 2.8289, 3.5231],
  [3136, 3.6277, 77713.7715],
  [2676, 4.4181, 7860.4194],
  [2343, 6.1352, 3930.2097],
  [1324, 0.7425, 11506.7698],
  [1273, 2.0371, 529.691],
  [1199, 1.1096, 1577.3435],
  [990, 5.233, 5884.927],
  [902, 2.045, 26.298],
  [857, 3.508, 398.149],
  [780, 1.179, 5223.694],
  [753, 2.533, 5507.553],
  [505, 4.583, 18849.228],
  [492, 4.205, 775.523],
  [357, 2.92, 0.067],
  [317, 5.849, 11790.629],
  [284, 1.899, 796.298],
  [271, 0.315, 10977.079],
  [243, 0.345, 5486.778],
  [206, 4.806, 2544.314],
  [205, 1.869, 5573.143],
  [202, 2.458, 6069.777],
  [156, 0.833, 213.299],
  [132, 3.411, 2942.463],
  [126, 1.083, 20.775],
  [115, 0.645, 0.98],
  [103, 0.636, 4694.003],
  [102, 0.976, 15720.839],
  [102, 4.267, 7.114],
  [99, 6.21, 2146.17],
  [98, 0.68, 155.42],
  [86, 5.98, 161000.69],
  [85, 1.3, 6275.96],
  [85, 3.67, 71430.7],
  [80, 1.81, 17260.15],
  [79, 3.04, 12036.46],
  [75, 1.76, 5088.63],
  [74, 3.5, 3154.69],
  [74, 4.68, 801.82],
  [70, 0.83, 9437.76],
  [62, 3.98, 8827.39],
  [61, 1.82, 7084.9],
  [57, 2.78, 6286.6],
  [56, 4.39, 14143.5],
  [56, 3.47, 6279.55],
  [52, 0.19, 12139.55],
  [52, 1.33, 1748.02],
  [51, 0.28, 5856.48],
  [49, 0.49, 1194.45],
  [41, 5.37, 8429.24],
  [41, 2.4, 19651.05],
  [39, 6.17, 10447.39],
  [37, 6.04, 10213.29],
  [37, 2.57, 1059.38],
  [36, 1.71, 2352.87],
  [36, 1.78, 6812.77],
  [33, 0.59, 17789.85],
  [30, 0.44, 83996.85],
  [30, 2.74, 1349.87],
  [25, 3.16, 4690.48]
];
var EARTH_L1 = [
  [628331966747, 0, 0],
  [206059, 2.678235, 6283.07585],
  [4303, 2.6351, 12566.1517],
  [425, 1.59, 3.523],
  [119, 5.796, 26.298],
  [109, 2.966, 1577.344],
  [93, 2.59, 18849.23],
  [72, 1.14, 529.69],
  [68, 1.87, 398.15],
  [67, 4.41, 5507.55],
  [59, 2.89, 5223.69],
  [56, 2.17, 155.42],
  [45, 0.4, 796.3],
  [36, 0.47, 775.52],
  [29, 2.65, 7.11],
  [21, 5.34, 0.98],
  [19, 1.85, 5486.78],
  [19, 4.97, 213.3],
  [17, 2.99, 6275.96],
  [16, 0.03, 2544.31]
];
var EARTH_L2 = [
  [52919, 0, 0],
  [8720, 1.0721, 6283.0758],
  [309, 0.867, 12566.152],
  [27, 0.05, 3.52],
  [16, 5.19, 26.3],
  [16, 3.68, 155.42],
  [10, 0.76, 18849.23],
  [9, 2.06, 77713.77],
  [7, 0.83, 775.52],
  [5, 4.66, 1577.34]
];
var EARTH_L3 = [[289, 5.844, 6283.076], [35, 0, 0], [17, 5.49, 12566.15]];
var EARTH_L4 = [[114, 3.142, 0], [8, 4.13, 6283.08]];
var EARTH_L5 = [[1, 3.14, 0]];
function vsopSum(terms, tau) {
  let s = 0;
  for (const [a, b, c] of terms) s += a * Math.cos(b + c * tau);
  return s;
}
function earthHeliocentricLongitude(jdTT) {
  const tau = (jdTT - 2451545) / 365250;
  const L = vsopSum(EARTH_L0, tau) + vsopSum(EARTH_L1, tau) * tau + vsopSum(EARTH_L2, tau) * tau ** 2 + vsopSum(EARTH_L3, tau) * tau ** 3 + vsopSum(EARTH_L4, tau) * tau ** 4 + vsopSum(EARTH_L5, tau) * tau ** 5;
  return norm360(L / 1e8 / DEG);
}
function nutationInLongitude(T) {
  const omega = 125.04452 - 1934.136261 * T;
  const Ls = 280.4665 + 36000.7698 * T;
  const Lm = 218.3165 + 481267.8813 * T;
  const arcsec = -17.2 * sin(omega) - 1.32 * sin(2 * Ls) - 0.23 * sin(2 * Lm) + 0.21 * sin(2 * omega);
  return arcsec / 3600;
}
function sunLongitude(jd) {
  const jdTT = jd + deltaTdays(jd);
  const T = centuries(jdTT);
  let theta = earthHeliocentricLongitude(jdTT) + 180;
  theta -= 0.09033 / 3600;
  theta += nutationInLongitude(T);
  theta -= 20.4898 / 3600;
  return norm360(theta);
}
function equationOfTime(jd) {
  const T = centuries(jd + deltaTdays(jd));
  const L0 = norm360(280.46646 + 36000.76983 * T + 3032e-7 * T * T);
  const M = 357.52911 + 35999.05029 * T - 1537e-7 * T * T;
  const e = 0.016708634 - 42037e-9 * T - 1267e-10 * T * T;
  const eps0 = 23 + 26 / 60 + 21.448 / 3600 - (46.815 * T + 59e-5 * T * T - 1813e-6 * T ** 3) / 3600;
  const y = Math.tan(eps0 / 2 * DEG) ** 2;
  const E = y * Math.sin(2 * L0 * DEG) - 2 * e * sin(M) + 4 * e * y * sin(M) * Math.cos(2 * L0 * DEG) - 0.5 * y * y * Math.sin(4 * L0 * DEG) - 1.25 * e * e * Math.sin(2 * M * DEG);
  return E / DEG * 4;
}
function refineCrossing(targetLon, guessJD) {
  let lo = guessJD - 5;
  let hi = guessJD + 5;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (angleDiff(sunLongitude(mid), targetLon) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
var SUN_DEG_PER_DAY = 360 / 365.2422;
function solarTermJD(targetLon, startJD) {
  const ahead = norm360(targetLon - sunLongitude(startJD));
  return refineCrossing(targetLon, startJD + ahead / SUN_DEG_PER_DAY);
}
function prevSolarTermJD(targetLon, startJD) {
  const behind = norm360(sunLongitude(startJD) - targetLon);
  return refineCrossing(targetLon, startJD - behind / SUN_DEG_PER_DAY);
}
function solarTermSector(jd) {
  const lon = sunLongitude(jd);
  const index = Math.floor(norm360(lon - 315) / 30);
  const startLon = norm360(315 + index * 30);
  const endLon = norm360(startLon + 30);
  return {
    index,
    lon,
    startJD: prevSolarTermJD(startLon, jd),
    endJD: solarTermJD(endLon, jd)
  };
}
var MOON_LON_TERMS = [
  [0, 0, 1, 0, 6288774],
  [2, 0, -1, 0, 1274027],
  [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793],
  [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923],
  [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383],
  [2, 0, 0, -2, 15327],
  [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675],
  [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548],
  [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163],
  [1, 1, 0, 0, 4987],
  [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861],
  [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602],
  [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348],
  [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069],
  [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595],
  [4, -1, -1, 0, 1215],
  [0, 0, 2, 2, -1110],
  [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810],
  [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713],
  [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596],
  [4, 0, 1, 0, 549],
  [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520],
  [1, 0, -2, 0, -487]
];
function moonLongitude(jd) {
  const T = centuries(jd + deltaTdays(jd));
  const Lp = 218.3164477 + 481267.88123421 * T - 15786e-7 * T * T + T ** 3 / 538841 - T ** 4 / 65194e3;
  const D = 297.8501921 + 445267.1114034 * T - 18819e-7 * T * T + T ** 3 / 545868 - T ** 4 / 113065e3;
  const M = 357.5291092 + 35999.0502909 * T - 1536e-7 * T * T + T ** 3 / 2449e4;
  const Mp = 134.9633964 + 477198.8675055 * T + 87414e-7 * T * T + T ** 3 / 69699 - T ** 4 / 14712e3;
  const F = 93.272095 + 483202.0175233 * T - 36539e-7 * T * T - T ** 3 / 3526e3 + T ** 4 / 86331e4;
  const E = 1 - 2516e-6 * T - 74e-7 * T * T;
  let sigmaL = 0;
  for (const [d, m, mp, f, coef] of MOON_LON_TERMS) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const ecc = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sigmaL += coef * ecc * sin(arg);
  }
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  sigmaL += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  return norm360(Lp + sigmaL / 1e6);
}
function newMoonJD(k) {
  const T = k / 1236.85;
  let jde = 245155009766e-5 + 29.530588861 * k + 15437e-8 * T * T - 15e-8 * T ** 3 + 73e-11 * T ** 4;
  const E = 1 - 2516e-6 * T - 74e-7 * T * T;
  const M = 2.5534 + 29.1053567 * k - 14e-7 * T * T - 11e-8 * T ** 3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 1238e-8 * T ** 3 - 58e-9 * T ** 4;
  const F = 160.7108 + 390.67050284 * k - 16118e-7 * T * T - 227e-8 * T ** 3 + 11e-9 * T ** 4;
  const O = 124.7746 - 1.56375588 * k + 20672e-7 * T * T + 215e-8 * T ** 3;
  jde += -0.4072 * sin(Mp) + 0.17241 * E * sin(M) + 0.01608 * sin(2 * Mp) + 0.01039 * sin(2 * F) + 739e-5 * E * sin(Mp - M) - 514e-5 * E * sin(Mp + M) + 208e-5 * E * E * sin(2 * M) - 111e-5 * sin(Mp - 2 * F) - 57e-5 * sin(Mp + 2 * F) + 56e-5 * E * sin(2 * Mp + M) - 42e-5 * sin(3 * Mp) + 42e-5 * E * sin(M + 2 * F) + 38e-5 * E * sin(M - 2 * F) - 24e-5 * E * sin(2 * Mp - M) - 17e-5 * sin(O) - 7e-5 * sin(Mp + 2 * M) + 4e-5 * sin(2 * Mp - 2 * F) + 4e-5 * sin(3 * M) + 3e-5 * sin(Mp + M - 2 * F) + 3e-5 * sin(2 * Mp + 2 * F) - 3e-5 * sin(Mp + M + 2 * F) + 3e-5 * sin(Mp - M + 2 * F) - 2e-5 * sin(Mp - M - 2 * F) - 2e-5 * sin(3 * Mp + M) + 2e-5 * sin(4 * Mp);
  const A1 = 299.77 + 0.107408 * k - 9173e-6 * T * T;
  const A2 = 251.88 + 0.016321 * k;
  const A3 = 251.83 + 26.651886 * k;
  const A4 = 349.42 + 36.412478 * k;
  const A5 = 84.66 + 18.206239 * k;
  const A6 = 141.74 + 53.303771 * k;
  const A7 = 207.14 + 2.453732 * k;
  const A8 = 154.84 + 7.30686 * k;
  const A9 = 34.52 + 27.261239 * k;
  const A10 = 207.19 + 0.121824 * k;
  const A11 = 291.34 + 1.844379 * k;
  const A12 = 161.72 + 24.198154 * k;
  const A13 = 239.56 + 25.513099 * k;
  const A14 = 331.55 + 3.592518 * k;
  jde += 325e-6 * sin(A1) + 165e-6 * sin(A2) + 164e-6 * sin(A3) + 126e-6 * sin(A4) + 11e-5 * sin(A5) + 62e-6 * sin(A6) + 6e-5 * sin(A7) + 56e-6 * sin(A8) + 47e-6 * sin(A9) + 42e-6 * sin(A10) + 4e-5 * sin(A11) + 37e-6 * sin(A12) + 35e-6 * sin(A13) + 23e-6 * sin(A14);
  return jde - deltaTdays(jde);
}
function precession(jd) {
  const T = centuries(jd + deltaTdays(jd));
  return (5028.796195 * T + 1.1054348 * T * T) / 3600;
}
function lahiriAyanamsa(jd) {
  const T = centuries(jd + deltaTdays(jd));
  return 23.8534 + 1.3970833 * T + 3085e-7 * T * T;
}
function obliquity(jd) {
  const T = centuries(jd + deltaTdays(jd));
  return 23 + 26 / 60 + (21.448 - 46.815 * T - 59e-5 * T * T + 1813e-6 * T ** 3) / 3600;
}

// public/unse-8f3k2m/src/core/time.js
var KR_TZ_PERIODS = [
  { from: [1908, 4, 1], tz: 8.5 },
  { from: [1912, 1, 1], tz: 9 },
  { from: [1954, 3, 21], tz: 8.5 },
  { from: [1961, 8, 10], tz: 9 }
];
var KR_DST_PERIODS = [
  [[1948, 6, 1], [1948, 9, 12]],
  [[1949, 4, 3], [1949, 9, 10]],
  [[1950, 4, 1], [1950, 9, 10]],
  [[1951, 5, 6], [1951, 9, 8]],
  [[1955, 5, 5], [1955, 9, 8]],
  [[1956, 5, 20], [1956, 9, 29]],
  [[1957, 5, 5], [1957, 9, 21]],
  [[1958, 5, 4], [1958, 9, 20]],
  [[1959, 5, 3], [1959, 9, 19]],
  [[1960, 5, 1], [1960, 9, 17]],
  [[1987, 5, 10], [1987, 10, 11]],
  [[1988, 5, 8], [1988, 10, 9]]
];
var dayNum = ([y, m, d]) => toJDN(y, m, d);
function koreaStandardOffset(y, m, d) {
  const n = toJDN(y, m, d);
  let tz = 8.5;
  for (const p of KR_TZ_PERIODS) {
    if (n >= dayNum(p.from)) tz = p.tz;
  }
  return tz;
}
function koreaDST(y, m, d) {
  const n = toJDN(y, m, d);
  return KR_DST_PERIODS.some(([a, b]) => n >= dayNum(a) && n <= dayNum(b));
}
function normalizeBirth(input) {
  const { year, month, day, place } = input;
  const timeKnown = input.hour != null;
  const hour = timeKnown ? input.hour : 12;
  const minute = input.minute ?? 0;
  const corrections = [];
  let tz;
  if (place.kr) {
    tz = koreaStandardOffset(year, month, day);
    if (tz === 8.5) {
      corrections.push(`\uB2F9\uC2DC \uD55C\uAD6D \uD45C\uC900\uC2DC\uB294 \uB3D9\uACBD 127.5\xB0(UTC+8:30) \uAE30\uC900\uC774\uC5C8\uC2B5\uB2C8\uB2E4`);
    }
  } else {
    tz = place.tz;
  }
  const dstActive = place.kr ? koreaDST(year, month, day) : !!input.dst;
  if (dstActive) {
    corrections.push("\uC11C\uBA38\uD0C0\uC784 \uC2DC\uD589 \uAE30\uAC04 \u2192 1\uC2DC\uAC04 \uCC28\uAC10");
  }
  const tzEffective = tz + (dstActive ? 1 : 0);
  const jdUT = toJD(year, month, day, hour, minute) - tzEffective / 24;
  const standardMeridian = tz * 15;
  const lonMinutes = (place.lon - standardMeridian) * 4;
  const eotMinutes = equationOfTime(jdUT);
  const jdTST = jdUT + place.lon / 15 / 24 + eotMinutes / 1440;
  if (timeKnown) {
    const sign = (v) => v >= 0 ? "+" : "\u2212";
    corrections.push(
      `\uACBD\uB3C4 \uBCF4\uC815 ${sign(lonMinutes)}${Math.abs(lonMinutes).toFixed(1)}\uBD84 (\uB3D9\uACBD ${place.lon.toFixed(2)}\xB0 vs \uD45C\uC900 ${standardMeridian}\xB0)`
    );
    corrections.push(
      `\uADE0\uC2DC\uCC28 ${sign(eotMinutes)}${Math.abs(eotMinutes).toFixed(1)}\uBD84`
    );
  }
  return {
    jdUT,
    jdTST,
    tst: fromJD(jdTST),
    tzUsed: tz,
    dstActive,
    timeKnown,
    totalShiftMinutes: lonMinutes + eotMinutes,
    corrections
  };
}

// public/unse-8f3k2m/src/core/lunar.js
function kstDay(jd) {
  return Math.floor(jd + 9 / 24 + 0.5);
}
function newMoonIndexOnOrBefore(dayNumber) {
  let k = Math.round((dayNumber - 24515501e-1) / 29.530588861);
  let guard = 0;
  while (kstDay(newMoonJD(k)) > dayNumber && guard++ < 40) k--;
  while (kstDay(newMoonJD(k + 1)) <= dayNumber && guard++ < 40) k++;
  return k;
}
function containsMajorTerm(startJD, endJD) {
  const lon = sunLongitude(startJD);
  let target = Math.ceil(lon / 30 - 1e-9) * 30;
  target = (target % 360 + 360) % 360;
  const termJD = solarTermJD(target, startJD);
  return kstDay(termJD) < kstDay(endJD);
}
function buildLunarCycle(jd) {
  let ws = prevSolarTermJD(270, jd);
  let k11 = newMoonIndexOnOrBefore(kstDay(ws));
  if (kstDay(newMoonJD(k11)) > kstDay(jd)) {
    ws = prevSolarTermJD(270, ws - 10);
    k11 = newMoonIndexOnOrBefore(kstDay(ws));
  }
  let ws2 = solarTermJD(270, ws + 10);
  let k11next = newMoonIndexOnOrBefore(kstDay(ws2));
  if (kstDay(jd) >= kstDay(newMoonJD(k11next))) {
    ws = ws2;
    k11 = k11next;
    ws2 = solarTermJD(270, ws + 10);
    k11next = newMoonIndexOnOrBefore(kstDay(ws2));
  }
  const monthCount = k11next - k11;
  let leapIndex = -1;
  if (monthCount === 13) {
    for (let i = 1; i < 13; i++) {
      if (!containsMajorTerm(newMoonJD(k11 + i), newMoonJD(k11 + i + 1))) {
        leapIndex = i;
        break;
      }
    }
  }
  const months = [];
  let num2 = 11;
  let lunarYear = fromJD(ws + 9 / 24).y;
  let first = true;
  for (let i = 0; i < monthCount; i++) {
    const isLeap = i === leapIndex;
    if (!isLeap) {
      if (!first) {
        num2 = num2 === 12 ? 1 : num2 + 1;
        if (num2 === 1) lunarYear += 1;
      }
      first = false;
    }
    const start = kstDay(newMoonJD(k11 + i));
    const end = kstDay(newMoonJD(k11 + i + 1));
    months.push({ num: num2, isLeap, year: lunarYear, start, end, size: end - start });
  }
  return months;
}
function solarToLunar(y, m, d) {
  const dayNumber = toJDN(y, m, d);
  const jd = toJD(y, m, d, 12) - 9 / 24;
  const months = buildLunarCycle(jd);
  const month = months.find((mm) => dayNumber >= mm.start && dayNumber < mm.end);
  if (!month) throw new Error(`\uC74C\uB825 \uBCC0\uD658 \uC2E4\uD328: ${y}-${m}-${d}`);
  return {
    year: month.year,
    month: month.num,
    day: dayNumber - month.start + 1,
    isLeap: month.isLeap,
    isBigMonth: month.size === 30
  };
}

// public/unse-8f3k2m/src/core/ganzhi.js
var STEMS = ["\u7532", "\u4E59", "\u4E19", "\u4E01", "\u620A", "\u5DF1", "\u5E9A", "\u8F9B", "\u58EC", "\u7678"];
var STEMS_KR = ["\uAC11", "\uC744", "\uBCD1", "\uC815", "\uBB34", "\uAE30", "\uACBD", "\uC2E0", "\uC784", "\uACC4"];
var BRANCHES = ["\u5B50", "\u4E11", "\u5BC5", "\u536F", "\u8FB0", "\u5DF3", "\u5348", "\u672A", "\u7533", "\u9149", "\u620C", "\u4EA5"];
var BRANCHES_KR = ["\uC790", "\uCD95", "\uC778", "\uBB18", "\uC9C4", "\uC0AC", "\uC624", "\uBBF8", "\uC2E0", "\uC720", "\uC220", "\uD574"];
var ZODIAC = ["\uC950", "\uC18C", "\uD638\uB791\uC774", "\uD1A0\uB07C", "\uC6A9", "\uBC40", "\uB9D0", "\uC591", "\uC6D0\uC22D\uC774", "\uB2ED", "\uAC1C", "\uB3FC\uC9C0"];
var STEM_ELEMENT = STEMS.map((_, i) => Math.floor(i / 2));
var STEM_YIN = STEMS.map((_, i) => i % 2);
var BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
var BRANCH_YIN = BRANCHES.map((_, i) => i % 2);
var HIDDEN_STEMS = [
  [8, 9],
  // 子
  [9, 7, 5],
  // 丑
  [4, 2, 0],
  // 寅
  [0, 1],
  // 卯
  [1, 9, 4],
  // 辰
  [4, 6, 2],
  // 巳
  [2, 5, 3],
  // 午
  [3, 1, 5],
  // 未
  [4, 8, 6],
  // 申
  [6, 7],
  // 酉
  [7, 3, 4],
  // 戌
  [4, 0, 8]
  // 亥
];
var MAIN_HIDDEN = HIDDEN_STEMS.map((a) => a[a.length - 1]);
function isClash(a, b) {
  return (a + 6) % 12 === b % 12;
}
var TEN_GODS = {
  \uBE44\uACAC: "\u6BD4\u80A9",
  \uAC81\uC7AC: "\u52AB\u8CA1",
  \uC2DD\uC2E0: "\u98DF\u795E",
  \uC0C1\uAD00: "\u50B7\u5B98",
  \uD3B8\uC7AC: "\u504F\u8CA1",
  \uC815\uC7AC: "\u6B63\u8CA1",
  \uD3B8\uAD00: "\u504F\u5B98",
  \uC815\uAD00: "\u6B63\u5B98",
  \uD3B8\uC778: "\u504F\u5370",
  \uC815\uC778: "\u6B63\u5370"
};
var TEN_GOD_LIST = Object.keys(TEN_GODS);
function ganzhiName(stem, branch2) {
  return {
    hanja: STEMS[stem] + BRANCHES[branch2],
    kr: STEMS_KR[stem] + BRANCHES_KR[branch2],
    stem,
    branch: branch2,
    element: STEM_ELEMENT[stem],
    branchElement: BRANCH_ELEMENT[branch2]
  };
}
function sexagenaryIndex(stem, branch2) {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stem && i % 12 === branch2) return i;
  }
  return -1;
}
function computeFourPillars(jdUT, jdTST, opts = {}) {
  const { timeKnown = true, lateZiNextDay = true } = opts;
  const ipchunJD = prevSolarTermJD(315, jdUT);
  const sajuYear = fromJD(ipchunJD + 9 / 24).y;
  const yearStem = ((sajuYear - 4) % 10 + 10) % 10;
  const yearBranch = ((sajuYear - 4) % 12 + 12) % 12;
  const sector = solarTermSector(jdUT);
  const monthBranch = (sector.index + 2) % 12;
  const monthStemBase = (yearStem % 5 * 2 + 2) % 10;
  const monthStem = (monthStemBase + sector.index) % 10;
  const t = fromJD(jdTST);
  let dayJDN = toJDN(t.y, t.m, t.d);
  if (lateZiNextDay && t.h >= 23) dayJDN += 1;
  const dayStem = (dayJDN + 9) % 10;
  const dayBranch = (dayJDN + 1) % 12;
  let hourStem = null, hourBranch = null;
  if (timeKnown) {
    hourBranch = Math.floor((t.h + 1) % 24 / 2);
    const hourStemBase = dayStem % 5 * 2 % 10;
    hourStem = (hourStemBase + hourBranch) % 10;
  }
  const pillars = {
    year: ganzhiName(yearStem, yearBranch),
    month: ganzhiName(monthStem, monthBranch),
    day: ganzhiName(dayStem, dayBranch),
    hour: timeKnown ? ganzhiName(hourStem, hourBranch) : null
  };
  return {
    sajuYear,
    pillars,
    dayStem,
    // 일간 = 사주의 주인공
    sector,
    // 절기 구간 (대운 계산에 쓴다)
    zodiac: ZODIAC[yearBranch],
    timeKnown
  };
}
function elementDistribution(pillars) {
  const count = [0, 0, 0, 0, 0];
  const list = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean);
  for (const p of list) {
    count[STEM_ELEMENT[p.stem]] += 1;
    const hidden = HIDDEN_STEMS[p.branch];
    const weights = hidden.length === 2 ? [0.3, 1] : [0.2, 0.4, 1];
    hidden.forEach((s, i) => {
      count[STEM_ELEMENT[s]] += weights[i];
    });
  }
  const total = count.reduce((a, b) => a + b, 0);
  const pct = count.map((c) => total ? c / total * 100 : 0);
  const max = Math.max(...count);
  const min = Math.min(...count);
  return {
    count: count.map((c) => Math.round(c * 10) / 10),
    pct: pct.map((p) => Math.round(p * 10) / 10),
    strongest: count.indexOf(max),
    weakest: count.indexOf(min),
    missing: count.map((c, i) => c < 0.5 ? i : -1).filter((i) => i >= 0)
  };
}
function yearPillar(year) {
  const s = ((year - 4) % 10 + 10) % 10;
  const b = ((year - 4) % 12 + 12) % 12;
  return ganzhiName(s, b);
}

// public/unse-8f3k2m/src/core/planets.js
var sin2 = (d) => Math.sin(d * DEG);
var cos = (d) => Math.cos(d * DEG);
var tan = (d) => Math.tan(d * DEG);
var asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) / DEG;
var atan2 = (y, x) => Math.atan2(y, x) / DEG;
var ELEMENTS = {
  \uC218\uC131: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [37e-8, 1906e-8, -594749e-8, 149472.67411175, 0.16047689, -0.12534081]
  ],
  \uAE08\uC131: [
    [0.72333566, 677672e-8, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [39e-7, -4107e-8, -7889e-7, 58517.81538729, 268329e-8, -0.27769418]
  ],
  \uC9C0\uAD6C: [
    [1.00000261, 0.01671123, -1531e-8, 100.46457166, 102.93768193, 0],
    [562e-8, -4392e-8, -0.01294668, 35999.37244981, 0.32327364, 0]
  ],
  \uD654\uC131: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [1847e-8, 7882e-8, -813131e-8, 19140.30268499, 0.44441088, -0.29257343]
  ],
  \uBAA9\uC131: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-11607e-8, -13253e-8, -183714e-8, 3034.74612775, 0.21252668, 0.20469106]
  ],
  \uD1A0\uC131: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-12506e-7, -50991e-8, 193609e-8, 1222.49362201, -0.41897216, -0.28867794]
  ],
  \uCC9C\uC655\uC131: [
    [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
    [-196176e-8, -4397e-8, -242939e-8, 428.48202785, 0.40805281, 0.04240589]
  ],
  \uD574\uC655\uC131: [
    [30.06992276, 859048e-8, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    [26291e-8, 5105e-8, 35372e-8, 218.45945325, -0.32241464, -508664e-8]
  ],
  \uBA85\uC655\uC131: [
    [39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
    [-31596e-8, 517e-7, 4818e-8, 145.20780515, -0.04062942, -0.01183482]
  ]
};
function eccentricAnomaly(M, e) {
  const eDeg = e / DEG;
  let E = M + eDeg * sin2(M);
  for (let i = 0; i < 12; i++) {
    const dM = M - (E - eDeg * sin2(E));
    const dE = dM / (1 - e * cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}
function heliocentricXYZ(name, T) {
  const [base, rate] = ELEMENTS[name];
  const [a, e, I, L, peri, node] = base.map((v, i) => v + rate[i] * T);
  const omega = peri - node;
  const M = norm360(L - peri);
  const E = eccentricAnomaly(M > 180 ? M - 360 : M, e);
  const xv = a * (cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * sin2(E);
  const co = cos(omega), so = sin2(omega);
  const cn = cos(node), sn = sin2(node);
  const ci = cos(I), si = sin2(I);
  return {
    x: (co * cn - so * sn * ci) * xv + (-so * cn - co * sn * ci) * yv,
    y: (co * sn + so * cn * ci) * xv + (-so * sn + co * cn * ci) * yv,
    z: so * si * xv + co * si * yv
  };
}
function geocentricLongitude(name, jd) {
  const T = (jd - 2451545) / 36525;
  const p = heliocentricXYZ(name, T);
  const earth = heliocentricXYZ("\uC9C0\uAD6C", T);
  const x = p.x - earth.x;
  const y = p.y - earth.y;
  return norm360(atan2(y, x) + precession(jd));
}
function meanNode(jd) {
  const T = (jd - 2451545) / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 20754e-7 * T * T);
}
var PLANET_ORDER = [
  "\uD0DC\uC591",
  "\uB2EC",
  "\uC218\uC131",
  "\uAE08\uC131",
  "\uD654\uC131",
  "\uBAA9\uC131",
  "\uD1A0\uC131",
  "\uCC9C\uC655\uC131",
  "\uD574\uC655\uC131",
  "\uBA85\uC655\uC131",
  "\uB77C\uD6C4",
  "\uCF00\uD22C"
];
function planetPositions(jd) {
  const out = {};
  const at = (t) => ({
    \uD0DC\uC591: sunLongitude(t),
    \uB2EC: moonLongitude(t),
    \uC218\uC131: geocentricLongitude("\uC218\uC131", t),
    \uAE08\uC131: geocentricLongitude("\uAE08\uC131", t),
    \uD654\uC131: geocentricLongitude("\uD654\uC131", t),
    \uBAA9\uC131: geocentricLongitude("\uBAA9\uC131", t),
    \uD1A0\uC131: geocentricLongitude("\uD1A0\uC131", t),
    \uCC9C\uC655\uC131: geocentricLongitude("\uCC9C\uC655\uC131", t),
    \uD574\uC655\uC131: geocentricLongitude("\uD574\uC655\uC131", t),
    \uBA85\uC655\uC131: geocentricLongitude("\uBA85\uC655\uC131", t),
    \uB77C\uD6C4: meanNode(t),
    \uCF00\uD22C: norm360(meanNode(t) + 180)
  });
  const now = at(jd);
  const next = at(jd + 1);
  for (const name of PLANET_ORDER) {
    const lon = now[name];
    const delta = (next[name] - lon + 540) % 360 - 180;
    out[name] = { lon, retrograde: delta < 0, speed: delta };
  }
  return out;
}
function gmst(jd) {
  const T = (jd - 2451545) / 36525;
  return norm360(
    280.46061837 + 360.98564736629 * (jd - 2451545) + 387933e-9 * T * T - T * T * T / 3871e4
  );
}
var lonFromRA = (ra, eps) => norm360(atan2(sin2(ra), cos(ra) * cos(eps)));
var declFromLon = (lon, eps) => asin(sin2(lon) * sin2(eps));
function placidusCusp(ramc, phi, eps, fraction, nocturnal) {
  let ad = 0;
  let lon = 0;
  for (let i = 0; i < 40; i++) {
    const arc = nocturnal ? 90 - ad : 90 + ad;
    const ra = nocturnal ? ramc + 180 - fraction * arc : ramc + fraction * arc;
    lon = lonFromRA(ra, eps);
    const decl = declFromLon(lon, eps);
    const t = tan(phi) * tan(decl);
    if (Math.abs(t) > 1) return null;
    const next = asin(t);
    if (Math.abs(next - ad) < 1e-9) {
      ad = next;
      break;
    }
    ad = next;
  }
  return norm360(lon);
}
function houses(jd, lat, lon) {
  const eps = obliquity(jd);
  const ramc = norm360(gmst(jd) + lon);
  const mc = norm360(atan2(sin2(ramc), cos(ramc) * cos(eps)));
  let asc = norm360(atan2(cos(ramc), -(sin2(ramc) * cos(eps) + tan(lat) * sin2(eps))));
  if (norm360(asc - mc) > 180) asc = norm360(asc + 180);
  const cusps = new Array(13).fill(0);
  cusps[1] = asc;
  cusps[10] = mc;
  const c11 = placidusCusp(ramc, lat, eps, 1 / 3, false);
  const c12 = placidusCusp(ramc, lat, eps, 2 / 3, false);
  const c2 = placidusCusp(ramc, lat, eps, 2 / 3, true);
  const c3 = placidusCusp(ramc, lat, eps, 1 / 3, true);
  if (c11 == null || c12 == null || c2 == null || c3 == null) {
    for (let i = 1; i <= 12; i++) cusps[i] = norm360(asc + (i - 1) * 30);
    return { asc, mc, cusps, system: "\uB4F1\uBD84 (\uACE0\uC704\uB3C4\uB77C \uD50C\uB77C\uC2DC\uB450\uC2A4 \uBD88\uAC00)", ramc, eps };
  }
  cusps[11] = c11;
  cusps[12] = c12;
  cusps[2] = c2;
  cusps[3] = c3;
  cusps[4] = norm360(cusps[10] + 180);
  cusps[5] = norm360(cusps[11] + 180);
  cusps[6] = norm360(cusps[12] + 180);
  cusps[7] = norm360(cusps[1] + 180);
  cusps[8] = norm360(cusps[2] + 180);
  cusps[9] = norm360(cusps[3] + 180);
  return { asc, mc, cusps, system: "\uD50C\uB77C\uC2DC\uB450\uC2A4", ramc, eps };
}
function toSidereal(lon, jd) {
  return norm360(lon - lahiriAyanamsa(jd));
}

// public/unse-8f3k2m/src/core/place.js
var CITIES = [
  // ── 한국 ──
  { name: "\uC11C\uC6B8", lat: 37.5665, lon: 126.978, tz: 9, kr: true },
  { name: "\uC778\uCC9C", lat: 37.4563, lon: 126.7052, tz: 9, kr: true },
  { name: "\uC218\uC6D0", lat: 37.2636, lon: 127.0286, tz: 9, kr: true },
  { name: "\uC131\uB0A8", lat: 37.42, lon: 127.1265, tz: 9, kr: true },
  { name: "\uC6A9\uC778", lat: 37.2411, lon: 127.1776, tz: 9, kr: true },
  { name: "\uACE0\uC591", lat: 37.6584, lon: 126.832, tz: 9, kr: true },
  { name: "\uBD80\uCC9C", lat: 37.5035, lon: 126.766, tz: 9, kr: true },
  { name: "\uC548\uC0B0", lat: 37.3219, lon: 126.8309, tz: 9, kr: true },
  { name: "\uC758\uC815\uBD80", lat: 37.7381, lon: 127.0338, tz: 9, kr: true },
  { name: "\uCD98\uCC9C", lat: 37.8813, lon: 127.73, tz: 9, kr: true },
  { name: "\uC6D0\uC8FC", lat: 37.3422, lon: 127.9202, tz: 9, kr: true },
  { name: "\uAC15\uB989", lat: 37.7519, lon: 128.8761, tz: 9, kr: true },
  { name: "\uB300\uC804", lat: 36.3504, lon: 127.3845, tz: 9, kr: true },
  { name: "\uC138\uC885", lat: 36.48, lon: 127.289, tz: 9, kr: true },
  { name: "\uCCAD\uC8FC", lat: 36.6424, lon: 127.489, tz: 9, kr: true },
  { name: "\uCC9C\uC548", lat: 36.8151, lon: 127.1139, tz: 9, kr: true },
  { name: "\uACF5\uC8FC", lat: 36.4465, lon: 127.119, tz: 9, kr: true },
  { name: "\uAD11\uC8FC\uAD11\uC5ED\uC2DC", lat: 35.1595, lon: 126.8526, tz: 9, kr: true },
  { name: "\uAD11\uC8FC(\uACBD\uAE30)", lat: 37.4292, lon: 127.255, tz: 9, kr: true },
  { name: "\uC804\uC8FC", lat: 35.8242, lon: 127.148, tz: 9, kr: true },
  { name: "\uAD70\uC0B0", lat: 35.9676, lon: 126.737, tz: 9, kr: true },
  { name: "\uBAA9\uD3EC", lat: 34.8118, lon: 126.3922, tz: 9, kr: true },
  { name: "\uC5EC\uC218", lat: 34.7604, lon: 127.6622, tz: 9, kr: true },
  { name: "\uC21C\uCC9C", lat: 34.9506, lon: 127.4872, tz: 9, kr: true },
  { name: "\uB300\uAD6C", lat: 35.8714, lon: 128.6014, tz: 9, kr: true },
  { name: "\uD3EC\uD56D", lat: 36.019, lon: 129.3435, tz: 9, kr: true },
  { name: "\uACBD\uC8FC", lat: 35.8562, lon: 129.2247, tz: 9, kr: true },
  { name: "\uC548\uB3D9", lat: 36.5684, lon: 128.7294, tz: 9, kr: true },
  { name: "\uAD6C\uBBF8", lat: 36.1196, lon: 128.3446, tz: 9, kr: true },
  { name: "\uBD80\uC0B0", lat: 35.1796, lon: 129.0756, tz: 9, kr: true },
  { name: "\uC6B8\uC0B0", lat: 35.5384, lon: 129.3114, tz: 9, kr: true },
  { name: "\uCC3D\uC6D0", lat: 35.228, lon: 128.6811, tz: 9, kr: true },
  { name: "\uC9C4\uC8FC", lat: 35.18, lon: 128.1076, tz: 9, kr: true },
  { name: "\uC81C\uC8FC", lat: 33.4996, lon: 126.5312, tz: 9, kr: true },
  { name: "\uC11C\uADC0\uD3EC", lat: 33.2541, lon: 126.56, tz: 9, kr: true },
  { name: "\uC5EC\uC8FC", lat: 37.2982, lon: 127.6372, tz: 9, kr: true },
  { name: "\uC774\uCC9C", lat: 37.2723, lon: 127.435, tz: 9, kr: true },
  { name: "\uD3C9\uD0DD", lat: 36.9921, lon: 127.1129, tz: 9, kr: true },
  { name: "\uC548\uC591", lat: 37.3943, lon: 126.9568, tz: 9, kr: true },
  { name: "\uAD11\uBA85", lat: 37.4781, lon: 126.8646, tz: 9, kr: true },
  { name: "\uC2DC\uD765", lat: 37.38, lon: 126.8029, tz: 9, kr: true },
  { name: "\uD30C\uC8FC", lat: 37.7599, lon: 126.78, tz: 9, kr: true },
  { name: "\uAE40\uD3EC", lat: 37.6152, lon: 126.7156, tz: 9, kr: true },
  { name: "\uB0A8\uC591\uC8FC", lat: 37.636, lon: 127.2165, tz: 9, kr: true },
  { name: "\uAD6C\uB9AC", lat: 37.5943, lon: 127.1296, tz: 9, kr: true },
  { name: "\uD558\uB0A8", lat: 37.5393, lon: 127.2148, tz: 9, kr: true },
  { name: "\uC624\uC0B0", lat: 37.1499, lon: 127.0774, tz: 9, kr: true },
  { name: "\uD654\uC131", lat: 37.1995, lon: 126.8314, tz: 9, kr: true },
  { name: "\uC591\uC8FC", lat: 37.7853, lon: 127.0458, tz: 9, kr: true },
  { name: "\uD3EC\uCC9C", lat: 37.8949, lon: 127.2003, tz: 9, kr: true },
  { name: "\uB3D9\uB450\uCC9C", lat: 37.9036, lon: 127.0606, tz: 9, kr: true },
  { name: "\uC548\uC131", lat: 37.008, lon: 127.2797, tz: 9, kr: true },
  { name: "\uC758\uC655", lat: 37.3449, lon: 126.9682, tz: 9, kr: true },
  { name: "\uAD70\uD3EC", lat: 37.3617, lon: 126.9352, tz: 9, kr: true },
  { name: "\uACFC\uCC9C", lat: 37.4292, lon: 126.9877, tz: 9, kr: true },
  { name: "\uC18D\uCD08", lat: 38.207, lon: 128.5918, tz: 9, kr: true },
  { name: "\uB3D9\uD574", lat: 37.5247, lon: 129.1143, tz: 9, kr: true },
  { name: "\uC0BC\uCC99", lat: 37.45, lon: 129.1653, tz: 9, kr: true },
  { name: "\uD0DC\uBC31", lat: 37.1641, lon: 128.9856, tz: 9, kr: true },
  { name: "\uCDA9\uC8FC", lat: 36.991, lon: 127.9259, tz: 9, kr: true },
  { name: "\uC81C\uCC9C", lat: 37.1326, lon: 128.191, tz: 9, kr: true },
  { name: "\uC544\uC0B0", lat: 36.7898, lon: 127.0018, tz: 9, kr: true },
  { name: "\uC11C\uC0B0", lat: 36.7848, lon: 126.4503, tz: 9, kr: true },
  { name: "\uB17C\uC0B0", lat: 36.1872, lon: 127.0987, tz: 9, kr: true },
  { name: "\uB2F9\uC9C4", lat: 36.8895, lon: 126.6457, tz: 9, kr: true },
  { name: "\uBCF4\uB839", lat: 36.3333, lon: 126.6128, tz: 9, kr: true },
  { name: "\uC775\uC0B0", lat: 35.9483, lon: 126.9576, tz: 9, kr: true },
  { name: "\uC815\uC74D", lat: 35.5699, lon: 126.8558, tz: 9, kr: true },
  { name: "\uB0A8\uC6D0", lat: 35.4164, lon: 127.3905, tz: 9, kr: true },
  { name: "\uB098\uC8FC", lat: 35.016, lon: 126.7108, tz: 9, kr: true },
  { name: "\uAD11\uC591", lat: 34.9407, lon: 127.6959, tz: 9, kr: true },
  { name: "\uAE40\uCC9C", lat: 36.1398, lon: 128.1136, tz: 9, kr: true },
  { name: "\uC601\uC8FC", lat: 36.8056, lon: 128.624, tz: 9, kr: true },
  { name: "\uC0C1\uC8FC", lat: 36.411, lon: 128.159, tz: 9, kr: true },
  { name: "\uACBD\uC0B0", lat: 35.8251, lon: 128.7411, tz: 9, kr: true },
  { name: "\uAE40\uD574", lat: 35.2285, lon: 128.8894, tz: 9, kr: true },
  { name: "\uC591\uC0B0", lat: 35.335, lon: 129.0372, tz: 9, kr: true },
  { name: "\uD1B5\uC601", lat: 34.8544, lon: 128.4331, tz: 9, kr: true },
  { name: "\uAC70\uC81C", lat: 34.8804, lon: 128.6211, tz: 9, kr: true },
  { name: "\uBC00\uC591", lat: 35.5038, lon: 128.7465, tz: 9, kr: true },
  { name: "\uC0AC\uCC9C", lat: 35.0034, lon: 128.0642, tz: 9, kr: true },
  // ── 나머지 시·군 ──
  { name: "\uACC4\uB8E1", lat: 36.2744, lon: 127.2487, tz: 9, kr: true },
  { name: "\uAE40\uC81C", lat: 35.8038, lon: 126.8807, tz: 9, kr: true },
  { name: "\uBB38\uACBD", lat: 36.5868, lon: 128.1867, tz: 9, kr: true },
  { name: "\uC601\uCC9C", lat: 35.9733, lon: 128.9387, tz: 9, kr: true },
  { name: "\uC591\uD3C9", lat: 37.4917, lon: 127.4876, tz: 9, kr: true },
  { name: "\uAC00\uD3C9", lat: 37.8315, lon: 127.5097, tz: 9, kr: true },
  { name: "\uC5F0\uCC9C", lat: 38.0965, lon: 127.0748, tz: 9, kr: true },
  { name: "\uAC15\uD654", lat: 37.7466, lon: 126.4878, tz: 9, kr: true },
  { name: "\uD64D\uCC9C", lat: 37.6971, lon: 127.8889, tz: 9, kr: true },
  { name: "\uD6A1\uC131", lat: 37.4917, lon: 127.985, tz: 9, kr: true },
  { name: "\uC601\uC6D4", lat: 37.1836, lon: 128.4618, tz: 9, kr: true },
  { name: "\uD3C9\uCC3D", lat: 37.3705, lon: 128.3902, tz: 9, kr: true },
  { name: "\uC815\uC120", lat: 37.3805, lon: 128.6608, tz: 9, kr: true },
  { name: "\uCCA0\uC6D0", lat: 38.1466, lon: 127.3131, tz: 9, kr: true },
  { name: "\uD654\uCC9C", lat: 38.106, lon: 127.7081, tz: 9, kr: true },
  { name: "\uC591\uAD6C", lat: 38.11, lon: 127.9899, tz: 9, kr: true },
  { name: "\uC778\uC81C", lat: 38.0696, lon: 128.1707, tz: 9, kr: true },
  { name: "\uACE0\uC131(\uAC15\uC6D0)", lat: 38.3806, lon: 128.4678, tz: 9, kr: true },
  { name: "\uC591\uC591", lat: 38.0754, lon: 128.619, tz: 9, kr: true },
  { name: "\uBCF4\uC740", lat: 36.4894, lon: 127.7294, tz: 9, kr: true },
  { name: "\uC625\uCC9C", lat: 36.3065, lon: 127.5714, tz: 9, kr: true },
  { name: "\uC601\uB3D9", lat: 36.175, lon: 127.7764, tz: 9, kr: true },
  { name: "\uC9C4\uCC9C", lat: 36.8554, lon: 127.4355, tz: 9, kr: true },
  { name: "\uAD34\uC0B0", lat: 36.8153, lon: 127.7867, tz: 9, kr: true },
  { name: "\uC74C\uC131", lat: 36.9403, lon: 127.6903, tz: 9, kr: true },
  { name: "\uB2E8\uC591", lat: 36.9846, lon: 128.3654, tz: 9, kr: true },
  { name: "\uC99D\uD3C9", lat: 36.7855, lon: 127.5814, tz: 9, kr: true },
  { name: "\uAE08\uC0B0", lat: 36.1089, lon: 127.488, tz: 9, kr: true },
  { name: "\uBD80\uC5EC", lat: 36.2757, lon: 126.9099, tz: 9, kr: true },
  { name: "\uC11C\uCC9C", lat: 36.0801, lon: 126.6917, tz: 9, kr: true },
  { name: "\uCCAD\uC591", lat: 36.4592, lon: 126.8022, tz: 9, kr: true },
  { name: "\uD64D\uC131", lat: 36.6014, lon: 126.6608, tz: 9, kr: true },
  { name: "\uC608\uC0B0", lat: 36.6827, lon: 126.845, tz: 9, kr: true },
  { name: "\uD0DC\uC548", lat: 36.7456, lon: 126.2978, tz: 9, kr: true },
  { name: "\uC644\uC8FC", lat: 35.9049, lon: 127.162, tz: 9, kr: true },
  { name: "\uC9C4\uC548", lat: 35.7917, lon: 127.4248, tz: 9, kr: true },
  { name: "\uBB34\uC8FC", lat: 36.0069, lon: 127.6606, tz: 9, kr: true },
  { name: "\uC7A5\uC218", lat: 35.6474, lon: 127.5212, tz: 9, kr: true },
  { name: "\uC784\uC2E4", lat: 35.6178, lon: 127.2892, tz: 9, kr: true },
  { name: "\uC21C\uCC3D", lat: 35.3744, lon: 127.1375, tz: 9, kr: true },
  { name: "\uACE0\uCC3D", lat: 35.4358, lon: 126.702, tz: 9, kr: true },
  { name: "\uBD80\uC548", lat: 35.7318, lon: 126.733, tz: 9, kr: true },
  { name: "\uB2F4\uC591", lat: 35.3211, lon: 126.9882, tz: 9, kr: true },
  { name: "\uACE1\uC131", lat: 35.282, lon: 127.2921, tz: 9, kr: true },
  { name: "\uAD6C\uB840", lat: 35.2026, lon: 127.4629, tz: 9, kr: true },
  { name: "\uACE0\uD765", lat: 34.6111, lon: 127.285, tz: 9, kr: true },
  { name: "\uBCF4\uC131", lat: 34.7714, lon: 127.08, tz: 9, kr: true },
  { name: "\uD654\uC21C", lat: 35.0645, lon: 126.9865, tz: 9, kr: true },
  { name: "\uC7A5\uD765", lat: 34.6816, lon: 126.907, tz: 9, kr: true },
  { name: "\uAC15\uC9C4", lat: 34.642, lon: 126.7673, tz: 9, kr: true },
  { name: "\uD574\uB0A8", lat: 34.5735, lon: 126.599, tz: 9, kr: true },
  { name: "\uC601\uC554", lat: 34.8001, lon: 126.6967, tz: 9, kr: true },
  { name: "\uBB34\uC548", lat: 34.99, lon: 126.4817, tz: 9, kr: true },
  { name: "\uD568\uD3C9", lat: 35.0658, lon: 126.5166, tz: 9, kr: true },
  { name: "\uC601\uAD11", lat: 35.2772, lon: 126.512, tz: 9, kr: true },
  { name: "\uC7A5\uC131", lat: 35.3018, lon: 126.7847, tz: 9, kr: true },
  { name: "\uC644\uB3C4", lat: 34.311, lon: 126.7551, tz: 9, kr: true },
  { name: "\uC9C4\uB3C4", lat: 34.4868, lon: 126.2634, tz: 9, kr: true },
  { name: "\uC2E0\uC548", lat: 34.8332, lon: 126.351, tz: 9, kr: true },
  { name: "\uAD70\uC704", lat: 36.2393, lon: 128.5727, tz: 9, kr: true },
  { name: "\uC758\uC131", lat: 36.3527, lon: 128.6971, tz: 9, kr: true },
  { name: "\uCCAD\uC1A1", lat: 36.4363, lon: 129.0571, tz: 9, kr: true },
  { name: "\uC601\uC591", lat: 36.6667, lon: 129.1124, tz: 9, kr: true },
  { name: "\uC601\uB355", lat: 36.415, lon: 129.3656, tz: 9, kr: true },
  { name: "\uCCAD\uB3C4", lat: 35.6474, lon: 128.7341, tz: 9, kr: true },
  { name: "\uACE0\uB839", lat: 35.7262, lon: 128.2628, tz: 9, kr: true },
  { name: "\uC131\uC8FC", lat: 35.919, lon: 128.2831, tz: 9, kr: true },
  { name: "\uCE60\uACE1", lat: 35.9955, lon: 128.4017, tz: 9, kr: true },
  { name: "\uC608\uCC9C", lat: 36.6578, lon: 128.4527, tz: 9, kr: true },
  { name: "\uBD09\uD654", lat: 36.8932, lon: 128.7325, tz: 9, kr: true },
  { name: "\uC6B8\uC9C4", lat: 36.993, lon: 129.4003, tz: 9, kr: true },
  { name: "\uC6B8\uB989", lat: 37.4843, lon: 130.9057, tz: 9, kr: true },
  { name: "\uC758\uB839", lat: 35.3222, lon: 128.2617, tz: 9, kr: true },
  { name: "\uD568\uC548", lat: 35.2724, lon: 128.4066, tz: 9, kr: true },
  { name: "\uCC3D\uB155", lat: 35.5444, lon: 128.4922, tz: 9, kr: true },
  { name: "\uACE0\uC131(\uACBD\uB0A8)", lat: 34.973, lon: 128.3222, tz: 9, kr: true },
  { name: "\uB0A8\uD574", lat: 34.8376, lon: 127.8925, tz: 9, kr: true },
  { name: "\uD558\uB3D9", lat: 35.0672, lon: 127.7514, tz: 9, kr: true },
  { name: "\uC0B0\uCCAD", lat: 35.4156, lon: 127.8736, tz: 9, kr: true },
  { name: "\uD568\uC591", lat: 35.5205, lon: 127.7252, tz: 9, kr: true },
  { name: "\uAC70\uCC3D", lat: 35.6868, lon: 127.9095, tz: 9, kr: true },
  { name: "\uD569\uCC9C", lat: 35.5666, lon: 128.1658, tz: 9, kr: true },
  // 북한 (출생지로 입력되는 경우가 있다)
  { name: "\uD3C9\uC591", lat: 39.0392, lon: 125.7625, tz: 9, kr: true },
  { name: "\uAC1C\uC131", lat: 37.97, lon: 126.5544, tz: 9, kr: true },
  { name: "\uD568\uD765", lat: 39.9183, lon: 127.5364, tz: 9, kr: true },
  { name: "\uC2E0\uC758\uC8FC", lat: 40.1006, lon: 124.3981, tz: 9, kr: true },
  // ── 해외 ──
  { name: "\uB3C4\uCFC4", lat: 35.6762, lon: 139.6503, tz: 9 },
  { name: "\uC624\uC0AC\uCE74", lat: 34.6937, lon: 135.5023, tz: 9 },
  { name: "\uBCA0\uC774\uC9D5", lat: 39.9042, lon: 116.4074, tz: 8 },
  { name: "\uC0C1\uD558\uC774", lat: 31.2304, lon: 121.4737, tz: 8 },
  { name: "\uD64D\uCF69", lat: 22.3193, lon: 114.1694, tz: 8 },
  { name: "\uD0C0\uC774\uBCA0\uC774", lat: 25.033, lon: 121.5654, tz: 8 },
  { name: "\uC2F1\uAC00\uD3EC\uB974", lat: 1.3521, lon: 103.8198, tz: 8 },
  { name: "\uD558\uB178\uC774", lat: 21.0278, lon: 105.8342, tz: 7 },
  { name: "\uBC29\uCF55", lat: 13.7563, lon: 100.5018, tz: 7 },
  { name: "\uC790\uCE74\uB974\uD0C0", lat: -6.2088, lon: 106.8456, tz: 7 },
  { name: "\uB9C8\uB2D0\uB77C", lat: 14.5995, lon: 120.9842, tz: 8 },
  { name: "\uB378\uB9AC", lat: 28.6139, lon: 77.209, tz: 5.5 },
  { name: "\uB450\uBC14\uC774", lat: 25.2048, lon: 55.2708, tz: 4 },
  { name: "\uBAA8\uC2A4\uD06C\uBC14", lat: 55.7558, lon: 37.6173, tz: 3 },
  { name: "\uBCA0\uB97C\uB9B0", lat: 52.52, lon: 13.405, tz: 1 },
  { name: "\uD30C\uB9AC", lat: 48.8566, lon: 2.3522, tz: 1 },
  { name: "\uB85C\uB9C8", lat: 41.9028, lon: 12.4964, tz: 1 },
  { name: "\uB7F0\uB358", lat: 51.5074, lon: -0.1278, tz: 0 },
  { name: "\uB274\uC695", lat: 40.7128, lon: -74.006, tz: -5 },
  { name: "\uD1A0\uB860\uD1A0", lat: 43.6532, lon: -79.3832, tz: -5 },
  { name: "\uC2DC\uCE74\uACE0", lat: 41.8781, lon: -87.6298, tz: -6 },
  { name: "\uB374\uBC84", lat: 39.7392, lon: -104.9903, tz: -7 },
  { name: "\uB85C\uC2A4\uC564\uC824\uB808\uC2A4", lat: 34.0522, lon: -118.2437, tz: -8 },
  { name: "\uC0CC\uD504\uB780\uC2DC\uC2A4\uCF54", lat: 37.7749, lon: -122.4194, tz: -8 },
  { name: "\uC2DC\uC560\uD2C0", lat: 47.6062, lon: -122.3321, tz: -8 },
  { name: "\uBC34\uCFE0\uBC84", lat: 49.2827, lon: -123.1207, tz: -8 },
  { name: "\uC0C1\uD30C\uC6B8\uB8E8", lat: -23.5505, lon: -46.6333, tz: -3 },
  { name: "\uC2DC\uB4DC\uB2C8", lat: -33.8688, lon: 151.2093, tz: 10 },
  { name: "\uBA5C\uBC84\uB978", lat: -37.8136, lon: 144.9631, tz: 10 },
  { name: "\uC624\uD074\uB79C\uB4DC", lat: -36.8485, lon: 174.7633, tz: 12 }
];
var BY_NAME = new Map(CITIES.map((c) => [c.name, c]));
function findCity(name) {
  return BY_NAME.get(name) ?? null;
}

// public/unse-8f3k2m/src/core/josa.js
function tailChar(word) {
  const s = String(word ?? "").trim().replace(/[)\]}\s]+$/, "");
  return s ? s.charCodeAt(s.length - 1) : null;
}
var DIGIT_JONG = [8, 8, 0, 16, 0, 0, 1, 8, 8, 0];
function jong(word) {
  const s = String(word ?? "").trim().replace(/[)\]}\s]+$/, "");
  const last = s[s.length - 1];
  if (/[0-9]/.test(last)) return DIGIT_JONG[Number(last)];
  const code = tailChar(word);
  if (code === null || code < 44032 || code > 55203) return null;
  return (code - 44032) % 28;
}
var PAIRS = {
  "\uC774": ["\uC774", "\uAC00"],
  "\uAC00": ["\uC774", "\uAC00"],
  "\uC740": ["\uC740", "\uB294"],
  "\uB294": ["\uC740", "\uB294"],
  "\uC744": ["\uC744", "\uB97C"],
  "\uB97C": ["\uC744", "\uB97C"],
  "\uACFC": ["\uACFC", "\uC640"],
  "\uC640": ["\uACFC", "\uC640"],
  "\uC73C\uB85C": ["\uC73C\uB85C", "\uB85C"],
  "\uB85C": ["\uC73C\uB85C", "\uB85C"],
  "\uC774\uB77C": ["\uC774\uB77C", "\uB77C"],
  "\uB77C": ["\uC774\uB77C", "\uB77C"],
  "\uC774\uB098": ["\uC774\uB098", "\uB098"],
  "\uB098": ["\uC774\uB098", "\uB098"]
};
function j(word, particle) {
  const pair = PAIRS[particle];
  const w = String(word ?? "");
  if (!pair) return w + particle;
  const t = jong(w);
  if (t === null) return `${w}${pair[0]}(${pair[1]})`;
  if (pair[0] === "\uC73C\uB85C" && t === 8) return `${w}\uB85C`;
  return w + (t !== 0 ? pair[0] : pair[1]);
}

// public/unse-8f3k2m/src/systems/_base.js
var WESTERN_TO_OHAENG = {
  \uBD88: [0, 1, 0, 0, 0],
  \uD759: [0, 0, 0.7, 0.3, 0],
  \uACF5\uAE30: [0.7, 0, 0, 0.3, 0],
  \uBB3C: [0, 0, 0, 0, 1]
};
var TAGS = [
  "\uB3C5\uB9BD",
  "\uC8FC\uB3C4",
  "\uACB0\uB2E8",
  "\uC2E4\uD589",
  "\uCC45\uC784",
  // 미는 힘
  "\uD45C\uD604",
  "\uC0AC\uAD50",
  "\uC790\uC720",
  "\uBCC0\uD654",
  // 밖으로 뻗는 힘
  "\uB0B4\uD5A5",
  "\uC9C1\uAD00",
  "\uAC10\uC218\uC131",
  "\uB3CC\uBD04",
  // 안으로 향하는 힘
  "\uBD84\uC11D",
  "\uD559\uC2B5",
  "\uC644\uBCBD",
  // 다듬는 힘
  "\uC778\uB0B4",
  "\uC548\uC815",
  "\uC7AC\uBB3C",
  "\uBA85\uC608"
  // 쌓는 힘
];
var TAG_SET = new Set(TAGS);
function validateTags(tags = []) {
  const bad = tags.filter((t) => !TAG_SET.has(t));
  if (bad.length) {
    console.warn(`[\uC6B4\uC138] \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC740 \uD0DC\uADF8\uAC00 \uBB34\uC2DC\uB418\uC5C8\uC2B5\uB2C8\uB2E4: ${bad.join(", ")}`);
  }
  return tags.filter((t) => TAG_SET.has(t));
}
function zeroElements() {
  return [0, 0, 0, 0, 0];
}
function zeroTraits() {
  return { \uC8FC\uB3C4: 0, \uC678\uD5A5: 0, \uAC10\uC131: 0, \uC548\uC815: 0, \uC2E4\uB9AC: 0 };
}
function emptyDomains() {
  return { \uC7AC\uBB3C: null, \uAD00\uACC4: null, \uC9C1\uC5C5: null, \uAC74\uAC15: null, \uD559\uC5C5: null };
}
function normalizeElements(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  if (sum <= 0) return zeroElements();
  return arr.map((v) => v / sum);
}
function result(o) {
  return {
    id: o.id,
    name: o.name,
    hanja: o.hanja ?? "",
    headline: o.headline ?? "",
    facts: o.facts ?? [],
    readings: o.readings ?? [],
    confidence: o.confidence ?? 1,
    signals: {
      elements: normalizeElements(o.signals?.elements ?? zeroElements()),
      traits: { ...zeroTraits(), ...o.signals?.traits ?? {} },
      domains: { ...emptyDomains(), ...o.signals?.domains ?? {} },
      tags: validateTags(o.signals?.tags),
      keywords: o.signals?.keywords ?? []
    }
  };
}
function modFrom1(n, m) {
  const r = n % m;
  return r === 0 ? m : r;
}
function weekdayFromJDN(jdn) {
  return (jdn + 1) % 7;
}
var WEEKDAY_KR = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];

// public/unse-8f3k2m/src/systems/sukyo.js
function nakshatraOf(jd) {
  const sidereal = norm360(moonLongitude(jd) - lahiriAyanamsa(jd));
  const span = 360 / 27;
  const index = Math.floor(sidereal / span);
  return { index, sidereal, pada: Math.floor(sidereal % span / (span / 4)) + 1 };
}
var SU = [
  ["\u5A41", "\uB8E8", "Ashwini", "\uBE60\uB974\uACE0 \uAC00\uBCCD\uC2B5\uB2C8\uB2E4. \uB0A8\uBCF4\uB2E4 \uBA3C\uC800 \uCD9C\uBC1C\uD558\uACE0 \uBA3C\uC800 \uB3C4\uCC29\uD558\uB294 \uC720\uD615\uC774\uB77C \uC0C8\uB85C \uC5EC\uB294 \uC77C\uC5D0 \uAC15\uD569\uB2C8\uB2E4. \uC624\uB798 \uBD99\uB4E4\uACE0 \uC788\uB294 \uAC83\uC740 \uC798 \uBABB \uACAC\uB525\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.6, \uC678\uD5A5: 0.5, \uC548\uC815: -0.4 }],
  ["\u80C3", "\uC704", "Bharani", "\uD488\uACE0 \uACAC\uB514\uB294 \uD798\uC774 \uD07D\uB2C8\uB2E4. \uAC89\uC73C\uB85C\uB294 \uC794\uC794\uD574 \uBCF4\uC5EC\uB3C4 \uC548\uC5D0 \uB20C\uB7EC\uB454 \uAC83\uC774 \uB9CE\uC2B5\uB2C8\uB2E4. \uD55C\uBC88 \uACB0\uC2EC\uD558\uBA74 \uB05D\uC744 \uBD05\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.3, \uAC10\uC131: 0.4, \uC548\uC815: 0.5 }],
  ["\u6634", "\uBB18", "Krittika", "\uB0A0\uC774 \uC11C \uC788\uC2B5\uB2C8\uB2E4. \uC633\uACE0 \uADF8\uB984\uC744 \uAC00\uB974\uB294 \uB208\uC774 \uB9E4\uC12D\uACE0 \uADF8\uB300\uB85C \uB9D0\uD569\uB2C8\uB2E4. \uD0DC\uC6CC\uC11C \uC815\uD654\uD558\uB294 \uC790\uB9AC\uB77C \uB0A1\uC740 \uAC83\uC744 \uB04A\uC5B4\uB0B4\uB294 \uB370 \uC4F8\uBAA8\uAC00 \uD07D\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.7, \uAC10\uC131: -0.4, \uC2E4\uB9AC: 0.3 }],
  ["\u7562", "\uD544", "Rohini", "\uB04C\uC5B4\uB2F9\uAE41\uB2C8\uB2E4. \uC544\uB984\uB2E4\uC6B4 \uAC83\uC744 \uC54C\uC544\uBCF4\uACE0 \uB9CC\uB4E4\uC5B4\uB0B4\uB294 \uAC10\uAC01\uC774 \uB6F0\uC5B4\uB0A9\uB2C8\uB2E4. \uD48D\uC694\uC640 \uC778\uC5F0\uC774 \uAE4A\uC9C0\uB9CC \uC560\uCC29\uC774 \uC9C0\uB098\uCCD0 \uB193\uC9C0 \uBABB\uD558\uB294 \uAC8C \uACFC\uC81C\uC785\uB2C8\uB2E4.", { \uC678\uD5A5: 0.4, \uAC10\uC131: 0.6, \uC2E4\uB9AC: 0.4 }],
  ["\u89DC", "\uC790", "Mrigashira", "\uCC3E\uC544\uB2E4\uB2D9\uB2C8\uB2E4. \uD638\uAE30\uC2EC\uC774 \uACC4\uC18D \uB2E4\uC74C \uAC83\uC744 \uAC00\uB9AC\uCF1C\uC11C \uD55C\uACF3\uC5D0 \uC624\uB798 \uBA38\uBB3C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD0D0\uC0C9\uACFC \uC870\uC0AC\uAC00 \uD544\uC694\uD55C \uC77C\uC5D0 \uC798 \uB9DE\uC2B5\uB2C8\uB2E4.", { \uC678\uD5A5: 0.3, \uC548\uC815: -0.5, \uAC10\uC131: 0.3 }],
  ["\u53C3", "\uC0BC", "Ardra", "\uD3ED\uD48D\uC6B0\uC785\uB2C8\uB2E4. \uAE30\uC874\uC758 \uAC83\uC744 \uD754\uB4E4\uC5B4 \uBD80\uC218\uACE0 \uC0C8\uB85C \uC138\uC6B0\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uAC10\uC815\uC758 \uC9C4\uD3ED\uC774 \uD06C\uACE0 \uADF8 \uD798\uC73C\uB85C \uB0A8\uC774 \uBABB \uD558\uB294 \uB3CC\uD30C\uB97C \uD574\uB0C5\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.5, \uAC10\uC131: 0.7, \uC548\uC815: -0.6 }],
  ["\u4E95", "\uC815", "Punarvasu", "\uB2E4\uC2DC \uB3CC\uC544\uC635\uB2C8\uB2E4. \uC783\uC5B4\uB3C4 \uD68C\uBCF5\uD558\uB294 \uD798\uC774 \uAC15\uD574\uC11C \uBB34\uB108\uC838\uB3C4 \uB2E4\uC2DC \uC12D\uB2C8\uB2E4. \uB108\uADF8\uB7FD\uACE0 \uC0AC\uB78C\uC744 \uC798 \uD488\uC2B5\uB2C8\uB2E4.", { \uC678\uD5A5: 0.4, \uAC10\uC131: 0.3, \uC548\uC815: 0.4 }],
  ["\u9B3C", "\uADC0", "Pushya", "\uAE30\uB985\uB2C8\uB2E4. 27\uC218 \uC911 \uAC00\uC7A5 \uC0C1\uC11C\uB86D\uAC8C \uBCF4\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uB0A8\uC744 \uB3CC\uBCF4\uACE0 \uBA39\uC774\uB294 \uB370\uC11C \uC790\uAE30 \uC790\uB9AC\uB97C \uCC3E\uC2B5\uB2C8\uB2E4.", { \uAC10\uC131: 0.5, \uC548\uC815: 0.6, \uC8FC\uB3C4: -0.2 }],
  ["\u67F3", "\uB958", "Ashlesha", "\uD718\uAC10\uC2B5\uB2C8\uB2E4. \uD1B5\uCC30\uC774 \uAE4A\uACE0 \uC0AC\uB78C\uC758 \uC18D\uC744 \uC77D\uC2B5\uB2C8\uB2E4. \uADF8 \uD798\uC774 \uC548\uC73C\uB85C \uD5A5\uD558\uBA74 \uC2A4\uC2A4\uB85C\uB97C \uC62D\uC544\uB9F5\uB2C8\uB2E4.", { \uAC10\uC131: 0.8, \uC678\uD5A5: -0.4, \uC2E4\uB9AC: 0.3 }],
  ["\u661F", "\uC131", "Magha", "\uC790\uB9AC\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uAD8C\uC704\uC640 \uC804\uD1B5, \uBFCC\uB9AC\uC640 \uC778\uC5F0\uC774 \uAE4A\uC5B4 \uC717\uC790\uB9AC\uC5D0 \uC549\uC744 \uB54C \uD3B8\uC548\uD569\uB2C8\uB2E4. \uC790\uC874\uC2EC\uC774 \uD310\uB2E8\uC744 \uAC00\uB9B4 \uB54C\uAC00 \uC788\uC2B5\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.8, \uC678\uD5A5: 0.2, \uC548\uC815: 0.4 }],
  ["\u5F35", "\uC7A5", "Purva Phalguni", "\uC990\uAE41\uB2C8\uB2E4. \uC0B6\uC758 \uC88B\uC740 \uAC83\uC744 \uB204\uB9B4 \uC904 \uC54C\uACE0 \uC0AC\uB78C\uC744 \uD3B8\uD558\uAC8C \uB9CC\uB4ED\uB2C8\uB2E4. \uCC3D\uC791\uACFC \uC5F0\uC560, \uC0AC\uAD50\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4.", { \uC678\uD5A5: 0.7, \uAC10\uC131: 0.5, \uC2E4\uB9AC: -0.2 }],
  ["\u7FFC", "\uC775", "Uttara Phalguni", "\uC57D\uC18D\uC744 \uC9C0\uD0B5\uB2C8\uB2E4. \uB9FA\uC740 \uAD00\uACC4\uC640 \uACC4\uC57D\uC744 \uB05D\uAE4C\uC9C0 \uAC74\uC0AC\uD569\uB2C8\uB2E4. \uB3C4\uC6C0\uC744 \uC8FC\uACE0\uBC1B\uB294 \uAD6C\uC870 \uC548\uC5D0\uC11C \uAC00\uC7A5 \uC798 \uC0BD\uB2C8\uB2E4.", { \uC548\uC815: 0.6, \uC2E4\uB9AC: 0.4, \uC8FC\uB3C4: 0.2 }],
  ["\u8EEB", "\uC9C4", "Hasta", "\uC190\uC7AC\uC8FC\uC785\uB2C8\uB2E4. \uBA38\uB9BF\uC18D\uC758 \uAC83\uC744 \uC2E4\uC81C \uBB3C\uAC74\uC73C\uB85C \uB9CC\uB4E4\uC5B4\uB0B4\uB294 \uC7AC\uB2A5\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uC190\uC73C\uB85C \uD558\uB294 \uC77C, \uAE30\uC220, \uC138\uACF5\uC5D0 \uAC15\uD569\uB2C8\uB2E4.", { \uC2E4\uB9AC: 0.7, \uC8FC\uB3C4: 0.3, \uAC10\uC131: 0.2 }],
  ["\u89D2", "\uAC01", "Chitra", "\uBE5B\uB0A9\uB2C8\uB2E4. \uB208\uC5D0 \uB744\uB294 \uAC83\uC744 \uB9CC\uB4E4\uACE0 \uC2A4\uC2A4\uB85C\uB3C4 \uB208\uC5D0 \uB755\uB2C8\uB2E4. \uB514\uC790\uC778\xB7\uAC74\uCD95\xB7\uC5F0\uCD9C\uCC98\uB7FC \uD615\uD0DC\uB97C \uB2E4\uB8E8\uB294 \uC77C\uACFC \uC778\uC5F0\uC774 \uAE4A\uC2B5\uB2C8\uB2E4.", { \uC678\uD5A5: 0.5, \uAC10\uC131: 0.5, \uC2E4\uB9AC: 0.3 }],
  ["\u4EA2", "\uD56D", "Swati", "\uBC14\uB78C\uC785\uB2C8\uB2E4. \uB3C5\uB9BD\uC744 \uC911\uC694\uD558\uAC8C \uC5EC\uAE30\uACE0 \uB9E4\uC774\uB294 \uAC83\uC744 \uACAC\uB514\uC9C0 \uBABB\uD569\uB2C8\uB2E4. \uD754\uB4E4\uB9AC\uBA74\uC11C\uB3C4 \uBD80\uB7EC\uC9C0\uC9C0 \uC54A\uB294 \uC720\uC5F0\uD568\uC774 \uBB34\uAE30\uC785\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.4, \uC548\uC815: -0.5, \uC678\uD5A5: 0.3 }],
  ["\u6C10", "\uC800", "Vishakha", "\uBAA9\uD45C\uB97C \uD5A5\uD569\uB2C8\uB2E4. \uC6D0\uD558\uB294 \uAC83\uC744 \uC815\uD558\uBA74 \uC9D1\uC694\uD558\uAC8C \uAC11\uB2C8\uB2E4. \uB450 \uAC08\uB798 \uC0AC\uC774\uC5D0\uC11C \uC624\uB798 \uACE0\uBBFC\uD558\uB294 \uAC83\uC774 \uD2B9\uC9D5\uC774\uC790 \uC57D\uC810\uC785\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.6, \uC2E4\uB9AC: 0.4, \uC548\uC815: -0.2 }],
  ["\u623F", "\uBC29", "Anuradha", "\uD568\uAED8\uD569\uB2C8\uB2E4. \uC0AC\uB78C\uC744 \uBAA8\uC73C\uACE0 \uAD00\uACC4\uB97C \uC624\uB798 \uC720\uC9C0\uD558\uB294 \uD798\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uB0AF\uC120 \uACF3\uC5D0\uC11C\uB3C4 \uAE08\uC138 \uC790\uAE30 \uC790\uB9AC\uB97C \uB9CC\uB4ED\uB2C8\uB2E4.", { \uC678\uD5A5: 0.6, \uAC10\uC131: 0.4, \uC548\uC815: 0.3 }],
  ["\u5FC3", "\uC2EC", "Jyeshtha", "\uC55E\uC7A5\uC12D\uB2C8\uB2E4. \uCC45\uC784\uC744 \uC9C0\uACE0 \uBCF4\uD638\uD558\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBB34\uAC8C\uB97C \uD63C\uC790 \uC9C0\uB824\uB2E4 \uACE0\uB9BD\uB418\uAE30 \uC27D\uC2B5\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.7, \uAC10\uC131: 0.3, \uC678\uD5A5: -0.2 }],
  ["\u5C3E", "\uBBF8", "Mula", "\uBFCC\uB9AC\uB97C \uBF51\uC2B5\uB2C8\uB2E4. \uD45C\uBA74\uC774 \uC544\uB2C8\uB77C \uADFC\uC6D0\uC744 \uD30C\uACE0\uB4DC\uB294 \uC0AC\uB78C\uC785\uB2C8\uB2E4. \uC5F0\uAD6C\xB7\uC218\uC0AC\xB7\uCE58\uC720\uCC98\uB7FC \uBC14\uB2E5\uC744 \uBCF4\uB294 \uC77C\uC5D0 \uB9DE\uC2B5\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.4, \uAC10\uC131: 0.5, \uC548\uC815: -0.4 }],
  ["\u7B95", "\uAE30", "Purva Ashadha", "\uAEBE\uC774\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC790\uAE30 \uC2E0\uB150\uC774 \uD655\uACE0\uD558\uACE0 \uC124\uB4DD\uD558\uB294 \uD798\uC774 \uC149\uB2C8\uB2E4. \uBB3C\uCC98\uB7FC \uBD88\uC5B4\uB098\uB294 \uD655\uC7A5\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.5, \uC678\uD5A5: 0.6, \uC548\uC815: -0.2 }],
  ["\u6597", "\uB450", "Uttara Ashadha", "\uB05D\uC744 \uBD05\uB2C8\uB2E4. \uC2DC\uC791\uBCF4\uB2E4 \uC644\uC8FC\uC5D0 \uAC15\uD558\uACE0, \uC624\uB798 \uAC78\uB9AC\uB294 \uC77C\uC5D0\uC11C \uC9C4\uAC00\uAC00 \uB0A9\uB2C8\uB2E4. \uBA85\uBD84\uC774 \uBD84\uBA85\uD574\uC57C \uC6C0\uC9C1\uC785\uB2C8\uB2E4.", { \uC8FC\uB3C4: 0.5, \uC548\uC815: 0.7, \uC2E4\uB9AC: 0.3 }],
  ["\u5973", "\uC5EC", "Shravana", "\uB4E3\uC2B5\uB2C8\uB2E4. \uBC30\uC6B0\uACE0 \uAE30\uB85D\uD558\uACE0 \uC804\uD558\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uB0A8\uC758 \uB9D0\uC744 \uC815\uD655\uD788 \uC62E\uAE30\uB294 \uB2A5\uB825\uC774 \uACE7 \uC790\uC0B0\uC774 \uB429\uB2C8\uB2E4.", { \uAC10\uC131: 0.4, \uC548\uC815: 0.5, \uC678\uD5A5: -0.2 }],
  ["\u865B", "\uD5C8", "Dhanishta", "\uBC15\uC790\uB97C \uC555\uB2C8\uB2E4. \uB9AC\uB4EC\uAC10\uACFC \uD0C0\uC774\uBC0D\uC774 \uC88B\uC544 \uC0AC\uB78C\uACFC \uD310\uC744 \uC798 \uB9DE\uCDA5\uB2C8\uB2E4. \uC7AC\uBB3C\uACFC \uC778\uC5F0\uC774 \uAE4A\uC740 \uC790\uB9AC\uB85C \uBD05\uB2C8\uB2E4.", { \uC678\uD5A5: 0.5, \uC2E4\uB9AC: 0.6, \uC8FC\uB3C4: 0.3 }],
  ["\u5371", "\uC704", "Shatabhisha", "\uACE0\uCE69\uB2C8\uB2E4. \uAC10\uCDB0\uC9C4 \uAC83\uC744 \uB2E4\uB8E8\uB294 \uC790\uB9AC\uB77C \uCE58\uC720\xB7\uBE44\uBC00\xB7\uC5F0\uAD6C\uC640 \uC778\uC5F0\uC774 \uAE4A\uC2B5\uB2C8\uB2E4. \uD63C\uC790 \uC788\uB294 \uC2DC\uAC04\uC774 \uBC18\uB4DC\uC2DC \uD544\uC694\uD569\uB2C8\uB2E4.", { \uC678\uD5A5: -0.5, \uAC10\uC131: 0.5, \uC2E4\uB9AC: 0.3 }],
  ["\u5BA4", "\uC2E4", "Purva Bhadrapada", "\uAE4A\uC774 \uBD05\uB2C8\uB2E4. \uD604\uC2E4 \uB108\uBA38\uB97C \uC0DD\uAC01\uD558\uACE0 \uADF9\uB2E8\uC744 \uC624\uAC11\uB2C8\uB2E4. \uD3C9\uBC94\uD55C \uD2C0\uC5D0 \uC798 \uC548 \uB9DE\uB294 \uB300\uC2E0 \uB0A8\uC774 \uBABB \uBCF4\uB294 \uAC83\uC744 \uBD05\uB2C8\uB2E4.", { \uAC10\uC131: 0.7, \uC548\uC815: -0.5, \uC8FC\uB3C4: 0.3 }],
  ["\u58C1", "\uBCBD", "Uttara Bhadrapada", "\uAC00\uB77C\uC549\uD799\uB2C8\uB2E4. \uAE4A\uACE0 \uC870\uC6A9\uD558\uBA70 \uD754\uB4E4\uB9AC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB0A8\uC758 \uACE0\uD1B5\uC744 \uACAC\uB514\uB294 \uD798\uC774 \uCEE4\uC11C \uAE30\uB300\uB294 \uC0AC\uB78C\uC774 \uB9CE\uC2B5\uB2C8\uB2E4.", { \uAC10\uC131: 0.5, \uC548\uC815: 0.8, \uC678\uD5A5: -0.3 }],
  ["\u594E", "\uADDC", "Revati", "\uB9C8\uBB34\uB9AC\uD569\uB2C8\uB2E4. 27\uC218\uC758 \uB9C8\uC9C0\uB9C9 \uC790\uB9AC\uB77C \uB05D\uB9FA\uACE0 \uBC30\uC6C5\uD558\uB294 \uC5ED\uD560\uC774 \uBD99\uC2B5\uB2C8\uB2E4. \uC628\uD654\uD558\uACE0 \uBCF4\uD638\uD558\uB294 \uAE30\uC6B4\uC774 \uAC15\uD569\uB2C8\uB2E4.", { \uAC10\uC131: 0.6, \uC548\uC815: 0.4, \uC8FC\uB3C4: -0.2 }]
];
var NAKSHATRA_NAMES = SU.map(([hanja, kr, sanskrit]) => ({ hanja, kr, sanskrit }));

// public/unse-8f3k2m/src/systems/juyeok.js
var HEXAGRAM_TABLE = [
  [1, 10, 13, 25, 44, 6, 33, 12],
  // 상 건
  [43, 58, 49, 17, 28, 47, 31, 45],
  // 상 태
  [14, 38, 30, 21, 50, 64, 56, 35],
  // 상 리
  [34, 54, 55, 51, 32, 40, 62, 16],
  // 상 진
  [9, 61, 37, 42, 57, 59, 53, 20],
  // 상 손
  [5, 60, 63, 3, 48, 29, 39, 8],
  // 상 감
  [26, 41, 22, 27, 18, 4, 52, 23],
  // 상 간
  [11, 19, 36, 24, 46, 7, 15, 2]
  // 상 곤
];
function hexOf(x) {
  const yearNum = x.yearBranch + 1;
  const hourNum = x.timeKnown ? x.hourBranch + 1 : 1;
  const base = yearNum + x.lunar.month + x.lunar.day;
  const upper = modFrom1(base, 8) - 1;
  const lower = modFrom1(base + hourNum, 8) - 1;
  return { upper, lower, num: HEXAGRAM_TABLE[upper][lower] };
}

// public/unse-8f3k2m/src/systems/yukim.js
var meta = {
  id: "yukim",
  name: "\uC721\uC784",
  hanja: "\u5927\u516D\u58EC",
  desc: "\uD0DC\uC5B4\uB09C \uC21C\uAC04\uC744 \uC810\uC2DC\uB85C \uC0BC\uC544 \uCC9C\uC9C0\uBC18\uACFC \uC0AC\uACFC\uC0BC\uC804\uC73C\uB85C \uAD6C\uB3C4\uB97C \uC77D\uB294\uB2E4",
  needsTime: true,
  requiresTime: true,
  // 시각이 없으면 판 자체가 안 서는 체계
  needsPlace: false
};
var GIGUNG = [2, 4, 5, 7, 5, 7, 8, 10, 11, 1];
var GENERALS = [
  ["\uADC0\uC778", "\u8CB4\u4EBA", "\uB3C4\uC6C0\uACFC \uC717\uC0AC\uB78C. \uC77C\uC774 \uC21C\uC870\uB86D\uAC8C \uD480\uB9AC\uB294 \uC790\uB9AC"],
  ["\uB4F1\uC0AC", "\u87A3\u86C7", "\uB180\uB77C\uC6C0\uACFC \uBD88\uC548. \uD5DB\uB41C \uADFC\uC2EC\uC774 \uC0DD\uAE30\uB294 \uC790\uB9AC"],
  ["\uC8FC\uC791", "\u6731\u96C0", "\uB9D0\uACFC \uBB38\uC11C. \uC18C\uC2DD\uC774 \uC624\uAC70\uB098 \uAD6C\uC124\uC774 \uC774\uB294 \uC790\uB9AC"],
  ["\uC721\uD569", "\u516D\u5408", "\uD654\uD569\uACFC \uACB0\uD569. \uC778\uC5F0\uACFC \uAC70\uB798\uAC00 \uB9FA\uC5B4\uC9C0\uB294 \uC790\uB9AC"],
  ["\uAD6C\uC9C4", "\u52FE\u9673", "\uC9C0\uCCB4\uC640 \uBD84\uC7C1. \uC5BD\uD600\uC11C \uB354\uB38C\uC9C0\uB294 \uC790\uB9AC"],
  ["\uCCAD\uB8E1", "\u9751\u9F8D", "\uC7AC\uBB3C\uACFC \uACBD\uC0AC. \uAC00\uC7A5 \uBC18\uAE30\uB294 \uC790\uB9AC"],
  ["\uCC9C\uACF5", "\u5929\u7A7A", "\uD5C8\uC640 \uAC70\uC9D3. \uAE30\uB300\uAC00 \uBE44\uB294 \uC790\uB9AC"],
  ["\uBC31\uD638", "\u767D\u864E", "\uC9C8\uBCD1\uACFC \uC0AC\uACE0. \uAE09\uD558\uACE0 \uD5D8\uD55C \uC77C\uC758 \uC790\uB9AC"],
  ["\uD0DC\uC0C1", "\u592A\u5E38", "\uC758\uC2DD\uACFC \uC548\uC815. \uBA39\uACE0 \uC785\uB294 \uC77C\uC758 \uC790\uB9AC"],
  ["\uD604\uBB34", "\u7384\u6B66", "\uB3C4\uB451\uACFC \uC740\uBC00\uD568. \uC783\uC5B4\uBC84\uB9AC\uACE0 \uAC10\uCDB0\uC9C0\uB294 \uC790\uB9AC"],
  ["\uD0DC\uC74C", "\u592A\u9670", "\uC228\uC74C\uACFC \uBCF4\uD638. \uC870\uC6A9\uD788 \uC9C0\uCF1C\uC9C0\uB294 \uC790\uB9AC"],
  ["\uCC9C\uD6C4", "\u5929\u540E", "\uC5EC\uC778\uACFC \uB0B4\uBC00\uD568. \uC0AC\uC801\uC778 \uC778\uC5F0\uC758 \uC790\uB9AC"]
];
var NOBLE = {
  0: [1, 7],
  4: [1, 7],
  6: [1, 7],
  // 甲戊庚
  1: [0, 8],
  5: [0, 8],
  // 乙己
  2: [11, 9],
  3: [11, 9],
  // 丙丁
  7: [6, 2],
  // 辛
  8: [5, 3],
  9: [5, 3]
  // 壬癸
};
var overcomes = (a, b) => (a + 2) % 5 === b;
function monthGeneral(jd) {
  const lon = sunLongitude(jd);
  const step = Math.floor(norm360(lon - 330) / 30);
  return ((11 - step) % 12 + 12) % 12;
}
function analyze(input) {
  const { jdUT, timeKnown, hourBranch } = input;
  if (!timeKnown) throw new Error("\uC721\uC784\uC740 \uD0DC\uC5B4\uB09C \uC2DC\uAC01\uC774 \uC788\uC5B4\uC57C \uCC9C\uBC18\uC744 \uB3CC\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4");
  const dayStem = input.dayStem;
  const dayBranch = input.dayBranch;
  const wolJang = monthGeneral(jdUT);
  const heaven = [];
  for (let i = 0; i < 12; i++) {
    heaven[i] = ((wolJang + (i - hourBranch)) % 12 + 12) % 12;
  }
  const gi = GIGUNG[dayStem];
  const courses = [
    { label: "1\uACFC", lower: gi, upper: heaven[gi], note: `\uC77C\uAC04 ${STEMS[dayStem]}\uC758 \uAE30\uAD81` },
    { label: "2\uACFC", lower: heaven[gi], upper: heaven[heaven[gi]], note: "1\uACFC\uC758 \uC0C1\uC2E0 \uC704" },
    { label: "3\uACFC", lower: dayBranch, upper: heaven[dayBranch], note: "\uC77C\uC9C0" },
    { label: "4\uACFC", lower: heaven[dayBranch], upper: heaven[heaven[dayBranch]], note: "3\uACFC\uC758 \uC0C1\uC2E0 \uC704" }
  ];
  const el = (b) => BRANCH_ELEMENT[b];
  const jeok = courses.filter((c) => overcomes(el(c.upper), el(c.lower)));
  const geuk = courses.filter((c) => overcomes(el(c.lower), el(c.upper)));
  let first = null;
  let style = "";
  const sameYin = (b) => b % 2 === STEM_YIN[dayStem];
  if (jeok.length === 1) {
    first = jeok[0].upper;
    style = "\uC801\uADF9\uBC95 (\u8CCA)";
  } else if (jeok.length === 0 && geuk.length === 1) {
    first = geuk[0].upper;
    style = "\uC801\uADF9\uBC95 (\u524B)";
  } else if (jeok.length > 1 || geuk.length > 1) {
    const pool = jeok.length > 1 ? jeok : geuk;
    const matched = pool.filter((c) => sameYin(c.upper));
    if (matched.length === 1) {
      first = matched[0].upper;
      style = "\uBE44\uC6A9\uBC95";
    } else {
      const score = (b) => BRANCHES.reduce((n, _, i) => n + (overcomes(el(i), el(b)) ? 1 : 0), 0);
      const best = (matched.length ? matched : pool).sort((a, b) => score(b.upper) - score(a.upper))[0];
      first = best.upper;
      style = "\uC12D\uD574\uBC95";
    }
  } else {
    const ups = courses.map((c) => c.upper);
    const toMe = ups.find((u) => overcomes(el(u), STEM_ELEMENT[dayStem]));
    const fromMe = ups.find((u) => overcomes(STEM_ELEMENT[dayStem], el(u)));
    if (toMe != null) {
      first = toMe;
      style = "\uC694\uADF9\uBC95 (\u84BF\u77E2)";
    } else if (fromMe != null) {
      first = fromMe;
      style = "\uC694\uADF9\uBC95 (\u5F48\u5C04)";
    } else {
      first = STEM_YIN[dayStem] === 0 ? heaven[9] : heaven.indexOf(9);
      style = "\uBB18\uC131\uBC95";
    }
  }
  const isBokeum = heaven.every((v, i) => v === i);
  const isBaneum = heaven.every((v, i) => isClash(i, v));
  if (isBokeum) style = "\uBCF5\uC74C\uACFC (\uCC9C\uC9C0\uBC18\uC774 \uACB9\uCE68)";
  if (isBaneum) style = "\uBC18\uC74C\uACFC (\uCC9C\uC9C0\uBC18\uC774 \uB9C8\uC8FC \uBD04)";
  const second = heaven[first];
  const third = heaven[second];
  const isDay = hourBranch >= 3 && hourBranch <= 8;
  const nobleSeat = NOBLE[dayStem][isDay ? 0 : 1];
  const noblePos = heaven.indexOf(nobleSeat);
  const forward = [11, 0, 1, 2, 3, 4].includes(noblePos);
  const generalAt = {};
  for (let i = 0; i < 12; i++) {
    const pos = ((noblePos + (forward ? i : -i)) % 12 + 12) % 12;
    generalAt[pos] = GENERALS[i];
  }
  const bn = (b) => `${BRANCHES[b]}(${BRANCHES_KR[b]})`;
  const gAt = (b) => generalAt[b] ? generalAt[b][0] : "";
  const facts = [
    { label: "\uC6D4\uC7A5", value: bn(wolJang), note: "\uD0DC\uC5B4\uB0A0 \uB54C \uD0DC\uC591\uC774 \uBA38\uBB38 \uC790\uB9AC" },
    { label: "\uC810\uC2DC", value: bn(hourBranch), note: "\uD0DC\uC5B4\uB09C \uC2DC\uAC01\uC758 \uC9C0\uC9C0" },
    { label: "\uC77C\uAC04 \uAE30\uAD81", value: `${STEMS[dayStem]} \u2192 ${bn(gi)}`, note: "\uCC9C\uAC04\uC774 \uBAB8\uC744 \uBD99\uC774\uB294 \uC790\uB9AC" },
    { label: "\uACFC\uCCB4", value: style, note: "\uC0BC\uC804\uC744 \uBF51\uC744 \uB54C \uAC78\uB9B0 \uADDC\uCE59" },
    { label: "\uCD08\uC804", value: `${bn(first)} ${gAt(first)}`, note: "\uC77C\uC758 \uC2DC\uC791" },
    { label: "\uC911\uC804", value: `${bn(second)} ${gAt(second)}`, note: "\uACFC\uC815" },
    { label: "\uB9D0\uC804", value: `${bn(third)} ${gAt(third)}`, note: "\uACB0\uB9D0" },
    // 귀인은 일간이 정하는 글자이고, 그것이 어느 지반에 올라탔는지가 따로다.
    // 지반만 적어두면 그 자리가 귀인인 줄로 읽힌다.
    {
      label: "\uADC0\uC778",
      value: `${bn(nobleSeat)} \u2192 ${bn(noblePos)}`,
      note: `${isDay ? "\uC8FC\uADC0" : "\uC57C\uADC0"} ${BRANCHES[nobleSeat]}\uAC00 \uC9C0\uBC18 ${BRANCHES[noblePos]}\uC5D0 \uC784\uD568 \xB7 ${forward ? "\uC21C\uD589" : "\uC5ED\uD589"}`
    }
  ];
  const readings = [
    {
      title: "\uC0AC\uACFC \u2014 \uC9C0\uAE08 \uB193\uC778 \uAD6C\uB3C4",
      mono: true,
      text: courses.map(
        (c) => `${c.label}  ${bn(c.upper)} / ${bn(c.lower)}  ${gAt(c.upper)}   (${c.note})`
      ).join("\n") + "\n\uC704\uAC00 \uCC9C\uBC18, \uC544\uB798\uAC00 \uC9C0\uBC18\uC785\uB2C8\uB2E4. 1\xB72\uACFC\uB294 \uC774 \uC0AC\uB78C \uC790\uC2E0\uC744, 3\xB74\uACFC\uB294 \uADF8\uAC00 \uB193\uC778 \uD658\uACBD\uC744 \uBD05\uB2C8\uB2E4."
    },
    {
      title: `\uC0BC\uC804 \u2014 ${style}`,
      text: `\uCD08\uC804 ${bn(first)}, \uC911\uC804 ${bn(second)}, \uB9D0\uC804 ${bn(third)}.
\uC77C\uC774 ${bn(first)}\uC5D0\uC11C \uC2DC\uC791\uD574 ${j(bn(second), "\uB97C")} \uAC70\uCCD0 ${j(bn(third), "\uB85C")} \uB05D\uB098\uB294 \uAD6C\uC870\uC785\uB2C8\uB2E4. ` + (isBokeum ? "\uCC9C\uBC18\uACFC \uC9C0\uBC18\uC774 \uC644\uC804\uD788 \uACB9\uCE5C \uBCF5\uC74C\uACFC\uC785\uB2C8\uB2E4. \uC6C0\uC9C1\uC784\uC774 \uB9C9\uD788\uACE0 \uC548\uC73C\uB85C \uB20C\uB9AC\uB294 \uD615\uAD6D\uC774\uB77C, \uB098\uC544\uAC00\uAE30\uBCF4\uB2E4 \uC790\uB9AC\uB97C \uC9C0\uD0A4\uB294 \uCABD\uC774 \uB9DE\uC2B5\uB2C8\uB2E4." : isBaneum ? "\uCC9C\uBC18\uACFC \uC9C0\uBC18\uC774 \uC815\uBA74\uC73C\uB85C \uB9C8\uC8FC \uBCF8 \uBC18\uC74C\uACFC\uC785\uB2C8\uB2E4. \uB4A4\uC9D1\uD788\uACE0 \uC624\uAC00\uB294 \uD615\uAD6D\uC774\uB77C \uBCC0\uB3D9\uC774 \uD06C\uACE0 \uC655\uB798\uAC00 \uC7A6\uC2B5\uB2C8\uB2E4." : "\uC0AC\uACFC \uC548\uC5D0\uC11C \uADF9\uC774 \uC77C\uC5B4\uB09C \uC790\uB9AC\uB97C \uCD08\uC804\uC73C\uB85C \uC0BC\uC558\uC2B5\uB2C8\uB2E4.")
    },
    {
      title: `\uCD08\uC804\uC758 \uCC9C\uC7A5 \u2014 ${generalAt[first] ? generalAt[first][0] : "\uC5C6\uC74C"}`,
      text: generalAt[first] ? `${generalAt[first][1]}. ${generalAt[first][2]}\uC785\uB2C8\uB2E4. \uC77C\uC774 \uCC98\uC74C \uC6C0\uC9C1\uC77C \uB54C \uC774 \uC131\uC9C8\uC774 \uB530\uB77C\uBD99\uC2B5\uB2C8\uB2E4.` : "\uCD08\uC804\uC5D0 \uCC9C\uC7A5\uC774 \uBC30\uCE58\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."
    },
    {
      title: `\uB9D0\uC804\uC758 \uCC9C\uC7A5 \u2014 ${generalAt[third] ? generalAt[third][0] : "\uC5C6\uC74C"}`,
      text: generalAt[third] ? `${generalAt[third][1]}. ${generalAt[third][2]}\uC785\uB2C8\uB2E4. \uACB0\uB9D0\uC758 \uC131\uACA9\uC774 \uC5EC\uAE30\uC11C \uB4DC\uB7EC\uB0A9\uB2C8\uB2E4.` : "\uB9D0\uC804\uC5D0 \uCC9C\uC7A5\uC774 \uBC30\uCE58\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."
    },
    {
      title: "\uCC9C\uC9C0\uBC18",
      mono: true,
      text: BRANCHES.map(
        (_, i) => `\uC9C0\uBC18 ${BRANCHES[i]} \u2192 \uCC9C\uBC18 ${BRANCHES[heaven[i]]} ${gAt(i)}`
      ).join("\n")
    }
  ];
  const elements = [0, 0, 0, 0, 0];
  elements[el(first)] += 2;
  elements[el(second)] += 1;
  elements[el(third)] += 1;
  const GENERAL_TAGS = {
    \uADC0\uC778: ["\uBA85\uC608", "\uB3CC\uBD04"],
    \uB4F1\uC0AC: ["\uAC10\uC218\uC131", "\uBCC0\uD654"],
    \uC8FC\uC791: ["\uD45C\uD604", "\uBD84\uC11D"],
    \uC721\uD569: ["\uC0AC\uAD50", "\uB3CC\uBD04"],
    \uAD6C\uC9C4: ["\uC778\uB0B4", "\uCC45\uC784"],
    \uCCAD\uB8E1: ["\uC7AC\uBB3C", "\uBA85\uC608"],
    \uCC9C\uACF5: ["\uBCC0\uD654", "\uC790\uC720"],
    \uBC31\uD638: ["\uACB0\uB2E8", "\uC2E4\uD589"],
    \uD0DC\uC0C1: ["\uC548\uC815", "\uC778\uB0B4"],
    \uD604\uBB34: ["\uC9C1\uAD00", "\uB0B4\uD5A5"],
    \uD0DC\uC74C: ["\uB0B4\uD5A5", "\uC644\uBCBD"],
    \uCC9C\uD6C4: ["\uAC10\uC218\uC131", "\uC0AC\uAD50"]
  };
  const tag = GENERAL_TAGS[gAt(first)] ?? ["\uBCC0\uD654"];
  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `${style} \xB7 ${BRANCHES[first]}\u2192${BRANCHES[second]}\u2192${BRANCHES[third]}`,
    facts,
    readings,
    signals: {
      elements,
      traits: {},
      domains: { \uC7AC\uBB3C: null, \uAD00\uACC4: null, \uC9C1\uC5C5: null, \uAC74\uAC15: null, \uD559\uC5C5: null },
      tags: tag,
      keywords: [style, gAt(first)]
    }
  });
}

// public/unse-8f3k2m/src/systems/hongguk.js
var meta2 = {
  id: "hongguk",
  name: "\uD64D\uAD6D\uAE30\uBB38",
  hanja: "\u6D2A\u5C40\u5947\u9580",
  desc: "\uC0AC\uC8FC \uC5EC\uB35F \uAE00\uC790\uB97C \uC22B\uC790\uB85C \uBC14\uAFD4 \uAD6C\uAD81\uC5D0 \uD3BC\uCCD0 \uB193\uACE0 \uBCF8\uB2E4",
  needsTime: true,
  requiresTime: true,
  // 시각이 없으면 판 자체가 안 서는 체계
  needsPlace: false
};
var PALACES = [
  null,
  { name: "\uAC10", hanja: "\u574E", dir: "\uBD81", el: 4, gate: "\uD734\uBB38", gateH: "\u4F11\u9580", star: "\uCC9C\uBD09", starH: "\u5929\u84EC" },
  { name: "\uACE4", hanja: "\u5764", dir: "\uB0A8\uC11C", el: 2, gate: "\uC0AC\uBB38", gateH: "\u6B7B\u9580", star: "\uCC9C\uC608", starH: "\u5929\u82AE" },
  { name: "\uC9C4", hanja: "\u9707", dir: "\uB3D9", el: 0, gate: "\uC0C1\uBB38", gateH: "\u50B7\u9580", star: "\uCC9C\uCDA9", starH: "\u5929\u6C96" },
  { name: "\uC190", hanja: "\u5DFD", dir: "\uB0A8\uB3D9", el: 0, gate: "\uB450\uBB38", gateH: "\u675C\u9580", star: "\uCC9C\uBCF4", starH: "\u5929\u8F14" },
  { name: "\uC911", hanja: "\u4E2D", dir: "\uC911\uC559", el: 2, gate: "\u2014", gateH: "", star: "\uCC9C\uAE08", starH: "\u5929\u79BD" },
  { name: "\uAC74", hanja: "\u4E7E", dir: "\uBD81\uC11C", el: 3, gate: "\uAC1C\uBB38", gateH: "\u958B\u9580", star: "\uCC9C\uC2EC", starH: "\u5929\u5FC3" },
  { name: "\uD0DC", hanja: "\u514C", dir: "\uC11C", el: 3, gate: "\uACBD\uBB38", gateH: "\u9A5A\u9580", star: "\uCC9C\uC8FC", starH: "\u5929\u67F1" },
  { name: "\uAC04", hanja: "\u826E", dir: "\uBD81\uB3D9", el: 2, gate: "\uC0DD\uBB38", gateH: "\u751F\u9580", star: "\uCC9C\uC784", starH: "\u5929\u4EFB" },
  { name: "\uB9AC", hanja: "\u96E2", dir: "\uB0A8", el: 1, gate: "\uACBD\uBB38", gateH: "\u666F\u9580", star: "\uCC9C\uC601", starH: "\u5929\u82F1" }
];
var GATE_MEANING = {
  \uD734\uBB38: ["\uC26C\uC5B4 \uAC00\uB294 \uBB38", "\uBB34\uB9AC\uD558\uC9C0 \uC54A\uC744 \uB54C \uC624\uD788\uB824 \uD480\uB9BD\uB2C8\uB2E4. \uC0AC\uB78C\uC5D0\uAC8C \uAE30\uB300\uACE0 \uB3C4\uC6C0\uC744 \uCCAD\uD558\uAE30 \uC88B\uC740 \uC790\uB9AC\uC785\uB2C8\uB2E4.", 1],
  \uC0DD\uBB38: ["\uC0B4\uB9AC\uB294 \uBB38", "\uD314\uBB38 \uAC00\uC6B4\uB370 \uAC00\uC7A5 \uC88B\uAC8C \uBD05\uB2C8\uB2E4. \uC7AC\uBB3C\uACFC \uAC74\uAC15, \uC0C8\uB85C \uC2DC\uC791\uD558\uB294 \uC77C\uC774 \uBAA8\uB450 \uC774 \uBB38\uC744 \uD0D1\uB2C8\uB2E4.", 2],
  \uC0C1\uBB38: ["\uB2E4\uCE58\uB294 \uBB38", "\uBD80\uB52A\uCE58\uACE0 \uAE68\uC9D1\uB2C8\uB2E4. \uB2E4\uB9CC \uADF8 \uCDA9\uB3CC\uB85C \uB0A1\uC740 \uAC83\uC744 \uB04A\uC5B4\uB0B4\uB294 \uD798\uB3C4 \uD568\uAED8 \uC788\uC2B5\uB2C8\uB2E4.", -1],
  \uB450\uBB38: ["\uB9C9\uB294 \uBB38", "\uAC10\uCD94\uACE0 \uBB3C\uB7EC\uC11C\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uB4DC\uB7EC\uB0B4\uC9C0 \uC54A\uACE0 \uC900\uBE44\uD560 \uB54C \uD798\uC774 \uB429\uB2C8\uB2E4.", 0],
  \uACBD\uBB38: ["\uB4DC\uB7EC\uB098\uB294 \uBB38", "\uBC1D\uAC8C \uBCF4\uC774\uACE0 \uC774\uB984\uC774 \uC624\uB974\uB0B4\uB9BD\uB2C8\uB2E4. \uBB38\uC11C\uC640 \uC18C\uC2DD\uC774 \uC624\uAC00\uC9C0\uB9CC \uB180\uB784 \uC77C\uB3C4 \uD568\uAED8 \uC635\uB2C8\uB2E4.", 0],
  \uC0AC\uBB38: ["\uBA48\uCD94\uB294 \uBB38", "\uB05D\uB098\uACE0 \uC815\uB9AC\uB418\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC0C8\uB85C \uBC8C\uC774\uAE30\uC5D0\uB294 \uB9DE\uC9C0 \uC54A\uACE0 \uB9C8\uBB34\uB9AC\uC5D0 \uC5B4\uC6B8\uB9BD\uB2C8\uB2E4.", -2],
  \uAC1C\uBB38: ["\uC5EC\uB294 \uBB38", "\uAE38\uC774 \uD2B8\uC774\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uACF5\uC801\uC778 \uC77C, \uAD00\uCCAD, \uC717\uC0AC\uB78C\uACFC \uAD00\uB828\uD55C \uC77C\uC774 \uC798 \uD480\uB9BD\uB2C8\uB2E4.", 2]
};
var stemNum = (i) => i + 1;
var branchNum = (i) => i + 1;
function layout(centerNum, forward) {
  const map = {};
  for (let p = 1; p <= 9; p++) {
    map[p] = forward ? ((p - 5 + centerNum - 1) % 9 + 9) % 9 + 1 : ((5 - p + centerNum - 1) % 9 + 9) % 9 + 1;
  }
  return map;
}
function analyze2(input) {
  const {
    jdUT,
    timeKnown,
    yearStem,
    yearBranch,
    monthStem,
    monthBranch,
    dayStem,
    dayBranch,
    hourStem,
    hourBranch
  } = input;
  if (!timeKnown) throw new Error("\uD64D\uAD6D\uAE30\uBB38\uC740 \uC2DC\uC8FC\uAE4C\uC9C0 \uC788\uC5B4\uC57C \uD310\uC744 \uC138\uC6B8 \uC218 \uC788\uC2B5\uB2C8\uB2E4");
  const lon = sunLongitude(jdUT);
  const yangdun = norm360(lon - 270) < 180;
  const heavenSum = stemNum(yearStem) + stemNum(monthStem) + stemNum(dayStem) + stemNum(hourStem);
  const earthSum = branchNum(yearBranch) + branchNum(monthBranch) + branchNum(dayBranch) + branchNum(hourBranch);
  const heavenCenter = modFrom1(heavenSum, 9);
  const earthCenter = modFrom1(earthSum, 9);
  const heaven = layout(heavenCenter, yangdun);
  const earth = layout(earthCenter, yangdun);
  const myNum = modFrom1(stemNum(dayStem), 9);
  const myPalace = Number(Object.keys(earth).find((p) => earth[p] === myNum)) || 5;
  const yearNum = modFrom1(branchNum(yearBranch), 9);
  const yearPalace = Number(Object.keys(earth).find((p) => earth[p] === yearNum)) || 5;
  const P = PALACES[myPalace];
  const gate = GATE_MEANING[P.gate] ?? ["\uC911\uC559", "\uAC00\uC6B4\uB370 \uC790\uB9AC\uB77C \uBB38\uC774 \uB530\uB85C \uBD99\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD310 \uC804\uCCB4\uB97C \uC544\uC6B0\uB974\uB294 \uC704\uCE58\uC785\uB2C8\uB2E4.", 0];
  const facts = [
    { label: "\uCC9C\uBC18\uC218", value: String(heavenCenter), note: `${STEMS[yearStem]}${STEMS[monthStem]}${STEMS[dayStem]}${STEMS[hourStem]} \uD569 ${heavenSum} \u2192 \xF79` },
    { label: "\uC9C0\uBC18\uC218", value: String(earthCenter), note: `${BRANCHES[yearBranch]}${BRANCHES[monthBranch]}${BRANCHES[dayBranch]}${BRANCHES[hourBranch]} \uD569 ${earthSum} \u2192 \xF79` },
    { label: "\uB454", value: yangdun ? "\uC591\uB454 (\uC21C\uD589)" : "\uC74C\uB454 (\uC5ED\uD589)", note: yangdun ? "\uB3D9\uC9C0~\uD558\uC9C0 \uCD9C\uC0DD" : "\uD558\uC9C0~\uB3D9\uC9C0 \uCD9C\uC0DD" },
    { label: "\uB0B4 \uAD81", value: `${myPalace}\uAD81 ${P.hanja}(${P.name})`, note: `${P.dir} \xB7 ${P.gate}${P.gateH ? `(${P.gateH})` : ""} \xB7 ${P.star}` },
    { label: "\uC138\uAD81", value: `${yearPalace}\uAD81 ${PALACES[yearPalace].hanja}`, note: `${PALACES[yearPalace].dir} \xB7 \uD0DC\uC5B4\uB09C \uD574\uC758 \uC790\uB9AC` }
  ];
  const readings = [
    {
      title: `\uB0B4 \uC790\uB9AC \u2014 ${myPalace}\uAD81 ${P.hanja}(${P.name}), ${P.dir}`,
      text: `\uC77C\uAC04 ${STEMS_KR[dayStem]}\uC758 \uC218\uAC00 ${myPalace}\uAD81\uC5D0 \uB5A8\uC5B4\uC84C\uC2B5\uB2C8\uB2E4. \uC774 \uAD81\uC774 \uD310 \uC704\uC5D0\uC11C \uC774 \uC0AC\uB78C\uC774 \uC11C \uC788\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. ${P.dir}\uCABD\uC774 \uAE30\uBCF8 \uBC29\uC704\uAC00 \uB418\uACE0, \uC774\uC0AC\uB098 \uC911\uC694\uD55C \uACB0\uC815\uC5D0\uC11C \uC774 \uBC29\uD5A5\uC744 \uBA3C\uC800 \uBD05\uB2C8\uB2E4.`
    },
    {
      title: `${P.gate}${P.gateH ? ` (${P.gateH})` : ""} \u2014 ${gate[0]}`,
      text: gate[1]
    },
    {
      title: `${P.star}(${P.starH})\uC774 \uC9C0\uD0A4\uB294 \uC790\uB9AC`,
      text: {
        \uCC9C\uBD09: "\uD5D8\uD55C \uAC83\uC744 \uBA3C\uC800 \uACAA\uACE0 \uB2E8\uB2E8\uD574\uC9C0\uB294 \uBCC4\uC785\uB2C8\uB2E4. \uBB3C\uCC98\uB7FC \uB0AE\uC740 \uB370\uB85C \uD758\uB7EC \uAE38\uC744 \uCC3E\uC2B5\uB2C8\uB2E4.",
        \uCC9C\uC608: "\uBCD1\uACFC \uADFC\uC2EC\uC744 \uB2E4\uB8E8\uB294 \uBCC4\uC785\uB2C8\uB2E4. \uB0A8\uC758 \uC544\uD508 \uB370\uB97C \uC798 \uC54C\uC544\uBCF4\uC544 \uB3CC\uBCF4\uB294 \uC77C\uACFC \uC778\uC5F0\uC774 \uAE4A\uC2B5\uB2C8\uB2E4.",
        \uCC9C\uCDA9: "\uBA3C\uC800 \uBD80\uB52A\uCE58\uB294 \uBCC4\uC785\uB2C8\uB2E4. \uC6C0\uC9C1\uC784\uC774 \uBE60\uB974\uACE0 \uC815\uBA74\uC73C\uB85C \uBC00\uC5B4\uBD99\uC785\uB2C8\uB2E4.",
        \uCC9C\uBCF4: "\uAE30\uB974\uACE0 \uAC00\uB974\uCE58\uB294 \uBCC4\uC785\uB2C8\uB2E4. \uBB38(\u6587)\uACFC \uC778\uC5F0\uC774 \uAE4A\uACE0 \uCC28\uBD84\uD788 \uC313\uC544 \uC62C\uB9BD\uB2C8\uB2E4.",
        \uCC9C\uAE08: "\uAC00\uC6B4\uB370 \uC790\uB9AC\uC758 \uBCC4\uC785\uB2C8\uB2E4. \uC5B4\uB290 \uCABD\uC73C\uB85C\uB3C4 \uCE58\uC6B0\uCE58\uC9C0 \uC54A\uACE0 \uC911\uC2EC\uC744 \uC7A1\uC2B5\uB2C8\uB2E4.",
        \uCC9C\uC2EC: "\uD5E4\uC544\uB9AC\uB294 \uBCC4\uC785\uB2C8\uB2E4. \uD310\uB2E8\uC774 \uC815\uD655\uD558\uACE0 \uACE0\uCE58\uACE0 \uB2E4\uC2A4\uB9AC\uB294 \uC77C\uC5D0 \uBC1D\uC2B5\uB2C8\uB2E4.",
        \uCC9C\uC8FC: "\uBC84\uD2F0\uB294 \uBCC4\uC785\uB2C8\uB2E4. \uAEBE\uC774\uC9C0 \uC54A\uACE0 \uC6D0\uCE59\uC744 \uC9C0\uD0A4\uBA70 \uB9D0\uB85C \uC790\uAE30\uB97C \uC138\uC6C1\uB2C8\uB2E4.",
        \uCC9C\uC784: "\uB9E1\uC544 \uC9C0\uD0A4\uB294 \uBCC4\uC785\uB2C8\uB2E4. \uBB34\uAC81\uACE0 \uC131\uC2E4\uD574\uC11C \uC624\uB798 \uAC00\uB294 \uC77C\uC5D0 \uAC15\uD569\uB2C8\uB2E4.",
        \uCC9C\uC601: "\uB4DC\uB7EC\uB098\uB294 \uBCC4\uC785\uB2C8\uB2E4. \uBC1D\uACE0 \uD654\uB824\uD558\uBA70 \uC774\uB984\uC774 \uB098\uC9C0\uB9CC \uADF8\uB9CC\uD07C \uC18C\uBAA8\uB3C4 \uD07D\uB2C8\uB2E4."
      }[P.star]
    },
    {
      title: "\uAD6C\uAD81 \uC804\uCCB4 (\uC704\uAC00 \uCC9C\uBC18\uC218, \uC544\uB798\uAC00 \uC9C0\uBC18\uC218)",
      mono: true,
      text: [[4, 9, 2], [3, 5, 7], [8, 1, 6]].map(
        (row) => row.map((p) => {
          const mark = p === myPalace ? "*" : p === yearPalace ? "+" : " ";
          return `${mark}${PALACES[p].hanja}${p} ${heaven[p]}/${earth[p]}`.padEnd(11);
        }).join("")
      ).join("\n") + "\n\n* \uB0B4 \uAD81, + \uC138\uAD81. \uC67C\uCABD \uC704\uAC00 \uB0A8\uB3D9, \uAC00\uC6B4\uB370 \uC704\uAC00 \uB0A8\uC785\uB2C8\uB2E4."
    },
    {
      title: "\uCC9C\uBC18\uACFC \uC9C0\uBC18\uC774 \uB9CC\uB098\uB294 \uACF3",
      text: heaven[myPalace] === earth[myPalace] ? `\uB0B4 \uAD81\uC5D0\uC11C \uCC9C\uBC18\uC218\uC640 \uC9C0\uBC18\uC218\uAC00 ${j(heaven[myPalace], "\uB85C")} \uAC19\uC2B5\uB2C8\uB2E4. \uC548\uACFC \uBC16\uC774 \uC77C\uCE58\uD558\uB294 \uD615\uAD6D\uC774\uB77C \uC0DD\uAC01\uD55C \uB300\uB85C \uC77C\uC774 \uC9C4\uD589\uB418\uB294 \uD3B8\uC785\uB2C8\uB2E4.` : `\uB0B4 \uAD81\uC758 \uCC9C\uBC18\uC218\uB294 ${heaven[myPalace]}, \uC9C0\uBC18\uC218\uB294 ${earth[myPalace]}\uC785\uB2C8\uB2E4. ` + (heaven[myPalace] > earth[myPalace] ? "\uC704\uAC00 \uC544\uB798\uBCF4\uB2E4 \uD07D\uB2C8\uB2E4. \uB73B\uC774 \uD604\uC2E4\uBCF4\uB2E4 \uC55E\uC11C \uB098\uAC00\uB294 \uAD6C\uC870\uB77C, \uC0DD\uAC01\uC744 \uB545\uC5D0 \uB0B4\uB824\uB193\uB294 \uACFC\uC815\uC774 \uB298 \uD544\uC694\uD569\uB2C8\uB2E4." : "\uC544\uB798\uAC00 \uC704\uBCF4\uB2E4 \uD07D\uB2C8\uB2E4. \uC2E4\uC81C \uC5ED\uB7C9\uC774 \uB4DC\uB7EC\uB09C \uAC83\uBCF4\uB2E4 \uD070 \uAD6C\uC870\uB77C, \uC790\uAE30\uB97C \uD45C\uD604\uD558\uB294 \uCABD\uC5D0 \uD798\uC744 \uC2E4\uC73C\uBA74 \uB2EC\uB77C\uC9D1\uB2C8\uB2E4.")
    }
  ];
  const elements = [0, 0, 0, 0, 0];
  elements[P.el] += 2;
  elements[PALACES[yearPalace].el] += 1;
  const GATE_TAGS = {
    \uD734\uBB38: ["\uC548\uC815", "\uB3CC\uBD04"],
    \uC0DD\uBB38: ["\uC7AC\uBB3C", "\uC2E4\uD589"],
    \uC0C1\uBB38: ["\uACB0\uB2E8", "\uBCC0\uD654"],
    \uB450\uBB38: ["\uB0B4\uD5A5", "\uC644\uBCBD"],
    \uACBD\uBB38: ["\uD45C\uD604", "\uBA85\uC608"],
    \uC0AC\uBB38: ["\uC778\uB0B4", "\uBCC0\uD654"],
    \uAC1C\uBB38: ["\uBA85\uC608", "\uC8FC\uB3C4"]
  };
  return result({
    id: meta2.id,
    name: meta2.name,
    hanja: meta2.hanja,
    headline: `${myPalace}\uAD81 ${P.hanja} \xB7 ${P.gate} \xB7 ${P.dir} \xB7 ${yangdun ? "\uC591\uB454" : "\uC74C\uB454"}`,
    facts,
    readings,
    signals: {
      elements,
      traits: {},
      domains: {
        \uC7AC\uBB3C: 50 + gate[2] * 8,
        \uAD00\uACC4: null,
        \uC9C1\uC5C5: 50 + gate[2] * 6,
        \uAC74\uAC15: 50 + (P.star === "\uCC9C\uC608" ? -10 : 0),
        \uD559\uC5C5: 50 + (P.star === "\uCC9C\uBCF4" ? 12 : 0)
      },
      tags: GATE_TAGS[P.gate] ?? ["\uC548\uC815"],
      keywords: [`${P.name}\uAD81`, P.gate, P.star]
    }
  });
}

// public/unse-8f3k2m/src/systems/taeeul.js
var meta3 = {
  id: "taeeul",
  name: "\uD0DC\uC744\uC2E0\uC218",
  hanja: "\u592A\u4E59\u795E\u6578",
  desc: "\uC0BC\uC2DD \uC911 \uAC00\uC7A5 \uD070 \uD310. \uD0DC\uC744\uC758 \uC790\uB9AC\uC640 \uC8FC\uAC1D\uC758 \uC148\uC73C\uB85C \uD750\uB984\uC758 \uC8FC\uB3C4\uAD8C\uC744 \uBCF8\uB2E4",
  needsTime: false,
  needsPlace: false
};
var EIGHT = [
  {
    n: 1,
    name: "\uAC74",
    hanja: "\u4E7E",
    dir: "\uBD81\uC11C",
    el: 3,
    text: "\uD558\uB298\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC704\uC5D0\uC11C \uB0B4\uB824\uB2E4\uBCF4\uB294 \uAD6C\uB3C4\uB77C \uAD8C\uD55C\uACFC \uCC45\uC784\uC774 \uD568\uAED8 \uC8FC\uC5B4\uC9D1\uB2C8\uB2E4. \uD310\uC744 \uC5EC\uB294 \uD798\uC774 \uAC15\uD55C \uB300\uC2E0 \uD63C\uC790 \uC9C0\uACE0 \uAC00\uAE30 \uC27D\uC2B5\uB2C8\uB2E4."
  },
  {
    n: 2,
    name: "\uB9AC",
    hanja: "\u96E2",
    dir: "\uB0A8",
    el: 1,
    text: "\uBD88\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uB4DC\uB7EC\uB098\uACE0 \uBC1D\uD600\uC9C0\uB294 \uAD6C\uB3C4\uB77C \uC774\uB984\uC774 \uC624\uB974\uB0B4\uB9BD\uB2C8\uB2E4. \uAC10\uCD94\uB294 \uAC83\uC774 \uD1B5\uD558\uC9C0 \uC54A\uC73C\uB2C8 \uC815\uBA74\uC73C\uB85C \uAC00\uB294 \uD3B8\uC774 \uB0AB\uC2B5\uB2C8\uB2E4."
  },
  {
    n: 3,
    name: "\uAC04",
    hanja: "\u826E",
    dir: "\uBD81\uB3D9",
    el: 2,
    text: "\uC0B0\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBA48\uCD94\uACE0 \uC313\uB294 \uAD6C\uB3C4\uB77C \uC11C\uB450\uB974\uBA74 \uC5B4\uAE0B\uB0A9\uB2C8\uB2E4. \uB54C\uB97C \uAE30\uB2E4\uB838\uB2E4 \uD55C \uBC88\uC5D0 \uC6C0\uC9C1\uC774\uB294 \uBC29\uC2DD\uC774 \uB9DE\uC2B5\uB2C8\uB2E4."
  },
  {
    n: 4,
    name: "\uC9C4",
    hanja: "\u9707",
    dir: "\uB3D9",
    el: 0,
    text: "\uC6B0\uB808\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uD754\uB4E4\uACE0 \uAE68\uC6B0\uB294 \uAD6C\uB3C4\uB77C \uBCC0\uB3D9\uC774 \uC7A6\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 \uC6C0\uC9C1\uC774\uB294 \uCABD\uC774 \uC8FC\uB3C4\uAD8C\uC744 \uC961\uB2C8\uB2E4."
  },
  {
    n: 5,
    name: "\uC190",
    hanja: "\u5DFD",
    dir: "\uB0A8\uB3D9",
    el: 0,
    text: "\uBC14\uB78C\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC2A4\uBA70\uB4E4\uACE0 \uD37C\uC9C0\uB294 \uAD6C\uB3C4\uB77C \uC815\uBA74 \uB3CC\uD30C\uBCF4\uB2E4 \uC5D0\uB458\uB7EC \uAC00\uB294 \uD3B8\uC774 \uBE60\uB985\uB2C8\uB2E4. \uC0AC\uB78C\uC744 \uD1B5\uD574 \uC77C\uC774 \uD480\uB9BD\uB2C8\uB2E4."
  },
  {
    n: 6,
    name: "\uACE4",
    hanja: "\u5764",
    dir: "\uB0A8\uC11C",
    el: 2,
    text: "\uB545\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBC1B\uC544 \uC2E3\uB294 \uAD6C\uB3C4\uB77C \uC55E\uC11C\uAE30\uBCF4\uB2E4 \uB4A4\uC5D0\uC11C \uBC1B\uCE58\uB294 \uC5ED\uD560\uC774 \uC798 \uB9DE\uC2B5\uB2C8\uB2E4. \uC624\uB798 \uAC00\uB294 \uD798\uC774 \uC788\uC2B5\uB2C8\uB2E4."
  },
  {
    n: 7,
    name: "\uD0DC",
    hanja: "\u514C",
    dir: "\uC11C",
    el: 3,
    text: "\uBABB\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uAE30\uC068\uACFC \uB9D0\uC758 \uAD6C\uB3C4\uB77C \uC0AC\uB78C\uACFC \uAD50\uB958\uC5D0\uC11C \uC77C\uC774 \uC0DD\uAE41\uB2C8\uB2E4. \uC990\uAC70\uC6C0\uC774 \uC9C0\uB098\uCE58\uBA74 \uC0C8\uC5B4 \uB098\uAC11\uB2C8\uB2E4."
  },
  {
    n: 8,
    name: "\uAC10",
    hanja: "\u574E",
    dir: "\uBD81",
    el: 4,
    text: "\uBB3C\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uD5D8\uD55C \uB370\uB97C \uAC74\uB108\uB294 \uAD6C\uB3C4\uB77C \uACE0\uBE44\uAC00 \uC7A6\uC2B5\uB2C8\uB2E4. \uB2E4\uB9CC \uADF8 \uACE0\uBE44\uB97C \uC9C0\uB098\uBA74\uC11C \uAE4A\uC5B4\uC9C0\uB294 \uC790\uB9AC\uC774\uAE30\uB3C4 \uD569\uB2C8\uB2E4."
  }
];
var GATES = ["\uAC1C\uBB38", "\uD734\uBB38", "\uC0DD\uBB38", "\uC0C1\uBB38", "\uB450\uBB38", "\uACBD\uBB38", "\uC0AC\uBB38", "\uACBD\uBB38"];
var GATE_NOTE = {
  \uAC1C\uBB38: "\uC5F4\uB9AC\uB294 \uBB38\uC785\uB2C8\uB2E4. \uACF5\uC801\uC778 \uC77C\uACFC \uC717\uC0AC\uB78C \uCABD\uC73C\uB85C \uAE38\uC774 \uD2B8\uC785\uB2C8\uB2E4.",
  \uD734\uBB38: "\uC26C\uB294 \uBB38\uC785\uB2C8\uB2E4. \uD798\uC744 \uBE7C\uACE0 \uAE30\uB2E4\uB9B4 \uB54C \uC624\uD788\uB824 \uD480\uB9BD\uB2C8\uB2E4.",
  \uC0DD\uBB38: "\uC0B4\uB9AC\uB294 \uBB38\uC785\uB2C8\uB2E4. \uC5EC\uB35F \uBB38 \uAC00\uC6B4\uB370 \uAC00\uC7A5 \uC88B\uAC8C \uBCF4\uBA70 \uC7AC\uBB3C\uACFC \uC2DC\uC791\uC5D0 \uC720\uB9AC\uD569\uB2C8\uB2E4.",
  \uC0C1\uBB38: "\uB2E4\uCE58\uB294 \uBB38\uC785\uB2C8\uB2E4. \uBD80\uB52A\uCE68\uC774 \uC7A6\uC9C0\uB9CC \uB0A1\uC740 \uAC83\uC744 \uB04A\uC5B4\uB0B4\uB294 \uD798\uC774 \uB429\uB2C8\uB2E4.",
  \uB450\uBB38: "\uB9C9\uB294 \uBB38\uC785\uB2C8\uB2E4. \uB4DC\uB7EC\uB0B4\uC9C0 \uC54A\uACE0 \uC900\uBE44\uD558\uB294 \uB370 \uC5B4\uC6B8\uB9BD\uB2C8\uB2E4.",
  \uACBD\uBB38: "\uB4DC\uB7EC\uB098\uB294 \uBB38\uC785\uB2C8\uB2E4. \uC18C\uC2DD\uACFC \uBB38\uC11C\uAC00 \uC624\uAC00\uACE0 \uB180\uB784 \uC77C\uB3C4 \uD568\uAED8 \uC635\uB2C8\uB2E4.",
  \uC0AC\uBB38: "\uBA48\uCD94\uB294 \uBB38\uC785\uB2C8\uB2E4. \uC0C8\uB85C \uBC8C\uC774\uAE30\uBCF4\uB2E4 \uC815\uB9AC\uD558\uACE0 \uB9E4\uB4ED\uC9D3\uB294 \uB370 \uB9DE\uC2B5\uB2C8\uB2E4."
};
function analyze3(input) {
  const { sajuYear, sectorIndex, currentYear, age } = input;
  const accYear = sajuYear - 4;
  const cycle = (accYear % 24 + 24) % 24;
  const palaceIndex = Math.floor(cycle / 3);
  const palace = EIGHT[palaceIndex];
  const stayYear = cycle % 3 + 1;
  const monthBranch = (sectorIndex + 2) % 12;
  const gyesin = ((2 - monthBranch) % 12 + 12) % 12;
  const juSan = (palace.n + gyesin) % 12 + 1;
  const gaekSan = (palace.n + 12 - gyesin) % 12 + 1;
  const juWins = juSan > gaekSan;
  const even = juSan === gaekSan;
  const gate = GATES[palaceIndex];
  const nowCycle = ((currentYear - 4) % 24 + 24) % 24;
  const nowPalace = EIGHT[Math.floor(nowCycle / 3)];
  const samePalace = nowPalace.n === palace.n;
  const facts = [
    // 고전 태을의 적년은 상원부터 누적한 아주 큰 수다. 그걸 쓰지 않으면서
    // 이름만 '적년'이라고 달면 같은 것인 줄로 읽힌다.
    {
      label: "\uC0AC\uC774\uD2B8 \uAE30\uC900 \uC5F0\uB3C4 \uC624\uD504\uC14B",
      value: String(accYear),
      note: `\uAC11\uC790\uB144(\uC11C\uAE30 4\uB144)\uBD80\uD130 ${sajuYear}\uB144\uAE4C\uC9C0 \uC13C \uAC12. \uACE0\uC804 \uD0DC\uC744\uC758 \uC801\uB144(\uC0C1\uC6D0\uBD80\uD130 \uB204\uC801\uD55C \uD070 \uC218)\uACFC \uAC19\uC740 \uAC83\uC774 \uC544\uB2C8\uBA70, \uC544\uB798 \uAD81\xB7\uC8FC\uAC1D\uC0B0\uC740 \uBAA8\uB450 \uC774 \uC624\uD504\uC14B\uC5D0\uC11C \uB098\uC628 \uAC12\uC774\uB2E4`
    },
    { label: "\uD0DC\uC744\uAD81", value: `${palace.hanja}(${palace.name})`, note: `${palace.dir} \xB7 24\uB144 \uC8FC\uAE30\uC758 ${cycle + 1}\uBC88\uC9F8 \uD574` },
    { label: "\uBA38\uBB38 \uD574", value: `${stayYear}\uB144\uC9F8`, note: "\uD55C \uAD81\uC5D0 \uC138 \uD574\uB97C \uBA38\uBB38\uB2E4" },
    { label: "\uACC4\uC2E0", value: `${BRANCHES[gyesin]}(${BRANCHES_KR[gyesin]})`, note: `${monthBranch === 2 ? "\uC778" : BRANCHES_KR[monthBranch]}\uC6D4 \uAE30\uC900` },
    { label: "\uC8FC\uC0B0", value: String(juSan), note: "\uB0B4\uAC00 \uC954 \uBAAB" },
    { label: "\uAC1D\uC0B0", value: String(gaekSan), note: "\uC0C1\uB300\xB7\uD658\uACBD\uC774 \uC954 \uBAAB" },
    { label: "\uBB38", value: gate, note: GATE_NOTE[gate].split(".")[0] },
    { label: `${currentYear}\uB144 \uD0DC\uC744`, value: `${nowPalace.hanja}(${nowPalace.name})`, note: samePalace ? "\uD0DC\uC5B4\uB09C \uAD81\uACFC \uAC19\uB2E4" : nowPalace.dir }
  ];
  const readings = [
    {
      title: `\uD0DC\uC744\uC774 ${palace.hanja}\uAD81\uC5D0 \uC788\uC2B5\uB2C8\uB2E4`,
      text: palace.text
    },
    {
      title: even ? "\uC8FC\uC0B0\uACFC \uAC1D\uC0B0\uC774 \uAC19\uC2B5\uB2C8\uB2E4" : juWins ? "\uC8FC\uC0B0\uC774 \uD07D\uB2C8\uB2E4 \u2014 \uB0B4\uAC00 \uC954 \uD310" : "\uAC1D\uC0B0\uC774 \uD07D\uB2C8\uB2E4 \u2014 \uD750\uB984\uC774 \uC954 \uD310",
      text: even ? `\uC8FC\uC0B0 ${juSan}, \uAC1D\uC0B0 ${j(gaekSan, "\uB85C")} \uD33D\uD33D\uD569\uB2C8\uB2E4. \uBA3C\uC800 \uC6C0\uC9C1\uC5EC\uB3C4 \uB530\uB77C\uAC00\uB3C4 \uACB0\uACFC\uAC00 \uD06C\uAC8C \uB2E4\uB974\uC9C0 \uC54A\uC740 \uAD6C\uB3C4\uB77C, \uD310\uB2E8\uC758 \uADFC\uAC70\uB97C \uBC16\uC774 \uC544\uB2C8\uB77C \uC790\uAE30 \uAE30\uC900\uC5D0\uC11C \uCC3E\uC544\uC57C \uD569\uB2C8\uB2E4.` : juWins ? `\uC8FC\uC0B0 ${juSan}, \uAC1D\uC0B0 ${gaekSan}\uC785\uB2C8\uB2E4. \uD0DC\uC744\uC5D0\uC11C \uC8FC(\u4E3B)\uB294 \uC790\uB9AC\uB97C \uC9C0\uD0A4\uB294 \uCABD, \uAC1D(\u5BA2)\uC740 \uC6C0\uC9C1\uC5EC \uC624\uB294 \uCABD\uC785\uB2C8\uB2E4. \uC8FC\uC0B0\uC774 \uD06C\uB2E4\uB294 \uAC83\uC740 \uC774 \uC0AC\uB78C\uC774 \uC790\uAE30 \uC790\uB9AC\uB97C \uC9C0\uD0A4\uBA70 \uD310\uC744 \uB04C\uACE0 \uAC08 \uB54C \uC720\uB9AC\uD558\uB2E4\uB294 \uB73B\uC785\uB2C8\uB2E4. \uB0A8\uC744 \uCAD3\uC544\uAC00\uAC70\uB098 \uAE09\uD788 \uD310\uC744 \uBC14\uAFB8\uB824 \uD560\uC218\uB85D \uD798\uC774 \uBE60\uC9D1\uB2C8\uB2E4.` : `\uC8FC\uC0B0 ${juSan}, \uAC1D\uC0B0 ${gaekSan}\uC785\uB2C8\uB2E4. \uAC1D\uC0B0\uC774 \uD06C\uB2E4\uB294 \uAC83\uC740 \uBA3C\uC800 \uC6C0\uC9C1\uC774\uACE0 \uBC16\uC73C\uB85C \uB098\uAC00\uB294 \uCABD\uC774 \uC720\uB9AC\uD558\uB2E4\uB294 \uB73B\uC785\uB2C8\uB2E4. \uD55C\uC790\uB9AC\uB97C \uC9C0\uD0A4\uACE0 \uC788\uC73C\uBA74 \uC624\uD788\uB824 \uBC00\uB9BD\uB2C8\uB2E4. \uC774\uB3D9\xB7\uC804\uD658\xB7\uAC1D\uC9C0\uC5D0\uC11C \uAE30\uD68C\uAC00 \uC5F4\uB9AC\uB294 \uAD6C\uB3C4\uC785\uB2C8\uB2E4.`
    },
    {
      title: `${j(gate, "\uC774")} \uBD99\uC5C8\uC2B5\uB2C8\uB2E4`,
      text: GATE_NOTE[gate]
    },
    {
      title: `${currentYear}\uB144\uC758 \uD0DC\uC744\uC740 ${nowPalace.hanja}\uAD81`,
      text: samePalace ? `\uC62C\uD574 \uD0DC\uC744\uC774 \uD0DC\uC5B4\uB0A0 \uB54C\uC640 \uAC19\uC740 ${palace.hanja}\uAD81\uC5D0 \uB4E4\uC5C8\uC2B5\uB2C8\uB2E4. 24\uB144 \uB9CC\uC5D0 \uB3CC\uC544\uC628 \uC790\uB9AC\uB77C, \uC624\uB798\uC804\uC5D0 \uC2DC\uC791\uD588\uB358 \uC77C\uC774 \uB2E4\uC2DC \uBD88\uB824 \uB098\uC624\uAC70\uB098 \uBE44\uC2B7\uD55C \uAD6D\uBA74\uC774 \uBC18\uBCF5\uB429\uB2C8\uB2E4. \uADF8\uB54C \uBABB \uB05D\uB0B8 \uAC83\uC744 \uB9E4\uB4ED\uC9D3\uAE30 \uC88B\uC740 \uD574\uC785\uB2C8\uB2E4.` : `\uC62C\uD574 \uD0DC\uC744\uC740 ${nowPalace.hanja}(${nowPalace.name})\uAD81, ${nowPalace.dir}\uC5D0 \uC788\uC2B5\uB2C8\uB2E4. \uD0DC\uC5B4\uB0A0 \uB54C\uC758 ${palace.hanja}\uAD81\uACFC \uB2E4\uB974\uB2C8 \uC62C\uD574\uC758 \uD310\uC740 \uC774 \uC0AC\uB78C\uC758 \uAE30\uBCF8 \uAD6C\uB3C4\uC640 \uACB0\uC774 \uB2E4\uB985\uB2C8\uB2E4. ${nowPalace.text.split(".").slice(1).join(".").trim()}`
    },
    {
      title: "\uD0DC\uC744\uC758 \uD070 \uC8FC\uAE30",
      text: `\uD0DC\uC744\uC740 \uC138 \uD574\uC5D0 \uD55C \uAD81\uC529, 24\uB144\uC5D0 \uC5EC\uB35F \uAD81\uC744 \uD55C \uBC14\uD034 \uB3D5\uB2C8\uB2E4. \uC9C0\uAE08 ${age}\uC138\uC774\uB2C8 \uD0DC\uC5B4\uB09C \uB4A4 ${Math.floor(age / 24)}\uBC14\uD034\uB97C \uB3CC\uC558\uACE0, \uB2E4\uC74C \uD55C \uBC14\uD034\uB294 ${(Math.floor(age / 24) + 1) * 24}\uC138\uC5D0 \uB9C8\uCE69\uB2C8\uB2E4. 24\uB144\xB772\uB144\xB7360\uB144\uC73C\uB85C \uC774\uC5B4\uC9C0\uB294 \uC774 \uC8FC\uAE30\uAC00 \uD0DC\uC744\uC774 \uB098\uB77C\uC758 \uC6B4\uC744 \uBCF4\uB358 \uD2C0\uC774\uACE0, \uAC1C\uC778\uC5D0\uAC8C\uB3C4 \uAC19\uC740 \uB208\uAE08\uC744 \uB300\uB294 \uAC83\uC785\uB2C8\uB2E4.`
    },
    {
      title: "\uC774 \uACC4\uC0B0\uC5D0 \uB300\uD558\uC5EC",
      text: "\uD0DC\uC744\uC2E0\uC218\uB294 \uBCF8\uB798 \uAD6D\uC6B4\uC744 \uBCF4\uB358 \uCCB4\uACC4\uB77C \uAC1C\uC778 \uBA85\uBC95\uC740 \uC804\uC2B9\uC5D0 \uB530\uB77C \uCC28\uC774\uAC00 \uD07D\uB2C8\uB2E4. \uD2B9\uD788 \uC801\uB144\uC744 \uC5B4\uB514\uC11C\uBD80\uD130 \uC138\uB290\uB0D0\uC5D0 \uB530\uB77C \uAD81\uC774 \uD1B5\uC9F8\uB85C \uBC00\uB9BD\uB2C8\uB2E4. \uC5EC\uAE30\uC11C\uB294 \uAC11\uC790\uB144(\uC11C\uAE30 4\uB144)\uC744 \uAE30\uC900\uC73C\uB85C \uC0BC\uC558\uACE0, \uACC4\uC0B0 \uACFC\uC815\uC744 \uC704\uC5D0 \uC804\uBD80 \uB4DC\uB7EC\uB0C8\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uCC45\uACFC \uACB0\uACFC\uAC00 \uB2E4\uB97C \uC218 \uC788\uC73C\uB2C8 \uCC38\uACE0\uB85C\uB9CC \uBCF4\uC2DC\uAE30 \uBC14\uB78D\uB2C8\uB2E4."
    }
  ];
  const elements = [0, 0, 0, 0, 0];
  elements[palace.el] = 2;
  elements[nowPalace.el] += 1;
  return result({
    id: meta3.id,
    name: meta3.name,
    hanja: meta3.hanja,
    headline: `\uD0DC\uC744 ${palace.hanja}\uAD81 \xB7 ${juWins ? "\uC8FC\uC0B0 \uC6B0\uC138" : even ? "\uC8FC\uAC1D \uB300\uB4F1" : "\uAC1D\uC0B0 \uC6B0\uC138"} \xB7 ${gate}`,
    facts,
    readings,
    // 전승 차이가 커서 종합에는 가볍게만 반영한다
    confidence: 0.6,
    signals: {
      elements,
      traits: {
        \uC8FC\uB3C4: juWins ? 0.5 : -0.3,
        \uC548\uC815: juWins ? 0.4 : -0.4
      },
      domains: { \uC7AC\uBB3C: null, \uAD00\uACC4: null, \uC9C1\uC5C5: null, \uAC74\uAC15: null, \uD559\uC5C5: null },
      tags: juWins ? ["\uC8FC\uB3C4", "\uC548\uC815"] : ["\uBCC0\uD654", "\uC790\uC720"],
      keywords: [`${palace.name}\uAD81`, gate, juWins ? "\uC8FC\uC0B0 \uC6B0\uC138" : "\uAC1D\uC0B0 \uC6B0\uC138"]
    }
  });
}

// public/unse-8f3k2m/src/systems/gujeong.js
function starOfYear(year) {
  let s = String(year).split("").reduce((a, c) => a + Number(c), 0);
  while (s > 9) s = String(s).split("").reduce((a, c) => a + Number(c), 0);
  const v = 11 - s;
  return v > 9 ? v - 9 : v;
}

// public/unse-8f3k2m/src/systems/tojeong.js
var meta4 = {
  id: "tojeong",
  name: "\uD1A0\uC815\uBE44\uACB0",
  hanja: "\u571F\u4EAD\u7955\u8A23",
  desc: "\uC138\uB294\uB098\uC774\uC640 \uC0DD\uC6D4\xB7\uC0DD\uC77C\uB85C \uD55C \uD574\uC758 \uAD18\uB97C \uBF51\uC544 \uC5F0\uC6B4\uACFC \uC6D4\uC6B4\uC744 \uBCF8\uB2E4",
  needsTime: false,
  needsPlace: false
};
var STEM_NUM = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5];
var BRANCH_NUM = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4];
var UPPER = [
  null,
  { title: "\uB3D9\uD48D\uC5D0 \uC5BC\uC74C\uC774 \uD480\uB9B0\uB2E4", text: "\uB9C9\uD614\uB358 \uAC83\uC774 \uD480\uB9AC\uAE30 \uC2DC\uC791\uD558\uB294 \uD574\uC785\uB2C8\uB2E4. \uC9C0\uB09C\uD574\uAE4C\uC9C0 \uB2F5\uB2F5\uD588\uB358 \uC77C\uC5D0 \uC228\uD1B5\uC774 \uD2B8\uC774\uACE0, \uBBF8\uB904\uB454 \uC77C\uC744 \uB2E4\uC2DC \uAEBC\uB0BC \uB9CC\uD569\uB2C8\uB2E4. \uB2E4\uB9CC \uC5BC\uC74C\uC774 \uB179\uB294 \uCD08\uC785\uC774\uB77C \uBC1C\uBC11\uC774 \uBB34\uB985\uB2C8\uB2E4. \uD55C\uAEBC\uBC88\uC5D0 \uBC00\uC5B4\uBD99\uC774\uC9C0 \uB9D0\uACE0 \uC21C\uC11C\uB300\uB85C \uAC00\uC138\uC694.", tone: 1 },
  { title: "\uB098\uBB34\uC5D0 \uAF43\uC774 \uD53C\uB098 \uC5F4\uB9E4\uB294 \uC544\uC9C1\uC774\uB2E4", text: "\uAC89\uC73C\uB85C \uBCF4\uAE30 \uC88B\uC740 \uC77C\uC774 \uB9CE\uC740 \uD574\uC785\uB2C8\uB2E4. \uC0AC\uB78C\uC774 \uBAA8\uC774\uACE0 \uB9D0\uC774 \uC624\uAC00\uC9C0\uB9CC \uC190\uC5D0 \uC7A1\uD788\uB294 \uACB0\uC2E4\uC740 \uB4A4\uB85C \uBBF8\uB904\uC9D1\uB2C8\uB2E4. \uC9C0\uAE08 \uB9FA\uC740 \uC778\uC5F0\uACFC \uD3C9\uD310\uC774 \uB098\uC911\uC5D0 \uAC12\uC744 \uD558\uB2C8, \uB2F9\uC7A5\uC758 \uC131\uACFC\uAC00 \uC5C6\uB2E4\uACE0 \uC870\uAE09\uD574\uD558\uC9C0 \uB9C8\uC138\uC694.", tone: 0 },
  { title: "\uC6A9\uC774 \uC5EC\uC758\uC8FC\uB97C \uC5BB\uB294\uB2E4", text: "\uC624\uB798 \uC900\uBE44\uD55C \uAC83\uC774 \uC81C\uC790\uB9AC\uB97C \uCC3E\uB294 \uD574\uC785\uB2C8\uB2E4. \uC790\uB9AC\xB7\uC790\uACA9\xB7\uC778\uC815 \uAC00\uC6B4\uB370 \uD558\uB098\uAC00 \uB4E4\uC5B4\uC635\uB2C8\uB2E4. \uAE30\uD68C\uAC00 \uC654\uC744 \uB54C \uC8FC\uC800\uD558\uBA74 \uB2E4\uC74C\uC774 \uBA40\uC5B4\uC9C0\uB2C8, \uACB0\uC815\uD574\uC57C \uD560 \uC21C\uAC04\uC5D0 \uACB0\uC815\uD558\uC138\uC694.", tone: 2 },
  { title: "\uBC30\uAC00 \uB098\uB8E8\uB97C \uB5A0\uB09C\uB2E4", text: "\uC6C0\uC9C1\uC784\uC774 \uD070 \uD574\uC785\uB2C8\uB2E4. \uC774\uC0AC\xB7\uC774\uC9C1\xB7\uC804\uD559\uCC98\uB7FC \uC790\uB9AC\uB97C \uC62E\uAE30\uB294 \uC77C\uC774 \uC0DD\uAE30\uACE0, \uC775\uC219\uD55C \uAC83\uACFC \uD5E4\uC5B4\uC9D1\uB2C8\uB2E4. \uB5A0\uB098\uB294 \uAC83 \uC790\uCCB4\uB294 \uB098\uC058\uC9C0 \uC54A\uC73C\uB098 \uBAA9\uC801\uC9C0\uB97C \uC815\uD558\uACE0 \uB5A0\uB098\uC57C \uD569\uB2C8\uB2E4.", tone: 0 },
  { title: "\uAE38\uC5D0\uC11C \uADC0\uC778\uC744 \uB9CC\uB09C\uB2E4", text: "\uC0AC\uB78C\uC73C\uB85C \uD480\uB9AC\uB294 \uD574\uC785\uB2C8\uB2E4. \uB73B\uBC16\uC758 \uB3C4\uC6C0\uC774 \uC606\uC5D0\uC11C \uC635\uB2C8\uB2E4. \uD63C\uC790 \uD574\uACB0\uD558\uB824 \uB4E4\uBA74 \uC624\uD788\uB824 \uAE38\uC5B4\uC9C0\uB2C8, \uBA3C\uC800 \uCCAD\uD558\uACE0 \uBA3C\uC800 \uBB3B\uB294 \uD3B8\uC774 \uC774\uB4DD\uC785\uB2C8\uB2E4.", tone: 2 },
  { title: "\uAD6C\uB984\uC774 \uB2EC\uC744 \uAC00\uB9B0\uB2E4", text: "\uC870\uC2EC\uD560 \uD574\uC785\uB2C8\uB2E4. \uC2E4\uB825\uC774 \uBAA8\uC790\uB77C\uC11C\uAC00 \uC544\uB2C8\uB77C \uB54C\uAC00 \uD750\uB824\uC11C \uB73B\uB300\uB85C \uC548 \uB429\uB2C8\uB2E4. \uC0C8 \uC77C\uC744 \uBC8C\uC774\uAE30\uBCF4\uB2E4 \uD558\uB358 \uAC83\uC744 \uC9C0\uD0A4\uACE0, \uBB38\uC11C\uC640 \uBCF4\uC99D\uC5D0 \uD2B9\uD788 \uC2E0\uACBD \uC4F0\uC138\uC694.", tone: -1 },
  { title: "\uC6B0\uBB3C\uC744 \uAE4A\uC774 \uD310\uB2E4", text: "\uC548\uC73C\uB85C \uC313\uB294 \uD574\uC785\uB2C8\uB2E4. \uBC16\uC73C\uB85C \uB4DC\uB7EC\uB098\uB294 \uC131\uACFC\uB294 \uC801\uC9C0\uB9CC \uC2E4\uB825\uACFC \uAE30\uBC18\uC774 \uB450\uD130\uC6CC\uC9D1\uB2C8\uB2E4. \uB0A8\uACFC \uACAC\uC8FC\uC9C0 \uB9D0\uACE0 \uC791\uB144\uC758 \uC790\uAE30\uC640 \uACAC\uC8FC\uBA74 \uD750\uB984\uC774 \uBCF4\uC785\uB2C8\uB2E4.", tone: 0 },
  { title: "\uAC00\uC744 \uB4E4\uC5D0 \uACE1\uC2DD\uC774 \uC775\uB294\uB2E4", text: "\uAC70\uB450\uB294 \uD574\uC785\uB2C8\uB2E4. \uADF8\uB3D9\uC548 \uB4E4\uC778 \uAC83\uC774 \uACB0\uACFC\uB85C \uB3CC\uC544\uC635\uB2C8\uB2E4. \uC7AC\uBB3C\uACFC \uBA85\uC608\uAC00 \uD568\uAED8 \uB530\uB974\uB418, \uAC70\uB458 \uB54C \uB098\uB20C \uBAAB\uC744 \uBBF8\uB9AC \uC815\uD574\uB450\uC5B4\uC57C \uB4A4\uD0C8\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", tone: 2 }
];
var MIDDLE = [
  null,
  "\uD750\uB984\uC774 \uBE60\uB985\uB2C8\uB2E4. \uC77C\uC774 \uC608\uC0C1\uBCF4\uB2E4 \uC77C\uCC0D \uB2E5\uCE58\uB2C8 \uBBF8\uB9AC \uC900\uBE44\uD574\uB450\uB294 \uCABD\uC774 \uC720\uB9AC\uD569\uB2C8\uB2E4.",
  "\uC0AC\uB78C\uC774 \uC5BD\uD799\uB2C8\uB2E4. \uC88B\uC740 \uC778\uC5F0\uB3C4 \uC131\uAC00\uC2E0 \uC778\uC5F0\uB3C4 \uB298\uC5B4\uB098\uB2C8 \uAC70\uB9AC\uB97C \uC870\uC808\uD558\uB294 \uAC83\uC774 \uACFC\uC81C\uC785\uB2C8\uB2E4.",
  "\uB3C8\uC774 \uC624\uAC11\uB2C8\uB2E4. \uB4E4\uC5B4\uC624\uB294 \uAC83\uB3C4 \uB098\uAC00\uB294 \uAC83\uB3C4 \uCEE4\uC9C0\uB2C8 \uC7A5\uBD80\uB97C \uB530\uB85C \uC801\uC5B4\uB450\uC138\uC694.",
  "\uB9D0\uC774 \uB9CE\uC544\uC9D1\uB2C8\uB2E4. \uC624\uD574\uC640 \uC18C\uBB38\uC774 \uC0DD\uAE30\uAE30 \uC26C\uC6B0\uB2C8 \uC911\uC694\uD55C \uC57D\uC18D\uC740 \uBC18\uB4DC\uC2DC \uAE00\uB85C \uB0A8\uAE30\uC138\uC694.",
  "\uBAB8\uC774 \uBA3C\uC800 \uC2E0\uD638\uB97C \uBCF4\uB0C5\uB2C8\uB2E4. \uBB34\uB9AC\uD558\uBA74 \uADF8 \uC790\uB9AC\uC5D0\uC11C \uBC14\uB85C \uAC12\uC744 \uCE58\uB974\uB294 \uD574\uC785\uB2C8\uB2E4.",
  "\uC548\uC774 \uC870\uC6A9\uD569\uB2C8\uB2E4. \uD070 \uC0AC\uAC74 \uC5C6\uC774 \uC9C0\uB098\uAC00\uB2C8 \uC774 \uD2C8\uC5D0 \uBBF8\uB904\uB454 \uC815\uBE44\uB97C \uD558\uAE30 \uC88B\uC2B5\uB2C8\uB2E4."
];
var LOWER = [
  null,
  "\uB05D\uC774 \uCC98\uC74C\uBCF4\uB2E4 \uB0AB\uC2B5\uB2C8\uB2E4. \uCD08\uBC18\uC5D0 \uB354\uB514\uB354\uB77C\uB3C4 \uB193\uC9C0 \uB9C8\uC138\uC694.",
  "\uC911\uAC04\uC774 \uACE0\uBE44\uC785\uB2C8\uB2E4. \uADF8 \uACE0\uBE44\uB9CC \uB118\uAE30\uBA74 \uB098\uBA38\uC9C0\uB294 \uC21C\uD569\uB2C8\uB2E4.",
  "\uCC98\uC74C\uC774 \uC88B\uACE0 \uB4A4\uAC00 \uD5D0\uAC81\uC2B5\uB2C8\uB2E4. \uC798\uB420 \uB54C \uB9C8\uBB34\uB9AC\uB97C \uBBF8\uB9AC \uCC59\uACA8\uB450\uC138\uC694."
];
var MONTH_TONE = [
  "\uC21C\uC870\uB86D\uC2B5\uB2C8\uB2E4. \uBC8C\uC5EC\uB3C4 \uC88B\uC740 \uB2EC\uC785\uB2C8\uB2E4.",
  "\uBD84\uC8FC\uD569\uB2C8\uB2E4. \uC77C\uC740 \uB9CE\uC740\uB370 \uACB0\uACFC\uAC00 \uB2A6\uC2B5\uB2C8\uB2E4.",
  "\uB9C9\uD799\uB2C8\uB2E4. \uC0C8\uB85C \uBC8C\uC774\uC9C0 \uB9D0\uACE0 \uC9C0\uD0A4\uC138\uC694.",
  "\uD480\uB9BD\uB2C8\uB2E4. \uBBF8\uB904\uB454 \uC77C\uC744 \uAEBC\uB0B4\uAE30 \uC88B\uC2B5\uB2C8\uB2E4.",
  "\uC0AC\uB78C\uC774 \uC635\uB2C8\uB2E4. \uAD00\uACC4\uC5D0\uC11C \uAE30\uD68C\uAC00 \uC0DD\uAE41\uB2C8\uB2E4.",
  "\uC9C0\uCD9C\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uD070\uB3C8 \uC4F8 \uC77C\uC744 \uBBF8\uB9AC \uC7A1\uC544\uB450\uC138\uC694."
];
function analyze4(input) {
  const { year, month, day, lunar, currentYear, jdUT } = input;
  const koreanAge = currentYear - year + 1;
  const taeSe = yearPillar(currentYear);
  const taeSeNum = STEM_NUM[taeSe.stem] + BRANCH_NUM[taeSe.branch];
  const jdn = toJDN(year, month, day);
  const dayStem = (jdn + 9) % 10;
  const dayBranch = (jdn + 1) % 12;
  const iljinNum = STEM_NUM[dayStem] + BRANCH_NUM[dayBranch];
  const wolGeonBranch = (lunar.month + 1) % 12;
  const wolGeonStem = ((taeSe.stem % 5 * 2 + 2) % 10 + (lunar.month - 1)) % 10;
  const wolGeonNum = STEM_NUM[wolGeonStem] + BRANCH_NUM[wolGeonBranch];
  const upper = modFrom1(koreanAge + taeSeNum, 8);
  const middle = modFrom1(wolGeonNum + (lunar.isBigMonth ? 30 : 29), 6);
  const lower = modFrom1(lunar.day + iljinNum, 3);
  const gwaeNo = upper * 100 + middle * 10 + lower;
  const U = UPPER[upper];
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const idx = (upper + middle + lower + m) % 6;
    months.push({ month: m, text: MONTH_TONE[idx] });
  }
  const facts = [
    // 괘 번호는 산법대로 나온 값이고, 그 옆의 문구는 이 사이트에서 쓴 것이다.
    // 원전의 표제처럼 보이면 곤란해서 밝혀 둔다.
    {
      label: "\uAD18",
      value: `${upper}\xB7${middle}\xB7${lower}`,
      note: `\uC81C${gwaeNo}\uAD18 \xB7 ${U.title} (\uBB38\uAD6C\uB294 \uC6D0\uC804\uC744 \uC62E\uAE34 \uAC83\uC774 \uC544\uB2C8\uB77C \uC774 \uC0AC\uC774\uD2B8\uC5D0\uC11C \uC0C8\uB85C \uC4F4 \uAC83)`
    },
    { label: "\uC0C1\uAD18", value: String(upper), note: `\uC138\uB294\uB098\uC774 ${koreanAge} + \uD0DC\uC138\uC218 ${taeSeNum} \u2192 \xF78` },
    {
      label: "\uC911\uAD18",
      value: String(middle),
      note: `\uC6D4\uAC74 ${STEMS[wolGeonStem]}${BRANCHES[wolGeonBranch]} \uC218 ${wolGeonNum} + \uC6D4\uB300\uC18C ${lunar.isBigMonth ? 30 : 29} \u2192 \xF76`
    },
    {
      label: "\uD558\uAD18",
      value: String(lower),
      note: `\uC74C\uB825 ${lunar.day}\uC77C + \uC77C\uC9C4\uC218 ${iljinNum} \u2192 \xF73 (\uC77C\uC9C4\uC218\uB294 \uC120\uCC9C\uC218 ${STEMS[dayStem]}+${BRANCHES[dayBranch]})`
    },
    { label: "\uD0DC\uC138", value: taeSe.hanja, note: `${currentYear}\uB144 \xB7 ${taeSe.kr}` },
    { label: "\uC77C\uC9C4", value: STEMS[dayStem] + BRANCHES[dayBranch], note: "\uD0DC\uC5B4\uB09C \uB0A0\uC758 \uAC04\uC9C0" }
  ];
  const readings = [
    { title: `${currentYear}\uB144 \u2014 ${U.title}`, text: U.text },
    { title: "\uC62C\uD574\uC758 \uACB0", text: MIDDLE[middle] },
    { title: "\uB9C8\uBB34\uB9AC", text: LOWER[lower] },
    {
      title: "\uB2EC\uBCC4 \uD750\uB984",
      text: months.map((m) => `${m.month}\uC6D4 \u2014 ${m.text}`).join("\n")
    },
    {
      title: "\uAD18\uC0AC\uC5D0 \uB300\uD558\uC5EC",
      text: "\uAD18\uB97C \uBF51\uB294 \uC0B0\uBC95\uC740 \uC804\uD1B5 \uBC29\uC2DD \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uB2E4\uB9CC \uC704\uC758 \uAD18\uC0AC\uB294 \uC6D0\uC804\uC744 \uC62E\uAE34 \uAC83\uC774 \uC544\uB2C8\uB77C \uC774 \uC0AC\uC774\uD2B8\uC5D0\uC11C \uC0C8\uB85C \uC4F4 \uBB38\uC7A5\uC785\uB2C8\uB2E4. \uD1A0\uC815\uBE44\uACB0\uC740 \uD310\uBCF8\uB9C8\uB2E4 \uBB38\uAD6C\uAC00 \uB2EC\uB77C, \uC6D0\uBB38\uC744 \uADF8\uB300\uB85C \uC2E3\uAE30\uBCF4\uB2E4 \uB73B\uC744 \uD480\uC5B4 \uC4F0\uB294 \uD3B8\uC774 \uC815\uC9C1\uD558\uB2E4\uACE0 \uBCF4\uC558\uC2B5\uB2C8\uB2E4."
    }
  ];
  const elements = [0, 0, 0, 0, 0];
  elements[(upper - 1) % 5] = 1;
  return result({
    id: meta4.id,
    name: meta4.name,
    hanja: meta4.hanja,
    headline: `\uC81C${gwaeNo}\uAD18 \xB7 ${U.title}`,
    facts,
    readings,
    signals: {
      elements,
      traits: {},
      domains: {
        \uC7AC\uBB3C: 50 + U.tone * 10 + (middle === 3 ? 8 : 0),
        \uAD00\uACC4: 50 + U.tone * 6 + (middle === 2 ? 10 : 0),
        \uC9C1\uC5C5: 50 + U.tone * 10,
        \uAC74\uAC15: 50 - (middle === 5 ? 14 : 0),
        \uD559\uC5C5: null
      },
      tags: U.tone >= 2 ? ["\uBA85\uC608", "\uC7AC\uBB3C"] : U.tone <= -1 ? ["\uC778\uB0B4", "\uC548\uC815"] : ["\uBCC0\uD654", "\uC778\uB0B4"],
      keywords: [U.title, `\uC81C${gwaeNo}\uAD18`]
    }
  });
}

// public/unse-8f3k2m/src/systems/mahabote.js
var meta5 = {
  id: "mahabote",
  name: "\uB9C8\uD558\uBCF4\uD14C",
  hanja: "Mahabote",
  desc: "\uBBF8\uC580\uB9C8 \uC810\uBC95. \uD0DC\uC5B4\uB09C \uC694\uC77C\uACFC \uD574\uB9CC\uC73C\uB85C \uC5EC\uB35F \uC790\uB9AC \uC911 \uB0B4 \uC790\uB9AC\uB97C \uCC3E\uB294\uB2E4",
  needsTime: false,
  needsPlace: false
};
var PLANETS = [
  { name: "\uD0DC\uC591", my: "Taninganway", el: 1 },
  { name: "\uB2EC", my: "Taninla", el: 4 },
  { name: "\uD654\uC131", my: "Inga", el: 1 },
  { name: "\uC218\uC131", my: "Boddahu", el: 4 },
  { name: "\uBAA9\uC131", my: "Kyasapade", el: 0 },
  { name: "\uAE08\uC131", my: "Thaukkya", el: 3 },
  { name: "\uD1A0\uC131", my: "Sanay", el: 2 },
  { name: "\uB77C\uD6C4", my: "Yahu", el: 2 }
];
var HOUSES = [
  {
    name: "\uBE59\uAC00",
    my: "Binga",
    mean: "\uCC3D\uC758",
    text: "\uB9CC\uB4E4\uC5B4\uB0B4\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC190\uC7AC\uC8FC\uB098 \uC544\uC774\uB514\uC5B4\uB85C \uBA39\uACE0\uC0B4 \uAE38\uC774 \uC5F4\uB9AC\uACE0, \uB0A8\uC774 \uBABB \uBCF4\uB294 \uBC29\uC2DD\uC744 \uCC3E\uC544\uB0C5\uB2C8\uB2E4. \uB2E4\uB9CC \uAFB8\uC900\uD568\uC774 \uB298 \uACFC\uC81C\uB85C \uB0A8\uC2B5\uB2C8\uB2E4.",
    tags: ["\uD45C\uD604", "\uC2E4\uD589"],
    domains: { \uC9C1\uC5C5: 66, \uD559\uC5C5: 60 }
  },
  {
    name: "\uC544\uD230",
    my: "Ahtun",
    mean: "\uB3D9\uBC18",
    text: "\uD568\uAED8 \uAC00\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBC30\uC6B0\uC790\uC640 \uB3D9\uC5C5\uC790\uAC00 \uC0B6\uC758 \uBC29\uD5A5\uC744 \uD06C\uAC8C \uC88C\uC6B0\uD569\uB2C8\uB2E4. \uD63C\uC790 \uC788\uC744 \uB54C\uBCF4\uB2E4 \uC9DD\uC774 \uC788\uC744 \uB54C \uD798\uC774 \uBA87 \uBC30\uB85C \uCEE4\uC9D1\uB2C8\uB2E4.",
    tags: ["\uC0AC\uAD50", "\uB3CC\uBD04"],
    domains: { \uAD00\uACC4: 72 }
  },
  {
    name: "\uC57C\uC790",
    my: "Yaza",
    mean: "\uAD8C\uC704",
    text: "\uC790\uB9AC\uB97C \uC5BB\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC717\uC0AC\uB78C\uC758 \uB208\uC5D0 \uB4E4\uACE0 \uACF5\uC801\uC778 \uC778\uC815\uC774 \uB530\uB985\uB2C8\uB2E4. \uAD8C\uD55C\uC774 \uCEE4\uC9C8\uC218\uB85D \uCC45\uC784\uB3C4 \uD568\uAED8 \uCEE4\uC9C0\uB2C8 \uCC98\uC2E0\uC774 \uC911\uC694\uD574\uC9D1\uB2C8\uB2E4.",
    tags: ["\uBA85\uC608", "\uCC45\uC784"],
    domains: { \uC9C1\uC5C5: 74, \uC7AC\uBB3C: 60 }
  },
  {
    name: "\uC544\uB514\uD30C\uD2F0",
    my: "Adipati",
    mean: "\uC131\uCDE8",
    text: "\uC5EC\uB35F \uC790\uB9AC \uAC00\uC6B4\uB370 \uAC00\uC7A5 \uC88B\uAC8C \uBCF4\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC774\uB044\uB294 \uD798\uC774 \uC788\uACE0 \uD558\uB294 \uC77C\uC774 \uACB0\uAD6D \uBAA8\uC591\uC744 \uAC16\uCDA5\uB2C8\uB2E4. \uC21C\uC870\uB85C\uC6B4 \uB9CC\uD07C \uC548\uC8FC\uD558\uC9C0 \uC54A\uB294 \uAC83\uC774 \uAD00\uAC74\uC785\uB2C8\uB2E4.",
    tags: ["\uC8FC\uB3C4", "\uBA85\uC608"],
    domains: { \uC9C1\uC5C5: 78, \uC7AC\uBB3C: 68 }
  },
  {
    name: "\uB9C8\uB77C\uB098",
    my: "Marana",
    mean: "\uC0C1\uC2E4",
    text: "\uAC00\uC7A5 \uBB34\uAC81\uAC8C \uBCF4\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC783\uB294 \uACBD\uD5D8\uC774 \uBC18\uBCF5\uB418\uC9C0\uB9CC, \uADF8 \uC790\uB9AC\uB294 \uB3D9\uC2DC\uC5D0 \uBE44\uC6CC\uB0B4\uACE0 \uB2E4\uC2DC \uC138\uC6B0\uB294 \uC790\uB9AC\uC774\uAE30\uB3C4 \uD569\uB2C8\uB2E4. \uBD99\uB4E4\uC9C0 \uC54A\uB294 \uBC95\uC744 \uBC30\uC6B0\uBA74 \uC624\uD788\uB824 \uC790\uC720\uB85C\uC6CC\uC9D1\uB2C8\uB2E4.",
    tags: ["\uBCC0\uD654", "\uC778\uB0B4"],
    domains: { \uAC74\uAC15: 40, \uC7AC\uBB3C: 42 }
  },
  {
    name: "\uD14C\uCF00",
    my: "Thike",
    mean: "\uC548\uC815",
    text: "\uBC84\uD2F0\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uD654\uB824\uD558\uC9C0 \uC54A\uC544\uB3C4 \uBB34\uB108\uC9C0\uC9C0 \uC54A\uACE0, \uC624\uB798 \uD558\uB294 \uC77C\uC5D0\uC11C \uC2E0\uB8B0\uB97C \uC5BB\uC2B5\uB2C8\uB2E4. \uD070 \uBCC0\uD654\uB97C \uC2A4\uC2A4\uB85C \uB9CC\uB4E4\uC9C0\uB294 \uC54A\uB294 \uD3B8\uC785\uB2C8\uB2E4.",
    tags: ["\uC548\uC815", "\uC778\uB0B4"],
    domains: { \uAC74\uAC15: 66, \uC7AC\uBB3C: 58 }
  },
  {
    name: "\uD478\uD2F0",
    my: "Puti",
    mean: "\uACB0\uC2E4",
    text: "\uC774\uC5B4\uC9C0\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC790\uC2DD\xB7\uC81C\uC790\xB7\uD6C4\uBC30\uCC98\uB7FC \uB4A4\uB97C \uC787\uB294 \uC874\uC7AC\uC640 \uC778\uC5F0\uC774 \uAE4A\uC2B5\uB2C8\uB2E4. \uC2EC\uC5B4\uB454 \uAC83\uC774 \uC2DC\uAC04\uC774 \uC9C0\uB098 \uB3CC\uC544\uC635\uB2C8\uB2E4.",
    tags: ["\uB3CC\uBD04", "\uD559\uC2B5"],
    domains: { \uAD00\uACC4: 66, \uD559\uC5C5: 64 }
  },
  {
    name: "\uB77C\uD6C4",
    my: "Rahu",
    mean: "\uBCC0\uC218",
    text: "\uC608\uCE21\uC774 \uC5B4\uB824\uC6B4 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC815\uD574\uC9C4 \uAE38\uC774 \uC798 \uC548 \uB9DE\uACE0 \uB73B\uBC16\uC758 \uACBD\uB85C\uB85C \uD480\uB9BD\uB2C8\uB2E4. \uB0A8\uB4E4\uC774 \uC548 \uAC00\uB294 \uCABD\uC5D0\uC11C \uC624\uD788\uB824 \uAE30\uD68C\uAC00 \uC5F4\uB9BD\uB2C8\uB2E4.",
    tags: ["\uBCC0\uD654", "\uC790\uC720"],
    domains: { \uC9C1\uC5C5: 56, \uC7AC\uBB3C: 52 }
  }
];
function burmeseYear(y, m = 12, d = 31) {
  const beforeNewYear = m < 4 || m === 4 && d < 17;
  return y - (beforeNewYear ? 639 : 638);
}
function analyze5(input) {
  const { year, month, day, hour, timeKnown } = input;
  const jdn = toJDN(year, month, day);
  const weekday = weekdayFromJDN(jdn);
  const isWedNight = weekday === 3 && timeKnown && hour >= 12;
  const planetIndex = isWedNight ? 7 : weekday;
  const planet = PLANETS[planetIndex];
  const by = burmeseYear(year, month, day);
  const remainder = (by % 7 + 7) % 7;
  const houseIndex = (planetIndex + remainder) % 8;
  const house = HOUSES[houseIndex];
  const layout2 = PLANETS.map((p, i) => ({
    planet: p.name,
    house: HOUSES[(i + remainder) % 8].name,
    mine: i === planetIndex
  }));
  const facts = [
    { label: "\uD0DC\uC5B4\uB09C \uC694\uC77C", value: `${WEEKDAY_KR[weekday]}\uC694\uC77C`, note: isWedNight ? "\uC218\uC694\uC77C \uC624\uD6C4 \u2192 \uB77C\uD6C4\uB85C \uBCF8\uB2E4" : "" },
    { label: "\uB0B4 \uD589\uC131", value: planet.name, note: planet.my },
    { label: "\uBC84\uB9C8\uB825", value: `${by}\uB144`, note: `\uC11C\uAE30 ${year} \u2212 ${year - by} (\uBC84\uB9C8 \uC0C8\uD574\uB294 4\uC6D4 \uC911\uC21C)` },
    { label: "\uB098\uBA38\uC9C0", value: String(remainder), note: `${by} \xF7 7` },
    // 버마력과 나머지까지는 규칙이 분명한데, 그 나머지를 여덟 자리에
    // 어떻게 얹느냐는 자료마다 다르다. 어느 배치를 썼는지 밝혀 둔다.
    {
      label: "\uB0B4 \uC790\uB9AC",
      value: house.name,
      note: `${house.my} \xB7 ${house.mean} \xB7 \uC694\uC77C \uD589\uC131 \uC790\uB9AC\uC5D0\uC11C \uB098\uBA38\uC9C0\uB9CC\uD07C \uB098\uC544\uAC00\uB294 \uBC30\uCE58\uB97C \uB530\uB790\uB2E4. \uC790\uB9AC \uBC30\uCE58\uB294 \uC720\uD30C\uB9C8\uB2E4 \uB2EC\uB77C \uB2E4\uB978 \uCC45\uACFC \uACB0\uACFC\uAC00 \uB2E4\uB97C \uC218 \uC788\uB2E4`
    }
  ];
  const readings = [
    { title: `${house.name} (${house.my}) \u2014 ${house.mean}\uC758 \uC790\uB9AC`, text: house.text },
    {
      title: `\uB0B4 \uD589\uC131\uC740 ${planet.name}`,
      text: {
        \uD0DC\uC591: "\uB4DC\uB7EC\uB098\uACE0 \uC778\uC815\uBC1B\uB294 \uCABD\uC73C\uB85C \uAE30\uC6C1\uB2C8\uB2E4. \uC911\uC2EC\uC5D0 \uC124 \uB54C \uD798\uC774 \uB098\uACE0, \uBB34\uC2DC\uB2F9\uD55C\uB2E4\uACE0 \uB290\uB07C\uBA74 \uAE09\uACA9\uD788 \uC2DD\uC2B5\uB2C8\uB2E4.",
        \uB2EC: "\uC8FC\uBCC0 \uBD84\uC704\uAE30\uC5D0 \uBBFC\uAC10\uD569\uB2C8\uB2E4. \uB9C8\uC74C\uC774 \uD3B8\uD55C \uD658\uACBD\uC744 \uACE0\uB974\uB294 \uAC83\uC774 \uADF8\uB300\uB85C \uC2E4\uB825\uC774 \uB418\uB294 \uC720\uD615\uC785\uB2C8\uB2E4.",
        \uD654\uC131: "\uBA3C\uC800 \uC6C0\uC9C1\uC785\uB2C8\uB2E4. \uCD94\uC9C4\uB825\uC774 \uAC15\uD558\uACE0 \uBD80\uB52A\uCE58\uB294 \uC77C\uB3C4 \uC7A6\uC73C\uB2C8, \uC18D\uB3C4\uB97C \uB2A6\uCD9C \uC7A5\uCE58\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.",
        \uC218\uC131: "\uB9D0\uACFC \uC148\uC774 \uBE60\uB985\uB2C8\uB2E4. \uC815\uBCF4\uB97C \uC62E\uAE30\uACE0 \uC911\uAC1C\uD558\uB294 \uC790\uB9AC\uC5D0\uC11C \uB450\uAC01\uC744 \uB0C5\uB2C8\uB2E4.",
        \uBAA9\uC131: "\uB113\uAC8C \uBD05\uB2C8\uB2E4. \uAC00\uB974\uCE58\uACE0 \uC774\uB044\uB294 \uC5ED\uD560\uC774 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB9E1\uACA8\uC9D1\uB2C8\uB2E4.",
        \uAE08\uC131: "\uAC10\uAC01\uACFC \uAD00\uACC4\uC758 \uD589\uC131\uC785\uB2C8\uB2E4. \uC0AC\uB78C\uACFC \uC544\uB984\uB2E4\uC6B4 \uAC83\uC744 \uB2E4\uB8E8\uB294 \uC77C\uC5D0 \uC7AC\uB2A5\uC774 \uBD99\uC2B5\uB2C8\uB2E4.",
        \uD1A0\uC131: "\uB290\uB9AC\uC9C0\uB9CC \uB05D\uAE4C\uC9C0 \uAC11\uB2C8\uB2E4. \uC2DC\uAC04\uC774 \uC313\uC5EC\uC57C \uACB0\uACFC\uAC00 \uB098\uC624\uB2C8 \uC870\uAE09\uD568\uC774 \uAC00\uC7A5 \uD070 \uC801\uC785\uB2C8\uB2E4.",
        \uB77C\uD6C4: "\uC815\uD574\uC9C4 \uAE38\uC5D0\uC11C \uBC97\uC5B4\uB09C \uC790\uB9AC\uC785\uB2C8\uB2E4. \uB0A8\uB4E4\uACFC \uAC19\uC740 \uBC29\uC2DD\uC73C\uB85C\uB294 \uC798 \uC548 \uD480\uB9AC\uACE0, \uC790\uAE30 \uACBD\uB85C\uB97C \uB9CC\uB4E4\uC5B4\uC57C \uC5F4\uB9BD\uB2C8\uB2E4."
      }[planet.name]
    },
    {
      title: "\uC5EC\uB35F \uC790\uB9AC \uBC30\uCE58",
      text: layout2.map((x) => `${x.planet} \u2192 ${x.house}${x.mine ? "  \u2190 \uB098" : ""}`).join("\n")
    },
    {
      title: "\uC774 \uACC4\uC0B0\uC5D0 \uB300\uD558\uC5EC",
      text: "\uB9C8\uD558\uBCF4\uD14C\uB294 \uC804\uC2B9\uB9C8\uB2E4 \uBC30\uCE58 \uADDC\uCE59\uC5D0 \uCC28\uC774\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uC5EC\uAE30\uC11C\uB294 \uAC00\uC7A5 \uB110\uB9AC \uC18C\uAC1C\uB41C \uBC29\uC2DD\uC744 \uB530\uB790\uACE0, \uC704\uC5D0 \uACC4\uC0B0 \uACFC\uC815\uC744 \uC804\uBD80 \uB4DC\uB7EC\uB0C8\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uBC29\uC2DD\uC73C\uB85C \uBCF8 \uACB0\uACFC\uC640 \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4."
    }
  ];
  const elements = [0, 0, 0, 0, 0];
  elements[planet.el] = 1;
  return result({
    id: meta5.id,
    name: meta5.name,
    hanja: meta5.hanja,
    headline: `${planet.name} \xB7 ${house.name}(${house.mean})`,
    facts,
    readings,
    // 수요일생만 시간에 따라 갈린다
    confidence: weekday === 3 && !timeKnown ? 0.6 : 1,
    signals: {
      elements,
      traits: {},
      domains: { \uC7AC\uBB3C: null, \uAD00\uACC4: null, \uC9C1\uC5C5: null, \uAC74\uAC15: null, \uD559\uC5C5: null, ...house.domains },
      tags: house.tags,
      keywords: [house.name, planet.name]
    }
  });
}

// public/unse-8f3k2m/src/systems/thai.js
var meta6 = {
  id: "thai",
  name: "\uD0DC\uAD6D \uC810\uC131\uC220",
  hanja: "\u0E42\u0E2B\u0E23\u0E32\u0E28\u0E32\u0E2A\u0E15\u0E23\u0E4C",
  desc: "\uD0DC\uC5B4\uB09C \uC694\uC77C\uB85C \uC0C9\xB7\uBC29\uC704\xB7\uC218\uD638 \uBD88\uC0C1\uACFC \uAE30\uC9C8\uC744 \uBCF8\uB2E4",
  needsTime: false,
  needsPlace: false
};
var DAYS = [
  {
    planet: "\uD0DC\uC591",
    color: "\uBE68\uAC15",
    dir: "\uBD81\uB3D9",
    el: 1,
    buddha: "\uD30C\uC559 \uD0C0\uC640\uC774 \uB137",
    buddhaMean: "\uB208\uC744 \uAC10\uC9C0 \uC54A\uACE0 \uBCF4\uB9AC\uC218\uB97C \uBC14\uB77C\uBCF4\uB294 \uC0C1",
    text: "\uB4DC\uB7EC\uB098\uB294 \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uC790\uC874\uC2EC\uC774 \uB69C\uB837\uD558\uACE0 \uB0A8\uC5D0\uAC8C \uAD7D\uD788\uB294 \uAC83\uC744 \uC5B4\uB824\uC6CC\uD569\uB2C8\uB2E4. \uC911\uC2EC\uC5D0 \uC124 \uB54C \uAC00\uC7A5 \uC790\uAE30\uB2F5\uACE0, \uC0AC\uB78C\uB4E4\uC774 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC2DC\uC120\uC744 \uC90D\uB2C8\uB2E4.",
    traits: { \uC8FC\uB3C4: 0.7, \uC678\uD5A5: 0.6 },
    tags: ["\uBA85\uC608", "\uC8FC\uB3C4"]
  },
  {
    planet: "\uB2EC",
    color: "\uB178\uB791",
    dir: "\uB3D9",
    el: 4,
    buddha: "\uD30C\uC559 \uD568 \uC58F",
    buddhaMean: "\uC190\uC744 \uB4E4\uC5B4 \uB2E4\uD23C\uC744 \uB9C9\uB294 \uC0C1",
    text: "\uBD80\uB4DC\uB7FD\uAC8C \uAC00\uB77C\uC549\uD788\uB294 \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uAC08\uB4F1\uC744 \uC2EB\uC5B4\uD558\uACE0 \uC911\uAC04\uC5D0\uC11C \uC870\uC728\uD569\uB2C8\uB2E4. \uB0A8\uC758 \uAE30\uBD84\uC744 \uBE68\uB9AC \uC54C\uC544\uCC44\uB294 \uB9CC\uD07C \uC790\uAE30 \uAC10\uC815\uC740 \uB4A4\uB85C \uBBF8\uB8F9\uB2C8\uB2E4.",
    traits: { \uAC10\uC131: 0.7, \uC8FC\uB3C4: -0.2 },
    tags: ["\uB3CC\uBD04", "\uAC10\uC218\uC131"]
  },
  {
    planet: "\uD654\uC131",
    color: "\uBD84\uD64D",
    dir: "\uB0A8\uB3D9",
    el: 1,
    buddha: "\uD30C\uC559 \uC0AC\uC774\uC57C",
    buddhaMean: "\uC606\uC73C\uB85C \uB204\uC6B4 \uC5F4\uBC18\uC758 \uC0C1",
    text: "\uB2E8\uB2E8\uD55C \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uAC89\uC73C\uB85C\uB294 \uC870\uC6A9\uD574\uB3C4 \uD55C\uBC88 \uC815\uD558\uBA74 \uB05D\uAE4C\uC9C0 \uAC11\uB2C8\uB2E4. \uCC38\uB2E4\uAC00 \uD55C\uAEBC\uBC88\uC5D0 \uD130\uB728\uB9AC\uB294 \uCABD\uC774\uB77C \uC911\uAC04\uC5D0 \uB35C\uC5B4\uB0B4\uB294 \uBC95\uC744 \uC775\uD600\uC57C \uD569\uB2C8\uB2E4.",
    traits: { \uC8FC\uB3C4: 0.5, \uC548\uC815: 0.4 },
    tags: ["\uC778\uB0B4", "\uACB0\uB2E8"]
  },
  {
    planet: "\uC218\uC131",
    color: "\uCD08\uB85D",
    dir: "\uB0A8",
    el: 4,
    buddha: "\uD30C\uC559 \uC6C0 \uBC27",
    buddhaMean: "\uBC1C\uC6B0\uB97C \uB4E4\uACE0 \uD0C1\uBC1C\uD558\uB294 \uC0C1",
    text: "\uB9D0\uACFC \uC190\uC774 \uBE60\uB978 \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uC0AC\uB78C\uACFC \uC0AC\uB78C \uC0AC\uC774\uB97C \uC624\uAC00\uBA70 \uC77C\uC744 \uC131\uC0AC\uC2DC\uD0A4\uB294 \uB370 \uB2A5\uD569\uB2C8\uB2E4. \uC5EC\uB7EC \uAC08\uB798\uB97C \uB3D9\uC2DC\uC5D0 \uC950\uB2E4 \uB193\uCE58\uB294 \uAC83\uC774 \uD760\uC785\uB2C8\uB2E4.",
    traits: { \uC678\uD5A5: 0.6, \uC2E4\uB9AC: 0.4 },
    tags: ["\uD45C\uD604", "\uC0AC\uAD50"]
  },
  {
    planet: "\uBAA9\uC131",
    color: "\uC8FC\uD669",
    dir: "\uC11C",
    el: 0,
    buddha: "\uD30C\uC559 \uC0AC\uB9C8\uD2F0",
    buddhaMean: "\uAC00\uBD80\uC88C\uB97C \uD2C0\uACE0 \uBA85\uC0C1\uD558\uB294 \uC0C1",
    text: "\uAC00\uB77C\uC549\uC740 \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uB113\uAC8C \uBCF4\uACE0 \uAE4A\uC774 \uC0DD\uAC01\uD558\uBA70, \uB0A8\uC744 \uAC00\uB974\uCE58\uACE0 \uC774\uB044\uB294 \uC790\uB9AC\uAC00 \uC798 \uB9DE\uC2B5\uB2C8\uB2E4. \uACB0\uC815\uC774 \uB290\uB9B0 \uAC83\uC774 \uC720\uC77C\uD55C \uC57D\uC810\uC785\uB2C8\uB2E4.",
    traits: { \uC548\uC815: 0.5, \uAC10\uC131: 0.3 },
    tags: ["\uD559\uC2B5", "\uC548\uC815"]
  },
  {
    planet: "\uAE08\uC131",
    color: "\uD30C\uB791",
    dir: "\uBD81",
    el: 3,
    buddha: "\uD30C\uC559 \uB78C\uD519",
    buddhaMean: "\uB450 \uC190\uC744 \uBAA8\uC73C\uACE0 \uC0AC\uC0C9\uD558\uB294 \uC0C1",
    text: "\uAC10\uAC01\uC774 \uC608\uBBFC\uD55C \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uC544\uB984\uB2E4\uC6B4 \uAC83\uC744 \uC54C\uC544\uBCF4\uACE0 \uC0AC\uB78C\uC744 \uB04C\uC5B4\uB2F9\uAE41\uB2C8\uB2E4. \uC990\uAC70\uC6C0\uC744 \uC544\uB294 \uB300\uC2E0 \uC500\uC500\uC774\uAC00 \uCEE4\uC9C0\uAE30 \uC27D\uC2B5\uB2C8\uB2E4.",
    traits: { \uC678\uD5A5: 0.5, \uAC10\uC131: 0.5 },
    tags: ["\uC0AC\uAD50", "\uD45C\uD604"]
  },
  {
    planet: "\uD1A0\uC131",
    color: "\uBCF4\uB77C",
    dir: "\uB0A8\uC11C",
    el: 2,
    buddha: "\uD30C\uC559 \uB099 \uC058\uB85D",
    buddhaMean: "\uB098\uAC00\uAC00 \uBAB8\uC744 \uAC10\uC2F8 \uBE44\uB97C \uB9C9\uC544\uC8FC\uB294 \uC0C1",
    text: "\uACAC\uB514\uB294 \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uC5B4\uB824\uC6B4 \uC2DC\uAE30\uB97C \uBB35\uBB35\uD788 \uD1B5\uACFC\uD558\uACE0 \uADF8 \uACBD\uD5D8\uC73C\uB85C \uB2E8\uB2E8\uD574\uC9D1\uB2C8\uB2E4. \uC2DC\uAC04\uC774 \uC313\uC5EC\uC57C \uACB0\uACFC\uAC00 \uB098\uC624\uB294 \uAD6C\uC870\uC785\uB2C8\uB2E4.",
    traits: { \uC548\uC815: 0.7, \uC678\uD5A5: -0.3 },
    tags: ["\uC778\uB0B4", "\uCC45\uC784"]
  }
];
var WED_NIGHT = {
  planet: "\uB77C\uD6C4",
  color: "\uAC80\uC815\xB7\uC9C4\uD68C\uC0C9",
  dir: "\uBD81\uC11C",
  el: 2,
  buddha: "\uD30C\uC559 \uBE60\uB808\uB77C\uC774",
  buddhaMean: "\uC232\uC18D\uC5D0\uC11C \uCF54\uB07C\uB9AC\uC640 \uC6D0\uC22D\uC774\uC758 \uC2DC\uC911\uC744 \uBC1B\uB294 \uC0C1",
  text: "\uAE38\uC774 \uB0A8\uACFC \uB2E4\uB978 \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uC815\uD574\uC9C4 \uACBD\uB85C\uC5D0\uC11C \uC790\uAFB8 \uBC97\uC5B4\uB098\uACE0, \uC624\uD788\uB824 \uADF8 \uBC97\uC5B4\uB0A8\uC5D0\uC11C \uC790\uAE30 \uC790\uB9AC\uB97C \uCC3E\uC2B5\uB2C8\uB2E4. \uD63C\uC790 \uC788\uB294 \uC2DC\uAC04\uC774 \uBC18\uB4DC\uC2DC \uD544\uC694\uD569\uB2C8\uB2E4.",
  traits: { \uC678\uD5A5: -0.4, \uC548\uC815: -0.4 },
  tags: ["\uC790\uC720", "\uBCC0\uD654"]
};
function analyze6(input) {
  const { year, month, day, hour, timeKnown, yearBranch } = input;
  const jdn = toJDN(year, month, day);
  const weekday = weekdayFromJDN(jdn);
  const isWedNight = weekday === 3 && timeKnown && hour >= 18;
  const d = isWedNight ? WED_NIGHT : DAYS[weekday];
  const buddhistYear = year + 543;
  const facts = [
    { label: "\uD0DC\uC5B4\uB09C \uC694\uC77C", value: `${WEEKDAY_KR[weekday]}\uC694\uC77C`, note: isWedNight ? "\uC218\uC694\uC77C \uBC24 \u2192 \uB77C\uD6C4\uB85C \uBCF8\uB2E4" : "" },
    { label: "\uC218\uD638 \uD589\uC131", value: d.planet, note: "" },
    { label: "\uD589\uC6B4\uC758 \uC0C9", value: d.color, note: "\uC911\uC694\uD55C \uB0A0\uC5D0 \uAC78\uCE58\uBA74 \uC88B\uB2E4\uACE0 \uBCF8\uB2E4" },
    { label: "\uBC29\uC704", value: d.dir, note: "\uC0AC\uC6D0\uC5D0\uC11C \uC774 \uBC29\uD5A5\uC758 \uBD88\uC0C1\uC5D0 \uCC38\uBC30\uD55C\uB2E4" },
    { label: "\uC218\uD638 \uBD88\uC0C1", value: d.buddha, note: d.buddhaMean },
    { label: "\uBD88\uAE30", value: `${buddhistYear}\uB144`, note: `\uC11C\uAE30 ${year} + 543` },
    { label: "\uB760", value: ZODIAC[yearBranch], note: `${BRANCHES_KR[yearBranch]}\uB144\uC0DD` }
  ];
  const readings = [
    { title: `${WEEKDAY_KR[weekday]}\uC694\uC77C\uC0DD \u2014 ${d.planet}\uC758 \uC0AC\uB78C`, text: d.text },
    {
      title: `\uC218\uD638 \uBD88\uC0C1 \u2014 ${d.buddha}`,
      text: `${d.buddhaMean}\uC785\uB2C8\uB2E4. \uD0DC\uAD6D\uC758 \uC0AC\uC6D0\uC5D0\uB294 \uC694\uC77C\uB9C8\uB2E4 \uB2E4\uB978 \uC790\uC138\uC758 \uBD88\uC0C1\uC774 \uB193\uC5EC \uC788\uACE0, \uC0AC\uB78C\uB4E4\uC740 \uC790\uAE30 \uC694\uC77C\uC758 \uBD88\uC0C1 \uC55E\uC5D0\uC11C \uAE30\uB3C4\uD569\uB2C8\uB2E4. \uC77C\uACF1 \uC694\uC77C\uC5D0 \uC218\uC694\uC77C \uBC24\uC744 \uB354\uD574 \uC5EC\uB35F \uC790\uB9AC\uAC00 \uB418\uB294\uB370, \uC774 \uC5EC\uB35F\uC740 \uBC29\uC704\uC640\uB3C4 \uC9DD\uC744 \uC774\uB8F9\uB2C8\uB2E4.`
    },
    {
      title: "\uC0C9\uC744 \uC4F0\uB294 \uBC95",
      text: `${j(d.color, "\uC774")} \uC774 \uC0AC\uB78C\uC758 \uC0C9\uC785\uB2C8\uB2E4. \uD0DC\uAD6D\uC5D0\uC11C\uB294 \uC694\uC77C \uC0C9\uC744 \uC2E4\uC81C\uB85C \uC785\uC2B5\uB2C8\uB2E4. \uD0DC\uAD6D \uAD6D\uC655\uC774 \uC6D4\uC694\uC77C\uC0DD\uC774\uB77C \uC655\uC2E4 \uD589\uC0AC\uC5D0 \uB178\uB780\uC0C9\uC774 \uC4F0\uC774\uB294 \uAC83\uB3C4 \uAC19\uC740 \uC774\uC720\uC785\uB2C8\uB2E4. \uBA74\uC811\uC774\uB098 \uC911\uC694\uD55C \uC790\uB9AC\uCC98\uB7FC \uAE30\uC6B4\uC744 \uBE4C\uB9AC\uACE0 \uC2F6\uC740 \uB0A0\uC5D0 \uAC78\uCE58\uB294 \uC6A9\uB3C4\uB85C \uC4F0\uBA74 \uB429\uB2C8\uB2E4.`
    }
  ];
  const elements = [0, 0, 0, 0, 0];
  elements[d.el] = 1;
  return result({
    id: meta6.id,
    name: meta6.name,
    hanja: meta6.hanja,
    headline: `${WEEKDAY_KR[weekday]}\uC694\uC77C\uC0DD \xB7 ${d.planet} \xB7 ${d.color}`,
    facts,
    readings,
    confidence: weekday === 3 && !timeKnown ? 0.7 : 0.9,
    signals: {
      elements,
      traits: d.traits,
      domains: { \uC7AC\uBB3C: null, \uAD00\uACC4: null, \uC9C1\uC5C5: null, \uAC74\uAC15: null, \uD559\uC5C5: null },
      tags: d.tags,
      keywords: [`${WEEKDAY_KR[weekday]}\uC694\uC77C`, d.color, d.planet]
    }
  });
}

// public/unse-8f3k2m/src/systems/tarot.js
var meta7 = {
  id: "tarot",
  name: "\uD0C0\uB85C",
  hanja: "Tarot",
  desc: "\uC0DD\uB144\uC6D4\uC77C\uB85C \uACE0\uC815\uB41C \uCE74\uB4DC\uB97C \uBF51\uC544 \uD3C9\uC0DD\uC758 \uC8FC\uC81C\uC640 \uC9C0\uAE08\uC758 \uAD6D\uBA74\uC744 \uBCF8\uB2E4",
  needsTime: false,
  needsPlace: false
};
var MAJOR = [
  ["\uBC14\uBCF4", "The Fool", "\uC544\uBB34\uAC83\uB3C4 \uC815\uD574\uC9C0\uC9C0 \uC54A\uC740 \uC790\uB9AC\uC5D0\uC11C \uCD9C\uBC1C\uD569\uB2C8\uB2E4. \uACC4\uC0B0\uBCF4\uB2E4 \uB6F0\uC5B4\uB4DC\uB294 \uD798\uC774 \uBA3C\uC800\uC778 \uC0AC\uB78C\uC774\uB77C, \uB0A8\uB4E4\uC774 \uBB34\uBAA8\uD558\uB2E4\uACE0 \uD560 \uB54C \uC624\uD788\uB824 \uAE38\uC774 \uC5F4\uB9BD\uB2C8\uB2E4."],
  ["\uB9C8\uBC95\uC0AC", "The Magician", "\uAC00\uC9C4 \uAC83\uC744 \uC2E4\uC81C\uB85C \uC4F0\uB294 \uC7AC\uC8FC\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uC7AC\uB8CC\uAC00 \uC788\uC73C\uBA74 \uC5B4\uB5BB\uAC8C\uB4E0 \uB9CC\uB4E4\uC5B4\uB0C5\uB2C8\uB2E4. \uBB34\uC5C7\uC744 \uB9CC\uB4E4 \uAC83\uC778\uC9C0 \uC815\uD558\uB294 \uCABD\uC774 \uB298 \uACFC\uC81C\uC785\uB2C8\uB2E4."],
  ["\uC5EC\uC0AC\uC81C", "The High Priestess", "\uB9D0\uD558\uC9C0 \uC54A\uACE0 \uC544\uB294 \uC0AC\uB78C\uC785\uB2C8\uB2E4. \uC9C1\uAD00\uC774 \uBA3C\uC800 \uB3C4\uCC29\uD558\uACE0 \uC124\uBA85\uC740 \uB098\uC911\uC5D0 \uBD99\uC2B5\uB2C8\uB2E4. \uC548\uC5D0 \uB2F4\uC544\uB450\uB294 \uAC83\uC774 \uB9CE\uC2B5\uB2C8\uB2E4."],
  ["\uC5EC\uD669\uC81C", "The Empress", "\uAE38\uB7EC\uB0B4\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC0AC\uB78C\uB3C4 \uC77C\uB3C4 \uD488\uC5B4\uC11C \uD0A4\uC6C1\uB2C8\uB2E4. \uD48D\uC694\uC640 \uC778\uC5F0\uC774 \uAE4A\uACE0, \uAC10\uAC01\uC801\uC778 \uAC83\uC5D0 \uBC1D\uC2B5\uB2C8\uB2E4."],
  ["\uD669\uC81C", "The Emperor", "\uD2C0\uC744 \uC138\uC6B0\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC9C8\uC11C\uC640 \uCC45\uC784\uC5D0\uC11C \uC548\uC815\uC744 \uC5BB\uC2B5\uB2C8\uB2E4. \uD1B5\uC81C\uAC00 \uC9C0\uB098\uCE58\uBA74 \uC8FC\uBCC0\uC774 \uAD73\uC5B4\uBC84\uB9BD\uB2C8\uB2E4."],
  ["\uAD50\uD669", "The Hierophant", "\uC804\uD1B5\uACFC \uBC30\uC6C0\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uAC80\uC99D\uB41C \uAE38\uC744 \uB530\uB974\uACE0 \uADF8\uAC83\uC744 \uB0A8\uC5D0\uAC8C \uC804\uD558\uB294 \uC5ED\uD560\uC774 \uBD99\uC2B5\uB2C8\uB2E4."],
  ["\uC5F0\uC778", "The Lovers", "\uC120\uD0DD\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uAD00\uACC4\uB97C \uD1B5\uD574 \uC790\uC2E0\uC744 \uC54C\uC544\uAC11\uB2C8\uB2E4. \uB458 \uC911 \uD558\uB098\uB97C \uACE0\uB974\uB294 \uAD6D\uBA74\uC774 \uBC18\uBCF5\uD574\uC11C \uCC3E\uC544\uC635\uB2C8\uB2E4."],
  ["\uC804\uCC28", "The Chariot", "\uBC00\uACE0 \uB098\uAC00\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBC18\uB300\uB418\uB294 \uD798\uC744 \uD55C \uBC29\uD5A5\uC73C\uB85C \uBB36\uC5B4 \uC804\uC9C4\uD569\uB2C8\uB2E4. \uC18D\uB3C4\uAC00 \uBB34\uAE30\uC774\uC790 \uC704\uD5D8\uC785\uB2C8\uB2E4."],
  ["\uD798", "Strength", "\uBD80\uB4DC\uB7EC\uC6C0\uC73C\uB85C \uC774\uAE30\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC5B5\uB204\uB974\uC9C0 \uC54A\uACE0 \uB2EC\uB798\uC11C \uB2E4\uB8F9\uB2C8\uB2E4. \uC778\uB0B4\uAC00 \uACE7 \uC2E4\uB825\uC778 \uC720\uD615\uC785\uB2C8\uB2E4."],
  ["\uC740\uB454\uC790", "The Hermit", "\uD63C\uC790 \uCC3E\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBB3C\uB7EC\uB098 \uC0DD\uAC01\uD558\uB294 \uC2DC\uAC04\uC5D0\uC11C \uB2F5\uC744 \uC5BB\uC2B5\uB2C8\uB2E4. \uB0A8\uC758 \uC18D\uB3C4\uC5D0 \uB9DE\uCD94\uBA74 \uAE38\uC744 \uC783\uC2B5\uB2C8\uB2E4."],
  ["\uC6B4\uBA85\uC758 \uC218\uB808\uBC14\uD034", "Wheel of Fortune", "\uD750\uB984\uC774 \uD06C\uAC8C \uBC14\uB00C\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uD1B5\uC81C \uBC16\uC758 \uBCC0\uD654\uAC00 \uC790\uC8FC \uCC3E\uC544\uC624\uACE0, \uADF8 \uD0C0\uC774\uBC0D\uC744 \uC77D\uB294 \uAC10\uAC01\uC774 \uBC1C\uB2EC\uD569\uB2C8\uB2E4."],
  ["\uC815\uC758", "Justice", "\uADE0\uD615\uC744 \uC7AC\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC633\uACE0 \uADF8\uB984\uC5D0 \uBBFC\uAC10\uD558\uACE0 \uADF8 \uAE30\uC900\uC73C\uB85C \uD310\uB2E8\uD569\uB2C8\uB2E4. \uC6D0\uC778\uACFC \uACB0\uACFC\uB97C \uBD84\uBA85\uD788 \uBD05\uB2C8\uB2E4."],
  ["\uB9E4\uB2EC\uB9B0 \uC0AC\uB78C", "The Hanged Man", "\uAC70\uAFB8\uB85C \uBCF4\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBA48\uCDB0 \uC788\uB294 \uB3D9\uC548 \uAD00\uC810\uC774 \uBC14\uB01D\uB2C8\uB2E4. \uAE30\uB2E4\uB9BC\uC774 \uC190\uD574\uAC00 \uC544\uB2CC \uC720\uD615\uC785\uB2C8\uB2E4."],
  ["\uC8FD\uC74C", "Death", "\uB05D\uB0B4\uC57C \uC2DC\uC791\uB418\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uD55C \uC2DC\uAE30\uB97C \uC644\uC804\uD788 \uB2EB\uB294 \uACBD\uD5D8\uC774 \uBC18\uBCF5\uB429\uB2C8\uB2E4. \uBB34\uC12D\uAC8C \uB4E4\uB9AC\uC9C0\uB9CC \uBCC0\uD654\uC758 \uCE74\uB4DC\uC785\uB2C8\uB2E4."],
  ["\uC808\uC81C", "Temperance", "\uC11E\uC5B4\uC11C \uC0C8\uB85C \uB9CC\uB4DC\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uADF9\uB2E8\uC744 \uC870\uC728\uD574 \uC911\uAC04\uC744 \uCC3E\uC2B5\uB2C8\uB2E4. \uC2DC\uAC04\uC774 \uAC78\uB9AC\uB294 \uC77C\uC5D0 \uAC15\uD569\uB2C8\uB2E4."],
  ["\uC545\uB9C8", "The Devil", "\uBB36\uC5EC \uC788\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC695\uB9DD\xB7\uC2B5\uAD00\xB7\uAD00\uACC4\uC5D0 \uB9E4\uC774\uB294 \uACBD\uD5D8\uC744 \uD1B5\uD574 \uBC30\uC6C1\uB2C8\uB2E4. \uC0AC\uC2AC\uC744 \uC954 \uCABD\uC774 \uC790\uC2E0\uC784\uC744 \uBCF4\uB294 \uAC8C \uAD00\uAC74\uC785\uB2C8\uB2E4."],
  ["\uD0D1", "The Tower", "\uBB34\uB108\uC9C0\uACE0 \uB2E4\uC2DC \uC9D3\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uC608\uACE0 \uC5C6\uB294 \uBD95\uAD34\uB97C \uACAA\uC9C0\uB9CC \uADF8 \uB4A4\uAC00 \uD6E8\uC52C \uB2E8\uB2E8\uD569\uB2C8\uB2E4."],
  ["\uBCC4", "The Star", "\uD68C\uBCF5\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBB34\uB108\uC9C4 \uB2E4\uC74C\uC5D0 \uC624\uB294 \uC870\uC6A9\uD55C \uD76C\uB9DD\uC785\uB2C8\uB2E4. \uB0A8\uC5D0\uAC8C \uBC29\uD5A5\uC744 \uBCF4\uC5EC\uC8FC\uB294 \uC5ED\uD560\uC774 \uBD99\uC2B5\uB2C8\uB2E4."],
  ["\uB2EC", "The Moon", "\uBD88\uD655\uC2E4 \uC18D\uC744 \uAC77\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBCF4\uC774\uC9C0 \uC54A\uB294 \uAC83\uC744 \uB2E4\uB8E8\uACE0 \uC0C1\uC0C1\uB825\uC774 \uAC15\uD569\uB2C8\uB2E4. \uC0AC\uC2E4\uACFC \uBD88\uC548\uC744 \uAD6C\uBD84\uD558\uB294 \uAC8C \uACFC\uC81C\uC785\uB2C8\uB2E4."],
  ["\uD0DC\uC591", "The Sun", "\uB4DC\uB7EC\uB0B4\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uBC1D\uACE0 \uBA85\uB8CC\uD558\uBA70 \uC788\uB294 \uADF8\uB300\uB85C \uD1B5\uD569\uB2C8\uB2E4. \uC228\uAE30\uB824 \uD558\uBA74 \uC624\uD788\uB824 \uC5B4\uAE0B\uB0A9\uB2C8\uB2E4."],
  ["\uC2EC\uD310", "Judgement", "\uBD80\uB984\uC5D0 \uB2F5\uD558\uB294 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uACFC\uAC70\uB97C \uC815\uC0B0\uD558\uACE0 \uB2E4\uC2DC \uC77C\uC5B4\uC11C\uB294 \uAD6D\uBA74\uC774 \uCC3E\uC544\uC635\uB2C8\uB2E4."],
  ["\uC138\uACC4", "The World", "\uC644\uC131\uC758 \uC790\uB9AC\uC785\uB2C8\uB2E4. \uD55C \uBC14\uD034\uB97C \uB2E4 \uB3CC\uACE0 \uB9E4\uB4ED\uC9D3\uC2B5\uB2C8\uB2E4. \uB05D\uC774 \uACE7 \uB2E4\uC74C \uC2DC\uC791\uC774 \uB429\uB2C8\uB2E4."]
];
var MAJOR_TAGS = [
  ["\uC790\uC720", "\uBCC0\uD654"],
  ["\uC2E4\uD589", "\uD45C\uD604"],
  ["\uC9C1\uAD00", "\uB0B4\uD5A5"],
  ["\uB3CC\uBD04", "\uAC10\uC218\uC131"],
  ["\uCC45\uC784", "\uC8FC\uB3C4"],
  ["\uD559\uC2B5", "\uC548\uC815"],
  ["\uC0AC\uAD50", "\uAC10\uC218\uC131"],
  ["\uC8FC\uB3C4", "\uC2E4\uD589"],
  ["\uC778\uB0B4", "\uB3CC\uBD04"],
  ["\uB0B4\uD5A5", "\uBD84\uC11D"],
  ["\uBCC0\uD654", "\uC9C1\uAD00"],
  ["\uBD84\uC11D", "\uACB0\uB2E8"],
  ["\uC778\uB0B4", "\uC9C1\uAD00"],
  ["\uBCC0\uD654", "\uACB0\uB2E8"],
  ["\uC778\uB0B4", "\uC548\uC815"],
  ["\uC7AC\uBB3C", "\uAC10\uC218\uC131"],
  ["\uBCC0\uD654", "\uACB0\uB2E8"],
  ["\uC9C1\uAD00", "\uB3CC\uBD04"],
  ["\uC9C1\uAD00", "\uAC10\uC218\uC131"],
  ["\uD45C\uD604", "\uBA85\uC608"],
  ["\uACB0\uB2E8", "\uCC45\uC784"],
  ["\uC644\uBCBD", "\uC548\uC815"]
];
var SUITS = [
  { name: "\uC644\uB4DC", en: "Wands", element: "\uBD88", theme: "\uC758\uC9C0\uC640 \uD589\uB3D9" },
  { name: "\uCEF5", en: "Cups", element: "\uBB3C", theme: "\uAC10\uC815\uACFC \uAD00\uACC4" },
  { name: "\uC18C\uB4DC", en: "Swords", element: "\uACF5\uAE30", theme: "\uC0DD\uAC01\uACFC \uACB0\uB2E8" },
  { name: "\uD39C\uD0C0\uD074", en: "Pentacles", element: "\uD759", theme: "\uD604\uC2E4\uACFC \uC7AC\uBB3C" }
];
var RANKS = [
  { name: "\uC5D0\uC774\uC2A4", mean: "\uB9C9 \uC528\uC557\uC774 \uB193\uC778 \uC0C1\uD0DC" },
  { name: "2", mean: "\uB458 \uC0AC\uC774\uC5D0\uC11C \uC800\uC6B8\uC9C8\uD558\uB294 \uC0C1\uD0DC" },
  { name: "3", mean: "\uCCAB \uACB0\uC2E4\uC774 \uBCF4\uC774\uB294 \uC0C1\uD0DC" },
  { name: "4", mean: "\uC548\uC815\uB418\uC5C8\uC9C0\uB9CC \uBA48\uCDB0 \uC788\uB294 \uC0C1\uD0DC" },
  { name: "5", mean: "\uBD80\uB52A\uCE58\uACE0 \uBAA8\uC790\uB780 \uC0C1\uD0DC" },
  { name: "6", mean: "\uD68C\uBCF5\uD558\uACE0 \uC8FC\uACE0\uBC1B\uB294 \uC0C1\uD0DC" },
  { name: "7", mean: "\uC2DC\uD5D8\uBC1B\uC73C\uBA70 \uBC84\uD2F0\uB294 \uC0C1\uD0DC" },
  { name: "8", mean: "\uBE60\uB974\uAC8C \uC6C0\uC9C1\uC774\uB294 \uC0C1\uD0DC" },
  { name: "9", mean: "\uAC70\uC758 \uB2E4 \uC654\uC73C\uB098 \uC544\uC9C1\uC778 \uC0C1\uD0DC" },
  { name: "10", mean: "\uAC00\uB4DD \uCC28\uC11C \uBB34\uAC70\uC6CC\uC9C4 \uC0C1\uD0DC" },
  { name: "\uD398\uC774\uC9C0", mean: "\uBC30\uC6B0\uAE30 \uC2DC\uC791\uD55C \uB2E8\uACC4" },
  { name: "\uB098\uC774\uD2B8", mean: "\uD55C \uBC29\uD5A5\uC73C\uB85C \uB3CC\uC9C4\uD558\uB294 \uB2E8\uACC4" },
  { name: "\uD038", mean: "\uD488\uC5B4\uC11C \uAE38\uB7EC\uB0B4\uB294 \uB2E8\uACC4" },
  { name: "\uD0B9", mean: "\uC644\uC219\uD558\uAC8C \uB2E4\uC2A4\uB9AC\uB294 \uB2E8\uACC4" }
];
function buildDeck() {
  const deck = MAJOR.map(([kr, en, text], i) => ({
    id: `major-${i}`,
    title: `${i}. ${kr}`,
    sub: en,
    text,
    element: null,
    major: true
  }));
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({
        id: `${s.en}-${r.name}`,
        title: `${s.name} ${r.name}`,
        sub: `${s.en} \xB7 ${s.element}`,
        text: `${s.theme}\uC758 \uC601\uC5ED\uC5D0\uC11C ${r.mean}\uC785\uB2C8\uB2E4.`,
        element: s.element,
        major: false
      });
    }
  }
  return deck;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = a + 1831565813 >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(deck, rng) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j2 = Math.floor(rng() * (i + 1));
    [a[i], a[j2]] = [a[j2], a[i]];
  }
  return a;
}
var POSITIONS = [
  { label: "\uC0C1\uD669", hint: "\uC9C0\uAE08 \uB193\uC5EC \uC788\uB294 \uC790\uB9AC" },
  { label: "\uACFC\uC81C", hint: "\uB118\uC5B4\uC57C \uD560 \uC9C0\uC810" },
  { label: "\uC870\uC5B8", hint: "\uC950\uACE0 \uAC00\uBA74 \uC88B\uC740 \uAC83" }
];
function analyze7(input) {
  const { year, month, day, hour, minute, timeKnown, civilYear } = input;
  const currentYear = civilYear;
  let sum = month + day + year;
  while (sum > 22) sum = String(sum).split("").reduce((a, c) => a + Number(c), 0);
  const birthIndex = sum === 22 ? 0 : sum;
  const [bKr, bEn, bText] = MAJOR[birthIndex];
  const seed = year * 1e5 + month * 3e3 + day * 100 + (timeKnown ? hour * 60 + minute : 0) + currentYear;
  const drawn = shuffle(buildDeck(), mulberry32(seed)).slice(0, 3);
  const facts = [
    { label: "\uC0DD\uC77C \uCE74\uB4DC", value: `${birthIndex}. ${bKr}`, note: bEn },
    // 씨앗에 올해가 들어간다. 즉 이 석 장은 생일 카드와 달리 평생 고정이
    // 아니라 해마다 바뀐다. 출생 고정 자료로 읽히면 곤란해서 밝혀 둔다.
    ...drawn.map((c, i) => ({
      label: POSITIONS[i].label,
      value: c.title,
      note: `${POSITIONS[i].hint} \xB7 ${currentYear}\uB144 \uBC30\uC5F4 (\uC0DD\uB144\uC6D4\uC77C\uC2DC\uB85C \uACE0\uC815\uD55C \uC528\uC557\uC5D0\uC11C \uBF51\uC74C. \uD574\uAC00 \uBC14\uB00C\uBA74 \uB2EC\uB77C\uC9C4\uB2E4)`
    }))
  ];
  const readings = [
    { title: `\uC0DD\uC77C \uCE74\uB4DC \u2014 ${bKr} (${bEn})`, text: bText },
    ...drawn.map((c, i) => ({
      title: `${POSITIONS[i].label} \u2014 ${c.title}`,
      text: c.text
    })),
    {
      title: "\uC774 \uBC30\uC5F4\uC5D0 \uB300\uD558\uC5EC",
      text: "\uD0C0\uB85C\uB294 \uC6D0\uB798 \uBF51\uC744 \uB54C\uB9C8\uB2E4 \uB2EC\uB77C\uC9C0\uB294 \uC810\uC785\uB2C8\uB2E4. \uC5EC\uAE30\uC11C\uB294 \uB2E4\uB978 \uCCB4\uACC4\uC640 \uACB9\uCCD0 \uBCF4\uAE30 \uC704\uD574 \uC0DD\uB144\uC6D4\uC77C\uC2DC\uB97C \uC528\uC557\uC73C\uB85C \uCE74\uB4DC\uB97C \uACE0\uC815\uD588\uC2B5\uB2C8\uB2E4. \uAC19\uC740 \uC0AC\uB78C\uC774 \uB2E4\uC2DC \uC5F4\uC5B4\uB3C4 \uAC19\uC740 \uCE74\uB4DC\uAC00 \uB098\uC635\uB2C8\uB2E4."
    }
  ];
  const elements = [0, 0, 0, 0, 0];
  for (const c of drawn) {
    if (!c.element) continue;
    const mapped = WESTERN_TO_OHAENG[c.element];
    mapped.forEach((v, i) => {
      elements[i] += v;
    });
  }
  const majorCount = drawn.filter((c) => c.major).length;
  return result({
    id: meta7.id,
    name: meta7.name,
    hanja: meta7.hanja,
    headline: `\uC0DD\uC77C \uCE74\uB4DC ${bKr} \xB7 ${drawn.map((c) => c.title).join(" / ")}`,
    facts,
    readings,
    // 메이저가 많을수록 큰 흐름, 적을수록 일상의 문제를 가리킨다
    confidence: 0.8,
    signals: {
      elements,
      traits: {
        \uC8FC\uB3C4: majorCount >= 2 ? 0.3 : 0,
        \uAC10\uC131: elements[4] > 1 ? 0.4 : 0,
        \uC2E4\uB9AC: elements[2] > 1 ? 0.4 : 0,
        \uC678\uD5A5: 0,
        \uC548\uC815: 0
      },
      domains: { \uC7AC\uBB3C: null, \uAD00\uACC4: null, \uC9C1\uC5C5: null, \uAC74\uAC15: null, \uD559\uC5C5: null },
      tags: MAJOR_TAGS[birthIndex],
      keywords: [bKr, ...drawn.filter((c) => c.major).map((c) => c.title.split(". ")[1] ?? c.title)]
    }
  });
}

// analysis/fortune-lotto/run-backtest.mjs
var HERE = dirname(fileURLToPath(import.meta.url));
var OUT = join(HERE, "output");
var CSV_URL = "https://raw.githubusercontent.com/jdyang88/Korea_Lotto/master/Lotto_Numbers.csv";
var END_ROUND = 1242;
var RECENT_DRAWS = [
  [1232, [12, 15, 19, 22, 24, 36], "2026-07-11"],
  [1233, [2, 7, 20, 25, 37, 40], "2026-07-18"],
  [1234, [1, 15, 19, 31, 35, 43], "2026-07-25"],
  [1235, [6, 7, 11, 15, 39, 43], "2026-08-01"],
  [1236, [12, 18, 21, 29, 34, 38], "2026-08-08"],
  [1237, [10, 20, 23, 34, 37, 40], "2026-08-15"],
  [1238, [2, 13, 18, 32, 38, 42], "2026-08-22"],
  [1239, [11, 13, 22, 32, 33, 36], "2026-08-29"],
  [1240, [11, 13, 19, 20, 31, 44], "2026-09-05"],
  [1241, [7, 13, 16, 23, 24, 43], "2026-09-12"],
  [1242, [2, 4, 10, 16, 31, 41], "2026-09-19"]
].map(([round, winning, date]) => ({ round, winning, date, source_url: `https://www.todaylotto.kr/draws/${round}` }));
var SCHEDULE_SOURCE = "https://www.mt.co.kr/amp/industry/2022/04/18/2022041810445230719";
var ORIGINAL_A_FIXED_SCHEDULE = { score: 5901, hist: [324, 525, 302, 82, 7, 1, 1], hits: 1414, mean: 1.1384863123993558, ge3: 0.07326892109500806, ge4: 0.007246376811594203, rounds: "1-1242", note: "Original pre-expansion A; fixed official 20:45/20:35 schedule." };
var SEOUL = findCity("\uC11C\uC6B8");
var BRANCH_CHARS = "\u5B50\u4E11\u5BC5\u536F\u8FB0\u5DF3\u5348\u672A\u7533\u9149\u620C\u4EA5";
var SCORE = [0, 1, 3, 10, 50, 300, 3e3];
var spread = (raw, max) => Math.min(45, Math.max(1, Math.floor(((raw - 1) % max + max) % max / max * 45) + 1));
var mod45 = (x) => ((Math.floor(x) - 1) % 45 + 45) % 45 + 1;
var digitRoot = (n, keepMaster = true) => {
  let x = Math.abs(Math.trunc(n));
  while (x > 9 && !(keepMaster && (x === 11 || x === 22))) x = String(x).split("").reduce((a, c) => a + +c, 0);
  return x;
};
var num = (s) => Number(String(s).match(/\d+/)?.[0] ?? 0);
var branch = (s) => Math.max(0, BRANCH_CHARS.indexOf(String(s).match(/[子丑寅卯辰巳午未申酉戌亥]/)?.[0]));
var fact = (r, label) => r.facts.find((x) => x.label === label)?.value ?? "";
async function fetchCsv() {
  const r = await fetch(CSV_URL);
  if (!r.ok) throw new Error(`lotto CSV download failed: ${r.status}`);
  return r.text();
}
function parseCsv(text) {
  return text.trim().replace(/^\uFEFF/, "").split(/\r?\n/).slice(1).map((line) => {
    const p = line.split(",").map(Number);
    return { round: p[0], winning: p.slice(1, 7) };
  }).filter((r) => r.round >= 1 && r.round <= END_ROUND && r.winning.length === 6);
}
function dateOf(round) {
  const d = new Date(Date.UTC(2002, 11, 7 + (round - 1) * 7));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
function drawClock(round, shift = 0) {
  const dd = dateOf(round);
  const changed = Date.UTC(dd.y, dd.m - 1, dd.d) >= Date.UTC(2022, 3, 23);
  const minutes = (changed ? 20 * 60 + 35 : 20 * 60 + 45) + shift;
  return { ...dd, hour: Math.floor(minutes / 60), minute: (minutes % 60 + 60) % 60, time_source: "official_schedule", source_url: SCHEDULE_SOURCE, source_note: changed ? "2022-04-23 1012\uD68C\uBD80\uD130 \uD655\uC778\uB41C 20:35 \uACF5\uC2DD \uBC29\uC1A1 \uD3B8\uC131" : "2022-04-23 \uC774\uC804 \uC77C\uBC18 \uACF5\uC2DD \uBC29\uC1A1 \uD3B8\uC131 20:45", draw_place: "\uC11C\uC6B8", place_source: "inferred_broadcast_studio_city" };
}
function eventInput(round, shift = 0) {
  const e = drawClock(round, shift);
  const birth = normalizeBirth({ year: e.y, month: e.m, day: e.d, hour: e.hour, minute: e.minute, place: SEOUL });
  const lunar = solarToLunar(e.y, e.m, e.d);
  const chart = computeFourPillars(birth.jdUT, birth.jdTST, { timeKnown: true });
  return {
    ...e,
    year: e.y,
    month: e.m,
    day: e.d,
    place: SEOUL,
    timeKnown: true,
    jdUT: birth.jdUT,
    jdTST: birth.jdTST,
    lunar,
    sajuYear: chart.sajuYear,
    sectorIndex: chart.sector.index,
    yearStem: chart.pillars.year.stem,
    yearBranch: chart.pillars.year.branch,
    monthStem: chart.pillars.month.stem,
    monthBranch: chart.pillars.month.branch,
    dayStem: chart.pillars.day.stem,
    dayBranch: chart.pillars.day.branch,
    hourStem: chart.pillars.hour.stem,
    hourBranch: chart.pillars.hour.branch,
    currentYear: chart.sajuYear,
    civilYear: e.y,
    age: 0,
    elapsedYears: 0,
    nowJD: birth.jdUT,
    chart
  };
}
function featuresFor(round, shift = 0) {
  const x = eventInput(round, shift), f = [];
  const add = (system, key, raw, max, lineage, note = "") => f.push({ id: `${system}.${key}`, system, key, raw, spread: spread(raw, max), max, lineage, note });
  const p = x.chart.pillars;
  for (const k of ["year", "month", "day", "hour"]) {
    add("saju", `${k}_stem`, p[k].stem + 1, 10, "ganzhi.pillars");
    add("saju", `${k}_branch`, p[k].branch + 1, 12, "ganzhi.pillars");
    add("saju", `${k}_sexagenary`, sexagenaryIndex(p[k].stem, p[k].branch) + 1, 60, "ganzhi.pillars");
  }
  elementDistribution(p).count.forEach((v, i) => add("saju", `element_${i}`, v, 8, "ganzhi.pillars.element_distribution"));
  add("saju", "solar_term_sector", x.sectorIndex + 1, 24, "astro.solar_term");
  const lm = x.lunar.month, ld = x.lunar.day, hb = x.hourBranch;
  const myeong = ((lm + 1 - hb) % 12 + 12) % 12, sin3 = ((lm + 1 + hb) % 12 + 12) % 12;
  const yearStem = ((x.sajuYear - 4) % 10 + 10) % 10, inStem = (yearStem % 5 * 2 + 2) % 10;
  const myeongStem = ((inStem + myeong - 2) % 10 + 10) % 10;
  let sexa = 0;
  for (let i = 0; i < 60; i++) if (i % 10 === myeongStem && i % 12 === myeong) {
    sexa = i;
    break;
  }
  const nayeum = [3, 1, 0, 2, 3, 1, 4, 2, 3, 0, 4, 2, 1, 0, 4, 3, 1, 0, 2, 3, 1, 4, 2, 3, 0, 4, 2, 1, 0, 4];
  const gukN = { 4: 2, 0: 3, 3: 4, 2: 5, 1: 6 }[nayeum[Math.floor(sexa / 2)]];
  const mok = Math.ceil(ld / gukN), rem = mok * gukN - ld;
  const ziwei = ((mok + 1 + (rem % 2 === 0 ? rem : -rem)) % 12 + 12) % 12, tianfu = ((4 - ziwei) % 12 + 12) % 12;
  add("jamidusu", "myeong_palace", myeong + 1, 12, "lunar.month+hour_branch");
  add("jamidusu", "sin_palace", sin3 + 1, 12, "lunar.month+hour_branch");
  add("jamidusu", "guk_number", gukN, 6, "saju_year+palace.nayeum");
  add("jamidusu", "ziwei_palace", ziwei + 1, 12, "lunar.day+guk");
  add("jamidusu", "tianfu_palace", tianfu + 1, 12, "ziwei_palace");
  [["tianji", -1], ["taiyang", -3], ["wuqu", -4], ["tiantong", -5], ["lianzhen", -8]].forEach(([n, o]) => add("jamidusu", `${n}_palace`, ((ziwei + o) % 12 + 12) % 12 + 1, 12, "ziwei.star_board"));
  [["taiyin", 1], ["tanlang", 2], ["jumen", 3], ["tianxiang", 4], ["tianliang", 5], ["qisha", 6], ["pojun", 10]].forEach(([n, o]) => add("jamidusu", `${n}_palace`, ((tianfu + o) % 12 + 12) % 12 + 1, 12, "ziwei.star_board"));
  const pos = planetPositions(x.jdUT);
  for (const n of PLANET_ORDER) {
    const lon = pos[n].lon;
    add("astrology", `${n}_longitude_degree`, Math.floor(lon) + 1, 360, `astro.planet.${n}`, `exact_lon=${lon}`);
    add("astrology", `${n}_sign`, Math.floor(lon / 30) + 1, 12, `astro.planet.${n}`);
  }
  const h = houses(x.jdUT, SEOUL.lat, SEOUL.lon);
  add("astrology", "ascendant_degree", Math.floor(h.asc) + 1, 360, "astro.houses", `exact_lon=${h.asc}`);
  add("astrology", "midheaven_degree", Math.floor(h.mc) + 1, 360, "astro.houses", `exact_lon=${h.mc}`);
  const moonSid = toSidereal(pos.\uB2EC.lon, x.jdUT), nak = nakshatraOf(x.jdUT);
  add("vedic_sukyo_shared", "sidereal_moon_degree", Math.floor(moonSid) + 1, 360, "astro.moon+lahiri_ayanamsa", `exact_lon=${moonSid}`);
  add("vedic_sukyo_shared", "nakshatra_index", nak.index + 1, 27, "astro.moon+lahiri_ayanamsa");
  add("vedic_sukyo_shared", "nakshatra_pada", nak.pada, 4, "astro.moon+lahiri_ayanamsa");
  for (const n of PLANET_ORDER) {
    const sid = toSidereal(pos[n].lon, x.jdUT);
    add("vedic", `${n}_sidereal_sign`, Math.floor(sid / 30) + 1, 12, `astro.planet.${n}+lahiri`);
  }
  const hx = hexOf(x), base = x.yearBranch + 1 + lm + ld, hourNum = hb + 1;
  add("juyeok", "base", base, 60, "ganzhi.year_branch+lunar");
  add("juyeok", "upper_trigram", hx.upper + 1, 8, "juyeok.base");
  add("juyeok", "lower_trigram", hx.lower + 1, 8, "juyeok.base+hour_branch");
  add("juyeok", "original_hexagram", hx.num, 64, "juyeok.trigrams");
  add("juyeok", "moving_line", ((base + hourNum - 1) % 6 + 6) % 6 + 1, 6, "juyeok.base+hour_branch");
  const yu = analyze(x);
  add("yukim", "month_general", branch(fact(yu, "\uC6D4\uC7A5")) + 1, 12, "astro.sun_longitude");
  add("yukim", "point_hour", hb + 1, 12, "ganzhi.hour_branch");
  add("yukim", "day_stem_gigung", branch(fact(yu, "\uC77C\uAC04 \uAE30\uAD81")) + 1, 12, "ganzhi.day_stem");
  add("yukim", "first_transmission", branch(fact(yu, "\uCD08\uC804")) + 1, 12, "yukim.four_courses");
  add("yukim", "middle_transmission", branch(fact(yu, "\uC911\uC804")) + 1, 12, "yukim.heaven_plate");
  add("yukim", "last_transmission", branch(fact(yu, "\uB9D0\uC804")) + 1, 12, "yukim.heaven_plate");
  add("yukim", "noble_ground", branch(fact(yu, "\uADC0\uC778").split("\u2192")[1]) + 1, 12, "yukim.noble");
  const wj = monthGeneral(x.jdUT);
  for (let i = 0; i < 12; i++) add("yukim", `heaven_plate_at_${i + 1}`, ((wj + i - hb) % 12 + 12) % 12 + 1, 12, "yukim.month_general+hour_branch");
  const hg = analyze2(x);
  add("hongguk", "heaven_plate_center", num(fact(hg, "\uCC9C\uBC18\uC218")), 9, "ganzhi.four_stems");
  add("hongguk", "earth_plate_center", num(fact(hg, "\uC9C0\uBC18\uC218")), 9, "ganzhi.four_branches");
  add("hongguk", "my_palace", num(fact(hg, "\uB0B4 \uAD81")), 9, "hongguk.day_stem");
  add("hongguk", "year_palace", num(fact(hg, "\uC138\uAD81")), 9, "hongguk.year_branch");
  add("hongguk", "dun_direction", fact(hg, "\uB454").includes("\uC591") ? 1 : 2, 2, "astro.solar_term");
  const te = analyze3(x);
  for (const label of ["\uD0DC\uC744 \uAD81", "\uD0DC\uC744\uC218", "\uC8FC\uAE30"]) {
    const v = fact(te, label);
    if (v) add("taeeul", label.replaceAll(" ", "_"), num(v) || 1, 24, "saju_year.24_cycle");
  }
  add("taeeul", "cycle_position", ((x.sajuYear - 4) % 24 + 24) % 24 + 1, 24, "saju_year.24_cycle");
  const honmei = starOfYear(x.sajuYear), monthBase = { 1: 8, 4: 8, 7: 8, 2: 2, 5: 2, 8: 2, 3: 5, 6: 5, 9: 5 }[honmei], getsu = ((monthBase - x.sectorIndex - 1) % 9 + 9) % 9 + 1;
  add("gujeong", "honmei_star", honmei, 9, "saju_year");
  add("gujeong", "getsumei_star", getsu, 9, "gujeong.honmei+solar_term");
  const tj = analyze4(x);
  for (const label of ["\uC0C1\uAD18", "\uC911\uAD18", "\uD558\uAD18", "\uAD18"]) {
    const v = fact(tj, label);
    if (v) add("tojeong", label, num(v) || 1, label === "\uAD18" ? 144 : label === "\uC0C1\uAD18" ? 8 : label === "\uC911\uAD18" ? 6 : 3, "lunar+ganzhi");
  }
  const life = digitRoot(String(x.y).split("").reduce((a, c) => a + +c, 0) + x.m + x.d), birthday = digitRoot(x.d), personal = digitRoot(x.m + x.d + x.y, false);
  add("kabbalah", "life_path", life, 22, "civil_date");
  add("kabbalah", "birthday_number", birthday, 9, "civil_date.day");
  add("kabbalah", "personal_year", personal, 9, "civil_date");
  const mb = analyze5(x);
  for (const label of ["\uB9C8\uD558\uBCF4\uD14C", "\uCD9C\uC0DD\uC694\uC77C", "\uBC84\uB9C8\uB825"]) {
    const v = fact(mb, label);
    if (v) add("mahabote", label, num(v) || 1, label === "\uBC84\uB9C8\uB825" ? 3e3 : 8, "civil_date");
  }
  const jdn = toJDN(x.y, x.m, x.d), weekday = ((jdn + 1) % 7 + 7) % 7, remYear = ((x.y - 638) % 7 + 7) % 7;
  add("mahabote", "eight_place", (weekday + remYear) % 8 + 1, 8, "weekday+burmese_year");
  const th = analyze6(x);
  for (const label of ["\uC694\uC77C", "\uBD88\uAE30"]) {
    const v = fact(th, label);
    if (v) add("thai", label, num(v) || 1, label === "\uBD88\uAE30" ? 3e3 : 7, "civil_date");
  }
  add("thai", "weekday_index", weekday + 1, 7, "weekday");
  add("thai", "buddhist_era_mod100", (x.y + 543) % 100 + 1, 100, "civil_year+543");
  const tr = analyze7(x);
  for (const q of tr.facts) {
    const v = num(q.value);
    if (v || q.label === "\uC0DD\uC77C \uCE74\uB4DC") add("tarot", q.label.replaceAll(" ", "_"), v + 1, 78, "civil_date+event_clock");
  }
  return { event: x, features: f };
}
function conditionOf(row, kind) {
  if (!row._conditions) {
    const x = row.event, pos = planetPositions(x.jdUT), moon = toSidereal(pos.\uB2EC.lon, x.jdUT), daySex = x.dayStem * 12 + x.dayBranch, h = houses(x.jdUT, SEOUL.lat, SEOUL.lon), solarSector = Math.floor(x.sectorIndex / 2), moonSector = Math.floor(pos.\uB2EC.lon / 30);
    row._conditions = { day_stem: x.dayStem, day_branch: x.dayBranch, hour_branch: x.hourBranch, lunar_month: x.lunar.month - 1, lunar_day: x.lunar.day - 1, solar_month: x.m - 1, weekday: (toJDN(x.y, x.m, x.d) + 1) % 7, season: Math.floor(x.m % 12 / 3), solar_sector: solarSector, sun_sign: Math.floor(pos.\uD0DC\uC591.lon / 30), moon_sector: moonSector, nakshatra_group: Math.floor(moon / (360 / 27) / 3), asc_sign: Math.floor(h.asc / 30), mc_sign: Math.floor(h.mc / 30), day_branch_lunar_day: `${x.dayBranch}:${x.lunar.day}`, day_sexagenary_lunar_day: `${daySex}:${x.lunar.day}`, lunar_day_solar_sector: `${x.lunar.day}:${solarSector}`, moon_sector_day_branch: `${moonSector}:${x.dayBranch}`, event_signature: `${daySex}:${x.lunar.day}:${solarSector}:${moonSector}:${Math.floor(h.asc / 30)}` };
  }
  return row._conditions[kind];
}
function formulaName(f, meta8) {
  const layer = (slot) => f.layers?.[slot] ?? f.layer;
  const n = (i, slot) => meta8[i].id + (layer(slot) === "spread" ? ".spread" : ".raw");
  const a = n(f.a, 0), b = f.b == null ? "" : n(f.b, 1), c = f.c == null ? "" : n(f.c, 2);
  return { one: a, sum: `${a}+${b}`, diff: `${a}-${b}`, rdiff: `${b}-${a}`, abs: `|${a}-${b}|`, a2b: `${a}+2\xD7${b}`, twoab: `2\xD7${a}+${b}`, twoaMinusB: `2\xD7${a}-${b}`, aMinusTwoB: `${a}-2\xD7${b}`, twoTwo: `2\xD7${a}+2\xD7${b}`, mul: `${a}\xD7${b}`, mean: `floor((${a}+${b})/2)`, plus3: `${a}+${b}+${c}`, minus3: `${a}+${b}-${c}`, aMinusBC: `${a}-${b}+${c}`, aMinusBMinusC: `${a}-${b}-${c}`, twoABMinusC: `2\xD7${a}+${b}-${c}`, aTwoBMinusC: `${a}+2\xD7${b}-${c}`, aBMinusTwoC: `${a}+${b}-2\xD7${c}`, absPlusC: `|${a}-${b}|+${c}` }[f.op];
}
function candidateForms(n) {
  const o = [], atoms = [];
  for (const layer of ["raw", "spread"]) for (let i = 0; i < n; i++) atoms.push({ i, layer });
  for (const a of atoms) o.push({ a: a.i, op: "one", layer: a.layer, layers: [a.layer], complexity: 1 });
  for (let i = 0; i < atoms.length; i++) for (let j2 = i + 1; j2 < atoms.length; j2++) {
    const a = atoms[i], b = atoms[j2], base = { a: a.i, b: b.i, layers: [a.layer, b.layer] };
    for (const op of ["sum", "diff", "rdiff", "abs", "a2b", "twoab", "twoaMinusB", "aMinusTwoB", "twoTwo", "mul", "mean"]) o.push({ ...base, op, layer: a.layer, complexity: op === "mul" ? 4 : op === "mean" ? 3 : op === "sum" || op === "diff" || op === "rdiff" || op === "abs" ? 2 : 3 });
  }
  return o;
}
function compare(a, b) {
  for (const k of ["score"]) if (b[k] !== a[k]) return b[k] - a[k];
  for (const k of [6, 5, 4]) if (b.hist[k] !== a.hist[k]) return b.hist[k] - a.hist[k];
  const ag = a.hist[3] + a.hist[4] + a.hist[5] + a.hist[6], bg = b.hist[3] + b.hist[4] + b.hist[5] + b.hist[6];
  return bg - ag || b.mean - a.mean;
}
async function main() {
  await mkdir(OUT, { recursive: true });
  const csv = await fetchCsv();
  const draws = [...parseCsv(csv), ...RECENT_DRAWS].sort((a, b) => a.round - b.round);
  if (draws.length !== END_ROUND || draws.at(-1).round !== END_ROUND) throw new Error(`expected complete 1-${END_ROUND} rows, got ${draws.length}`);
  const calculated = draws.map((d) => ({ round: d.round, winning: d.winning, ...featuresFor(d.round) }));
  const meta8 = calculated[0].features;
  const ids = meta8.map((x) => x.id);
  if (new Set(ids).size !== ids.length) {
    const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
    throw new Error(`duplicate feature id: ${duplicate}`);
  }
  const rows = calculated.map((x) => ({ round: x.round, event: x.event, win: new Set(x.winning), values: x.features.map((f) => f.raw), spread: x.features.map((f) => f.spread) }));
  for (const r of rows) {
    const raw = r.values;
    r.values = raw;
    r._spread = r.spread;
  }
  for (const r of rows) r.valuesRaw = r.values;
  const pred2 = (f, r) => {
    const value = (index, slot) => ((f.layers?.[slot] ?? f.layer) === "spread" ? r._spread : r.valuesRaw)[index];
    const a = value(f.a, 0), b = f.b == null ? 0 : value(f.b, 1), c = f.c == null ? 0 : value(f.c, 2);
    let x;
    if (f.op === "one") x = a;
    else if (f.op === "sum") x = a + b;
    else if (f.op === "diff") x = a - b;
    else if (f.op === "rdiff") x = b - a;
    else if (f.op === "abs") x = Math.abs(a - b);
    else if (f.op === "a2b") x = a + 2 * b;
    else if (f.op === "twoab" || f.op === "2ab") x = 2 * a + b;
    else if (f.op === "twoaMinusB") x = 2 * a - b;
    else if (f.op === "aMinusTwoB") x = a - 2 * b;
    else if (f.op === "twoTwo") x = 2 * a + 2 * b;
    else if (f.op === "mul") x = a * b;
    else if (f.op === "mean") x = Math.floor((a + b) / 2);
    else if (f.op === "plus3") x = a + b + c;
    else if (f.op === "aMinusBC") x = a - b + c;
    else if (f.op === "aMinusBMinusC") x = a - b - c;
    else if (f.op === "twoABMinusC") x = 2 * a + b - c;
    else if (f.op === "aTwoBMinusC") x = a + 2 * b - c;
    else if (f.op === "aBMinusTwoC") x = a + b - 2 * c;
    else if (f.op === "absPlusC") x = Math.abs(a - b) + c;
    else x = a + b - c;
    return mod45(x);
  };
  const evalS = (f, rs) => {
    let h = 0;
    for (const r of rs) if (r.win.has(pred2(f, r))) h++;
    return h;
  };
  const forms = candidateForms(meta8.length);
  const singles = forms.filter((f) => f.op === "one");
  const rankedSingles = singles.map((f) => ({ f, hits: evalS(f, rows) })).sort((a, b) => b.hits - a.hits);
  const allowed = rankedSingles.slice(0, 38).map((x) => ({ i: x.f.a, layer: x.f.layer }));
  const triples = [];
  for (let i = 0; i < allowed.length; i++) for (let j2 = i + 1; j2 < allowed.length; j2++) for (let k = j2 + 1; k < allowed.length; k++) {
    const a = allowed[i], b = allowed[j2], c = allowed[k], base = { a: a.i, b: b.i, c: c.i, layers: [a.layer, b.layer, c.layer], layer: a.layer };
    for (const op of ["plus3", "minus3", "aMinusBC", "aMinusBMinusC", "twoABMinusC", "aTwoBMinusC", "aBMinusTwoC", "absPlusC"]) triples.push({ ...base, op, complexity: op === "plus3" ? 3 : op === "absPlusC" ? 4 : op === "minus3" || op === "aMinusBC" ? 4 : 5 });
  }
  const allForms = [...forms, ...triples];
  console.log(`evaluating ${allForms.length} formulas across ${rows.length} rounds`);
  const ranked = [];
  for (let i = 0; i < allForms.length; i++) {
    ranked.push({ f: allForms[i], hits: evalS(allForms[i], rows) });
    if ((i + 1) % 5e3 === 0) console.log(`formula progress ${i + 1}/${allForms.length}`);
  }
  ranked.sort((a, b) => b.hits - a.hits);
  const pool = ranked.slice(0, 650).map((x) => x.f);
  const numbersFor = (p, r) => {
    const nums = /* @__PURE__ */ new Set();
    for (const f of p) {
      let n = f.predict ? f.predict(r) : pred2(f, r), g = 0;
      while (nums.has(n) && g++ < 45) n = n % 45 + 1;
      nums.add(n);
      if (nums.size === 6) break;
    }
    for (let fill = 1; nums.size < 6 && fill <= 45; fill++) if (!nums.has(fill)) nums.add(fill);
    return [...nums].sort((a, b) => a - b);
  };
  const ticket = (p, activeRows = rows) => {
    const hist = Array(7).fill(0);
    let hits = 0, score = 0;
    for (const r of activeRows) {
      const nums = numbersFor(p, r);
      const k = nums.filter((n) => r.win.has(n)).length;
      hist[k]++;
      hits += k;
      score += SCORE[k];
    }
    return { score, hist, hits, mean: hits / activeRows.length, ge3: (hist[3] + hist[4] + hist[5] + hist[6]) / activeRows.length, ge4: (hist[4] + hist[5] + hist[6]) / activeRows.length };
  };
  const legacyA = ORIGINAL_A_FIXED_SCHEDULE;
  const greedy = (candidatePool) => {
    const chosen = [];
    while (chosen.length < 6) {
      let best2 = null;
      for (const f of candidatePool) {
        const s = ticket([...chosen, f]);
        if (!best2 || compare(best2.s, s) > 0) best2 = { f, s };
      }
      chosen.push(best2.f);
    }
    return { chosen, stats: ticket(chosen) };
  };
  const conditionalKinds = ["day_stem", "day_branch", "hour_branch", "lunar_month", "lunar_day", "solar_month", "weekday", "season", "solar_sector", "sun_sign", "moon_sector", "nakshatra_group", "asc_sign", "mc_sign", "day_branch_lunar_day", "day_sexagenary_lunar_day", "lunar_day_solar_sector", "moon_sector_day_branch", "event_signature"];
  const conditional = [], branch_diagnostics = [];
  for (const kind of conditionalKinds) {
    const groups = [...new Set(rows.map((r) => conditionOf(r, kind)))], deep = groups.length > 100, ranks = deep ? 6 : 2, candidates = pool.slice(0, deep ? 650 : 180), maps = Array.from({ length: ranks }, () => /* @__PURE__ */ new Map()), sizes = groups.map((g) => rows.reduce((n, r) => n + (conditionOf(r, kind) === g), 0));
    branch_diagnostics.push({ kind, groups: groups.length, min_branch_size: Math.min(...sizes), max_branch_size: Math.max(...sizes), median_branch_size: [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)], memorization_prone: Math.min(...sizes) < 5 });
    for (const g of groups) {
      const sub = rows.filter((r) => conditionOf(r, kind) === g), ordered = candidates.map((f) => ({ f, h: evalS(f, sub) })).sort((a, b) => b.h - a.h || a.f.complexity - b.f.complexity), seen = /* @__PURE__ */ new Set();
      for (let rank = 0; rank < ranks; rank++) {
        const picked = ordered.find(({ f }) => {
          const signature = sub.map((r) => pred2(f, r)).join(",");
          if (seen.has(signature)) return false;
          seen.add(signature);
          return true;
        }) ?? ordered[rank];
        maps[rank].set(g, picked.f);
      }
    }
    for (let rank = 0; rank < ranks; rank++) {
      const by = maps[rank], conditionFormula = { kind, rank, by, fallback: candidates[0], complexity: 1 + groups.length * 3 };
      conditionFormula.predict = (r) => pred2(by.get(conditionOf(r, kind)) ?? conditionFormula.fallback, r);
      conditional.push(conditionFormula);
    }
  }
  const allPool = [...pool, ...conditional];
  const initial = greedy(allPool);
  const simple = greedy(pool.filter((f) => f.complexity <= 2));
  const alternatives = [];
  for (let offset = 0; offset < 80; offset += 10) {
    const g = greedy(allPool.slice(offset, offset + 120));
    alternatives.push(g);
  }
  const leaders = [initial, ...alternatives];
  const best = leaders.slice().sort((a, b) => compare(a.stats, b.stats))[0];
  const bySix = { ...leaders.slice().sort((a, b) => b.stats.hist[6] - a.stats.hist[6] || compare(a.stats, b.stats))[0] };
  const byFive = { ...leaders.slice().sort((a, b) => b.stats.hist[5] + b.stats.hist[6] - (a.stats.hist[5] + a.stats.hist[6]) || compare(a.stats, b.stats))[0] };
  const byMean = { ...leaders.slice().sort((a, b) => b.stats.mean - a.stats.mean || compare(a.stats, b.stats))[0] };
  const baseline = { score: 0, hist: Array(7).fill(0), mean: 0 };
  const denom = 8145060;
  for (let k = 0; k <= 6; k++) {
    let comb = (n, r) => {
      let q = 1;
      for (let i = 1; i <= r; i++) q = q * (n - r + i) / i;
      return q;
    };
    const p = comb(6, k) * comb(39, 6 - k) / comb(45, 6);
    baseline.hist[k] = p * rows.length;
    baseline.score += p * rows.length * SCORE[k];
    baseline.mean += p * k;
  }
  const result2 = { best: { ...best, complexity: best.chosen.reduce((s, f) => s + (f.complexity || 1), 0), condition: best.chosen.some((f) => f.kind) ? "included (see lane rules)" : "none" }, bySix: { ...bySix, complexity: bySix.chosen.reduce((s, f) => s + (f.complexity || 1), 0) }, byFive: { ...byFive, complexity: byFive.chosen.reduce((s, f) => s + (f.complexity || 1), 0) }, byMean: { ...byMean, complexity: byMean.chosen.reduce((s, f) => s + (f.complexity || 1), 0) }, simple: { ...simple, complexity: simple.chosen.reduce((s, f) => s + (f.complexity || 1), 0) }, baseline, legacyA, branch_diagnostics, sensitivity: [], stability: [], time_source_performance: { exact: { rounds: 0, stats: null }, official_schedule: { rounds: rows.length, stats: null } } };
  result2.time_source_performance.official_schedule.stats = ticket(result2.best.chosen, rows);
  for (const [a, b] of [[1, 400], [401, 800], [801, 1231], [1e3, 1242]]) result2.stability.push({ range: `${a}-${b}`, stats: ticket(result2.best.chosen, rows.filter((r) => r.round >= a && r.round <= b)) });
  for (const shift of [-60, -30, 30, 60]) {
    const shifted = draws.map((d) => ({ round: d.round, winning: d.winning, ...featuresFor(d.round, shift) })).map((x) => ({ round: x.round, event: x.event, win: new Set(x.winning), valuesRaw: x.features.map((f) => f.raw), _spread: x.features.map((f) => f.spread) }));
    result2.sensitivity.push({ shift, stats: ticket(result2.best.chosen, shifted) });
  }
  let seed = 2654435769;
  const random = () => (seed = seed * 1664525 + 1013904223 >>> 0) / 4294967296;
  const randomScores = [];
  for (let sim = 0; sim < 500; sim++) {
    const hist = Array(7).fill(0);
    let score = 0, hits = 0;
    for (const row of rows) {
      const nums = /* @__PURE__ */ new Set();
      while (nums.size < 6) nums.add(Math.floor(random() * 45) + 1);
      const k = [...nums].filter((n) => row.win.has(n)).length;
      hist[k]++;
      hits += k;
      score += SCORE[k];
    }
    randomScores.push({ score, hits, mean: hits / rows.length, hist });
  }
  randomScores.sort((a, b) => a.score - b.score);
  const nullSimulation = { method: "500 deterministic Monte Carlo random six-number tickets; this is a lower bound and does not reproduce the adaptive search winner's curse", runs: randomScores.length, min: randomScores[0].score, median: randomScores[Math.floor(randomScores.length / 2)].score, max: randomScores.at(-1).score, mean: randomScores.reduce((s, x) => s + x.score, 0) / randomScores.length, exceed_best: randomScores.filter((x) => x.score >= result2.best.stats.score).length };
  await writeFile(join(OUT, "feature_manifest.json"), JSON.stringify(meta8.map((f, i) => ({ ...f, index: i, shared_source: f.system === "vedic_sukyo_shared" })), null, 2));
  const featureMatrix = calculated.map((x) => ({ round: x.round, date: `${x.event.y}-${String(x.event.m).padStart(2, "0")}-${String(x.event.d).padStart(2, "0")}`, time: `${String(x.event.hour).padStart(2, "0")}:${String(x.event.minute).padStart(2, "0")}`, time_source: x.event.time_source, place: x.event.draw_place, place_source: x.event.place_source, winning: x.winning, raw: x.features.map((f) => f.raw), spread: x.features.map((f) => f.spread) }));
  const drawTimes = calculated.map((x) => ({ round: x.round, draw_date: `${x.event.y}-${String(x.event.m).padStart(2, "0")}-${String(x.event.d).padStart(2, "0")}`, draw_time_local: `${String(x.event.hour).padStart(2, "0")}:${String(x.event.minute).padStart(2, "0")}`, draw_time_utc: `${String((x.event.hour - 9 + 24) % 24).padStart(2, "0")}:${String(x.event.minute).padStart(2, "0")}`, time_source: x.event.time_source, source_url: x.event.source_url, source_note: x.event.source_note, draw_place: x.event.draw_place, place_source: x.event.place_source }));
  await writeFile(join(OUT, "feature_matrix.json"), JSON.stringify(featureMatrix));
  await writeFile(join(OUT, "feature_matrix_time_refined.json"), JSON.stringify(featureMatrix));
  await writeFile(join(OUT, "draw_times.json"), JSON.stringify(drawTimes, null, 2));
  const top20 = ranked.slice(0, 20).map((x, i) => ({ rank: i + 1, formula: formulaName(x.f, meta8), complexity: x.f.complexity, individual_hits: x.hits, layer: x.f.layer, feature_lineage: [x.f.a, x.f.b, x.f.c].filter((v) => v != null).map((v) => meta8[v].lineage) }));
  await writeFile(join(OUT, "top20.json"), JSON.stringify(top20, null, 2));
  const serialFormula = (f) => f.kind ? { ...f, by: [...f.by.entries()].map(([group, formula]) => ({ group, formula })) } : f;
  const serialResult = Object.fromEntries(Object.entries(result2).map(([key, value]) => value?.chosen ? [key, { ...value, chosen: value.chosen.map(serialFormula) }] : [key, value]));
  const displayFormula = (f) => f.kind ? { condition: f.kind, branches: [...f.by.entries()].map(([group, formula]) => ({ group, formula: formulaName(formula, meta8) })) } : { formula: formulaName(f, meta8) };
  const ruleTypes = [["A_score_max", result2.best], ["B_six_hits_max", result2.bySix], ["C_five_plus_max", result2.byFive], ["D_mean_hits_max", result2.byMean], ["E_simple", result2.simple]];
  const ruleDetails = Object.fromEntries(ruleTypes.map(([name, x]) => [name, { complexity: x.complexity, condition: x.condition ?? "none", stats: x.stats, lanes: x.chosen.map(displayFormula) }]));
  const ticketOutput = Object.fromEntries(ruleTypes.map(([name, x]) => [name, rows.map((r) => {
    const numbers = numbersFor(x.chosen, r);
    return { round: r.round, numbers, hits: numbers.filter((n) => r.win.has(n)).length };
  })]));
  await writeFile(join(OUT, "results.json"), JSON.stringify({ scope: { rounds: `1-${END_ROUND}`, time_source: "official_schedule", place: "\uC11C\uC6B8", csv_source: CSV_URL }, baseline, result: serialResult, top20 }, null, 2));
  await writeFile(join(OUT, "rule_details.json"), JSON.stringify(ruleDetails, null, 2));
  await writeFile(join(OUT, "tickets.json"), JSON.stringify(ticketOutput));
  const bestRule = { version: "time-refined-historical-max-v1", scope: { rounds: `1-${END_ROUND}`, time_source_counts: { exact: 0, official_schedule: rows.length }, place: "\uC11C\uC6B8" }, formula_terminal: "((floor(x)-1) % 45 + 45) % 45 + 1", duplicate_rule: "evaluate lanes in listed order; if a number duplicates, increment cyclically until unused; then fill remaining slots in ascending 1..45 order", score: result2.best.stats, complexity: result2.best.complexity, branch_diagnostics, lanes: result2.best.chosen.map(displayFormula), stability: result2.stability, time_source_performance: result2.time_source_performance, legacy_A_recomputed: legacyA };
  await writeFile(join(OUT, "best_rule.json"), JSON.stringify(bestRule, null, 2));
  await writeFile(join(OUT, "sensitivity.json"), JSON.stringify(result2.sensitivity, null, 2));
  await writeFile(join(OUT, "null_simulation.json"), JSON.stringify(nullSimulation, null, 2));
  const statRow = ([name, x]) => `| ${name} | ${x.stats.score} | ${x.stats.hist.join(" / ")} | ${x.stats.mean.toFixed(4)} | ${(x.stats.ge3 * 100).toFixed(2)}% | ${(x.stats.ge4 * 100).toFixed(2)}% | ${x.complexity} | ${(x.stats.score - baseline.score).toFixed(1)} |`;
  const lanes = ([name, x]) => `## ${name}

${x.chosen.map((f, i) => `${i + 1}. ${f.kind ? `${f.kind}: ${[...f.by.entries()].map(([g, z]) => `${g}\u2192${formulaName(z, meta8)}`).join("; ")}` : formulaName(f, meta8)}`).join("\n\n")}`;
  await writeFile(join(OUT, "report.md"), `# Lotto 6/45 fortune-engine historical search

Scope: rounds 1-${END_ROUND}; Seoul; all draw times assumed. This is in-sample historical fitting only, not a predictive model. Formula terminal is \`((floor(x)-1) mod 45)+1\`; raw and \`lotto.js\` spread layers are both retained.

| type | score | 0/1/2/3/4/5/6 | mean | \u22653 | \u22654 | complexity | vs random |
|---|---:|---|---:|---:|---:|---:|---:|
${ruleTypes.map(statRow).join("\n")}

Exact branch-expanded rules are in \`rule_details.json\`; per-round six unique generated numbers are in \`tickets.json\`.

${ruleTypes.map(lanes).join("\n\n")}

## Best fixed-rule stability

${result2.stability.map((x) => `- ${x.range}: score ${x.stats.score}; mean ${x.stats.mean.toFixed(4)}; distribution ${x.stats.hist.join("/")}`).join("\n")}

## Time sensitivity

${result2.sensitivity.map((x) => `- ${x.shift >= 0 ? "+" : ""}${x.shift} min: score ${x.stats.score}; mean ${x.stats.mean.toFixed(4)}; distribution ${x.stats.hist.join("/")}`).join("\n")}

## Interpretation

This is intentionally in-sample and heavily overfit: thousands of correlated signals/formulas and conditional branches are selected using the same draws being scored. It is not evidence of future predictive power. The separate fixed round-1243 validation hypotheses were not used or modified.

## TOP 20 individual lanes

${top20.map((x) => `${x.rank}. ${x.formula} \u2014 hits ${x.individual_hits}, complexity ${x.complexity}`).join("\n")}
`);
  await writeFile(join(OUT, "report_time_refined.md"), `# Time-refined historical maximum search

- Incumbent prior score: 5,882
- Current score: ${result2.best.stats.score}
- Recomputed incumbent under fixed official schedule: ${legacyA.unavailable ? "unavailable" : legacyA.score}
- Exact mechanical draw-time rows: 0
- Official-schedule rows: ${rows.length}
- Search: ${ranked.length} arithmetic formulas, ${conditional.length} conditional lanes; branch diagnostics are in \`best_rule.json\`.
- Null Monte Carlo random-ticket max: ${nullSimulation.max}; adaptive-search null was not simulated.

This maximizes historical in-sample score only. High-cardinality branches marked \`memorization_prone\` are lookup-like and must not be treated as forecast evidence.

## Winner

${result2.best.chosen.map((f, i) => `${i + 1}. ${f.kind ? `${f.kind} (rank ${f.rank}): ${[...f.by.entries()].map(([g, z]) => `${g}\u2192${formulaName(z, meta8)}`).join("; ")}` : formulaName(f, meta8)}`).join("\n\n")}
`);
  console.log(JSON.stringify({ features: meta8.length, formulas_tested: ranked.length, best_score: result2.best.stats.score, best_mean: result2.best.stats.mean, top20: top20.slice(0, 3) }, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
