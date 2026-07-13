"use client";

type AppErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

/**
 * Segment-level recovery UI. Exception messages are intentionally omitted
 * because client-side errors can contain request data or provider credentials.
 */
export default function AppError({ unstable_retry }: AppErrorProps) {
  return (
    <main className="error-shell">
      <section className="error-card" role="alert" aria-live="assertive">
        <p className="eyebrow">BeatFit</p>
        <h1>Something went wrong</h1>
        <p>We could not load this page. No private error details have been displayed.</p>
        <button className="primary-button" type="button" onClick={unstable_retry}>
          Try again
        </button>
      </section>
    </main>
  );
}
