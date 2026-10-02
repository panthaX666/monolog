# Changelog

Everything that changed in the app, newest first. Each version also shows up on the
[Releases](https://github.com/panthaX666/monolog/releases) page.

Version numbers go `0.<milestone>.<update>`. The middle number goes up when a big chunk of
features lands, the last one for smaller updates in between.

## [0.4.5] · 2026-10-02 · Number pad and new exercises

### Changed
- The number pad has one big button now. While you type the weight it says **Enter** and moves you to reps. Once you're on reps it turns into the white **✓ Log set**. No more hitting Log set by accident after typing the weight.
- If you tap Enter twice by mistake, the second tap doesn't log the set.

### Added
- Creating an exercise from the picker opens a small "New exercise" screen. You can set the main muscle, the muscles it also works, and the equipment, each from a list. All optional, so you can still just hit Create.

## [0.4.4] · 2026-10-01 · No more waist

### Removed
- Waist is gone from the Body tab, the check-in sheet and the tracked metrics in Settings. Any waist numbers you already logged stay in your backups, they just aren't shown.

## [0.4.3] · 2026-10-01 · Cleaner wording

### Changed
- Rewrote the README, this changelog and the docs so they read more naturally. Install steps are shorter.
- Removed em dashes from text in the app (streak warnings, exercise cards, settings and a few other spots).

## [0.4.2] · 2026-10-01 · Release notes

### Added
- Settings → About now shows the version number (like `v0.4.2`) next to the build code.
- Every update now gets its own page on GitHub Releases with these notes. Older versions were added too.

## [0.4.1] · 2026-10-01 · Workout screen layout

### Changed
- Add exercise now sits right under your exercise cards and is still the big white button.
- Finish workout is now the dark button pinned to the bottom, so you don't hit it by mistake.
- Discard workout sits just above Finish with some space around it. In a long workout it's at the end of the list.
- Same thing when editing an old workout: Done at the bottom, Delete workout just above it.
- Exercise names are bigger (22px) and the set numbers are smaller and lighter (18px), so each card looks like a titled card instead of a wall of numbers. Buttons are still the same size to tap.
- Shorter README tagline: "A monochrome, offline-first gym tracker."

## [0.4.0] · 2026-10-01 · Body tab, charts, timed and cardio

### Added
- Timed exercises like Plank. You log added weight and time. Time is typed like a microwave (`130` means 1:30), and the −/+ buttons move 15 seconds.
- Cardio like Treadmill Run. You log distance in km and time, and the app works out your pace.
- Records and the celebration card now cover time, distance and pace too.
- Body tab: your latest weight with the change this week and over 30 days, a weigh-in chart with a 7-day average, and body fat, muscle mass and waist with their own pages and charts. BMI, fat mass and lean mass get worked out for you.
- Check-in sheet that starts with your last values filled in. You can delete entries from each metric's page.
- New cards on Home: muscle coverage this week (tap it to see sets per muscle and when you last trained each), body weight with a trend line, your recent records, and a weekly check-in reminder.
- Chart tab on every exercise: est. 1RM, top weight or volume per workout (or reps, hold time, distance, pace, time) over 3M / 6M / 1Y / All. Workouts where you hit a record show in gold.
- Every chart shows the latest value above it. Tap anywhere on it to see other points, or switch to a table.
- New settings: height, which day the weekly check-in is, and which body metrics you track.

### Changed
- You can now add timed and cardio exercises to a workout (they used to be greyed out).
- Summaries, history and records show each exercise in its own format, like `45.0×10`, `1:15` or `5.00 km · 30:00`.

## [0.3.0] · 2026-10-01 · History and exercises

### Added
- History tab: a month calendar (weeks start on Monday) showing workout and rest days. Streaks of 3+ days get joined into gold bars. Tap a day to see just that day. Workouts and rest days are listed below.
- Old workouts can be opened and edited: change, add, delete or un-log sets. Records update quietly in the background, no celebration. Done and Delete workout are at the bottom.
- Repeat: start a new workout with the same exercises in the same order, filled in from that workout.
- Exercises tab with search, muscle and equipment filters, an archived list, and a button to make your own.
- Exercise page: records (max weight, max reps, est. 1RM, and a timeline of every record), history, all your set notes, a pinned note, and the unit and rest time for that exercise.
- Exercise editor: name, type, main and secondary muscles, equipment, tags (compound, isolation, full body or your own), and archive.

### Changed
- When you edit an old workout and add an exercise, it fills in from the workout before that date, not from newer ones.
- Dates always look like "30 Sep" now (some phones showed "30 Sept").

### Fixed
- The tab bar now shows up on exercise pages.

## [0.2.2] · 2026-10-01 · Discard workout

### Added
- A red Discard workout button that's always there. It asks first and tells you how many logged sets you'd lose. It also stops the rest timer and takes you back Home.

### Changed
- Going back Home in the middle of a workout never throws it away. The workout and its clock keep going until you finish or discard it.

## [0.2.1] · 2026-10-01 · Fits every screen

### Fixed
- On some Android phones the app was taller than the screen, so Add exercise ended up hidden under the navigation bar. Every screen now fits properly and only the middle part scrolls.

## [0.2.0] · 2026-10-01 · Workout logging

### Added
- Home: streak card (dots for workout and rest days, a gold bar at 3+ days, how many rest days in a row out of 3, and a heads-up when yesterday still needs logging), Start or Resume workout, a rest day button for today or yesterday, and a backup reminder.
- Workout screen: exercise cards filled in (faded) from last time, ✓ to log a set and tap again to undo it, as many sets as you want, ✕ to delete with Undo, warm-up / working / to-failure sets, notes on any set, last time's numbers and note, a pinned note, kg or lb per exercise, and the screen stays on.
- Number pad: just type (the first key replaces the old number), −/+ by 2.5 kg, Next, and Log set.
- Exercise picker: search, muscle and equipment filters, Recent, A–Z, and making a new exercise.
- Rest timer in the top corner. You start it yourself, or turn on auto-start.
- Records: gold ✓ and a gold records button when you hit one, a records popup, and the big "New record" card.
- Finish dialog and a summary of the workout.
- Settings: units, default rest time, auto-start, vibration, keep screen on, save and restore backups, and the version.

## [0.1.0] · 2026-10-01 · The engine underneath

### Added
- The on-phone database and a starter list of 93 exercises, tagged by muscle, equipment and type.
- The rules for records (heavier weight, or more reps at the same or heavier weight; warm-ups don't count; exercises are never compared with each other), streaks, weekly muscle coverage, and backups.

## [0.0.3] · 2026-10-01 · Update check

### Added
- A small marker on Home to check that updates actually reach the installed app.

## [0.0.2] · 2026-10-01 · Install button

### Added
- An Install Monolog button on Home, so it installs as a proper full-screen app and not a Chrome shortcut.

## [0.0.1] · 2026-10-01 · Pull to refresh

### Fixed
- Pull down to refresh works again in a normal Chrome tab. It's only turned off inside the installed app.

## [0.0.0] · 2026-10-01 · First version

### Added
- The first installable version on GitHub Pages: four tabs, the black and white look, the "Update ready" bar, and the setup that tests every change before it goes live.
