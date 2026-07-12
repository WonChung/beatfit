export interface WorkoutFormValues {
  title: string;
  artist: string;
  minutes: string;
  seconds: string;
}

export type WorkoutFormErrors = Partial<
  Record<keyof WorkoutFormValues | "duration", string>
>;

const WHOLE_NUMBER = /^\d+$/;

export function validateWorkoutForm(values: WorkoutFormValues): WorkoutFormErrors {
  const errors: WorkoutFormErrors = {};
  if (!values.title.trim()) errors.title = "Song title is required.";
  if (!values.artist.trim()) errors.artist = "Artist is required.";
  if (!isWholeNumberOrEmpty(values.minutes)) {
    errors.minutes = "Minutes must be a whole number.";
  }
  if (!isWholeNumberOrEmpty(values.seconds)) {
    errors.seconds = "Seconds must be a whole number between 0 and 59.";
  } else if (parseNumber(values.seconds) > 59) {
    errors.seconds = "Seconds must be between 0 and 59.";
  }
  if (
    !errors.minutes &&
    !errors.seconds &&
    durationToMilliseconds(values.minutes, values.seconds) <= 0
  ) {
    errors.duration = "Duration must be greater than zero.";
  }
  return errors;
}

export function durationToMilliseconds(minutes: string, seconds: string): number {
  return (parseNumber(minutes) * 60 + parseNumber(seconds)) * 1000;
}

function isWholeNumberOrEmpty(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || WHOLE_NUMBER.test(trimmed);
}

function parseNumber(value: string): number {
  const trimmed = value.trim();
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : 0;
}
