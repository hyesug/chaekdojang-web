# D robustness audit (연구용)

기준 D0 = first22 + top900, 기존 D 알고리즘. 각 실험은 한 가지만 바꾼다. 기존 artifact·production·1243 예측은 읽기만 했다.

D0 재현: exact WF 920 (기존 920), split 티켓 일치 true.

| 실험 | 변경 | universe | in-sample | exact WF | Δ vs D0 | mean | 3+ | 4+ | 5-hit | 6-hit |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| D0 | none (기존 D) | 17633 | 7969 | 920 | 0 | 0.7944 | 18 | 5 | 0 | 0 |
| D_alias | 1~1242 전 회차 값열이 같은 candidate alias를 하나로 합침 | 15020 | 7969 | 903 | -17 | 0.8053 | 19 | 4 | 0 | 0 |
| D_tie | ranking 동점의 마지막 tie-break를 universe(manifest) 순서 대신 sha256(canonical formula) 순서로 | 17633 | 7969 | 835 | -85 | 0.7897 | 17 | 3 | 0 | 0 |
| D_unique | greedy/local swap에서 같은 formula를 두 lane에 넣지 않음 | 17633 | 7969 | 895 | -25 | 0.7975 | 20 | 4 | 0 | 0 |

## split별 exact WF

| split | D0 | D_alias | D_tie | D_unique |
|---|---:|---:|---:|---:|
| 1-600 → 601-700 | 207 (41/39/16/2/2/0/0) | 221 (41/39/14/4/2/0/0) | 207 (41/39/16/2/2/0/0) | 182 (40/40/14/5/1/0/0) |
| 1-700 → 701-800 | 189 (44/40/13/1/2/0/0) | 86 (46/38/16/0/0/0/0) | 86 (46/38/16/0/0/0/0) | 189 (44/40/13/1/2/0/0) |
| 1-800 → 801-900 | 88 (47/39/13/1/0/0/0) | 144 (40/45/13/1/1/0/0) | 106 (47/37/13/3/0/0/0) | 88 (47/39/13/1/0/0/0) |
| 1-900 → 901-1000 | 114 (40/40/18/2/0/0/0) | 114 (40/40/18/2/0/0/0) | 114 (40/40/18/2/0/0/0) | 114 (40/40/18/2/0/0/0) |
| 1-1000 → 1001-1100 | 155 (38/46/13/2/1/0/0) | 155 (38/46/13/2/1/0/0) | 155 (38/46/13/2/1/0/0) | 155 (38/46/13/2/1/0/0) |
| 1-1100 → 1101-1200 | 116 (34/48/16/2/0/0/0) | 132 (41/33/23/3/0/0/0) | 116 (34/48/16/2/0/0/0) | 116 (34/48/16/2/0/0/0) |
| 1-1200 → 1201-1242 | 51 (18/21/0/3/0/0/0) | 51 (18/21/0/3/0/0/0) | 51 (18/21/0/3/0/0/0) | 51 (18/21/0/3/0/0/0) |

## in-sample 최종 6식

### D0

- `wrap45(juyeok.c2_moving_line-yukim.c3_first_transmission+yukim.c4_middle_transmission)`
- `wrap45(astrology.c1_sun_longitude+juyeok.c1_hexagram-hongguk.c1_heaven_earth)`
- `wrap45(|gujeong.c2_honmei-tarot.c1_birth_card|)`
- `wrap45(astrology.c3_sun_sign-vedic.c2_nakshatra_pada-yukim.c3_first_transmission)`
- `wrap45(saju.c2_month_sexagenary+vedic.c2_nakshatra_pada+taeeul.c1_cycle)`
- `wrap45(2*hongguk.c1_heaven_earth-gujeong.c2_honmei)`

### D_alias

- `wrap45(juyeok.c2_moving_line-yukim.c3_first_transmission+yukim.c4_middle_transmission)`
- `wrap45(astrology.c1_sun_longitude+juyeok.c1_hexagram-hongguk.c1_heaven_earth)`
- `wrap45(|gujeong.c2_honmei-tarot.c1_birth_card|)`
- `wrap45(astrology.c3_sun_sign-vedic.c2_nakshatra_pada-yukim.c3_first_transmission)`
- `wrap45(saju.c2_month_sexagenary+vedic.c2_nakshatra_pada+taeeul.c1_cycle)`
- `wrap45(2*hongguk.c1_heaven_earth-gujeong.c2_honmei)`

