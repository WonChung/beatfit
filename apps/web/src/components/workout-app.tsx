"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExerciseAnimation } from "@/components/exercise-animation";
import {
  createWorkoutSession,
  generatePersonalizedWorkout,
  getUserPreferences,
  updateWorkoutSessionFeedback,
} from "@/lib/api";
import {
  createWorkoutSummary,
  toWorkoutSessionCreate,
  type WorkoutSummary,
} from "@/lib/completion";
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
import { chooseAllowedEquipment } from "@/lib/preferences";
import { getBrowserAccessToken } from "@/lib/supabase/access-token";
import type {
  Difficulty,
  Equipment,
  FeedbackRating,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  MuscleGroup,
  WorkoutGoal,
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
const GOALS: { label: string; value: WorkoutGoal }[] = [
  { label: "Strength", value: "strength" },
  { label: "Pump", value: "pump" },
  { label: "Endurance", value: "endurance" },
  { label: "Cardio", value: "cardio" },
];

export default function WorkoutApp({ importedSongs = [] }: { importedSongs?: GenerateWorkoutRequest['songs'] }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("chest");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [equipment, setEquipment] = useState<Equipment>("bodyweight");
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>(["bodyweight"]);
  const [goal, setGoal] = useState<WorkoutGoal>("endurance");
  const [title, setTitle] = useState("Song 1");
  const [artist, setArtist] = useState("Test Artist");
  const [minutes, setMinutes] = useState("3");
  const [seconds, setSeconds] = useState("45");
  const [errors, setErrors] = useState<WorkoutFormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preferencesStatus, setPreferencesStatus] = useState<"loading" | "ready" | "error">("loading");
  const [request, setRequest] = useState<GenerateWorkoutRequest | null>(null);
  const [workout, setWorkout] = useState<GenerateWorkoutResponse | null>(null);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRating | null>(null);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const submissionLock = useRef(false);
  const setupTouched = useRef(false);
  const sessionAttempt = useRef(0);

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      try {
        const accessToken = await getBrowserAccessToken();
        const preferences = await getUserPreferences(accessToken);
        if (!active) return;
        setAvailableEquipment(preferences.available_equipment);
        setEquipment((current) => chooseAllowedEquipment(current, preferences.available_equipment) ?? current);
        if (!setupTouched.current) {
          setDifficulty(preferences.default_difficulty);
          setGoal(preferences.preferred_goal);
          if (preferences.available_equipment[0]) setEquipment(preferences.available_equipment[0]);
        }
        setPreferencesStatus("ready");
      } catch {
        if (active) setPreferencesStatus("error");
      }
    }
    void loadPreferences();
    return () => { active = false; };
  }, []);

  const persistFinishedSession = useCallback(async (
    generatedWorkout: GenerateWorkoutResponse,
    finishedSummary: WorkoutSummary,
  ) => {
    const attempt = ++sessionAttempt.current;
    setServerSessionId(null);
    setSessionError(null);
    setFeedback(null);
    setFeedbackError(null);
    setIsSavingSession(true);
    try {
      if (!generatedWorkout.workout_id) {
        throw new Error("This workout has no persisted account reference.");
      }
      const accessToken = await getBrowserAccessToken();
      const saved = await createWorkoutSession(
        toWorkoutSessionCreate(generatedWorkout.workout_id, finishedSummary),
        accessToken,
      );
      if (attempt === sessionAttempt.current) setServerSessionId(saved.id);
    } catch (caught) {
      if (attempt === sessionAttempt.current) {
        setSessionError(caught instanceof Error ? caught.message : "The session could not be saved.");
      }
    } finally {
      if (attempt === sessionAttempt.current) setIsSavingSession(false);
    }
  }, []);

  const handleFinish = useCallback((finishedSummary: WorkoutSummary) => {
    if (!workout) return;
    setSummary(finishedSummary);
    setPhase("complete");
    void persistFinishedSession(workout, finishedSummary);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [persistFinishedSession, workout]);

  async function saveFeedback(rating: FeedbackRating) {
    if (!serverSessionId || isSavingFeedback) return;
    setIsSavingFeedback(true);
    setFeedbackError(null);
    try {
      const accessToken = await getBrowserAccessToken();
      const saved = await updateWorkoutSessionFeedback(serverSessionId, rating, accessToken);
      setFeedback(saved.feedback?.rating ?? rating);
    } catch (caught) {
      setFeedbackError(caught instanceof Error ? caught.message : "Feedback could not be saved.");
    } finally {
      setIsSavingFeedback(false);
    }
  }

  function leaveCompletion(nextPhase: Phase) {
    sessionAttempt.current += 1;
    setIsSavingSession(false);
    setIsSavingFeedback(false);
    setServerSessionId(null);
    setSessionError(null);
    setFeedback(null);
    setFeedbackError(null);
    setSummary(null);
    setPhase(nextPhase);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;
    const validationErrors = importedSongs.length > 0 ? {} : validateWorkoutForm({ title, artist, minutes, seconds });
    setErrors(validationErrors);
    setApiError(null);
    if (Object.keys(validationErrors).length > 0) return;

    const nextRequest: GenerateWorkoutRequest = {
      muscle_group: muscleGroup,
      difficulty,
      equipment: [equipment],
      goal,
      songs: importedSongs.length > 0 ? importedSongs : [{
        title: title.trim(), artist: artist.trim(),
        duration_ms: durationToMilliseconds(minutes, seconds),
      }],
    };
    submissionLock.current = true;
    setIsLoading(true);
    try {
      const accessToken = await getBrowserAccessToken();
      const generated = await generatePersonalizedWorkout(nextRequest, accessToken);
      setRequest(nextRequest);
      setWorkout(generated);
      setSummary(null);
      sessionAttempt.current += 1;
      setIsSavingSession(false);
      setIsSavingFeedback(false);
      setServerSessionId(null);
      setSessionError(null);
      setFeedback(null);
      setFeedbackError(null);
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
        {importedSongs.length > 0 ? <p className="imported-track-notice" role="status">Using {importedSongs.length} selected music track{importedSongs.length === 1 ? '' : 's'}.</p> : null}
        <StepIndicator phase={phase} />
        {phase === "setup" && (
          <SetupForm
            values={{ muscleGroup, difficulty, equipment, goal, title, artist, minutes, seconds }}
            availableEquipment={availableEquipment}
            preferencesStatus={preferencesStatus}
            setters={{
              setMuscleGroup: (value) => { setupTouched.current = true; setMuscleGroup(value); },
              setDifficulty: (value) => { setupTouched.current = true; setDifficulty(value); },
              setEquipment: (value) => { setupTouched.current = true; setEquipment(value); },
              setGoal: (value) => { setupTouched.current = true; setGoal(value); },
              setTitle, setArtist, setMinutes, setSeconds,
            }}
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
            serverSessionId={serverSessionId}
            isSavingSession={isSavingSession}
            sessionError={sessionError}
            feedback={feedback}
            isSavingFeedback={isSavingFeedback}
            feedbackError={feedbackError}
            onFeedback={(rating) => void saveFeedback(rating)}
            onRetrySession={() => void persistFinishedSession(workout, summary)}
            onRepeat={() => leaveCompletion("player")}
            onAnother={() => leaveCompletion("setup")}
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
  try {
    const accessToken = await getBrowserAccessToken();
    setWorkout(await generatePersonalizedWorkout(request, accessToken));
  }
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
  muscleGroup: MuscleGroup; difficulty: Difficulty; equipment: Equipment; goal: WorkoutGoal;
  title: string; artist: string; minutes: string; seconds: string;
};

function SetupForm({ values, availableEquipment, preferencesStatus, setters, errors, apiError, isLoading, onSubmit }: {
  values: SetupValues;
  availableEquipment: Equipment[];
  preferencesStatus: "loading" | "ready" | "error";
  setters: {
    setMuscleGroup: (v: MuscleGroup) => void; setDifficulty: (v: Difficulty) => void;
    setEquipment: (v: Equipment) => void; setTitle: (v: string) => void;
    setGoal: (v: WorkoutGoal) => void; setArtist: (v: string) => void;
    setMinutes: (v: string) => void; setSeconds: (v: string) => void;
  };
  errors: WorkoutFormErrors; apiError: string | null; isLoading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="section-card setup-layout">
    <div className="section-heading"><p className="eyebrow">Workout builder</p><h2>Set your rhythm</h2>
      <p>One song, one focused set. You can adjust everything before you begin.</p></div>
    <form className="setup-form" onSubmit={onSubmit} noValidate>
      {preferencesStatus === "loading" ? <p className="provider-note" role="status">Loading your workout preferences…</p> : null}
      {preferencesStatus === "error" ? <p className="provider-note" role="status">Preferences could not be loaded. BeatFit will use safe defaults.</p> : null}
      <ChoiceField label="Muscle group" value={values.muscleGroup} options={MUSCLE_GROUPS} onChange={setters.setMuscleGroup} />
      <div className="two-columns">
        <ChoiceField label="Difficulty" value={values.difficulty} options={DIFFICULTIES} onChange={setters.setDifficulty} />
        <ChoiceField label="Equipment" value={values.equipment} options={EQUIPMENT.filter((item) => availableEquipment.includes(item.value))} onChange={setters.setEquipment} />
      </div>
      {availableEquipment.length === 0 ? <p className="api-error" role="alert">Add available equipment in Preferences before generating a workout.</p> : null}
      <ChoiceField label="Workout goal" value={values.goal} options={GOALS} onChange={setters.setGoal} />
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
      <button className="primary-button" disabled={isLoading || availableEquipment.length === 0} type="submit">
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
  const [showExplanation, setShowExplanation] = useState(false);
  const canStart = workout.blocks.some((block) => block.intervals.length > 0);
  return <div className="section-card preview-shell"><div className="section-heading"><p className="eyebrow">Ready when you are</p>
    <h2>Workout preview</h2><p>Review every interval before starting the clock.</p></div>
    <div className="config-grid">
      <Config label="Focus" value={formatMuscleGroup(workout.muscle_group)} />
      <Config label="Level" value={readableLabel(workout.difficulty)} />
      <Config label="Equipment" value={workout.equipment.map(readableLabel).join(", ")} />
      <Config label="Goal" value={readableLabel(workout.goal)} />
      <Config label="Duration" value={formatSeconds(getPlannedDurationSeconds(workout))} />
    </div>
    <div className={workout.personalization.personalized ? "personalization-callout adjusted" : "personalization-callout"}>
      <div><small>Personalization</small><strong>{workout.personalization.summary}</strong></div>
      <button type="button" className="text-button" aria-expanded={showExplanation} aria-controls="personalization-explanation"
        onClick={() => setShowExplanation((current) => !current)}>{showExplanation ? "Hide why" : "View why"}</button>
    </div>
    {showExplanation ? <div id="personalization-explanation" className="personalization-details">
      <p><strong>Recent history considered:</strong> {workout.personalization.history_sessions_considered} session{workout.personalization.history_sessions_considered === 1 ? "" : "s"}</p>
      <p><strong>Feedback signal:</strong> {workout.personalization.feedback_signal ? readableLabel(workout.personalization.feedback_signal) : "None yet"}</p>
      {workout.personalization.adjustments.length > 0 ? <ul>{workout.personalization.adjustments.map((adjustment) => <li key={adjustment}>{adjustment}</li>)}</ul> :
        <p>No structure adjustment was needed. Your explicit muscle group, goal, equipment, avoidance, and impact constraints still apply.</p>}
    </div> : null}
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
      onFinish(createWorkoutSummary(
        workout,
        "completed",
        sessionStart.current ?? end,
        end,
        state.completedIndices,
      ));
    }
  }, [onFinish, state.completedIndices, state.status, workout]);

  const current = timeline[state.currentIndex];
  if (!current) return <div className="section-card empty-state">This workout has no playable intervals.</div>;
  const remaining = Math.ceil(getRemainingMs(state, now) / 1000);
  const progress = Math.round(getTimelineProgress(state, timeline, now) * 100);

  function start() { sessionStart.current ??= Date.now(); const time = Date.now(); setNow(time); setState((s) => startTimer(s, time)); }
  function pause() { const time = Date.now(); setNow(time); setState((s) => pauseTimer(s, timeline, time)); }
  function resume() { const time = Date.now(); setNow(time); setState((s) => resumeTimer(s, time)); }
  function skip() { const time = Date.now(); setNow(time); setState((s) => skipInterval(s, timeline, time)); }
  function end() {
    const time = Date.now();
    const currentState = reconcileTimer(state, timeline, time);
    onFinish(createWorkoutSummary(
      workout,
      currentState.status === "completed" ? "completed" : "ended_early",
      sessionStart.current ?? time,
      time,
      currentState.completedIndices,
    ));
  }

  return <div className="section-card player-shell"><div className="player-top"><div><p className="eyebrow">Song {current.blockIndex + 1} of {workout.blocks.length}</p>
    <h2>{current.songTitle}</h2><p>{current.artist}</p></div><span className={`type-pill ${current.interval.type}`}>{readableLabel(current.interval.type)}</span></div>
    <div className="countdown"><p>Current exercise</p><h3>{current.interval.exercise}</h3>
      <ExerciseAnimation
        exerciseId={current.interval.exercise_id}
        exerciseName={current.interval.exercise}
        size={260}
        isPaused={state.status !== "running"}
        intervalType={current.interval.type}
      />
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

function CompletionSummary({
  workout, summary, serverSessionId, isSavingSession, sessionError,
  feedback, isSavingFeedback, feedbackError, onFeedback, onRetrySession,
  onRepeat, onAnother,
}: {
  workout: GenerateWorkoutResponse;
  summary: WorkoutSummary;
  serverSessionId: string | null;
  isSavingSession: boolean;
  sessionError: string | null;
  feedback: FeedbackRating | null;
  isSavingFeedback: boolean;
  feedbackError: string | null;
  onFeedback: (rating: FeedbackRating) => void;
  onRetrySession: () => void;
  onRepeat: () => void;
  onAnother: () => void;
}) {
  const completed = summary.status === "completed";
  return <div className="section-card completion-shell"><div className={completed ? "completion-icon success" : "completion-icon early"}>{completed ? "✓" : "■"}</div>
    <div className="section-heading centered"><p className="eyebrow">{completed ? "Workout complete" : "Workout ended early"}</p>
      <h2>{completed ? "Strong finish." : "Progress still counts."}</h2><p>{formatMuscleGroup(workout.muscle_group)} · {readableLabel(workout.difficulty)}</p></div>
    <div className="summary-grid"><Config label="Planned" value={formatSeconds(summary.plannedDurationSeconds)} />
      <Config label="Actual" value={formatSeconds(Math.round(summary.actualDurationSeconds))} />
      <Config label="Intervals" value={`${summary.completedIntervals} / ${summary.totalIntervals}`} />
      <Config label="Completion" value={`${Math.round(summary.completionPercentage)}%`} /></div>
    <section className="feedback-card" aria-labelledby="difficulty-feedback-heading">
      <p className="eyebrow">Help tune the next one</p>
      <h3 id="difficulty-feedback-heading">How did the difficulty feel?</h3>
      {isSavingSession ? <p role="status">Saving your workout session…</p> : null}
      {sessionError ? <div className="feedback-error"><p className="api-error" role="alert">Your workout is still shown here, but its session could not be saved: {sessionError}</p>
        <button className="secondary-button" type="button" onClick={onRetrySession}>Retry saving session</button></div> : null}
      <div className="feedback-options" aria-label="Workout difficulty feedback">
        {([
          ["too_easy", "Too easy"],
          ["about_right", "About right"],
          ["too_hard", "Too hard"],
        ] as const).map(([rating, label]) => <button type="button" key={rating}
          className={feedback === rating ? "choice selected" : "choice"}
          aria-pressed={feedback === rating}
          disabled={!serverSessionId || isSavingSession || isSavingFeedback}
          onClick={() => onFeedback(rating)}>{label}</button>)}
      </div>
      {serverSessionId && !feedback && !isSavingFeedback ? <p className="provider-note">Feedback is optional and helps only after a consistent recent trend.</p> : null}
      {isSavingFeedback ? <p role="status">Saving feedback…</p> : null}
      {feedback ? <p className="success-notice" role="status">Feedback saved: {readableLabel(feedback)}.</p> : null}
      {feedbackError ? <p className="api-error" role="alert">{feedbackError}</p> : null}
    </section>
    <div className="action-row centered-actions"><button className="primary-button" onClick={onRepeat}>Repeat workout</button>
      <button className="secondary-button" onClick={onAnother}>Generate another</button></div>
  </div>;
}
