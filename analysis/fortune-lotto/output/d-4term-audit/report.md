# D 4항 감사 (연구용)

first22 · top900 · 중립 SHA256 tie-break · greedy 6 lanes + local swap 2 pass · train-only exact WF 7 splits. 한 가지 변경: 4항 universe 추가.

| 방식 | universe | in-sample | exact WF | WF mean | 3+ | 4+ | 5+ | 6-hit | split별 WF | 최종 6식 중 4항 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| D3term | 17633 | 7969 | 835 | 0.7897 | 17 | 3 | 0 | 0 | 207 / 86 / 106 / 114 / 155 / 116 / 51 | 0 (WF split 합 0/42) |
| D4term | 61523 | 8109 | 829 | 0.8551 | 18 | 1 | 0 | 0 | 131 / 121 / 174 / 111 / 133 / 87 / 72 | 4 (WF split 합 32/42) |

## D3term in-sample 최종 6식

- `abPlusC(juyeok.c2_moving_line,yukim.c3_first_transmission,yukim.c4_middle_transmission)`
- `abcSub(astrology.c1_sun_longitude,juyeok.c1_hexagram,hongguk.c1_heaven_earth)`
- `abs(gujeong.c2_honmei,tarot.c1_birth_card)`
- `abMinusC(astrology.c3_sun_sign,vedic.c2_nakshatra_pada,yukim.c3_first_transmission)`
- `abcSum(saju.c2_month_sexagenary,vedic.c2_nakshatra_pada,taeeul.c1_cycle)`
- `twoMinus(hongguk.c1_heaven_earth,gujeong.c2_honmei)`

## D4term in-sample 최종 6식

- `abTwoC(jamidusu.c1_myeong,vedic.c1_nakshatra,hongguk.c1_heaven_earth)`
- `wrap45(2*saju.c1_year_sexagenary+astrology.c2_moon_longitude+vedic.c2_nakshatra_pada-yukim.c4_middle_transmission)`
- `wrap45(2*astrology.c1_sun_longitude+astrology.c2_moon_longitude+juyeok.c2_moving_line-yukim.c4_middle_transmission)`
- `wrap45(|saju.c3_day_sexagenary-saju.c4_hour_sexagenary|+hongguk.c2_plate_mix-taeeul.c1_cycle)`
- `twoab(astrology.c2_moon_longitude,tojeong.c1_hexagram)`
- `wrap45(2*saju.c3_day_sexagenary+jamidusu.c2_sin+juyeok.c2_moving_line-yukim.c2_day_stem_gigung)`

