import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BeatFit — Song-duration interval workouts",
  description: "Generate deterministic interval workouts that fit selected track durations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body>{children}</body>
    </html>
  );
}
