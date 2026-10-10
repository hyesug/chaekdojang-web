# A–I / R extended comparison

Existing A–F artifacts were read, not modified. All results use the committed 1–1242 common matrix and evaluator.

| Method | In-sample score | Walk-forward score | Mean | 4+ | 5-hit | 6-hit | Complexity |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 39944.00 | 789.00 | 1.0378 | 2.58% | 5.00 | 12.00 | 84 |
| B | 2488.00 | 725.00 | 0.9380 | 0.48% | 2.00 | 0.00 | 17 |
| C | 2782.00 | 698.00 | 1.1425 | 0.89% | 0.00 | 0.00 | 3 |
| D | 7969.00 | 802.00 | 0.9074 | 0.48% | 1.00 | 2.00 | 17 |
| E | 32904.00 | 695.00 | 1.1031 | 2.82% | 11.00 | 9.00 | 97 |
| F | 1530.00 | 876.00 | 0.8052 | 0.24% | 0.00 | 0.00 | 35 |
| G | 4608.00 | 666.00 | 0.8841 | 0.16% | 0.00 | 1.00 | 6 |
| H | 4644.00 | 828.00 | 0.8961 | 0.24% | 0.00 | 1.00 | 18 |
| I | 39944.00 | 789.00 | 1.0378 | 2.58% | 5.00 | 12.00 | 3 |
| R | 1465.98 | 757.69 | 0.8000 | 0.14% | 0.04 | 0.00 | Monte Carlo |

- In-sample leader: **A** (39944.00).
- Walk-forward leader: **F** (876.00).
- I vs A: 39944 vs 39944; I does not exceed A in-sample.
- G vs fortune in-sample: 4608 vs A 39944; H vs fortune: 4644 vs A 39944.
- Search-adjusted null is deliberately reduced and reported only as a calibrated control: see `search-adjusted-null.json`.

## Leakage constraints

G per-row features use only draws 1..r-1. H uses numerical longitude/ASC/MC coordinates and Gregorian numbers, never signs or fortune interpretation. A and E walk-forward rules are retrained only on each train split. I ranks ticket union with preselected train/global weights, never current winners.
