import { describe, expect, it } from "vitest";
import { durationToMilliseconds, validateWorkoutForm } from "./form";

const valid = { title: "Song", artist: "Artist", minutes: "3", seconds: "45" };

describe("workout form", () => {
  it("converts duration to milliseconds", () => {
    expect(durationToMilliseconds("3", "45")).toBe(225_000);
  });

  it("validates required title, positive duration, and seconds range", () => {
    expect(validateWorkoutForm({ ...valid, title: " " }).title).toBeTruthy();
    expect(validateWorkoutForm({ ...valid, minutes: "0", seconds: "0" }).duration).toBeTruthy();
    expect(validateWorkoutForm({ ...valid, seconds: "60" }).seconds).toBeTruthy();
  });

  it("accepts a valid form", () => {
    expect(validateWorkoutForm(valid)).toEqual({});
  });
});
