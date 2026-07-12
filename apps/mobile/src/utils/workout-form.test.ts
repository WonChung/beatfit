import { describe, expect, it } from '@jest/globals';

import { durationToMilliseconds, validateWorkoutForm } from './workout-form';

describe('durationToMilliseconds', () => {
  it('converts minutes and seconds to milliseconds', () => {
    expect(durationToMilliseconds('3', '45')).toBe(225_000);
  });

  it('treats empty duration fields as zero', () => {
    expect(durationToMilliseconds('', '')).toBe(0);
  });
});

describe('validateWorkoutForm', () => {
  const validValues = {
    title: 'Song 1',
    artist: 'Test Artist',
    minutes: '3',
    seconds: '45',
  };

  it('accepts a valid form', () => {
    expect(validateWorkoutForm(validValues)).toEqual({});
  });

  it('requires a non-blank song title', () => {
    expect(validateWorkoutForm({ ...validValues, title: '  ' }).title).toBe(
      'Song title is required.'
    );
  });

  it('requires a duration greater than zero', () => {
    expect(validateWorkoutForm({ ...validValues, minutes: '0', seconds: '0' }).duration).toBe(
      'Duration must be greater than zero.'
    );
  });

  it.each(['60', '99'])('rejects seconds outside 0 through 59 (%s)', (seconds) => {
    expect(validateWorkoutForm({ ...validValues, seconds }).seconds).toBe(
      'Seconds must be between 0 and 59.'
    );
  });

  it('rejects non-numeric duration input', () => {
    const errors = validateWorkoutForm({ ...validValues, minutes: '-1', seconds: 'abc' });
    expect(errors.minutes).toBe('Minutes must be a whole number.');
    expect(errors.seconds).toBe('Seconds must be a whole number between 0 and 59.');
  });
});
