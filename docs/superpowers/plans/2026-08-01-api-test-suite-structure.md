# API Test Suite Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop stack-independent API tests from running Supabase cleanup while preserving every existing full-suite entry point.

**Architecture:** Place stack-independent modules under `tests/unit/` and real-stack modules plus their fixtures under `tests/integration/`. Keep pytest's root test path and all pnpm/CI commands unchanged so recursive discovery still runs everything.

**Tech Stack:** Python 3.12, pytest, pytest-asyncio, uv, pnpm, Turbo, local Supabase

## Global Constraints

- Do not remove or rewrite existing test cases.
- `uv run pytest`, root `pnpm test`, and CI must continue to run the full backend suite.
- Do not change production code or add dependencies.

---

### Task 1: Prove and create the unit/integration seam

**Files:**
- Move: `services/api/tests/conftest.py` to `services/api/tests/integration/conftest.py`
- Move: stack-independent `services/api/tests/test_*.py` modules to `services/api/tests/unit/`
- Move: remaining `services/api/tests/test_*.py` modules to `services/api/tests/integration/`

**Interfaces:**
- Consumes: pytest's directory-scoped `conftest.py` discovery and existing absolute `tests.support` imports
- Produces: `tests/unit/` runnable without Supabase and `tests/integration/` retaining all existing fixtures

- [ ] **Step 1: Run a stack-independent test without `supabase` on `PATH` and verify it fails because the root integration fixture is loaded.**

Run the resolved `uv` executable with `PATH=/usr/bin:/bin` against `tests/test_screening.py`.

- [ ] **Step 2: Verify all proposed unit modules pass with `--noconftest`.**

Run `uv run pytest --noconftest` against the proposed module list and remove any module that requires repository fixtures.

- [ ] **Step 3: Move the modules and integration `conftest.py`.**

Use only directory moves; do not edit test bodies or change pytest configuration.

- [ ] **Step 4: Run the moved unit test without `supabase` on `PATH` and verify it passes.**

Run the same resolved `uv` executable with `PATH=/usr/bin:/bin` against `tests/unit/test_screening.py`.

- [ ] **Step 5: Run integration smoke tests.**

Run `SYNC_TEST_SKIP_DB_RESET=1 uv run pytest tests/integration/test_health.py -q` against the existing local stack.

### Task 2: Verify every existing entry point

**Files:**
- Verify: `services/api/pyproject.toml`
- Verify: `services/api/package.json`
- Verify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: existing bare `pytest` commands and recursive test collection
- Produces: unchanged full-suite behavior through uv, pnpm/Turbo, and CI

- [ ] **Step 1: Compare collected test counts before and after the move.**

Run `uv run pytest --collect-only -q` from `services/api`; it must still report 567 selected tests and 12 deselected live tests.

- [ ] **Step 2: Run the complete backend suite.**

Run `uv run pytest` from `services/api` and require zero failures.

- [ ] **Step 3: Run root `pnpm test`.**

Run `pnpm test` from the repository root and require zero failures in every workspace.

- [ ] **Step 4: Inspect the final diff.**

Confirm all former test modules exist exactly once, scripts and CI are unchanged, and no test body or production file changed.
