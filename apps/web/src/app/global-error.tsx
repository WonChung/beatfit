"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

/** Last-resort recovery UI for failures in the root layout itself. */
export default function GlobalError({ unstable_retry }: GlobalErrorProps) {
  return (
    <html lang="en">
      <head>
        <title>BeatFit error</title>
      </head>
      <body style={styles.body}>
        <main style={styles.shell}>
          <section role="alert" aria-live="assertive" style={styles.card}>
            <p style={styles.eyebrow}>BeatFit</p>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.message}>
              We could not load BeatFit. No private error details have been displayed.
            </p>
            <button type="button" onClick={unstable_retry} style={styles.button}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

const styles = {
  body: {
    margin: 0,
    background: "#101218",
    color: "#101218",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  shell: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    boxSizing: "border-box" as const,
  },
  card: {
    width: "min(100%, 520px)",
    padding: "36px",
    borderRadius: "24px",
    background: "#ffffff",
    boxSizing: "border-box" as const,
  },
  eyebrow: {
    margin: "0 0 12px",
    color: "#3558f4",
    fontSize: "13px",
    fontWeight: 900,
    letterSpacing: ".14em",
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    fontSize: "clamp(34px, 7vw, 52px)",
    letterSpacing: "-.04em",
  },
  message: {
    margin: "16px 0 24px",
    color: "#636978",
    fontSize: "16px",
    lineHeight: 1.6,
  },
  button: {
    minHeight: "52px",
    padding: "0 24px",
    border: 0,
    borderRadius: "999px",
    background: "#3558f4",
    color: "#ffffff",
    font: "inherit",
    fontWeight: 800,
    cursor: "pointer",
  },
};
