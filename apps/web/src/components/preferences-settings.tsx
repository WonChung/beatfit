"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getUserPreferences,
  listExercises,
  resetPersonalization,
  updateUserPreferences,
} from "@/lib/api";
import {
  DEFAULT_PREFERENCE_VALUES,
  getConflictingExerciseIds,
  toPreferencesUpdate,
} from "@/lib/preferences";
import { getBrowserAccessToken } from "@/lib/supabase/access-token";
import type {
  Difficulty,
  Equipment,
  Exercise,
  UserPreferencesUpdate,
  WorkoutGoal,
  WorkRestPreference,
} from "@/types/workout";

const DIFFICULTIES: { label: string; value: Difficulty }[] = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];
const EQUIPMENT: { label: string; value: Equipment }[] = [
  { label: "Bodyweight", value: "bodyweight" },
  { label: "Dumbbells", value: "dumbbells" },
  { label: "Gym", value: "gym" },
];
const GOALS: { label: string; value: WorkoutGoal }[] = [
  { label: "Strength", value: "strength" },
  { label: "Pump", value: "pump" },
  { label: "Endurance", value: "endurance" },
  { label: "Cardio", value: "cardio" },
];
const WORK_REST: { label: string; description: string; value: WorkRestPreference }[] = [
  { label: "Balanced", description: "Keep work and recovery evenly paced.", value: "balanced" },
  { label: "More work", description: "Favor slightly longer work intervals.", value: "more_work" },
  { label: "More rest", description: "Favor slightly more recovery time.", value: "more_rest" },
];

