# API Generator Extreme Ratios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 1:3 and 3:1 image ratio presets to API generator nodes at 1K, 2K, and 4K resolutions.

**Architecture:** Extend the existing `SIZE_MAP` and inline ratio selector in `static/js/canvas.js`. Keep the backend contract unchanged because generation requests already submit the resolved pixel size.

**Tech Stack:** Browser JavaScript, HTML template strings, Node.js built-in test runner

---

### Task 1: Add regression coverage

**Files:**
- Create: `tests/canvas-ratio-presets.test.js`
- Test: `static/js/canvas.js`

- [ ] **Step 1: Write a failing source-level regression test**

Read `static/js/canvas.js` and assert the exact 1:3 and 3:1 size maps, selector options, and detail labels are present.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/canvas-ratio-presets.test.js`
Expected: FAIL because the new preset keys are absent.

### Task 2: Add ratio presets

**Files:**
- Modify: `static/js/canvas.js:226-234`
- Modify: `static/js/canvas.js:4209-4219`
- Modify: `static/js/canvas.js:6249`

- [ ] **Step 1: Add fixed size mappings**

Add `portrait13` with `512x1536`, `688x2048`, `1280x3840`, and `landscape31` with the transposed dimensions.

- [ ] **Step 2: Add selector options**

Add `portrait13` labeled `1:3` and `landscape31` labeled `3:1` beside the existing portrait and landscape presets.

- [ ] **Step 3: Add output detail labels**

Map both internal keys to their user-facing ratio strings in `ratioMap`.

- [ ] **Step 4: Run focused and existing tests**

Run: `node --test tests/*.test.js`
Expected: all tests pass.

- [ ] **Step 5: Check JavaScript syntax**

Run: `node --check static/js/canvas.js`
Expected: exit code 0 with no output.
