# Time-refined historical-maximum search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find and persist one higher-scoring in-sample Lotto 6/45 formula without modifying the fortune engine.

**Architecture:** The analysis runner owns fixed draw-time metadata, feature generation, formula search, and output serialization. It imports the existing staging engine read-only; all write targets remain under `analysis/fortune-lotto/output`.

**Tech Stack:** Node.js ESM, existing fortune-engine modules, public draw-result sources.

**Spec:** User request in this conversation and attached handoff text.

## Global Constraints

- Never modify `public/unse/src`.
- Use only fixed external draw-time schedules, never results, to set event time.
- Preserve raw, `lotto.js` spread, source lineage, and 1–45 cyclic terminal conversion.
- Keep future-validation rules from round 1243 untouched.

## Review Focus

- A draw number must have six distinct values in 1–45 for every persisted round.
- The supplied 1232–1242 records must retain their public-source date and number values.
- `exact` time must not be claimed where only a schedule is known.
- A high-cardinality conditional rule must record branch size and be labelled memorization-prone.
- The reported winner must be score-first under the stated tie order.

### Task 1: Fixed event metadata and latest draw extension

**Files:**
- Modify: `analysis/fortune-lotto/run-backtest.mjs`
- Modify: `analysis/fortune-lotto/run-backtest.test.mjs`

- [ ] Add a failing test for 1–1242 fixed draw metadata and no false `exact` labels.
- [ ] Run `node --test analysis/fortune-lotto/run-backtest.test.mjs` and observe the missing source behavior.
- [ ] Implement the fixed schedule/source records and latest public draw extension.
- [ ] Re-run the tests.

### Task 2: Expanded score-first formula search

**Files:**
- Modify: `analysis/fortune-lotto/run-backtest.mjs`
- Modify: `analysis/fortune-lotto/run-backtest.test.mjs`

- [ ] Add a failing test that requires multiplication, mixed layers, and high-cardinality branch diagnostics in the analysis source.
- [ ] Run the test and observe failure.
- [ ] Implement bounded broad candidate generation and conditional search with branch diagnostics.
- [ ] Re-run tests and execute the full runner.

### Task 3: Persist and verify the historical winner

**Files:**
- Create: `analysis/fortune-lotto/output/report_time_refined.md`
- Create: `analysis/fortune-lotto/output/best_rule.json`
- Create: `analysis/fortune-lotto/output/draw_times.json`
- Create: `analysis/fortune-lotto/output/feature_matrix_time_refined.json`
- Create: `analysis/fortune-lotto/output/sensitivity.json`
- Create: `analysis/fortune-lotto/output/null_simulation.json`

- [ ] Run the full runner to exhaustion of its declared candidate/conditional budgets.
- [ ] Check 1,242 rows, every ticket’s six unique bounded numbers, and score ordering.
- [ ] Record the incumbent comparison, time-source split, interval scores, and null simulation.