### D_tie

- `wrap45(juyeok.c2_moving_line-yukim.c3_first_transmission+yukim.c4_middle_transmission)`
- `wrap45(astrology.c1_sun_longitude+juyeok.c1_hexagram-hongguk.c1_heaven_earth)`
- `wrap45(|gujeong.c2_honmei-tarot.c1_birth_card|)`
- `wrap45(astrology.c3_sun_sign-vedic.c2_nakshatra_pada-yukim.c3_first_transmission)`
- `wrap45(saju.c2_month_sexagenary+vedic.c2_nakshatra_pada+taeeul.c1_cycle)`
- `wrap45(2*hongguk.c1_heaven_earth-gujeong.c2_honmei)`

### D_unique

- `wrap45(juyeok.c2_moving_line-yukim.c3_first_transmission+yukim.c4_middle_transmission)`
- `wrap45(astrology.c1_sun_longitude+juyeok.c1_hexagram-hongguk.c1_heaven_earth)`
- `wrap45(|gujeong.c2_honmei-tarot.c1_birth_card|)`
- `wrap45(astrology.c3_sun_sign-vedic.c2_nakshatra_pada-yukim.c3_first_transmission)`
- `wrap45(saju.c2_month_sexagenary+vedic.c2_nakshatra_pada+taeeul.c1_cycle)`
- `wrap45(2*hongguk.c1_heaven_earth-gujeong.c2_honmei)`

## alias로 합쳐진 candidate

- jamidusu.c2_sin ← jamidusu.c3_jaebaek
- vedic.c1_nakshatra ← sukyo.c1_nakshatra
- vedic.c2_nakshatra_pada ← sukyo.c2_nakshatra_pada

D_alias: candidate 30개, triple 참여 21개 (기존 first22에서 alias 제거), universe 15020.

## cutoff 동점 (D0 top900 경계)

| 구간 | cutoff hit | 같은 hit | 같은 hit+complexity | 그중 top900 포함 | D_tie에서 바뀐 top900 |
|---|---:|---:|---:|---:|---:|
| in-sample | 185 | 128 | 113 | 12 | 11 |
| 1-600 → 601-700 | 94 | 197 | 151 | 137 | 14 |
| 1-700 → 701-800 | 108 | 187 | 150 | 35 | 29 |
| 1-800 → 801-900 | 122 | 223 | 32 | 12 | 6 |
| 1-900 → 901-1000 | 137 | 157 | 136 | 98 | 29 |
| 1-1000 → 1001-1100 | 151 | 178 | 143 | 41 | 30 |
| 1-1100 → 1101-1200 | 165 | 187 | 164 | 14 | 9 |
| 1-1200 → 1201-1242 | 179 | 151 | 21 | 6 | 3 |

## D0 최종 6식의 formula 중복

- in-sample 중복 0개, WF 1/7 split에서 발생: 1-600 → 601-700=2, 1-700 → 701-800=0, 1-800 → 801-900=0, 1-900 → 901-1000=0, 1-1000 → 1001-1100=0, 1-1100 → 1101-1200=0, 1-1200 → 1201-1242=0

## 해석

- 가장 민감한 변경: **D_tie** (WF 835, D0 대비 -85).
- split별로 보면 D0와 점수가 다른 split: D_alias 601-700, 701-800, 801-900, 1101-1200 · D_tie 701-800, 801-900 · D_unique 601-700. in-sample 최종 6식은 네 실험 모두 같으므로 차이는 전부 WF split의 train-only 선택에서 나온다.
- 세 변경 모두 D0보다 WF가 낮고, 어떤 변경도 920을 넘지 못했다. 네 결과 중 920이 최고값이며, 기존 구현 세부(동점을 manifest 순서로 자르기, alias 열 유지, lane 중복 허용)가 모두 유리한 쪽으로 걸린 값이다.
- 세 변경은 모두 "예측 방법"이 아니라 구현 세부(열 중복·동점 처리·lane 중복)다. 이 중 어느 하나로 WF가 크게 움직이면 920은 D의 신호라기보다 그 세부가 우연히 맞은 값으로 읽어야 한다.

