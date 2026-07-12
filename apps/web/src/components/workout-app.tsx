"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateWorkout } from "@/lib/api";
import { createWorkoutSummary, type WorkoutSummary } from "@/lib/completion";
import { durationToMilliseconds, validateWorkoutForm, type WorkoutFormErrors } from "@/lib/form";
import {
  formatMuscleGroup,
  formatSeconds,
  getPlannedDurationSeconds,
  readableLabel,
} from "@/lib/format";
import {
  buildTimeline,
  createTimerState,
  getRemainingMs,
  getTimelineProgress,
  pauseTimer,
  reconcileTimer,
  resumeTimer,
  skipInterval,
  startTimer,
  type TimerStatus,
} from "@/lib/timer";
import type {
  Difficulty,
  Equipment,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  MuscleGroup,
} from "@/types/workout";

type Phase = "setup" | "preview" | "player" | "complete";

const MUSCLE_GROUPS: { label: string; value: MuscleGroup }[] = [
  { label: "Chest", value: "chest" }, { label: "Back", value: "back" },
  { label: "Legs", value: "legs" }, { label: "Shoulders", value: "shoulders" },
  { label: "Arms", value: "arms" }, { label: "Core", value: "core" },
  { label: "Full body", value: "full_body" },
];
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

export default function WorkoutApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("chest");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [equipment, setEquipment] = useState<Equipment>("bodyweight");
  const [title, setTitle] = useState("Song 1");
  const [artist, setArtist] = useState("Test Artist");
  const [minutes, setMinutes] = useState("3");
  const [seconds, setSeconds] = useState("45");
  const [errors, setErrors] = useState<WorkoutFormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [request, setRequest] = useState<GenerateWorkoutRequest | null>(null);
  const [workout, setWorkout] = useState<GenerateWorkoutResponse | null>(null);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const submissionLock = useRef(false);

  const handleFinish = useCallback((finishedSummary: WorkoutSummary) => {
    setSummary(finishedSummary);
    setPhase("complete");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;
    const validationErrors = validateWorkoutForm({ title, artist, minutes, seconds });
    setErrors(validationErrors);
    setApiError(null);
    if (Object.keys(validationErrors).length > 0) return;

    const nextRequest: GenerateWorkoutRequest = {
      muscle_group: muscleGroup,
      difficulty,
      equipment: [equipment],
      songs: [{
        title: title.trim(), artist: artist.trim(),
        duration_ms: durationToMilliseconds(minutes, seconds),
      }],
    };
    submissionLock.current = true;
    setIsLoading(true);
    try {
      const generated = await generateWorkout(nextRequest);
      setRequest(nextRequest);
      setWorkout(generated);
      setSummary(null);
      setPhase("preview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caughtError) {
      setApiError(caughtError instanceof Error ? caughtError.message : "Unexpected API error.");
    } finally {
      submissionLock.current = false;
      setIsLoading(false);
    }
  }

  return (
    <main>
      <section className="hero-shell">
        <nav className="topbar" aria-label="Primary navigation">
          <button className="brand" onClick={() => setPhase("setup")}>BeatFit</button>
          <a className="nav-link" href="#workout-builder">Build workout</a>
        </nav>
        <div className="hero-grid">
          <div>
            <p className="eyebrow">Music-powered movement</p>
            <h1>Every song becomes<br /><span>a workout set.</span></h1>
            <p className="hero-copy">
              Pick your focus, choose a track, and BeatFit builds a timed routine that moves with it.
            </p>
            <a className="hero-cta" href="#workout-builder">Create your workout <span>→</span></a>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orb orb-one" /><div className="orb orb-two" />
            <div className="track-card">
              <div className="track-art">BF</div>
              <div><strong>3:45 Session</strong><small>Chest · Intermediate</small></div>
              <div className="equalizer"><i /><i /><i /><i /><i /></div>
            </div>
          </div>
        </div>
      </section>

      <section id="workout-builder" className="app-shell" aria-live="polite">
        <StepIndicator phase={phase} />
        {phase === "setup" && (
          <SetupForm
            values={{ muscleGroup, difficulty, equipment, title, artist, minutes, seconds }}
            setters={{ setMuscleGroup, setDifficulty, setEquipment, setTitle, setArtist, setMinutes, setSeconds }}
            errors={errors} apiError={apiError} isLoading={isLoading} onSubmit={handleSubmit}
          />
        )}
        {phase === "preview" && workout && request && (
          <WorkoutPreview
            workout={workout}
            onStart={() => setPhase("player")}
            onEdit={() => setPhase("setup")}
            onRegenerate={() => void regenerate(request, setWorkout, setApiError, setIsLoading)}
            isLoading={isLoading} error={apiError}
          />
        )}
        {phase === "player" && workout && (
          <WorkoutPlayer workout={workout} onFinish={handleFinish} />
        )}
        {phase === "complete" && workout && summary && (
          <CompletionSummary
            workout={workout} summary={summary}
            onRepeat={() => { setSummary(null); setPhase("player"); }}
            onAnother={() => setPhase("setup")}
          />
        )}
      </section>
    </main>
  );
}

async function regenerate(
  request: GenerateWorkoutRequest,
  setWorkout: (value: GenerateWorkoutResponse) => void,
  setError: (value: string | null) => void,
  setLoading: (value: boolean) => void,
) {
  setLoading(true); setError(null);
  try { setWorkout(await generateWorkout(request)); }
  catch (error) { setError(error instanceof Error ? error.message : "Unexpected API error."); }
  finally { setLoading(false); }
}

function StepIndicator({ phase }: { phase: Phase }) {
  const steps: { key: Phase; label: string }[] = [
    { key: "setup", label: "Setup" }, { key: "preview", label: "Preview" },
    { key: "player", label: "Workout" }, { key: "complete", label: "Complete" },
  ];
  const current = steps.findIndex((step) => step.key === phase);
  return <ol className="steps" aria-label="Workout progress">
    {steps.map((step, index) => <li key={step.key} className={index <= current ? "active" : ""}>
      <span>{index + 1}</span>{step.label}
    </li>)}
  </ol>;
}

type SetupValues = {
  muscleGroup: MuscleGroup; difficulty: Difficulty; equipment: Equipment;
  title: string; artist: string; minutes: string; seconds: string;
};

function SetupForm({ values, setters, errors, apiError, isLoading, onSubmit }: {
  values: SetupValues;
  setters: {
    setMuscleGroup: (v: MuscleGroup) => void; setDifficulty: (v: Difficulty) => void;
    setEquipment: (v: Equipment) => void; setTitle: (v: string) => void;
    setArtist: (v: string) => void; setMinutes: (v: string) => void; setSeconds: (v: string) => void;
  };
  errors: WorkoutFormErrors; apiError: string | null; isLoading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="section-card setup-layout">
    <div className="section-heading"><p className="eyebrow">Workout builder</p><h2>Set your rhythm</h2>
      <p>One song, one focused set. You can adjust everything before you begin.</p></div>
    <form className="setup-form" onSubmit={onSubmit} noValidate>
      <ChoiceField label="Muscle group" value={values.muscleGroup} options={MUSCLE_GROUPS} onChange={setters.setMuscleGroup} />
      <div className="two-columns">
        <ChoiceField label="Difficulty" value={values.difficulty} options={DIFFICULTIES} onChange={setters.setDifficulty} />
        <ChoiceField label="Equipment" value={values.equipment} options={EQUIPMENT} onChange={setters.setEquipment} />
      </div>
      <div className="two-columns">
        <TextField id="song-title" label="Song title" value={values.title} onChange={setters.setTitle} error={errors.title} />
        <TextField id="artist" label="Artist" value={values.artist} onChange={setters.setArtist} error={errors.artist} />
      </div>
      <fieldset className="field-group"><legend>Duration</legend><div className="duration-fields">
        <TextField id="minutes" label="Minutes" hideLabel value={values.minutes} onChange={setters.setMinutes} error={errors.minutes} inputMode="numeric" />
        <span aria-hidden="true">:</span>
        <TextField id="seconds" label="Seconds" hideLabel value={values.seconds} onChange={setters.setSeconds} error={errors.seconds} inputMode="numeric" />
      </div>{errors.duration && <p className="field-error" role="alert">{errors.duration}</p>}</fieldset>
      {apiError && <p className="api-error" role="alert">{apiError}</p>}
      <button className="primary-button" disabled={isLoading} type="submit">
        {isLoading ? "Generating…" : "Generate workout"}<span aria-hidden="true">→</span>
      </button>
    </form>
  </div>;
}

function ChoiceField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { label: string; value: T }[]; onChange: (value: T) => void;
}) {
  return <fieldset className="field-group"><legend>{label}</legend><div className="choice-grid">
    {options.map((option) => <button key={option.value} type="button"
      aria-pressed={value === option.value} className={value === option.value ? "choice selected" : "choice"}
      onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div></fieldset>;
}

function TextField({ id, label, value, onChange, error, inputMode, hideLabel = false }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  error?: string; inputMode?: "numeric"; hideLabel?: boolean;
}) {
  return <div className="text-field"><label className={hideLabel ? "sr-only" : ""} htmlFor={id}>{label}</label>
    <input id={id} value={value} inputMode={inputMode} placeholder={label} aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />
    {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}</div>;
}

function WorkoutPreview({ workout, onStart, onEdit, onRegenerate, isLoading, error }: {
  workout: GenerateWorkoutResponse; onStart: () => void; onEdit: () => void;
  onRegenerate: () => void; isLoading: boolean; error: string | null;
}) {
  const canStart = workout.blocks.some((block) => block.intervals.length > 0);
  return <div className="section-card preview-shell"><div className="section-heading"><p className="eyebrow">Ready when you are</p>
    <h2>Workout preview</h2><p>Review every interval before starting the clock.</p></div>
    <div className="config-grid">
      <Config label="Focus" value={formatMuscleGroup(workout.muscle_group)} />
      <Config label="Level" value={readableLabel(workout.difficulty)} />
      <Config label="Equipment" value={workout.equipment.map(readableLabel).join(", ")} />
      <Config label="Duration" value={formatSeconds(getPlannedDurationSeconds(workout))} />
    </div>
    {workout.blocks.length === 0 ? <p className="empty-state">No workout blocks were returned.</p> :
      workout.blocks.map((block, blockIndex) => <article className="song-block" key={`${block.song.title}-${blockIndex}`}>
        <header><div><small>Song {blockIndex + 1}</small><h3>{block.song.title}</h3><p>{block.song.artist}</p></div>
          <strong>{formatSeconds(block.duration_seconds)}</strong></header>
        {block.intervals.length === 0 ? <p className="empty-state">No intervals for this song.</p> :
          <div className="interval-table" role="table" aria-label={`Intervals for ${block.song.title}`}>
            {block.intervals.map((interval, index) => <div className={`interval-row ${interval.type}`} role="row" key={`${interval.start_seconds}-${index}`}>
              <span className="interval-time">{formatSeconds(interval.start_seconds)}–{formatSeconds(interval.end_seconds)}</span>
              <span className="interval-type">{readableLabel(interval.type)}</span><strong>{interval.exercise}</strong>
            </div>)}
          </div>}
      </article>)}
    {error && <p className="api-error" role="alert">{error}</p>}
    <div className="action-row"><button className="primary-button" disabled={!canStart} onClick={onStart}>Start workout →</button>
      <button className="secondary-button" disabled={isLoading} onClick={onRegenerate}>{isLoading ? "Generating…" : "Generate again"}</button>
      <button className="text-button" onClick={onEdit}>Edit setup</button></div>
  </div>;
}

function Config({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}

function WorkoutPlayer({ workout, onFinish }: {
  workout: GenerateWorkoutResponse; onFinish: (summary: WorkoutSummary) => void;
}) {
  const timeline = useMemo(() => buildTimeline(workout), [workout]);
  const [state, setState] = useState(() => createTimerState(timeline));
  const [now, setNow] = useState(Date.now);
  const sessionStart = useRef<number | null>(null);
  const completionSent = useRef(false);

  useEffect(() => {
    if (state.status !== "running") return;
    const timer = window.setInterval(() => {
      const timestamp = Date.now(); setNow(timestamp);
      setState((current) => reconcileTimer(current, timeline, timestamp));
    }, 100);
    return () => window.clearInterval(timer);
  }, [state.status, timeline]);

  useEffect(() => {
    if (state.status === "completed" && !completionSent.current) {
      completionSent.current = true;
      const end = Date.now();
      onFinish(createWorkoutSummary(workout, "completed", (end - (sessionStart.current ?? end)) / 1000, state.completedIndices.length));
    }
  }, [onFinish, state.completedIndices.length, state.status, workout]);

  const current = timeline[state.currentIndex];
  if (!current) return <div className="section-card empty-state">This workout has no playable intervals.</div>;
  const remaining = Math.ceil(getRemainingMs(state, now) / 1000);
  const progress = Math.round(getTimelineProgress(state, timeline, now) * 100);

  function start() { sessionStart.current ??= Date.now(); const time = Date.now(); setNow(time); setState((s) => startTimer(s, time)); }
  function pause() { const time = Date.now(); setNow(time); setState((s) => pauseTimer(s, timeline, time)); }
  function resume() { const time = Date.now(); setNow(time); setState((s) => resumeTimer(s, time)); }
  function skip() { const time = Date.now(); setNow(time); setState((s) => skipInterval(s, timeline, time)); }
  function end() { const time = Date.now(); onFinish(createWorkoutSummary(workout, "ended_early", (time - (sessionStart.current ?? time)) / 1000, state.completedIndices.length)); }

  return <div className="section-card player-shell"><div className="player-top"><div><p className="eyebrow">Song {current.blockIndex + 1} of {workout.blocks.length}</p>
    <h2>{current.songTitle}</h2><p>{current.artist}</p></div><span className={`type-pill ${current.interval.type}`}>{readableLabel(current.interval.type)}</span></div>
    <div className="countdown"><p>Current exercise</p><h3>{current.interval.exercise}</h3>
      <output aria-label={`${remaining} seconds remaining`}>{formatSeconds(remaining)}</output><small>remaining</small></div>
    <div className="progress-label"><span>Workout progress</span><strong>{progress}%</strong></div>
    <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
    <div className="next-card"><small>Up next</small><strong>{timeline[state.currentIndex + 1]?.interval.exercise ?? "Workout complete"}</strong></div>
    <div className="action-row player-actions"><TimerButton status={state.status} start={start} pause={pause} resume={resume} />
      <button className="secondary-button" onClick={skip}>Skip interval</button><button className="danger-button" onClick={end}>End workout</button></div>
  </div>;
}

function TimerButton({ status, start, pause, resume }: { status: TimerStatus; start: () => void; pause: () => void; resume: () => void }) {
  const action = status === "ready" ? ["Start", start] as const : status === "paused" ? ["Resume", resume] as const : ["Pause", pause] as const;
  return <button className="primary-button" onClick={action[1]}>{action[0]}</button>;
}

function CompletionSummary({ workout, summary, onRepeat, onAnother }: {
  workout: GenerateWorkoutResponse; summary: WorkoutSummary; onRepeat: () => void; onAnother: () => void;
}) {
  const completed = summary.status === "completed";
  return <div className="section-card completion-shell"><div className={completed ? "completion-icon success" : "completion-icon early"}>{completed ? "✓" : "■"}</div>
    <div className="section-heading centered"><p className="eyebrow">{completed ? "Workout complete" : "Workout ended early"}</p>
      <h2>{completed ? "Strong finish." : "Progress still counts."}</h2><p>{formatMuscleGroup(workout.muscle_group)} · {readableLabel(workout.difficulty)}</p></div>
    <div className="summary-grid"><Config label="Planned" value={formatSeconds(summary.plannedDurationSeconds)} />
      <Config label="Actual" value={formatSeconds(Math.round(summary.actualDurationSeconds))} />
      <Config label="Intervals" value={`${summary.completedIntervals} / ${summary.totalIntervals}`} />
      <Config label="Completion" value={`${Math.round(summary.completionPercentage)}%`} /></div>
    <div className="action-row centered-actions"><button className="primary-button" onClick={onRepeat}>Repeat workout</button>
      <button className="secondary-button" onClick={onAnother}>Generate another</button></div>
  </div>;
}
