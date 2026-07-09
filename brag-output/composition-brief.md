# Hyperframes Composition Brief: DBSMO Training Platform

## Objective
Create a short launch-style brag video for DBSMO Training Platform.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape - 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: `/Users/cosmic/Documents/funni/dbsmo`
- Primary files read: `README.md`, `package.json`, `app/page.tsx`, `app/layout.tsx`, `app/dashboard/page.tsx`, `app/practice/page.tsx`, `app/problem-sets/[slug]/page.tsx`, `app/globals.css`, `DBSMO/Projects/dbsmo/Overview.md`, `DBSMO/Projects/dbsmo/Architecture.md`, `DBSMO/Projects/dbsmo/Entry Points.md`
- Product name: DBSMO Training Platform
- Tagline / strongest claim: "Self-paced mathematics olympiad training platform for DBS."
- Key UI or visual moment to recreate: practice category selection, live rendered answer preview, correctness/streak feedback, and dashboard/analytics cards.
- Copy that must appear verbatim:
  - "sign in to proceed."
  - "Diocesan Boys' School math olympiad training."
  - "training dashboard"
  - "Practice"
  - "Choose your focus"
  - "Correct. Streak 3."
  - "cohort snapshot"

## Creative Direction
- Tone preset: yc-parody
- Creative direction: fake Series A launch from 2016
- Interpretation: Serious startup launch language, restrained motion, corporate deck composition, and dry metrics.
- Angle: The platform is framed like a fictional 2016 startup funding announcement, but the product details are real: math practice, automatic grading, live math preview, dashboard progress, teacher analytics, and reports.
- Hook: "DBS math olympiad training has entered its Series A era."
- Outro / punchline: "Fictional funding. Actual grading."
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #f2f2f7
- Text: #222233
- Accent: #33aaff, #ff66aa, #8866cc
- Display font: Inter
- Body font: Inter
- Visual references from the project: progress ring, metric cards, pill buttons, topbar, practice answer preview, topic meters, cohort table.

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Funding Announcement - 3s - fake Series A claim and $0 fictional capital.
2. The Actual Product - 4s - login copy and dashboard shell.
3. Practice Flow - 5s - category select, typed answer, rendered math preview, correct/streak feedback.
4. Metrics Slide - 5s - dashboard metric cards, topic bars, cohort snapshot.
5. Outro - 4s - product name, punchline, version.

## Audio
- Audio role: sparse business bed with dry UI accents
- Audio arc: music starts immediately, stays restrained, and fades under the final logo.
- Music: `assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3`
- Music treatment: low volume around 0.2, no voiceover, clean end fade.
- Music cue guidance: bundled preset at `assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json`; use strong cues near 1.60s, 8.96s, and 17.91s only if readability survives.
- Audio-reactive treatment: subtle CSS/JS variable modulation on soft glows if available; skip if extraction is unavailable.
- Audio-coupled moments:
  - Scene 1 hook - dry impact
  - Scene 3 submit/correct - click then success bell
  - Scene 4 cards - restrained sequential card sounds
  - Scene 5 logo - final soft bell
- SFX selection guidance: low-risk clicks and soft impacts, no dense sequence.
- SFX analysis guidance: `/Users/cosmic/.codex/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copied into `brag-output/composition/assets/`.

## Hyperframes Instructions
Use the current Hyperframes CLI workflow. Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer.
- Treat cue metadata as optional; product clarity wins.
- Use SFX to support motion and interaction with restraint.
