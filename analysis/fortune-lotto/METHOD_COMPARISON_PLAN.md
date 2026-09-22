# Fortune Lottery A–F Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate reproducible A–F historical-fit results from the shared time-refined 1–1242 event matrix and publish only analysis artifacts.

**Architecture:** A single comparison runner consumes the cached matrix and candidate identities, exposes one evaluator to every method, and emits method-specific plus shared audit files. It never writes service-engine files or changes the fixed post-1242 hypotheses.

**Tech Stack:** Node.js ESM, built-in `node:test`, JSON/Markdown artifacts.

**Spec:** `C:/Users/kysn2/.codex/attachments/04e9e564-0561-4112-a0ea-c3896fab230d/붙여넣은 텍스트.txt`

## Global Constraints

- Write only under `analysis/fortune-lotto/`.
- Reuse the 1–1242 time-refined Seoul event matrix and the same winners for all methods.
- Use one evaluator enforcing six unique values in 1–45 and the requested score vector.
- Preserve source-lineage metadata and time-quality labels.
- Never modify the three separately fixed future-validation hypotheses.
- Exclude `event_signature`/unique event keys from A–F; retain it only as an explicitly non-comparable theoretical upper bound.
- Constrained conditional models may use at most 20 branches, depth at most two, and every learned leaf must contain at least 30 rounds.

## Review Focus

- Candidate identities must be global and cannot route on a round or winner.
- C number features must not contain a row’s winner values.
- F LOO must exclude self and past-only must exclude current/future rows.
- Each method must emit exactly 1,242 valid six-number tickets.
- Time subsets must report empty exact subsets honestly rather than inventing exact times.

### Task 1: Comparison runner and shared evaluator

**Files:** Create `analysis/fortune-lotto/run-method-comparison.mjs`; create `analysis/fortune-lotto/run-method-comparison.test.mjs`.

- [ ] Write a failing test that requires the runner to expose a shared evaluator, fixed A–F method outputs, and no service-source writes.
- [ ] Run `node --test analysis/fortune-lotto/run-method-comparison.test.mjs` and observe failure before the runner exists.
- [ ] Implement the cached-matrix loader, exact `lotto.js` candidate-grammar replication, and shared evaluator.
- [ ] Run the test until it passes.

### Task 2: Execute B–F and write audit artifacts

**Files:** Modify `analysis/fortune-lotto/run-method-comparison.mjs`; write `analysis/fortune-lotto/output/method-comparison/**`.

- [ ] Implement global candidate formula search (B), number ranking (C), joint fixed-formula search (D), fortune-state clustering (E), and LOO/past-only neighbors (F).
- [ ] Emit all required method, common, coverage, role, time, period, random, null, comparison, and report files.
- [ ] Execute the runner and inspect its integrity summary.

### Task 3: Reproducibility and release verification

**Files:** Modify the method comparison test if an output invariant needs coverage.

- [ ] Run unit tests, execute the full comparison runner, then validate all required files and A–F ticket invariants directly from output JSON.
- [ ] Inspect `git diff` to confirm only `analysis/fortune-lotto/` is staged.
- [ ] Commit analysis files and push the `staging` branch.
