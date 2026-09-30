# Monolog — Product & Technical Spec (Release 1)

> Monochrome, offline-first gym tracker. **Tracker, not a planner.**
> Status: Phase 4 draft · 2026-10-01 · Owner: panthaX666
> Visual reference: `mockups/mockup.html` (clickable Home + Active workout)

---

## 1. Context

| | |
|---|---|
| Replaces | Kintore Memo / "Gym get-fit Workout Schedule" (Android, Maketore) |
| Release 1 audience | The owner only (personal daily driver) |
| Later | Public release on Google Play (Capacitor wrapper), possible paywall |
| Platform | Installable PWA, hosted on GitHub Pages (`panthax666.github.io/monolog`) |
| Data | 100% on-device (IndexedDB). No accounts, no server, no cloud sync |
| Import from old app | None — fresh start (old backup is AES-encrypted) |

### Design principles
1. **Mid-workout logging comes first.** First set logged in ≤ 3 taps; typical set = 1 tap.
2. **Sweaty-hand friendly.** Targets ≥ 40 px, primary actions ≥ 56 px, thumb zone at the bottom.
3. **Monochrome with one meaning for colour.** Gold = progress (records, streak). Nothing else is gold.
4. **Your data is safe.** Crash-safe logging, tested schema migrations, one-tap backup.
5. **Any progress is progress.** Rep records celebrate as loudly as weight records.

---

## 2. Decision log

| # | Decision |
|---|---|
| D1–D6 | Replace third-party Android app; fully offline; no accounts; monetization deferred; install via GitHub Pages; switch ASAP |
| D7 | Remove training-load / tonnage cards |
| D8 | Remove RM calculator |
| D9 | Remove Spotting |
| D10 | Searchable exercise picker |
| D11 → D33 → **D41** | Record celebration = **large card** (old-app style): title, gold trophy art, "NEW WEIGHT/REP RECORD" ribbon, gold delta, before ▶ after with dates, OK |
| D12 | Streaks: trained OR logged rest day extends; empty day breaks; > 3 consecutive rest days breaks; bar shown at ≥ 3 |
| D13 | Add-exercise button is large, full-width, bottom |
| D14 | kg default; per-exercise unit override; stored as entered; never manual conversion |
| D15 | Notes resurfaced: last-session note, pinned exercise note, notes list per exercise |
| D16/D23 | Body metrics kept, redesigned, weekly check-in banner |
| D17 | No import |
| D18/D19 | ~~Public from start / paywall~~ — superseded by D26 |
| D20 | Tracker, not planner — no routines |
| D21 | Exercises organised by **tags** (muscles primary/secondary, equipment, type, custom), searchable |
| D22 | Rest day may be logged for yesterday until end of today |
| D24 | Charts included |
| D25 | Black & white, dark-mode first |
| D26 | Release 1 = personal only; public later on Play Store |
| D27/D35 | Rest timer in top-right corner; manual start default; Settings toggle to auto-start on set log |
| D28/A5 | Set kinds: warm-up / working; "to failure" is a flag on working sets |
| D29 | No RPE/RIR, no supersets |
| D30 | Exercise types: weight × reps, bodyweight (+added kg), timed, cardio (distance and/or time, speed/pace derived) |
| D31 | 4 tabs: Home / History / Exercises / Body |
| D32 | "Repeat" a past session |
| D34 | No "Due this week" in picker; Home coverage card stays |
| D36 | Unlimited sets; next set pre-filled from last session, else from the set just logged |
| D37 | Custom number pad: direct typing; −/+ (2.5 kg) are shortcuts |
| D38 | Logged set ✓ = white square; record set ✓ = **gold** square |
| D39/D45 | Records button = dark tile with gold rounded square; tile turns gold (square black) when this exercise hit a record this workout |
| D40 | ✕ delete on every set (logged or not), far left, 5 s Undo |
| D42 | No extra per-set/per-workout fields |
| D43 | Cardio records: longest distance, longest time, fastest pace |
| D44 | Week = Monday–Sunday |
| D46 | Public GitHub repo `panthaX666/monolog` |
| A1 | Estimated 1RM = Epley `w × (1 + reps/30)` (charts only; no longer triggers celebration) |
| A2 | Secondary muscles count ½ session in coverage |
| A3 | Rest duration remembered per exercise; global default 90 s |
| A4 | Lock-screen timer alert = best-effort in R1; reliable in Play Store build |
| A6 | Workouts are sessions (start/end), multiple per day allowed |

