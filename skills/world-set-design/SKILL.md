---
id: world-set-design
name: Layered parallax set design for BEHIX cut-out films
version: 1
owner: world
tasks: [world-set.design, world-set.layer-art, world-set.split, world-set.edit]
source: [https://github.com/calesthio/generative-media-skills, https://github.com/omer-metin/skills-for-antigravity]
license: [MIT, Apache-2.0]
---

# Designing a BEHIX set (SetDef v1)

You design still backgrounds for a deterministic 2D cut-out engine. Characters, props, camera and timing are animated by code; you only design and paint the world they stand in. Never plan generated video. Output must validate as `SetDef` (schema 1): 3 to 5 layers, a perspective block, a walk zone, anchors, a style id and generation metadata.

## 1. Start from the dramatic job, not the decor

Before drawing anything, write one sentence: what must the viewer understand in the first three seconds, and what should the place feel like?
Example: «پذیرایی کوچک یک خانهٔ تهرانی، شب؛ گرم و کمی شلوغ، تا دعوای سر کنترل تلویزیون خانوادگی و خنده‌دار باشد.»

Then answer:
- Who owns this place (family, office, city)? What does it say about them (tidy, worn, improvised, new)?
- What must be accurate: Persian signage reads right-to-left, Iranian interiors (rug, samovar, plastic-covered sofa only if the story wants it), Tehran streets (plane trees, gutters, Paykan-era cars). Avoid stereotypes and fake brand marks.
- What must stay empty: the action plane where characters walk and sit, and the caption band.

## 2. Layer plan (write this part carefully; the engine depends on it)

Stage space is 1080 × 1920 (portrait design). Feet stand on `perspective.groundY` (1340 by default). Square and landscape frames show the same stage with one uniform scale, so never put story-critical detail only at the extreme top.

| role | z | parallax | content | alpha |
|---|---|---|---|---|
| sky | 0 | 0.0–0.1 | sky, distant city, wall colour field | opaque |
| far | 10 | 0.25–0.45 | back wall, far buildings, windows | opaque |
| mid | 30 | 0.8–0.95 | furniture and objects behind actors (sofa back, counter, bus seats) | yes |
| near | 60 | 1.0 | things in front of seated actors: sofa arms, table, dashboard | yes |
| overlay | 90 | 1.2–1.4 | foreground frame: door jamb, plant, curtain edge; usually blurred | yes |

Rules:
- 3 layers minimum (far, mid, near), 5 maximum. Layers are sorted by z.
- Parallax 1 is the character plane. Seats and walk paths belong to parallax-1 art, otherwise actors slide against the furniture they sit on.
- Every layer with parallax ≠ 1 needs overscan: set `overscan.x` to at least the largest planned pan (about 135 px for a gentle pan) and make that layer's `rect` wider than 1080 by twice that amount.
- Leave a 150 px clear band around the walk zone in `mid` and `near` so cut-outs never intersect painted objects.
- Overlay covers at most 20% of the frame width per side and never crosses a face position.

## 3. Perspective and scale

Fill `perspective` from the art, not by guessing:
- `groundY`: y of the floor line where standing feet land at depth 1.
- `horizonY`: eye line; for an eye-level wide shot place it around 0.55–0.6 of groundY (≈ 760 for the default stage). Must be above groundY.
- `vanishX`: x of the vanishing point (floor grid, wall edges).
- `refHeightPx`: a standing adult at depth 1 is about 816 px tall in stage space. Doors are about 1.2× that, a sofa seat about 0.33× (seat top ≈ 1100), a table top about 0.45×.
- Walk zone: a floor polygon in stage px with `minDepth`/`maxDepth` (0.8–1.15). Keep it inside the floor painted in `mid`/`near`.

Scale check: put a 816 px silhouette on the ground line next to the door and sofa. If it looks like a child or a giant, fix the art, not the number.

## 4. Anchors

Anchors are where the engine places actors and props. Use stage px.
- `seat` (with `capacity`, `facing`, `layer: "mid"`): one per sitting position, at the seat top.
- `surface`: table tops and counters where table props go.
- `entry` / `exit`: door edges or frame edges; facing points into the room.
- `mark`: standing positions for dialogue, usually 0.3 and 0.7 of the width for two people.
- `light`: practical lights (lamp, window, street light) that motivate night glows.
- `hang`: wall spots for frames, clocks, signs.
`seats` (fractions of width) must equal the seat anchors' x / 1080.

## 5. Style tokens: match the characters

The set must look like the same film as the characters. Read the style tokens first and copy them into every prompt:
- palette: a few key colours, one shadow, one highlight, ink colour, paper colour;
- line weight: thicker near, thinner far (`line.weightNear` > `line.weightFar`);
- shading: flat or 2-tone cel, matching the character art;
- light: one direction and temperature for the whole scene; night uses one practical source as the exposure anchor plus cool fill;
- `promptFragment`: the exact sentence appended to every layer prompt.
Use one accent colour per scene for story attention. Keep backgrounds lower in contrast and saturation than the characters so faces read first. Squint test: blur the frame; the actors' area should be the clearest value step.

Colour script across a film: plan the temperature arc per scene (warm home, cool office, warmer at the resolution). Night is a lighting state, not a different place: same layout and anchors, darker values, practicals on.

## 6. Prompts for layer art (task world-set.layer-art)

Build each prompt in this order: style fragment → place and story moment → angle and lens feel → time of day and light → layer instruction → constraints.
Example (English prompt describing a Persian scene):
«{style} Interior of a small Tehran apartment living room, wide eye-level view, evening with one warm floor lamp camera-right. MID LAYER ONLY: the sofa and the low table, centred, on a transparent background. No people, no text, no logos. Keep the floor line at 70% height.»
Rules:
- One layer per request (per-layer) or one full plate and then split (plate+split). Record which in `gen.separation`.
- Ask for PNG when the layer needs alpha; transparency is not guaranteed, so it is verified afterwards.
- Never ask for readable text inside art. Persian signs are composited by code later; ask for blank sign boards.
- Use the locked style and character references every time; record them in `gen.refs` (max 14).
- 16:9 or 21:9 plates; 9:16 only if the model page lists it. Use 2K for normal work, 4K only for reviewed masters.
- Reproducibility = stored prompt + refs + model id + output hash. There is no seed; never re-roll a reviewed set.

## 7. Split and edits (tasks world-set.split, world-set.edit)

Split (structured JSON only): layer polygons or masks, `groundY`, `horizonY`, `vanishX`, the walk polygon, anchors, and a suggested camera range. Prefer conservative masks; a missed object is better than a cut-through face.
Edits are conversational and mask-free:
- fill behind a removed object: «remove the foreground chair and fill the floor and wall behind it in the same style»;
- extend for overscan: «extend the left side by 15% in the same style, keep the floor line height»;
- alpha cleanup when the matte is dirty.
If an edit drifts in style, fall back to the deterministic options: mirror or clone the edge strip, blur-fill small holes, or reduce the allowed pan.

## 8. QA checklist (reject the set if any fails)

- Alpha: mid/near/overlay have real transparency; no white halo or dark fringe at 200% zoom on both day paper and night paper; no semi-transparent holes inside objects.
- Edges: every layer covers its rect plus overscan; no visible seam when panned to the overscan limit.
- Ground: the floor line is level and matches `groundY` within 4 px; feet of a test silhouette touch the floor, seated hips sit on the seat anchors.
- Scale and perspective agree with `refHeightPx` and the vanishing point.
- Night: same anchors and layout as day; practicals glow, no pure black areas where actors stand.
- Style: palette, line weight and shading match the character sheet; no photoreal textures, no gradients the characters do not have.
- Text: no generated letters; blank sign areas are where code will place Persian text.
- Portrait, square and landscape: the action plane and faces stay inside every frame.
- Phone budget: each layer cropped to its rect; mid/near/overlay are not full-frame.

Sources: adapted from calesthio/generative-media-skills (production-design-direction, lighting-direction, visual-style-direction; MIT) and omer-metin/skills-for-antigravity (environment-art patterns: colour script and squint test; Apache-2.0). Layered parallax, perspective, anchors and QA rules are original BEHIX text.
