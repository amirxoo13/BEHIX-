---
id: story-shot-grammar
name: Shot grammar and coverage for BEHIX cut-out films
version: 1
owner: story
tasks: [film-plan.shots]
source: [https://github.com/calesthio/generative-media-skills, https://github.com/fal-ai-community/skills]
license: MIT
---
# Shot grammar for BEHIX cut-out films

You break one scene into shots for a 2D cut-out engine. Characters are flat puppets on a layered set. The engine places them at `startX` (0 = left edge of frame, 1 = right edge; −0.2 or 1.2 means offscreen), poses them from the gesture, face, hold and move lists, lip-syncs dialogue, and frames the camera. Every shot is an editorial decision. It must have a dramatic job, a subject, a size and a duration, not "cinematic" decoration.

## Give each shot one job

Pick the job first, then the size:

- **Orient**: who is where, where the exits are, where people are heading → `establishing`, `wide`, `full`.
- **Witness**: hold a behavior long enough to register → `medium`, `twoShot`, with a long duration.
- **Identify**: align with one character's look or feeling → `overShoulder`, `mediumClose`.
- **Isolate**: one face, one decision, one object → `close`, `extremeClose`, `insert`.
- **Compare**: two people in one frame so their relation reads → `twoShot`, `wide`.
- **React**: the listener's face changes what the line means → `reaction`.

## Shot sizes (schema `shotType`)

| Enum | Shows | Use it for | Costs |
|---|---|---|---|
| `establishing` | the whole place | the first shot of a new location or time jump, 3–5 s | faces unreadable |
| `wide` | full bodies plus set | entrances, exits, blocking, comedy setups | expression is small |
| `full` | one or two full figures | stance, a walk, a big gesture (`jump`, `bow`, `cheer`) | less set |
| `medium` | waist-up | conversation, gestures (`explain`, `point`, `shrug`) | loses feet and exits |
| `mediumClose` | chest-up | an important line, rising emotion | hand props may crop |
| `close` | face | a decision, a realization, a strong `expression` | geography gone |
| `extremeClose` | eyes or mouth | one or two moments per film at the peak | needs context from neighbors |
| `overShoulder` | listener's shoulder, speaker's face | dialogue with a clear axis | needs consistent sides |
| `twoShot` | both partners | simultaneity, relationship, a shared reaction | neither face dominates |
| `insert` | a prop or a detail | a story-critical object (`phone`, `book`, `flowers`) | needs a `hold` in the plan |
| `reaction` | the listener | the response that changes the meaning | no lines from that character |

The engine currently renders sizes as three framings (wide, medium, close). Still choose the precise enum, because it records intent for the camera stage.

## Camera moves (schema `cameraMove`)

Motivate every move with a story change. If nothing changes, use `static`.

- `static`: the default. Use it for deadpan comedy, held tension and most dialogue. Cut-out animation reads best locked off.
- `pushIn`: attention gathers on a realization or a threat. Start it just before the turn line.
- `pullOut`: isolation, aftermath, or a reveal of who else is present.
- `panLeft` / `panRight`: follow a look or a walk to something offscreen. Pan in the same direction the character moves or looks.
- `truck`: travel alongside a walking character. It shows the parallax layers of the set.
- `follow`: keep a moving character the same size in frame.
- `shake`: an impact, a slam or a shock. Use it under 1 s and rarely.
- `rackFocus`: shift attention from foreground to background (from a prop to a face).

Use at most one move per shot. Do not use a move on a shot shorter than 2 s. Avoid two moving shots in a row unless they continue the same motion.

## Continuity

- **The 180° rule.** In a dialogue, the line runs between the two speakers. Keep each character on the same side of the frame (`startX` < 0.5 or > 0.5) for the whole scene, and keep `facing` consistent: left character faces `right`, right character faces `left`. If you must swap sides, show the move inside a `wide` or `twoShot` shot (`toLeft`/`toRight`/`approach`), then continue on the new side.
- **Screen direction.** A character who exits right (`exit`, `startX` → 1.2) enters the next shot or scene from the left. Travel keeps one direction until the story turns them around.
- **Eyelines.** `lookAt` should point to the person they talk to or the object of the beat. Look, then object; action, then consequence; question, then reaction. Never reverse causal order across a cut.
- **State at the cut.** `hold`, `sit` and expression carry over between shots of a scene. If a character sat down in shot 3, they are still sitting in shot 4 unless shot 4 shows them stand.
- **Match on action.** When cutting on a movement (a reach or a sit), start the next shot at the middle of that movement.
- **Change both size and angle between neighbors.** Do not cut from `medium` to `medium` of the same person. Jump at least one size (`wide` → `medium` → `close`) or switch subject.

## Coverage around beats, not insurance

For each beat ask: whose information or reaction controls it? Must geography stay visible? Are two things happening at once? Does the performance need an uninterrupted hold?

A minimal, strong scene usually has:

1. An `establishing` or `wide` shot of the place and who is in it.
2. One shot per decisive line or action, sized by importance.
3. At least one `reaction` shot that changes interpretation.
4. An `insert` only for story-critical props.
5. An exit or transition shot that pulls into the next scene.

If simultaneity matters (one character talks while another sneaks out), keep both in a `twoShot` or `wide` shot. If a performance escalates, hold one shot and cut only at the turn.

## Timing and pacing

- Dialogue shot: the line's natural length (about 2.4 Persian words per second plus pauses) plus about 0.3 s of handle. Never shorten a line to fit.
- Reaction 1–2 s. Insert 1–1.5 s. Establishing 3–5 s. Silent witness 2–4 s.
- Put `dialogue[].startSec` at least 0.2 s into the shot, so the cut lands before the voice. Leave 0.3 s after the last line.
- Within a shot, lines run one after another. If one character cuts in, set `overlapsPrevious`. The engine still plays the lines one after another, with almost no gap.
- `acting[].atSec` and `durationSec` time the gesture or face relative to the shot start. Anticipate a line: start the gesture 0.2–0.4 s before the voice.
- Rhythm: open a scene with longer shots, tighten toward the turn, and hold the turn. After a climax, allow one long, quiet shot.
- Hit the scene's share of `targetDurationSec` by adding or removing silent shots, never by squeezing lines.

## Transitions (schema `transitionOut`)

- `cut`: the default within a scene and for most scene changes.
- `matchCut`: link two scenes by a shape, gesture or movement (a hand on a cup to a hand on a steering wheel).
- `fade` / `dipToBlack`: a time jump, the end of an act, or the end of the film. Use these at most at act boundaries.
- `crossDissolve`: a soft passage of time inside one place. Use rarely.
- `wipe`: playful or comic films only.

## Staging limits of the engine

- No more than 5 characters on stage in a shot. Only characters with lines or actions in a scene appear.
- `sit` works only where the place has seats. In `car`, everyone is seated.
- Holds and gestures come from the fixed lists. `phoneEar` implies `hold: phone`. `drive`, `eat` and `write` imply sitting.
- Entering characters start offscreen (`startX` −0.2 or 1.2) with `move: enter`. Leaving characters use `move: exit`.
- Put the speaker of a close or `mediumClose` shot in `subjectId`.

## Example (one beat, Persian)

Story lines:

```
مربی: علی، نوبت توست، آماده‌ای؟
علی: فکر کنم آماده‌ام، قلبم تند می‌زند.
```

Shots:

1. `twoShot`, `static`, 4.5 s: مربی at 0.3 (facing right), علی at 0.7 (facing left). مربی says the first line with `point` at 0.2 s.
2. `close` on علی, `pushIn`, 4.8 s, `subjectId: ali`: `expression: worried` 0.3 s before his line, `handChest` during "قلبم تند می‌زند".
3. `reaction` on مربی, 1.5 s: `content`, a small nod (`bow`). `transitionOut: cut`.

---
Sources: adapted and condensed from calesthio/generative-media-skills `skills/production/creative-direction/cinematic-shot-direction` and `storyboard-previsualization` (MIT, (c) 2026 generative-media-skills contributors) and fal-ai-community/skills `skills/cinematography` with `references/shot-language.md` (MIT, (c) 2026 fal.ai). All AI-video generation, model-routing and CLI steps were removed. Full license texts: skills/THIRD_PARTY_NOTICES.md. Engine limits and Persian examples are original to BEHIX.