---

## 3. Information architecture

```
Tabs:  Home · History · Exercises · Body
Full-screen: Active workout (+ picker sheet, number pad sheet, records popover,
             celebration overlay, finish → summary)
Persistent "● Resume workout · mm:ss" bar above tabs while a session is open.
```

| ID | Screen | Contents |
|---|---|---|
| N1 | Home | Date header + ⚙ · Streak card (count, dot row, gold run pill, rest-days x/3) · This-week coverage · Body-weight card + sparkline · Recent records · Check-in banner (on check-in day) · **[Rest day] [▶ Start workout]** (or Resume) |
| N2 | Active workout | Header: [‹ Home] · elapsed · **rest timer chip (top-right)** · exercise cards · full-width **[＋ Add exercise]** · Finish |
| N3 | Exercise picker | Search · muscle chips · equipment chips · Recent · A–Z · "＋ Create '…'" · long-press multi-select |
| N4 | Number pad | KG field (−/+) · REPS field · 3×4 keys · [Next] [✓ Log set] |
| N5 | Rest timer | Chip: idle `⏱ 1:30 ▶`, running (white) countdown, done (pulse + vibrate) |
| N6 | Celebration | Large gold card (D41) |
| N7 | Workout summary | Duration, exercises, sets, volume, records, muscles, streak, [Share] [Done] |
| N8 | History | Month calendar with joined streak bars (● trained, ○ rest, ◉ today) · session list |
| N9 | Session detail | = N2 in edit mode + [Repeat] |
| N10 | Exercises | Search + tag filters, library list |
| N11 | Exercise detail | Tags · pinned note · tabs **Records / History / Chart / Notes** · unit, rest length |
| N12 | Create/edit exercise | Name, type, primary/secondary muscles, equipment, tags |
| N13 | Body | Hero weight + deltas + 7-day-avg chart · other metrics rows · derived metrics (hidden if no data) |
| N14 | Check-in sheet | Tracked metrics pre-filled with last values, −/+ steppers, Save |
| N15 | Metric detail | Chart + entry list (edit/delete) |
| N16 | Settings | Unit, weight step, rest default, auto-start, vibration, wake lock, height, check-in day, tracked metrics, Export/Restore, version |
| N17 | Rest-day sheet | Today / Yesterday (if within grace) |

---

## 4. Key flows

### F1 — Log a workout (core)
1. Home → **Start workout** → session created, clock running.
2. **＋ Add exercise** → picker (Recent first; keyboard opens only when search tapped).
3. Tap exercise → card appears; sets pre-filled (faded) from last session; last-session note + pinned note shown.
4. **✓** logs the set exactly as shown → row solid, ✓ white (gold if record), next set pre-filled, rest timer starts if auto-start on; record → celebration card.
5. Tap a value → number pad; first key replaces value; ✓ on pad logs.
6. Tap set number → Warm-up / Working / Working + failure. ✕ deletes (Undo 5 s). ✎ opens a one-line note.
7. **Finish** → discard un-logged sets → summary.

Rules: every logged set persisted immediately (crash-safe); session open > 4 h → prompt to finish at last-set time; tapping ✓ on a logged set un-logs it.

### F2 — Rest day
Home → Rest day → Today / Yesterday (if yesterday empty and within grace) → streak updates.

### F3 — History & records
In workout: tap exercise name → detail sheet. Outside: Exercises → search → detail. Records button → popover (max weight, max reps @ weight, best at current weight).

### F4 — Create exercise
Picker search, no match → "＋ Create …" → name + type required, rest optional → added to workout.

### F5 — Body check-in
Banner or Body tab → sheet pre-filled → adjust → Save → deltas + charts update.

### F6 — Edit past workout
History → session → edit like N2. Records recomputed silently (no celebration).

