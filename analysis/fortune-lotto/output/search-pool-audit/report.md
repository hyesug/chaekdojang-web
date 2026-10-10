# D search-pool audit (연구용)

생성: 2026-09-25. 기존 A~I, production predictor, 1243회 예측, method-comparison/**, search-space-audit/** 는 읽기만 했다.

## 요약 표

| 방식 | 설정 | universe | pool | pool/universe | in-sample | exact WF | WF hist 0~6 | WF mean | WF 3+ | WF 4+ | WF 5-hit | WF 6-hit |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| D1 | first22 + top900 (기존 D) | 17,633 | 900 | 5.10% | 7969 | 920 | 262/273/89/13/5/0/0 | 0.7944 | 18 | 5 | 0 | 0 |
| D2 | triple_all + global top2500 | 48,961 | 2500 | 5.11% | 8511 | 686 | 254/281/95/12/0/0/0 | 0.7897 | 12 | 0 | 0 | 0 |
| D3 | triple_all + system round-robin diverse2500 | 48,961 | 2500 | 5.11% | 8511 | 686 | 254/281/95/12/0/0/0 | 0.7897 | 12 | 0 | 0 | 0 |

D1 재현: exact WF 920 (기존 920) · split 티켓 일치 true · in-sample 7969 (기존 7969).

## split별 exact WF

| split | D1 | D2 | D3 |
|---|---:|---:|---:|
| 1-600 → 601-700 | 207 (41/39/16/2/2/0/0) | 140 (35/45/15/5/0/0/0) | 140 (35/45/15/5/0/0/0) |
| 1-700 → 701-800 | 189 (44/40/13/1/2/0/0) | 106 (44/38/16/2/0/0/0) | 106 (44/38/16/2/0/0/0) |
| 1-800 → 801-900 | 88 (47/39/13/1/0/0/0) | 94 (42/40/18/0/0/0/0) | 94 (42/40/18/0/0/0/0) |
| 1-900 → 901-1000 | 114 (40/40/18/2/0/0/0) | 103 (36/48/15/1/0/0/0) | 103 (36/48/15/1/0/0/0) |
| 1-1000 → 1001-1100 | 155 (38/46/13/2/1/0/0) | 71 (45/47/8/0/0/0/0) | 71 (45/47/8/0/0/0/0) |
| 1-1100 → 1101-1200 | 116 (34/48/16/2/0/0/0) | 115 (41/38/19/2/0/0/0) | 115 (41/38/19/2/0/0/0) |
| 1-1200 → 1201-1242 | 51 (18/21/0/3/0/0/0) | 57 (11/25/4/2/0/0/0) | 57 (11/25/4/2/0/0/0) |

## in-sample 최종 6식

### D1

- `wrap45(juyeok.c2_moving_line-yukim.c3_first_transmission+yukim.c4_middle_transmission)`
- `wrap45(astrology.c1_sun_longitude+juyeok.c1_hexagram-hongguk.c1_heaven_earth)`
- `wrap45(|gujeong.c2_honmei-tarot.c1_birth_card|)`
- `wrap45(astrology.c3_sun_sign-vedic.c2_nakshatra_pada-yukim.c3_first_transmission)`
- `wrap45(saju.c2_month_sexagenary+vedic.c2_nakshatra_pada+taeeul.c1_cycle)`
- `wrap45(2*hongguk.c1_heaven_earth-gujeong.c2_honmei)`

system 9개: juyeok, yukim, astrology, hongguk, gujeong, tarot, vedic, saju, taeeul · lineage 9개: juyeok.trigrams, yukim.three_transmissions, astro.sun, hongguk.plate, gujeong.stars, tarot.cards, astro.sidereal_moon, ganzhi.pillars, taeeul.cycle · cyclic increment 387회 (5.19%)

### D2

- `wrap45(yukim.c2_day_stem_gigung+kabbalah.c1_life_birthday-2*kabbalah.c2_personal_year)`
- `wrap45(saju.c4_hour_sexagenary+yukim.c3_first_transmission-2*sukyo.c2_nakshatra_pada)`
- `wrap45(|yukim.c1_month_general_point_hour-yukim.c5_last_transmission|+thai.c1_weekday_buddhist)`
- `wrap45(vedic.c1_nakshatra-yukim.c5_last_transmission-kabbalah.c1_life_birthday)`
- `wrap45(|hongguk.c1_heaven_earth-kabbalah.c2_personal_year|)`
- `wrap45(jamidusu.c1_myeong-vedic.c2_nakshatra_pada+kabbalah.c1_life_birthday)`

system 8개: yukim, kabbalah, saju, sukyo, thai, vedic, hongguk, jamidusu · lineage 9개: yukim.day_stem_gigung, civil_date, ganzhi.pillars, yukim.three_transmissions, astro.sidereal_moon, yukim.month_general+hour_branch, thai.calendar, hongguk.plate, jamidusu.palaces · cyclic increment 408회 (5.48%)

### D3

- `wrap45(yukim.c2_day_stem_gigung+kabbalah.c1_life_birthday-2*kabbalah.c2_personal_year)`
- `wrap45(saju.c4_hour_sexagenary+yukim.c3_first_transmission-2*sukyo.c2_nakshatra_pada)`
- `wrap45(|yukim.c1_month_general_point_hour-yukim.c5_last_transmission|+thai.c1_weekday_buddhist)`
- `wrap45(vedic.c1_nakshatra-yukim.c5_last_transmission-kabbalah.c1_life_birthday)`
- `wrap45(|hongguk.c1_heaven_earth-kabbalah.c2_personal_year|)`
- `wrap45(jamidusu.c1_myeong-vedic.c2_nakshatra_pada+kabbalah.c1_life_birthday)`

system 8개: yukim, kabbalah, saju, sukyo, thai, vedic, hongguk, jamidusu · lineage 9개: yukim.day_stem_gigung, civil_date, ganzhi.pillars, yukim.three_transmissions, astro.sidereal_moon, yukim.month_general+hour_branch, thai.calendar, hongguk.plate, jamidusu.palaces · cyclic increment 408회 (5.48%)

## 새로 triple이 허용된 7개 system (in-sample pool / 최종 6식)

| system | D1 pool (triple) | D2 pool (triple) | D3 pool (triple) | D1 최종 | D2 최종 | D3 최종 |
|---|---:|---:|---:|---|---|---|
| gujeong | 34 (0) | 403 (367) | 402 (366) | final 2 | pool_only_dropped 0 | pool_only_dropped 0 |
| sukyo | 30 (0) | 419 (388) | 420 (389) | pool_only_dropped 0 | final 1 | final 1 |
| tojeong | 30 (0) | 387 (355) | 384 (352) | pool_only_dropped 0 | pool_only_dropped 0 | pool_only_dropped 0 |
| kabbalah | 29 (0) | 437 (407) | 434 (404) | pool_only_dropped 0 | final 4 | final 4 |
| mahabote | 19 (0) | 212 (193) | 217 (198) | pool_only_dropped 0 | pool_only_dropped 0 | pool_only_dropped 0 |
| thai | 12 (0) | 193 (180) | 195 (182) | pool_only_dropped 0 | final 1 | final 1 |
| tarot | 15 (0) | 227 (211) | 231 (215) | final 1 | pool_only_dropped 0 | pool_only_dropped 0 |

WF split 최종식 진입 횟수(7 split 중): D1 gujeong=5, sukyo=0, tojeong=3, kabbalah=0, mahabote=1, thai=1, tarot=2 · D2 gujeong=5, sukyo=2, tojeong=5, kabbalah=6, mahabote=3, thai=7, tarot=2 · D3 gujeong=5, sukyo=3, tojeong=5, kabbalah=6, mahabote=3, thai=7, tarot=2

## first22에서 triple이 막혔던 11개 candidate의 in-sample pool 포함 수 (전체 / triple)

| candidate | D1 | D2 | D3 |
|---|---:|---:|---:|
| gujeong.c1_honmei_getsumei | 21 / 0 | 202 / 180 | 203 / 181 |
| gujeong.c2_honmei | 15 / 0 | 212 / 196 | 209 / 193 |
| sukyo.c1_nakshatra | 11 / 0 | 204 / 193 | 204 / 193 |
| sukyo.c2_nakshatra_pada | 19 / 0 | 230 / 210 | 231 / 211 |
| tojeong.c1_hexagram | 10 / 0 | 181 / 169 | 178 / 166 |
| tojeong.c2_upper_middle | 20 / 0 | 214 / 194 | 213 / 193 |
| kabbalah.c1_life_birthday | 22 / 0 | 225 / 202 | 224 / 201 |
| kabbalah.c2_personal_year | 7 / 0 | 229 / 221 | 227 / 219 |
| mahabote.c1_eight_place | 19 / 0 | 212 / 193 | 217 / 198 |
| thai.c1_weekday_buddhist | 12 / 0 | 193 / 180 | 195 / 182 |
| tarot.c1_birth_card | 15 / 0 | 227 / 211 | 231 / 215 |

## 중복 value vector (설계 점검)

- D1: universe 17633 중 서로 다른 값벡터 15097개, pool 900 중 796개
- D2: universe 48961 중 서로 다른 값벡터 39152개, pool 2500 중 2037개
- D3: universe 48961 중 서로 다른 값벡터 39152개, pool 2500 중 2035개

- D1 pool 900 중 cutoff 점수(185회)에 동점인 formula 128개 중 23개만 포함, D2는 442개 중 135개. 동점은 complexity → universe 순서(=manifest 순서)로 잘린다.
- 입력 행렬에서 `vedic.c1 ≡ sukyo.c1`, `vedic.c2 ≡ sukyo.c2`, `jamidusu.c2_sin ≡ jamidusu.c3_jaebaek` 열이 1~1242 전 회차 동일하다. sukyo가 pool에 "들어간" 것은 vedic 식의 복제일 수 있다.

## D2 vs D3 pool 겹침

- in-sample pool 겹침 2487/2500. split별: 2472(최종 6식 동일), 2494(최종 6식 동일), 2482(최종 6식 동일), 2460(최종 6식 동일), 2476(최종 6식 다름), 2482(최종 6식 동일), 2491(최종 6식 동일)

## 무작위 1장 기준 (참고용 척도)

- WF 642회: 기대 점수 758, 표준편차 ≈ 79 (독립 회차 근사, 4·5·6-hit 때문에 꼬리가 두꺼움), 기대 4+ 0.89회. 유의성 검정이 아니라 눈금이다.

## 해석

1. **search pool을 같은 비율(5.11%)로 맞춰도 all33은 first22를 이기지 못했다.** in-sample은 D2 8511 > D1 7969 (+542)이지만 exact WF는 D2 686 < D1 920 (-234). 앞선 search-space-audit의 triple_all+top900(WF 826)보다도 낮다 — pool을 키울수록 in-sample은 오르고 WF는 내려가는 과적합 방향이다. "D1이 pool 크기 때문에 불공정하게 이겼다"는 가설은 지지되지 않는다.
2. **diversity-aware pool(D3)은 개선이 아니다.** D3 in-sample/WF가 D2와 완전히 같다(8511 / 686). global top2500이 이미 15개 system을 폭넓게 담고 있어서 round-robin pool과 2487/2500이 겹치고, greedy가 고르는 상위 식은 양쪽 pool에 모두 있다. first22 제약이 막은 것은 triple universe였지 pool 순위가 아니었다.
3. **새로 triple이 허용된 7개 system은 pool에는 들어갔다.** D2 in-sample pool에서 각 193~437개. 최종 6식 진입: sukyo(1식)·kabbalah(4식)·thai(1식); pool에만 있고 탈락: gujeong·tojeong·mahabote·tarot. sukyo 식은 vedic과 값이 같은 열을 쓰므로 실질적으로 vedic 식이다.
4. D1의 WF 920도 무작위 눈금(758 ± 79)과 비교해 읽어야 하며, 여러 방식을 시도한 뒤 고른 값이므로 선택 편향이 있다. 이번 실험은 production D 변경 근거가 아니다.

## 설계 문제 (이번에 발견)

- **중복 candidate 열**: sukyo.c1/c2 ≡ vedic.c1/c2, jamidusu.c3 ≡ jamidusu.c2. all33 universe 48961 중 서로 다른 값벡터는 39152개, D2 pool 2500 중 2037개뿐 — pool 슬롯의 약 18.52%가 복제다. "pool/universe 5.10%"라는 비율도 중복을 세므로 실효 비율과 다르다.
- **cutoff 동점**: pool 경계에 동점이 수백 개 몰려 있고 manifest 순서로 잘린다. manifest 순서 편향은 triple 제한이 사라져도 이 경로로 남는다.
- **greedy가 같은 formula를 여러 lane에 허용**: D1 첫 split이 같은 식을 3번 골랐다(중복 번호는 cyclic +1로 밀림). 이번 작업은 D 알고리즘을 바꾸지 않았으므로 그대로 두었다.

