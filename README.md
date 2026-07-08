# BeatFit

BeatFit is a music-based workout app that generates timed workouts from songs or playlists.

The user selects a muscle group, difficulty, equipment, and song or playlist. BeatFit then creates a workout block for each song, with timed warmups, exercises, rests, and burnout intervals.

## Product Concept

Every song becomes a workout set.

Example:

```text
Song: 3:45
Muscle Group: Chest
Difficulty: Intermediate

0:00 - 0:30   Warmup
0:30 - 1:15   Push-Ups
1:15 - 1:35   Rest
1:35 - 2:20   Diamond Push-Ups
2:20 - 2:40   Rest
2:40 - 3:45   Push-Up Hold / Burnout
```

## Planned Platforms

- iPhone app
- Android app
- Website

## Current Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native + Expo |
| Web App | Next.js |
| Backend | FastAPI |
| Database | PostgreSQL, planned |
| Auth | Supabase Auth or Clerk, planned |
| Music Integrations | Apple Music first, Spotify later |

## Repository Structure

```text
beatfit/
  apps/
    mobile/     # React Native / Expo app
    web/        # Next.js web app
  backend/      # FastAPI backend, planned
  README.md
  .gitignore
```

## Current Status

The project is in early MVP setup.

Completed:

- GitHub repository created
- Project renamed to BeatFit
- Expo mobile app initialized
- Next.js web app initialized
- `.gitignore` configured for monorepo development

Next:

- Create FastAPI backend
- Build workout generator endpoint
- Connect mobile app to backend
- Add workout timer UI
- Add Apple Music playlist import later
- Add Spotify playlist import later

## Running the Web App

From the project root:

```bash
cd apps/web
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Running the Mobile App

From the project root:

```bash
cd apps/mobile
npx expo start
```

Then choose one of the Expo options:

```text
w = open web preview
i = open iOS simulator
a = open Android emulator
```

Or scan the QR code with the Expo Go app.

## Backend Setup

Backend setup is planned next.

Expected backend path:

```text
backend/app/main.py
```

Planned backend commands:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install "fastapi[standard]"
fastapi dev app/main.py
```

Expected API docs URL:

```text
http://127.0.0.1:8000/docs
```

## MVP Features

The first MVP should support:

1. Select muscle group
2. Select difficulty
3. Select available equipment
4. Enter song title and duration manually
5. Generate a timed workout
6. Start a workout timer
7. Complete the workout

## Planned Muscle Groups

- Chest
- Back
- Legs
- Shoulders
- Arms
- Core
- Full body

## Planned Equipment Options

- Bodyweight
- Dumbbells
- Gym equipment

## Planned Difficulty Levels

- Beginner
- Intermediate
- Advanced

## Workout Generation Logic

The first version will generate workouts from:

- Song duration
- Muscle group
- Difficulty
- Equipment
- Workout goal

Example generator behavior:

```text
Short song:
- Warmup
- 1 to 2 work intervals
- Burnout

Medium song:
- Warmup
- Multiple work/rest intervals
- Burnout

Long song:
- Warmup
- Repeated work/rest intervals
- Finisher
```

## Future Music Integrations

### Apple Music

Apple Music will likely be added first because it is better suited for playlist access and playback across Apple platforms, Android, and web.

### Spotify

Spotify will likely be added later. The first Spotify version should use playlist and track metadata, not beat-perfect audio analysis.

## Development Workflow

Use feature branches for new work:

```bash
git checkout -b feature/workout-generator
```

Commit changes:

```bash
git add .
git commit -m "Add workout generator"
git push origin feature/workout-generator
```

Then open a pull request into `main`.

## Project Goal

Build a real cross-platform workout app where music drives the workout structure.

Short-term goal:

```text
Generate a workout from a manually entered song duration.
```

Long-term goal:

```text
Generate personalized workouts from Apple Music or Spotify playlists.
```