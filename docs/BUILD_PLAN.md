# Monolog build plan (Release 1)

The order things get built in. The details of how each piece should work are in [SPEC.md](SPEC.md).

Two rules the whole way through:
- Every milestone ends with a working version live on GitHub Pages that installs on the phone.
- The tricky logic (records, streaks, units, data migrations) gets tests first. If a test fails, nothing gets published.

Milestones M0 to M4 are done. See the [changelog](../CHANGELOG.md) for what each one shipped.

---

## M0: Skeleton and publishing ✅
Get an empty app onto the phone that installs and updates itself, before building anything real.

1. Public repo `panthaX666/monolog` with Vite, React and strict TypeScript, plus ESLint and Prettier.
2. Colors, spacing and base styles taken from `mockups/mockup.html`, with the Inter font bundled in.
3. Four placeholder tabs and the tab bar.
4. PWA setup: app name, icons, black theme, full screen, offline caching and the "Update ready" bar.
5. GitHub Actions: type check, test, build, then publish to Pages.
6. Ask the browser to keep the app's data safe (`navigator.storage.persist()`).

**Done when** the app is installed from the site, a small change is pushed, and the phone shows the update bar.

## M1: Data and logic ✅
1. The database (every table in SPEC §6) and the functions to read and write it.
2. Units: converting, formatting and rounding kg and lb.
3. The records engine (SPEC §6.1), including recalculating after edits. Fully tested, with a test for the old app's bug where it compared different exercises.
4. The streak engine (§6.2), with tests for the grace period, 3 vs 4 rest days, today still being in progress, and workouts that run past midnight.
5. Weekly muscle coverage (§6.3).
6. A starter list of about 80 exercises, including everything I used in the old app.
7. Backup save and restore, with checks and a way to test future data changes.

**Done when** all the logic tests pass in CI.

## M2: Logging a workout ✅ (the switch-over point)
1. Home: streak card, Start or Resume, rest day sheet (today, or yesterday while it's still allowed).
2. Workout screen: exercise cards, sets filled in from last time, ✓ to log and un-log, unlimited sets, ✕ delete with Undo, set types, set notes, last time's note and the pinned note.
3. Number pad: type directly, −/+ 2.5, Next, Log.
4. Exercise picker: search, tag filters, Recent, A–Z, create a new exercise.
5. Rest timer chip (start it yourself by default, auto-start is a setting), vibration, and keeping the screen on.
6. Records: gold ✓, gold records button, records popup and the celebration card.
7. Finish and summary. Every set is saved the moment it's logged. A workout left open for 4+ hours asks to be finished.
8. Basic settings: unit, rest time, auto-start, and save or restore a backup.
9. Browser tests that run a whole workout on a phone-sized screen.

**Done when** I can log a real gym session on the phone and save a backup. That's when the old app goes.

## M3: History and exercises ✅
1. History calendar with streak bars, and the list of workouts.
2. Opening an old workout gives the workout screen in edit mode. Records recalculate quietly. Plus Repeat.
3. Exercises tab (search and filters) and the exercise page (Records, History, Notes, pinned note, unit and rest time).
4. Editing and archiving exercises.

## M4: Body and charts ✅
1. Body tab, check-in sheet, a page per metric, and BMI, fat mass and lean mass worked out from height (set in Settings).
2. Weekly check-in reminder on the chosen day.
3. Charts, drawn as plain SVG (see SPEC §7): per exercise (est. 1RM, top set, volume over 3M, 6M, 1Y or All), body weight with a 7-day average, and weekly sets per muscle.
4. Home cards: coverage, body weight with a small trend line, recent records.
5. Timed and cardio exercises and their records (time, distance, pace).

## M5: Polish (next, will be v1.0.0)
1. Backup reminder every 10 workouts (already done in M2). Share a workout as an image (done in v0.4.6).
2. Drag to reorder exercises. Long press to pick several exercises at once in the picker.
3. Test it with 3 years of fake data to make sure it stays fast. Accessibility and reduced motion check.
4. Empty states and edge cases. If the app crashes, show a screen that still lets you save a backup.

## Later (Release 2, Play Store)
A Capacitor build with real notifications (rest timer on the lock screen, weekly check-in), onboarding, a bigger exercise list, a trademark check, maybe a paid unlock, and importing from Strong or Hevy.
