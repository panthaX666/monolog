// Entities, see docs/SPEC.md §6. Dates are ISO strings; DayKey is a local calendar date.

export type ID = string;
/** Local calendar date 'YYYY-MM-DD', fixed when the record is created. */
export type DayKey = string;
export type Unit = 'kg' | 'lb';

export type ExerciseType = 'weight_reps' | 'bodyweight_reps' | 'timed' | 'cardio';

export type Muscle =
  | 'chest'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'traps'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'abs'
  | 'obliques';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'smith'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'ez_bar'
  | 'cardio_machine'
  | 'other';

export interface Exercise {
  id: ID;
  name: string;
  /** Lower-cased, whitespace-collapsed name; unique. */
  nameKey: string;
  type: ExerciseType;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  /** 'compound' | 'isolation' | 'full_body' | custom */
  tags: string[];
  /** Per-exercise unit override; null = follow Settings. */
  unit: Unit | null;
  /** Per-exercise rest length; null = Settings default. */
  restSec: number | null;
  pinnedNote: string;
  isCustom: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface Session {
  id: ID;
  dayKey: DayKey;
  startedAt: string;
  endedAt: string | null;
  repeatedFrom: ID | null;
}

export interface SessionExercise {
  id: ID;
  sessionId: ID;
  exerciseId: ID;
  order: number;
}

export type SetKind = 'warmup' | 'working';

export interface WorkoutSet {
  id: ID;
  sessionExerciseId: ID;
  sessionId: ID;
  exerciseId: ID;
  dayKey: DayKey;
  order: number;
  kind: SetKind;
  toFailure: boolean;
  /** Weight exactly as entered (added weight for bodyweight exercises). */
  weight: number | null;
  unit: Unit;
  /** `weight` normalised to kg, used for comparisons and charts only. */
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  note: string;
  /** null = pre-filled, not logged. Only logged sets count for anything. */
  loggedAt: string | null;
}

export interface RestDay {
  dayKey: DayKey;
  createdAt: string;
}

export interface BodyEntry {
  id: ID;
  dayKey: DayKey;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waistCm: number | null;
  note: string;
}

export type RecordKind = 'weight' | 'reps' | 'duration' | 'distance' | 'pace';

export interface RecordEvent {
  /** Deterministic: `rec:<setId>` (at most one record per set). */
  id: ID;
  setId: ID;
  exerciseId: ID;
  kind: RecordKind;
  before: { value: number; setId: ID; dayKey: DayKey };
  after: { value: number };
  /** For weight/reps kinds: the weight the record was set at (kg). */
  atWeightKg: number | null;
  dayKey: DayKey;
  at: string;
}

export type MetricKey = 'weightKg' | 'bodyFatPct' | 'muscleMassKg' | 'waistCm';

export interface Settings {
  id: 'app';
  unit: Unit;
  weightStep: number;
  restDefaultSec: number;
  restAutoStart: boolean;
  vibration: boolean;
  wakeLock: boolean;
  heightCm: number | null;
  /** 0 = Sunday … 6 = Saturday */
  checkInDay: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  trackedMetrics: MetricKey[];
  lastBackupAt: string | null;
  workoutsSinceBackup: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  unit: 'kg',
  weightStep: 2.5,
  restDefaultSec: 90,
  restAutoStart: false,
  vibration: true,
  wakeLock: true,
  heightCm: null,
  checkInDay: 0,
  trackedMetrics: ['weightKg', 'bodyFatPct', 'muscleMassKg'],
  lastBackupAt: null,
  workoutsSinceBackup: 0,
};
