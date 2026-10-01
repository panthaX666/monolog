# Changelog

Every update that reaches the app is listed here. Versions are `0.<milestone>.<update>`: the middle
number goes up with each milestone, the last number with each update in between. Each version
becomes a GitHub Release automatically when it is published.

## [0.4.2] — 2026-10-01 · Release notes

### Added
- Settings → About shows the app version (for example `v0.4.2`) next to the build code.
- Every published update now creates a GitHub Release with these notes; past versions were back-filled.

## [0.4.1] — 2026-10-01 · Workout screen layout

### Changed
- **Add exercise** moved up, directly under the exercise cards, and stays the white main button.
- **Finish workout** is now the fixed button at the bottom of the screen (dark style), so it can't be confused with Add exercise.
- **Discard workout** sits at the bottom of the screen just above Finish, with clear space around it. In a long workout it follows the end of the list.
- When editing a past workout, **Done** is the bottom button and **Delete workout** sits just above it.
- Exercise names are larger (22px) and set numbers smaller and lighter (18px), so each card reads as a titled card rather than a grid of numbers. Tap areas are unchanged.
- README tagline shortened to "A monochrome, offline-first gym tracker."

## [0.4.0] — 2026-10-01 · M4: Body, charts, timed & cardio

### Added
- **Timed exercises** (e.g. Plank): log added weight and time. Time is typed microwave-style (`130` → 1:30); −/+ steps 15 s.
- **Cardio** (e.g. Treadmill Run): log distance in km and time; pace is worked out.
- Records and the celebration card for **time, distance and pace**.
- **Body tab**: latest weight with change this week and over 30 days; weigh-in chart with a 7-day average; body fat, muscle mass and waist with their own pages and charts; calculated BMI, fat mass and lean mass.
- **Check-in** sheet, pre-filled with your last values. Entries can be removed from each metric's page.
- **Home cards**: weekly muscle coverage (tap for working sets per muscle group and when each was last trained), body weight with a trend line, recent records, and a weekly check-in reminder.
- **Exercise page → Chart**: est. 1RM, top weight or volume per workout (or reps, hold, distance, pace, time), over 3M / 6M / 1Y / All; workouts with a record shown in gold.
- Every chart shows the latest value above it, tap for any other point, and has a **Show as table** view.
- Settings: height, weekly check-in day, which body metrics to track.

### Changed
- Timed and cardio exercises can now be added to workouts (they were greyed out).
- Summaries, history and records show each exercise in its own format (e.g. `45.0×10`, `1:15`, `5.00 km · 30:00`).

## [0.3.0] — 2026-10-01 · M3: History & Exercises

### Added
- **History tab**: month calendar (weeks start Monday) with trained and rest days; streaks of 3+ days joined into gold bars. Tap a day to filter. Workouts and rest days listed below.
- **Past workout page**: edit, add, delete or un-log sets in any old workout. Records update silently (no celebration). **Done** and **Delete workout** at the bottom.
- **Repeat**: start a new workout with the same exercises, in order, pre-filled from that workout.
- **Exercises tab**: search, muscle and equipment filters, archived list, create new.
- **Exercise page**: records (max weight, max reps, est. 1RM, record timeline), history, all set notes, pinned note, unit and rest time per exercise.
- **Exercise editor**: name, type, primary and secondary muscles, equipment, tags (compound / isolation / full body / custom), archive.

### Changed
- When editing an old workout, new exercises pre-fill from the session before that date, not from later ones.
- Dates always read like "30 Sep" (some phones showed "30 Sept").

### Fixed
- The tab bar now shows on exercise pages.

## [0.2.2] — 2026-10-01 · Discard workout

### Added
- **Discard workout** button (red), always available, with a confirmation that says how many logged sets will be deleted. Stops the rest timer and returns to Home.

### Changed
- Going Home during a workout never discards it — the workout and its clock keep running until you finish or discard.

## [0.2.1] — 2026-10-01 · Fit every screen

### Fixed
- On some Android phones the app was taller than the screen, pushing **Add exercise** under the navigation bar. Every screen now fits the visible window exactly; only the content area scrolls.

## [0.2.0] — 2026-10-01 · M2: Workout logging

### Added
- **Home**: streak card (trained/rest dots, gold bar at 3+ days, rest days in a row out of 3, warning when yesterday still needs logging), Start/Resume workout, rest-day sheet for today or yesterday, backup reminder.
- **Workout screen**: exercise cards pre-filled (faded) from last session, ✓ to log and tap again to un-log, unlimited sets, ✕ delete with Undo, warm-up / working / to-failure sets, per-set notes, last session's numbers and note, pinned note, kg/lb per exercise, screen kept on.
- **Number pad**: direct typing (first key replaces), −/+ 2.5 kg, Next, Log set.
- **Exercise picker**: search, muscle and equipment filters, Recent, A–Z, create exercise.
- **Rest timer** in the top corner — manual start, optional auto-start.
- **Records**: gold ✓ and gold records button on a record set, records popup, full "New record" celebration.
- **Finish** dialog and workout **summary**.
- **Settings**: units, rest default, auto-start, vibration, keep screen on, **save and restore backups**, version.

## [0.1.0] — 2026-10-01 · M1: Engine

### Added
- On-phone database and a 93-exercise starter library, tagged by muscle, equipment and type.
- Record detection (heavier weight, or more reps at the same or heavier weight; warm-ups never count; never compared across exercises), streak rules, weekly muscle coverage, backups.

## [0.0.3] — 2026-10-01 · Update check

### Added
- A visible marker on Home to confirm updates reach the installed app.

## [0.0.2] — 2026-10-01 · Install button

### Added
- **Install Monolog** button on Home, so the app installs as a real full-screen app instead of a Chrome shortcut.

## [0.0.1] — 2026-10-01 · Pull to refresh

### Fixed
- Pull-to-refresh works again in a normal Chrome tab (it's only blocked inside the installed app).

## [0.0.0] — 2026-10-01 · M0: First version

### Added
- Installable, offline app on GitHub Pages with four tabs, the black-and-white design, an "Update ready" banner, and a test-then-publish pipeline.
