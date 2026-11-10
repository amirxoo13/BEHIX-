---
id: world-camera
name: Camera moves for BEHIX layered cut-out scenes
version: 1
owner: world
tasks: [world-camera.plan]
source: [https://github.com/calesthio/generative-media-skills, https://github.com/fal-ai-community/skills, https://github.com/Moh4696/cinematic-skill]
license: MIT
---

# Planning a ShotCamera

You plan the camera for one scene of a code-rendered cut-out film. The camera is a list of keys evaluated by the engine; nothing is filmed or generated as video. Output must validate as `ShotCamera`: `keys` sorted by `t` (scene-local seconds), each with `cx`, `cy` (look-at point in 1080 × 1920 stage px, the character plane), `zoom`, optional `dolly`, `truck`, `roll`, `focus`, an `ease`, optional `dur`; optional `shake` and `continuity`.

## 1. Every move needs a job

Write one sentence per beat: at this moment the audience should notice X, understand Y, feel Z. If that still works with a locked camera, keep it locked. Movement must be motivated by the story, a look, an entrance, a reveal or a reaction.

Shot functions: orient (where are we, who is here), reveal (new information), witness (hold a performance), identify (see what a character sees or feels), compare (two people in one frame), isolate (one face or object), transition (carry direction into the next scene).

Example: «سارا کلید را پیدا می‌کند → آرام روی صورتش نزدیک شو تا نگرانی‌اش دیده شود؛ علی نرم کنار قاب می‌ماند.»

## 2. Moves this engine can do

| move | fields | parallax effect | use for |
|---|---|---|---|
| hold (locked) | same values in two keys | none | dialogue, jokes, reactions |
| pan | `cx` / `cy` change, zoom > 1 | far layers pan less | follow a look, connect two speakers |
| push-in / pull-back (zoom) | `zoom` | none, flat | emphasis without depth; cheap and safe |
| dolly in / out | `dolly` 0–0.3 | near layers grow more than far | realization, entering emotional space |
| truck | `truck` ±40–200 px | near layers slide more | follow a walk, reveal layers |
| rack focus | `focus` (1 = characters) | blur moves between layers | shift attention to a sign or a door |
| roll | `roll` ≤ 3° | far layers roll less | dream, dizziness; rarely |
| handheld | `shake` amp 2–6, freq 1–3 | whole frame | panic, chase, earthquake; short |

Not available: orbit or arc around a character, crane over objects, drone, true 3D rotation, perspective change. Cut-out characters are flat; they cannot be seen from a new side. Use a different `angle` set (reverse, close) and a cut instead.

## 3. Shot size by information

Wide: geography, entrances, full bodies (zoom 1). Medium: two-person dialogue and gestures (zoom 1.2–1.35). Close: one face and decision (zoom 1.5–1.8, cy near the face, about 300–420 px above groundY for a standing adult, nearer the seat for a seated one). Insert: an object (zoom up to 2.2 on a surface anchor). Use the smallest size that still contains all needed information. Faces, hands that act, and the caption band must stay in frame in portrait, square and landscape.

## 4. Keys and timing

- A move ends on the beat it serves. Land the camera about 0.3 s after the thing appears or the line starts; it reads as the camera noticing.
- `dur` is how long the move into a key takes. Short dialogue reframes: 0.6 s with `inOutCubic` (the engine's automatic style). Emotional push: 2–4 s with `inOutSine`. Snap zoom for comedy: 0.2–0.3 s with `outQuart`, then hold.
- `outBack` (small overshoot) only for cartoon accents, never on drama.
- A hold is two keys with the same values. Hold at least 1.5 s after a move so the performance registers.
- At most one move per 4 s; never move during a punchline. Let the line land, then cut or reframe.
- Hit timing on the spoken word, not the line start: a push lands on «کلید», a reaction zoom on the laugh.

## 5. Limits (the engine enforces them; plan inside them)

- Overscan: layers only extend `overscan.x` beyond the stage. Pans and truck must keep every layer's visible area inside its art; otherwise the engine pulls the camera back toward centre and the move flattens. Keep `truck` ≤ overscan.x for parallax-1 art.
- Zoom 1–2.2 for story beats; 0.5–1 only if the set was painted for it.
- Dolly ≤ 0.3: larger values make near layers balloon and expose cut-out edges.
- Roll ≤ 3°, shake amp ≤ 6, and both for under 2 s. Avoid flashing or fast shake (accessibility).
- Blur: only layers with a `blur` value get depth of field; keep `focus` at 1 unless racking.
- Portrait first: plan cx so both speakers stay inside 1080 px at zoom; check square and landscape keep faces inside.

## 6. Continuity and the 180° line

- Define the axis for dialogue (line between speakers) and for walks (direction of travel). Keep left/right positions and eyelines across reframes and across cuts.
- A walking character exits right → enters the next scene from the left.
- `continuity`: `cut` (default, independent start), `matchFrom` (start from the previous scene's framing when action continues through a door), `carryOver` (same set, no reset).
- Match on action: cut while a gesture or a turn is in motion, not after it ends.
- Same light direction and time of day across all shots of a scene.

## 7. Patterns

Dialogue (two-shot → singles):
```json
{ "keys": [
  { "t": 0, "cx": 540, "cy": 1000, "zoom": 1, "ease": "linear" },
  { "t": 3.2, "cx": 360, "cy": 980, "zoom": 1.3, "ease": "inOutCubic", "dur": 0.6 },
  { "t": 6.0, "cx": 720, "cy": 980, "zoom": 1.3, "ease": "inOutCubic", "dur": 0.6 } ] }
```
Slow reveal with parallax (a door opens on the far wall):
```json
{ "keys": [
  { "t": 0, "cx": 540, "cy": 1000, "zoom": 1, "ease": "linear" },
  { "t": 4, "cx": 540, "cy": 980, "zoom": 1.05, "dolly": 0.15, "truck": 60, "ease": "inOutSine" } ] }
```
Comedy snap: hold wide 2 s, `outQuart` 0.25 s to zoom 1.7 on the reacting face, hold 1.5 s, cut.
Scene opener: start wide (orient), one gentle push toward the first speaker as the first line starts.

## 8. Review before returning

- Each move has a written job and lands on a word or action.
- No move runs over a punchline or a key line.
- Faces and the caption band stay visible in all three formats; no layer edge appears at the extremes.
- Screen direction and eyelines are consistent.
- The scene still works if every move is replaced by a hold; if not, the moves are carrying the story instead of supporting it.

Sources: adapted from calesthio/generative-media-skills (cinematic-shot-direction: dramatic job, shot functions, movement geometry, axis rules; MIT), fal-ai-community-skills (cinematography and shot-language reference: move vocabulary; MIT) and Moh4696/cinematic-skill (cinematic-film: one camera timed to the voice, landing about 0.3 s after a hero appears; MIT). Engine limits, parallax rules and examples are original BEHIX text.
