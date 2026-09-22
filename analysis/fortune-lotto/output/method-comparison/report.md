# Fortune-lotto A–F method comparison

All methods use the same cached time-refined Seoul dataset: rounds 1–1242, all marked `official_schedule` rather than exact draw times. This is a whole-history in-sample fit study, not evidence of future prediction.

| Method | Score | Mean hits | 3+ | 4+ | 5-hit | 6-hit | Complexity |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 39944 | 1.0378 | 6.52% | 2.58% | 5 | 12 | 84 |
| B | 2488 | 0.9380 | 4.11% | 0.48% | 2 | 0 | 17 |
| C | 2782 | 1.1425 | 7.41% | 0.89% | 0 | 0 | 3 |
| D | 7969 | 0.9074 | 2.58% | 0.48% | 1 | 2 | 17 |
| E | 32904 | 1.1031 | 7.49% | 2.82% | 11 | 9 | 97 |
| F | 1530 | 0.8052 | 2.50% | 0.24% | 0 | 0 | 35 |

**Historical constrained winner: Method A (39944).** Its exact reproducible rule is in `method_A.json`.

## Guardrails

- A uses at most 12 leaves, depth 1, and every branch has at least 30 rounds.
- No A–F method uses `event_signature`, string-concatenated time keys, or round-specific winner routing.
- The prior lookup-like score 3726000 is preserved only as a non-comparable theoretical upper bound.
- Vedic and Sukyo Nakshatra/Pada share the `astro.sidereal_moon` lineage in support analysis.
- Fixed post-1242 future-validation hypotheses were neither used nor changed.

## Time and stability

There are no exact-time rows in the shared data, so exact-only performance is `null` rather than fabricated. Per-method time-quality and four-period results are in `time_quality_analysis.json` and `period_stability.json`.

## Overfitting warning

All model selection is in-sample. The random baseline and shuffled-target formula-search null results quantify only parts of winner’s-curse risk; they do not establish forecasting value.
