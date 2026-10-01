import type { Equipment, Exercise, ExerciseType, Muscle } from '../domain/types';

// Starter exercise library. Includes every exercise seen in the old app, under standard names.
// Seed ids are stable (`seed:<slug>`) so backups and future library updates can match them.

type Row = [
  name: string,
  type: ExerciseType,
  primary: Muscle[],
  secondary: Muscle[],
  equipment: Equipment[],
  tags: string[],
];

const WR: ExerciseType = 'weight_reps';
const BW: ExerciseType = 'bodyweight_reps';
const TIMED: ExerciseType = 'timed';
const CARDIO: ExerciseType = 'cardio';
const C = ['compound'];
const I = ['isolation'];
const FB = ['compound', 'full_body'];

const ROWS: Row[] = [
  // Chest
  ['Bench Press', WR, ['chest'], ['triceps', 'front_delts'], ['barbell'], C],
  ['Incline Bench Press', WR, ['chest'], ['front_delts', 'triceps'], ['barbell'], C],
  ['Decline Bench Press', WR, ['chest'], ['triceps'], ['barbell'], C],
  ['Dumbbell Bench Press', WR, ['chest'], ['triceps', 'front_delts'], ['dumbbell'], C],
  ['Incline Dumbbell Press', WR, ['chest'], ['front_delts', 'triceps'], ['dumbbell'], C],
  ['Chest Press', WR, ['chest'], ['triceps', 'front_delts'], ['machine'], C],
  ['Smith Machine Bench Press', WR, ['chest'], ['triceps', 'front_delts'], ['smith'], C],
  ['Pec Fly', WR, ['chest'], ['front_delts'], ['machine'], I],
  ['Dumbbell Fly', WR, ['chest'], ['front_delts'], ['dumbbell'], I],
  ['Cable Crossover', WR, ['chest'], ['front_delts'], ['cable'], I],
  ['Push-up', BW, ['chest'], ['triceps', 'front_delts'], ['bodyweight'], C],
  ['Dip', BW, ['chest', 'triceps'], ['front_delts'], ['bodyweight'], C],

  // Back
  ['Deadlift', WR, ['lower_back', 'glutes', 'hamstrings'], ['lats', 'traps', 'quads', 'forearms'], ['barbell'], FB],
  ['Lat Pulldown', WR, ['lats'], ['biceps', 'rear_delts'], ['cable'], C],
  ['Close-Grip Lat Pulldown', WR, ['lats'], ['biceps'], ['cable'], C],
  ['Seated Cable Row', WR, ['upper_back', 'lats'], ['biceps', 'rear_delts'], ['cable'], C],
  ['Barbell Row', WR, ['upper_back', 'lats'], ['biceps', 'rear_delts', 'lower_back'], ['barbell'], C],
  ['One-Arm Dumbbell Row', WR, ['lats', 'upper_back'], ['biceps', 'rear_delts'], ['dumbbell'], C],
  ['T-Bar Row', WR, ['upper_back', 'lats'], ['biceps', 'rear_delts'], ['barbell'], C],
  ['Machine Row', WR, ['upper_back', 'lats'], ['biceps', 'rear_delts'], ['machine'], C],
  ['Pull-up', BW, ['lats'], ['biceps', 'upper_back'], ['bodyweight'], C],
  ['Chin-up', BW, ['lats', 'biceps'], ['upper_back'], ['bodyweight'], C],
  ['Straight-Arm Pulldown', WR, ['lats'], [], ['cable'], I],
  ['Back Extension', BW, ['lower_back'], ['glutes', 'hamstrings'], ['bodyweight'], I],
  ['Dumbbell Shrug', WR, ['traps'], ['forearms'], ['dumbbell'], I],
  ['Face Pull', WR, ['rear_delts'], ['upper_back', 'traps'], ['cable'], I],

  // Legs
  ['Squat', WR, ['quads', 'glutes'], ['hamstrings', 'lower_back', 'adductors'], ['barbell'], C],
  ['Front Squat', WR, ['quads'], ['glutes', 'upper_back'], ['barbell'], C],
  ['Smith Machine Squat', WR, ['quads', 'glutes'], ['hamstrings', 'adductors'], ['smith'], C],
  ['Leg Press', WR, ['quads', 'glutes'], ['hamstrings', 'adductors'], ['machine'], C],
  ['Hack Squat', WR, ['quads'], ['glutes'], ['machine'], C],
  ['Goblet Squat', WR, ['quads', 'glutes'], ['adductors'], ['dumbbell', 'kettlebell'], C],
  ['Bulgarian Split Squat', WR, ['quads', 'glutes'], ['hamstrings', 'adductors'], ['dumbbell'], C],
  ['Walking Lunge', WR, ['quads', 'glutes'], ['hamstrings'], ['dumbbell'], C],
  ['Romanian Deadlift', WR, ['hamstrings', 'glutes'], ['lower_back'], ['barbell'], C],
  ['Dumbbell Romanian Deadlift', WR, ['hamstrings', 'glutes'], ['lower_back'], ['dumbbell'], C],
  ['Hip Thrust', WR, ['glutes'], ['hamstrings'], ['barbell'], C],
  ['Leg Extension', WR, ['quads'], [], ['machine'], I],
  ['Lying Leg Curl', WR, ['hamstrings'], ['calves'], ['machine'], I],
  ['Seated Leg Curl', WR, ['hamstrings'], [], ['machine'], I],
  ['Standing Calf Raise', WR, ['calves'], [], ['machine'], I],
  ['Seated Calf Raise', WR, ['calves'], [], ['machine'], I],
  ['Hip Adduction', WR, ['adductors'], [], ['machine'], I],
  ['Hip Abduction', WR, ['glutes'], [], ['machine'], I],
  ['Cable Glute Kickback', WR, ['glutes'], ['hamstrings'], ['cable'], I],

  // Shoulders
  ['Shoulder Press', WR, ['front_delts'], ['side_delts', 'triceps'], ['dumbbell'], C],
  ['Overhead Press', WR, ['front_delts'], ['side_delts', 'triceps', 'upper_back'], ['barbell'], C],
  ['Machine Shoulder Press', WR, ['front_delts'], ['side_delts', 'triceps'], ['machine'], C],
  ['Arnold Press', WR, ['front_delts', 'side_delts'], ['triceps'], ['dumbbell'], C],
  ['Dumbbell Lateral Raise', WR, ['side_delts'], [], ['dumbbell'], I],
  ['Cable Lateral Raise', WR, ['side_delts'], [], ['cable'], I],
  ['Machine Lateral Raise', WR, ['side_delts'], [], ['machine'], I],
  ['Front Raise', WR, ['front_delts'], [], ['dumbbell'], I],
  ['Rear Delt Fly', WR, ['rear_delts'], ['upper_back'], ['dumbbell'], I],
  ['Reverse Pec Deck', WR, ['rear_delts'], ['upper_back'], ['machine'], I],
  ['Upright Row', WR, ['side_delts'], ['traps', 'biceps'], ['barbell'], C],

  // Arms
  ['Barbell Curl', WR, ['biceps'], ['forearms'], ['barbell'], I],
  ['EZ-Bar Curl', WR, ['biceps'], ['forearms'], ['ez_bar'], I],
  ['Dumbbell Curl', WR, ['biceps'], ['forearms'], ['dumbbell'], I],
  ['Hammer Curl', WR, ['biceps', 'forearms'], [], ['dumbbell'], I],
  ['Preacher Curl', WR, ['biceps'], [], ['ez_bar'], I],
  ['Cable Curl', WR, ['biceps'], ['forearms'], ['cable'], I],
  ['Incline Dumbbell Curl', WR, ['biceps'], [], ['dumbbell'], I],
  ['Concentration Curl', WR, ['biceps'], [], ['dumbbell'], I],
  ['Rope Tricep Pushdown', WR, ['triceps'], [], ['cable'], I],
  ['Tricep Pushdown', WR, ['triceps'], [], ['cable'], I],
  ['Overhead Cable Tricep Extension', WR, ['triceps'], [], ['cable'], I],
  ['Dumbbell Overhead Tricep Extension', WR, ['triceps'], [], ['dumbbell'], I],
  ['Skull Crusher', WR, ['triceps'], [], ['ez_bar'], I],
  ['Tricep Kickback', WR, ['triceps'], [], ['dumbbell'], I],
  ['Close-Grip Bench Press', WR, ['triceps'], ['chest', 'front_delts'], ['barbell'], C],
  ['Wrist Curl', WR, ['forearms'], [], ['dumbbell'], I],

  // Core
  ['Plank', TIMED, ['abs'], ['obliques'], ['bodyweight'], I],
  ['Side Plank', TIMED, ['obliques'], ['abs'], ['bodyweight'], I],
  ['Sit-up', BW, ['abs'], [], ['bodyweight'], I],
  ['Crunch', BW, ['abs'], [], ['bodyweight'], I],
  ['Decline Crunch', BW, ['abs'], [], ['bodyweight'], I],
  ['Hanging Leg Raise', BW, ['abs'], ['obliques'], ['bodyweight'], I],
  ['Cable Crunch', WR, ['abs'], [], ['cable'], I],
  ['Russian Twist', BW, ['obliques'], ['abs'], ['bodyweight'], I],
  ['Ab Wheel Rollout', BW, ['abs'], ['lats'], ['other'], I],
  ['Dead Hang', TIMED, ['forearms'], ['lats'], ['bodyweight'], I],

  // Full body
  ['Kettlebell Swing', WR, ['glutes', 'hamstrings'], ['lower_back', 'abs'], ['kettlebell'], FB],
  ["Farmer's Carry", TIMED, ['forearms', 'traps'], ['abs', 'glutes'], ['dumbbell'], FB],
  ['Burpee', BW, ['quads', 'chest'], ['abs', 'front_delts'], ['bodyweight'], FB],

  // Cardio (no muscle groups, doesn't count toward weekly coverage)
  ['Treadmill Run', CARDIO, [], [], ['cardio_machine'], ['cardio']],
  ['Outdoor Run', CARDIO, [], [], ['other'], ['cardio']],
  ['Walk', CARDIO, [], [], ['other'], ['cardio']],
  ['Stationary Bike', CARDIO, [], [], ['cardio_machine'], ['cardio']],
  ['Rowing Machine', CARDIO, [], [], ['cardio_machine'], ['cardio']],
  ['Elliptical', CARDIO, [], [], ['cardio_machine'], ['cardio']],
  ['Stair Climber', CARDIO, [], [], ['cardio_machine'], ['cardio']],
  ['Jump Rope', CARDIO, [], [], ['other'], ['cardio']],
];

export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function slug(name: string): string {
  return nameKey(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function seedExercises(createdAt: string): Exercise[] {
  return ROWS.map(([name, type, primaryMuscles, secondaryMuscles, equipment, tags]) => ({
    id: `seed:${slug(name)}`,
    name,
    nameKey: nameKey(name),
    type,
    primaryMuscles,
    secondaryMuscles,
    equipment,
    tags,
    unit: null,
    restSec: null,
    pinnedNote: '',
    isCustom: false,
    archivedAt: null,
    createdAt,
  }));
}