export default function PreferencesSettings() {
  const [values, setValues] = useState<UserPreferencesUpdate>(DEFAULT_PREFERENCE_VALUES);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const accessToken = await getBrowserAccessToken();
        const [preferences, exerciseCatalog] = await Promise.all([
          getUserPreferences(accessToken),
          listExercises(),
        ]);
        if (!active) return;
        setValues(toPreferencesUpdate(preferences));
        setExercises(exerciseCatalog.slice().sort((a, b) => a.name.localeCompare(b.name)));
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const exerciseNames = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise.name])),
    [exercises],
  );
  const conflicts = getConflictingExerciseIds(values);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (values.available_equipment.length === 0) {
      setError("Select at least one available equipment option.");
      return;
    }
    setIsSaving(true);
    try {
      const accessToken = await getBrowserAccessToken();
      const saved = await updateUserPreferences(values, accessToken);
      setValues(toPreferencesUpdate(saved));
      setNotice("Preferences saved. Future workouts will respect these choices.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm("Reset feedback-based personalization? Your saved preferences will stay the same.")) return;
    setError(null);
    setNotice(null);
    setIsResetting(true);
    try {
      const accessToken = await getBrowserAccessToken();
      const resetPreferences = await resetPersonalization(accessToken);
      setValues(toPreferencesUpdate(resetPreferences));
      setNotice("Personalization history reset. New feedback will start a fresh trend.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setIsResetting(false);
    }
  }

  return <main className="settings-shell">
    <header className="settings-header">
      <div><p className="eyebrow">BeatFit preferences</p><h1>Personalize your workouts</h1>
        <p>These are durable guardrails. Recent feedback may make small, explainable adjustments inside them.</p></div>
      <Link className="secondary-button settings-back" href="/dashboard">Back to dashboard</Link>
    </header>

    {isLoading ? <div className="section-card settings-state" role="status">Loading preferences…</div> :
      <form className="section-card preferences-form" onSubmit={save} noValidate>
        <PreferenceChoices label="Default difficulty" value={values.default_difficulty} options={DIFFICULTIES}
          onChange={(default_difficulty) => setValues((current) => ({ ...current, default_difficulty }))} />

        <fieldset className="preference-section"><legend>Available equipment</legend>
          <p>Workout setup will only offer equipment you select here.</p>
          <div className="checkbox-grid">{EQUIPMENT.map((item) => <label key={item.value}>
            <input type="checkbox" checked={values.available_equipment.includes(item.value)}
              onChange={() => setValues((current) => ({ ...current, available_equipment: toggle(current.available_equipment, item.value) }))} />
            <span>{item.label}</span>
          </label>)}</div>
        </fieldset>

        <PreferenceChoices label="Preferred workout goal" value={values.preferred_goal} options={GOALS}
          onChange={(preferred_goal) => setValues((current) => ({ ...current, preferred_goal }))} />

        <div className="preference-two-columns">
          <ExerciseSelect label="Avoided exercises" hint="These are always excluded, even if also marked as a favorite."
            selected={values.avoided_exercise_ids} exercises={exercises}
            onChange={(avoided_exercise_ids) => setValues((current) => ({ ...current, avoided_exercise_ids }))} />
          <ExerciseSelect label="Favorite exercises" hint="BeatFit favors these when they fit the workout's hard constraints."
            selected={values.favorite_exercise_ids} exercises={exercises}
            onChange={(favorite_exercise_ids) => setValues((current) => ({ ...current, favorite_exercise_ids }))} />
        </div>
        {conflicts.length > 0 ? <p className="preference-warning" role="status">
          Avoided wins for: {conflicts.map((id) => exerciseNames.get(id) ?? id).join(", ")}.
        </p> : null}

        <fieldset className="preference-section"><legend>Impact</legend>
          <label className="switch-row"><input type="checkbox" checked={values.high_impact_allowed}
            onChange={(event) => setValues((current) => ({ ...current, high_impact_allowed: event.target.checked }))} />
            <span><strong>Allow high-impact movements</strong><small>Turn off to exclude jumps and similar high-impact exercises.</small></span>
          </label>
        </fieldset>

        <fieldset className="preference-section"><legend>Preferred work/rest intensity</legend>
          <div className="stacked-options">{WORK_REST.map((item) => <label key={item.value}>
            <input type="radio" name="work-rest" value={item.value} checked={values.work_rest_preference === item.value}
              onChange={() => setValues((current) => ({ ...current, work_rest_preference: item.value }))} />
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
          </label>)}</div>
        </fieldset>

        {error ? <p className="api-error" role="alert">{error}</p> : null}
        {notice ? <p className="success-notice" role="status">{notice}</p> : null}
        <div className="action-row">
          <button className="primary-button" type="submit" disabled={isSaving || isResetting}>{isSaving ? "Saving…" : "Save preferences"}</button>
          <button className="danger-button" type="button" disabled={isSaving || isResetting} onClick={() => void reset()}>{isResetting ? "Resetting…" : "Reset personalization"}</button>
        </div>
      </form>}
  </main>;
}

function PreferenceChoices<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  const name = label.toLowerCase().replaceAll(" ", "-");
  return <fieldset className="preference-section"><legend>{label}</legend><div className="choice-grid">
    {options.map((option) => <label className={value === option.value ? "choice selected" : "choice"} key={option.value}>
      <input className="sr-only" type="radio" name={name} value={option.value} checked={value === option.value}
        onChange={() => onChange(option.value)} />{option.label}
    </label>)}
  </div></fieldset>;
}

function ExerciseSelect({ label, hint, selected, exercises, onChange }: {
  label: string;
  hint: string;
  selected: string[];
  exercises: Exercise[];
  onChange: (ids: string[]) => void;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return <div className="exercise-picker"><label htmlFor={id}>{label}</label><p id={`${id}-hint`}>{hint}</p>
    <select id={id} multiple value={selected} aria-describedby={`${id}-hint`} size={Math.min(9, Math.max(5, exercises.length))}
      onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}>
      {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name} · {exercise.primary_muscle_group.replace("_", " ")}</option>)}
    </select><small>Use Ctrl/Command or Shift to select multiple exercises.</small>
  </div>;
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
