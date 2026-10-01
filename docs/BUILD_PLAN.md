# Monolog — Build Plan (Release 1)

Spec: `docs/SPEC.md`. Each milestone ends deployed to GitHub Pages and installable on the phone.
Rule: domain logic (records, streaks, units, migrations) is test-first; CI blocks deploy on failure.

---

## M0 — Skeleton & pipeline
**Goal:** an installable, auto-updating empty app on the phone. Proves the update flow before anything else.

1. Create public repo `panthaX666/monolog`; Vite + React + TS (strict); ESLint + Prettier.
2. Design tokens + base CSS ported from `mockups/mockup.html`; Inter bundled.
3. Hash router with 4 tab placeholders + tab bar.
4. `vite-plugin-pwa`: manifest (name, icons, black theme, standalone), precache, **"Update ready · Tap to reload"** banner.
5. GitHub Actions: typecheck → test → build → deploy to Pages (`base: '/monolog/'`).
6. `navigator.storage.persist()` request.

**Done when:** Pilot installs from `panthax666.github.io/monolog`, a trivial change is pushed, and the phone shows the update banner.

## M1 — Data layer & domain logic
1. Dexie schema v1 (all tables in SPEC §6) + typed repository functions.
2. Units module (conversion, formatting, rounding).
3. **Records engine** (SPEC §6.1) incl. recompute-from-point — full Vitest suite, including a regression test for the old app's cross-exercise bug.
4. **Streak engine** (§6.2) — tests for grace window, 3 vs 4 rest days, today-in-progress, midnight-crossing sessions.
5. Coverage calculator (§6.3).
6. Seed exercise library (~80 tagged exercises, including every exercise seen in the old app).
7. Backup export/import + validation + migration test harness.

**Done when:** all domain tests green in CI.

## M2 — Core logging ⭐ (switch-over point)
1. Home: streak card, Start/Resume, Rest-day sheet (today/yesterday grace).
2. Active workout: exercise cards, ghost pre-fill, ✓ log/un-log, unlimited sets, ✕ delete + Undo, set-type menu, per-set note, last-session & pinned notes.
3. Number pad sheet (direct entry, −/+ 2.5, Next, Log).
4. Picker: search, tag chips, Recent, A–Z, create exercise (N12 minimal).
5. Rest timer chip (manual default; auto-start setting), vibration, Wake Lock.
6. Records: gold ✓, gold records tile, records popover, **celebration card**.
7. Finish → summary; crash-safe persistence; 4-hour stale-session prompt.
8. Settings (minimal): unit, rest default, auto-start, **Export / Restore backup**.
9. Playwright e2e for F1 on a phone viewport.

**Done when:** Pilot logs a real gym session end-to-end on the phone and exports a backup. **→ Stop using the old app.**

## M3 — History & exercises
1. History calendar with joined streak bars + session list.
2. Session detail = workout screen in edit mode; silent record recompute; **Repeat**.
3. Exercises tab (search + filters) and Exercise detail (Records / History / Notes; pinned note edit; per-exercise unit & rest).
4. Edit/archive exercises.

## M4 — Body & charts
1. Body tab, check-in sheet, metric detail, derived BMI / fat mass / lean mass (height in Settings).
2. Weekly check-in banner on chosen day.
3. SVG charts (uPlot dropped — see SPEC §7): exercise (e1RM / top set / volume, range 3M·6M·1Y·All), body weight + 7-day average, weekly sets per muscle.
4. Home cards: coverage, body weight + sparkline, recent records.
5. Timed & cardio exercise inputs + their records (duration, distance, pace).

## M5 — Polish & hardening
1. Backup reminder every 10 workouts; Share workout (text/image).
2. Drag-to-reorder exercises; long-press multi-select in picker.
3. Performance test with 3 years of synthetic data; accessibility & reduced-motion pass.
4. Empty/edge states; error boundary with "export backup" escape hatch.

## Later (Release 2 / Play Store)
Capacitor build with local notifications (rest timer on lock screen, weekly check-in) · onboarding · larger library · trademark check · paywall (signed license keys) · importers (Strong/Hevy CSV).