### F7 — Repeat
Session detail → Repeat → new session with same exercises, sets pre-filled from that session.

### F8 — Backup / restore
Settings → Export → JSON via share sheet. Banner every 10 workouts without a backup. Restore → pick file → preview counts → confirm replace.

---

## 5. Visual design system

### Colour tokens
| Token | Value | Use |
|---|---|---|
| `bg` | `#000000` | Screen |
| `surface-1` | `#111113` | Cards, sheets |
| `surface-2` | `#1C1C1F` | Buttons, inputs, logged rows |
| `surface-3` | `#2A2A2E` | Borders, pressed, empty bars |
| `text-1` | `#FFFFFF` | Primary text, primary button fill |
| `text-2` | `#A1A1A6` | Secondary text |
| `text-3` | `#6B6B70` | Ghost (pre-filled) values, hints |
| `accent` | `#F5C542` | **Records + streak only** |
| `accent-dim` | `rgba(245,197,66,.14)` | Streak run pill, glows |
| `danger` | `#FF453A` | Failure marker, destructive confirms |

### Type — Inter (self-hosted, tabular numerals)
Display 44/700 · Title 30/700 · Exercise name 19/700 · Set values 22/600 · Body 16 · Meta 14 · Label 12/600 uppercase +0.08em.

### Layout
4-pt spacing (4/8/12/16/20/24/32) · radii: card 20, button 14, pill 999 · targets: ✓ 48 (row 60), keys 60, primary 56, min 40.

### Components
Primary button (white/black, max one per screen) · Secondary (surface-2 + border) · Chip · Card · Set row states (ghost / logged-white / logged-gold / warm-up W grey / failure F red) · Records tile · Timer chip · Number pad · Sheet (slide-up) · Snackbar (Undo) · Celebration card · Streak dots · Coverage bars.

### Motion & haptics
120–250 ms ease-out; celebration pop 450 ms; honour `prefers-reduced-motion`. Vibration: log 12 ms · record 30-60-30 · rest done 200-100-200.

---

## 6. Data model (IndexedDB via Dexie, DB name `monolog-v1-<random>`)

```ts
type ID = string;           // crypto.randomUUID()
type DayKey = string;       // 'YYYY-MM-DD', local date, fixed at creation
type Unit = 'kg' | 'lb';

interface Exercise {
  id: ID; name: string; nameKey: string;          // nameKey = lowercased, for uniqueness/search
  type: 'weight_reps' | 'bodyweight_reps' | 'timed' | 'cardio';
  primaryMuscles: string[]; secondaryMuscles: string[];
  equipment: string[]; tags: string[];
  unit: Unit | null; restSec: number | null; pinnedNote: string;
  isCustom: boolean; archivedAt: string | null; createdAt: string;
}
interface Session {
  id: ID; dayKey: DayKey; startedAt: string; endedAt: string | null;
  repeatedFrom: ID | null;
}
interface SessionExercise { id: ID; sessionId: ID; exerciseId: ID; order: number; }
interface WorkoutSet {
  id: ID; sessionExerciseId: ID; sessionId: ID; exerciseId: ID; dayKey: DayKey; order: number;
  kind: 'warmup' | 'working'; toFailure: boolean;
  weight: number | null; unit: Unit; weightKg: number | null;   // as entered + normalised
  reps: number | null; durationSec: number | null; distanceM: number | null;
  note: string; loggedAt: string | null;                        // null = pre-filled, not logged
}
interface RestDay { dayKey: DayKey; createdAt: string; }
interface BodyEntry {
  id: ID; dayKey: DayKey; weightKg: number | null; bodyFatPct: number | null;
  muscleMassKg: number | null; waistCm: number | null; note: string;
}
interface RecordEvent {
  id: ID; setId: ID; exerciseId: ID;
  kind: 'weight' | 'reps' | 'duration' | 'distance' | 'pace';
  before: { value: number; setId: ID; dayKey: DayKey };
  after: { value: number }; at: string;
}
interface Settings {
  unit: Unit; weightStep: number; restDefaultSec: number; restAutoStart: boolean;
  vibration: boolean; wakeLock: boolean; heightCm: number | null;
  checkInDay: 0|1|2|3|4|5|6; trackedMetrics: string[];
  lastBackupAt: string | null; workoutsSinceBackup: number; schemaVersion: number;
}
```

