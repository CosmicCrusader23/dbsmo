# Hyperframes Composition Brief: DBSMO Training

## Objective

Create a short launch-style brag video for DBSMO Training that feels like a polished contemporary product advertisement and proves the app through a student-facing learning flow.

## Output

- Composition directory: `brag-output-2026-07-10-020752/composition/`
- Rendered video: `brag-output-2026-07-10-020752/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22.00 seconds

## Source Material

- Project root: `/Users/cosmic/Documents/funni/dbsmo`
- Primary files read: `README.md`, `app/page.tsx`, `app/dashboard/page.tsx`, `app/practice/page.tsx`, `app/math-curve-loader.tsx`, `app/anime-route-effects.tsx`, `app/globals.css`, `public/logo.png`
- Product name: DBSMO Training
- Tagline / strongest claim: `Diocesan Boys' School math olympiad training.`
- Key UI or visual moment to recreate: typing an answer, seeing its live math preview, and receiving `Correct. Streak 4.` in the Practice arena
- Copy that must appear verbatim:
  - `training dashboard`
  - `Choose your focus`
  - `Correct. Streak 4.`
  - `DBSMO TRAINING`

## Creative Direction

- Tone preset: app-store
- Creative direction: cool kinetic motion in the language of a real modern advertisement
- Interpretation: Use modern product-film motion—cameralike pushes, bold but legible type, layered depth, and card choreography—while preserving the source app's clear educational UI.
- Angle: The product supplies momentum through a real flow: track work, choose a focus, see math as you type, get immediate feedback, and move to the next problem.
- Hook: a math curve draws into the MO mark and `Olympiad math. With momentum.`
- Outro / punchline: `DBSMO TRAINING` + `Pick a topic. Keep going.`
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals unrelated to mathematics or product UI
  - A redesign that loses the source palette, rounded card language, or actual UX copy
  - The older fake-Series-A parody direction in `brag-output/`

## Visual Identity

- Background: `#f2f2f7`
- Text: `#222233`
- Accent: `#33aaff`
- Secondary app states: `#ff66aa`, `#8866cc`, `#77bb00`, `#ffaa33`
- Display font: Archivo Black for cinematic outer-frame statements
- Body font: source UI's Inter; JetBrains Mono for telemetry/chrome
- Visual references from the project: `public/logo.png`, dashboard conic progress ring, metric cards, Practice topic picker, live KaTeX answer preview, math-curve loader

## Storyboard

Use `brag-plan.md` as the creative contract.

Scene summary:

1. Momentum trace — 3.01s — deterministic curve trace, MO mark, and hook
2. Dashboard, in motion — 4.78s — actual dashboard ring and metric-card choreography
3. Choose your focus — 3.68s — Practice picker and staggered subject cards
4. Solve, see, know — 4.91s — live math preview, submit, and correct/streak payoff
5. Keep moving — 5.62s — progress/metric payoff and final DBSMO lockup

## Audio

- Audio role: upbeat, clean modern-product music bed with sparse interaction accents
- Audio arc: restrained ignition → card/tablet momentum → tactile solve payoff → composed brand landing
- Music: `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`
- Music treatment: 0.31 baseline volume, no voiceover, fade to 0.12 during the final lockup
- Music cue guidance: local copy of bundled cue data at `assets/music/cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json`; lock correct/streak to 15.82s, logo to 20.19s, final copy near 21.83s; use dashboard beats 4.10/5.19/6.28 and practice-card beats 8.22/9.29/10.38
- Audio-reactive treatment: subtle; sample pre-extracted audio data so the dashboard halo and final logo aura breathe with low-band energy. Do not add waveform/equalizer imagery or readable text scaling.
- Audio-coupled moments:
  - formula preview / submit — a low-risk UI click at press
  - correct/streak — warm confirmation at 15.82s
  - final logo — soft impact/announcement at 20.19s
- SFX selection guidance: use low/medium high-frequency-risk assets only. Match card/process actions with a small selection or slide sound; reserve a warm impact for major transitions.
- SFX analysis guidance: `assets/sfx/sfx-analysis.md`
- Exact SFX choice: select after visual timing is implemented; use locally copied assets only.
- Audio files: store all music and SFX under `composition/assets/` using relative composition paths.

## Hyperframes Instructions

Use the current Hyperframes composition contract and existing project scaffold.

- Show real UI/copy/visual elements from the source project.
- Keep every line legible at normal playback speed.
- Keep the final render 15–25 seconds; target is 22.00 seconds.
- Use a single paused GSAP timeline, deterministic geometry, finite animation cycles, and local assets.
- Use the motion patterns in the plan: SVG path drawing, card/ring fills, kinetic type on a shared beat grid, and one motion-blur arrival.
- Run lint, validate, inspect, snapshots, and a final high-quality render before delivery.
