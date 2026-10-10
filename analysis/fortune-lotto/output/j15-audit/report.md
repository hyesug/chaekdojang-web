# J15 vs U33 (연구용)

all33 1/2/3항 · top2500 · 중립 SHA256 tie-break · greedy 6 lanes + local swap 2 pass · train-only exact WF 7 splits.

| 모델 | in-sample | exact WF | WF mean | 3+ | 4+ | 5+ | 6-hit | split별 WF | in-sample system 수 | unique lineage |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| U33 | 8511 | 753 | 0.8333 | 10 | 1 | 0 | 0 | 126 / 177 / 94 / 103 / 81 / 115 / 57 | 8 | 9 |
| J15 | 2216 | 713 | 0.8069 | 14 | 0 | 0 | 0 | 110 / 136 / 88 / 124 / 112 / 92 / 51 | 15 | 14 |

J15 WF split별 system 수: 15 / 15 / 15 / 15 / 15 / 15 / 15 · unique lineage: 15 / 14 / 15 / 14 / 14 / 16 / 14

J15 split 쏠림: split별 WF 점수 비중 vs 회차 비중 = 15.4%/15.6%, 19.1%/15.6%, 12.3%/15.6%, 17.4%/15.6%, 15.7%/15.6%, 12.9%/15.6%, 7.2%/6.5%. 최고 split 제외 WF 577. 무작위 기대(회당 1.180) 대비 초과분 합 -44.7 — 초과분이 없어 초과분 쏠림은 해당 없음.
## U33 in-sample 최종 6식

- `abTwoC(yukim.c2_day_stem_gigung,kabbalah.c1_life_birthday,kabbalah.c2_personal_year)`
- `abTwoC(saju.c4_hour_sexagenary,yukim.c3_first_transmission,sukyo.c2_nakshatra_pada)`
- `absPlusC(yukim.c1_month_general_point_hour,yukim.c5_last_transmission,thai.c1_weekday_buddhist)`
- `abMinusC(vedic.c1_nakshatra,yukim.c5_last_transmission,kabbalah.c1_life_birthday)`
- `abs(hongguk.c1_heaven_earth,kabbalah.c2_personal_year)`
- `abPlusC(jamidusu.c1_myeong,sukyo.c2_nakshatra_pada,kabbalah.c1_life_birthday)`

system 8: hongguk, jamidusu, kabbalah, saju, sukyo, thai, vedic, yukim · lineage 9

## J15 in-sample 최종 6식

- `rdiff(saju.c3_day_sexagenary,yukim.c5_last_transmission)`
- `abcSub(astrology.c1_sun_longitude,juyeok.c1_hexagram,hongguk.c1_heaven_earth)`
- `abs(gujeong.c2_honmei,tarot.c1_birth_card)`
- `abMinusC(vedic.c1_nakshatra,yukim.c5_last_transmission,kabbalah.c1_life_birthday)`
- `absPlusC(jamidusu.c2_sin,sukyo.c2_nakshatra_pada,tojeong.c2_upper_middle)`
- `abMinusC(taeeul.c1_cycle,mahabote.c1_eight_place,thai.c1_weekday_buddhist)`

system 15: astrology, gujeong, hongguk, jamidusu, juyeok, kabbalah, mahabote, saju, sukyo, taeeul, tarot, thai, tojeong, vedic, yukim · lineage 14

