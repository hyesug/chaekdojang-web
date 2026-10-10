# Fortune-lotto G/H/I/R Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reproducible non-divination controls and train-only walk-forward evaluation without modifying the preserved A–F comparison artifacts.

**Architecture:** An extension runner reads the committed common matrix, A–F tickets/models, and evaluator semantics. It writes only newly named G/H/I/R, walk-forward, null-control, comparison, and report artifacts beneath the existing method-comparison directory.

**Tech Stack:** Node.js ESM, built-in `node:test`, JSON and Markdown artifacts.

**Spec:** User request in this conversation, 2026-09-23.

## Global Constraints

- Modify only `analysis/fortune-lotto/`.
- Never overwrite existing `method_A.json` through `method_F.json`, existing A–F tickets, or their common evaluator artifacts.
- Use rounds 1–1242 and the existing score vector exactly.
- G uses only draw history, round order, and Gregorian calendar fields; its per-row features use prior draws only.
- H uses numerical time/astronomy coordinates only, never fortune interpretations or sign/nakshatra/hexagram labels.
- Walk-forward trains only on rows preceding its test window.
- I cannot choose A or E by the current row winner.
- Preserve the separate post-1242 hypotheses untouched.

## Review Focus

- Temporal rolling features must not include the target row or future rows.
- Every test ticket must be six unique values in 1–45 under the shared evaluator.
- H source identifiers must be explicit numerical coordinates rather than engine interpretation fields.
- A/E train procedures must derive all branch/cluster rules from each split’s training rows only.
- Permuted-winner null runs must permute targets with a deterministic, valid permutation.

### Task 1: Extension safety and temporal primitives

**Files:** Create `analysis/fortune-lotto/run-extended-comparison.mjs`; create `analysis/fortune-lotto/run-extended-comparison.test.mjs`.

- [ ] Write failing tests for prior-only G history, H feature exclusion, ticket validation, and deterministic permutations.
- [ ] Run `node --test analysis/fortune-lotto/run-extended-comparison.test.mjs` and observe missing-export failures.
- [ ] Implement pure helpers and run the test green.

### Task 2: G/H/I/R and walk-forward execution

**Files:** Modify the extension runner; create only newly required output files under `output/method-comparison/`.

- [ ] Implement G temporal number ranking plus global formula lanes, H numerical astronomical formula ranking, I deterministic A/E union weighting, and 10,000-run R Monte Carlo.
- [ ] Implement expanding-window train-only walk-forward for A–I, including train-only A branch rules and E clustering/rules.
- [ ] Write G/H/I/R, walk-forward, extended comparison, overlap, and null-control artifacts.

### Task 3: Reproducibility verification

**Files:** Modify test only if a missing invariant is found.

- [ ] Execute the extension runner twice and confirm deterministic summaries.
- [ ] Verify all required files, no A–F modification, 6-number validity, G prior-only history, and split separation.
- [ ] Run the analysis tests and project test suite; inspect the staged diff before committing.