Indexes: `sets: [exerciseId+loggedAt], sessionId, dayKey` · `sessions: dayKey, startedAt` · `bodyEntries: dayKey` · `recordEvents: exerciseId, at` · `exercises: &nameKey`.

### 6.1 Record rules (unit-tested)
- Eligible: logged (`loggedAt != null`), `kind = 'working'`, **same exerciseId**. Order by `loggedAt`.
- First-ever eligible set of an exercise → no record.
- **Weight:** `weightKg > max(prior weightKg)` (tolerance 0.001).
- **Reps:** `reps > max(prior reps where prior.weightKg ≥ this.weightKg)`.
- Bodyweight: weight = added kg. Timed: `durationSec` (at ≥ added weight). Cardio: longest `distanceM`, longest `durationSec`, fastest pace = lowest `durationSec/distanceM` among sets with distance ≥ this distance.
- If a set is both weight and reps record → show weight.
- Editing/deleting/un-logging a set recomputes RecordEvents for that exercise from that set's `loggedAt` onward; celebrations fire only for live logging.

### 6.2 Streak rules (unit-tested)
- Day status: **trained** (≥ 1 logged working set in a session with that dayKey) › **rest** (RestDay) › **empty**.
- Streak = consecutive non-empty days ending at today (if non-empty) or yesterday (today never breaks it).
- Breaks on an empty day once past its grace (grace = until end of the following day) or on the 4th consecutive rest day.
- Derived on read, never stored. Best streak also derived.

### 6.3 Coverage
Week Mon–Sun. Per muscle: +1 per session where primary, +½ where secondary (max once per session). Target 2.

### 6.4 Units
`1 lb = 0.45359237 kg`. Display in the exercise's unit, falling back to the Settings unit, rounded to 0.1 (0.25 steps shown exactly). Stored `weight`/`unit` never rewritten.

### 6.5 Backup format
`monolog-backup-YYYY-MM-DD.json` → `{ app: 'monolog', schemaVersion, exportedAt, data: { exercises, sessions, sessionExercises, sets, restDays, bodyEntries, recordEvents, settings } }`. Restore validates, migrates older versions, previews counts, replaces in one transaction.

### 6.6 Migrations
Every schema change = Dexie version bump + upgrade function + Vitest test running it against a fixture of the previous version.

---

## 7. Tech stack

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript (strict) |
| Build | Vite |
| Storage | Dexie.js (+ `dexie-react-hooks` live queries) |
| PWA | `vite-plugin-pwa` (Workbox precache, `registerType: 'prompt'` → "Update ready · Tap to reload") |
| Charts | uPlot |
| Styling | Plain CSS + custom-property tokens (from mockup) |
| Font | `@fontsource-variable/inter` (bundled) |
| Routing | Hash routing (`/#/history`) — GitHub Pages safe |
| Tests | Vitest (+ `fake-indexeddb`) for domain logic & migrations; Playwright (mobile viewport) for F1 |
| CI/CD | GitHub Actions: install → typecheck → test → build → deploy to Pages. **Failing tests block deploy.** |
| Web APIs | Screen Wake Lock (during workout), Vibration, `navigator.storage.persist()`, Web Share (backup/share) |
| Later | Capacitor (Play Store build, local notifications) |

---

## 8. Non-functional requirements
- Works fully offline after first load; installable (manifest, icons, standalone, black theme colour).
- Cold start to Home < 1.5 s on a mid-range Android; logging a set < 50 ms perceived.
- Handles 3+ years of data (≈ 50k sets) without jank on history/charts.
- No network requests at runtime (fonts/assets bundled).
- Accessibility: contrast ≥ 4.5:1 for text (ghost values ≥ 3:1 at 22 px), labelled buttons, reduced-motion support.

---

## 9. Out of scope for Release 1
Onboarding · import from other apps · routines/templates · supersets · RPE/RIR · plate calculator · cloud sync/accounts · paywall · push/scheduled notifications (best-effort only) · localisation.
