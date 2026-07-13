# Exercise visual assets

These bundled SVGs are intentionally generic posture silhouettes. Exercise
display names resolve to a posture key in `src/utils/exercise-visual.ts`, and
`src/components/exercise-visual.tsx` owns the static Metro `require()` table.

To replace a placeholder with custom artwork, keep a transparent square
viewBox, preserve strong contrast in both themes, verify the depicted form with
a qualified fitness reviewer, and update only the corresponding static source.
Do not use dynamic asset paths or remote URLs.
