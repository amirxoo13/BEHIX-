---
id: char-rig-acting
name: Cut-out rig landmarks, limits and acting for the BEHIX puppet engine
version: 1
owner: characters
tasks: [rig.joints, rig.refpose]
source: https://github.com/calesthio/generative-media-skills/tree/8c85352d5d75d4dcbe58480bd138e37b9742bab1/skills/production/creative-direction/2d-character-rig-animation
license: MIT
---

# Rig and acting for the BEHIX cut-out puppet

The BEHIX engine animates every character itself: pose library, staggered transitions, two-bone IK, a no-slip walk, breathing and lip-sync. AI never makes motion or video. Your job is to give the engine **exact, consistent rig data** and to choose **performances** that its rig can play well.

## 1. Joint landmarks (`rig.joints`)
Return exactly these 22 points as JSON, with no other keys and no commentary:
`headTop headCenter chin neck chest pelvis shoulderL elbowL wristL handL shoulderR elbowR wristR handR hipL kneeL ankleL toeL hipR kneeR ankleR toeR`

Coordinates:
- (0,0) is the **top-left** of the image. x grows right, y grows down. Both axes are normalized to **0..1000**, regardless of the image's aspect ratio.
- **L/R are the character's own left/right.** A character facing the viewer has their L on the image's **right**. Never swap sides to make the output look tidy.
- Every point is required. Estimate hidden points from anatomy. Never omit one or return null.

Where each point goes (this is the pivot the engine rotates around, so the anatomy has to be right):
- **headTop:** top of the hair mass, or of the head covering if there is one. **headCenter:** the centre of the skull, roughly level with the ears, not the nose. **chin:** the bottom of the jaw.
- **neck:** the base of the neck, where it meets the shoulders. **chest:** the centre of the ribcage, about nipple height. **pelvis:** the centre between the hip joints, not the waistband.
- **shoulder:** the ball of the shoulder joint, inside the sleeve outline, not on the edge of the clothing. **elbow:** the joint centre. **wrist:** the joint centre. **hand:** the centre of the palm.
- **hip:** the hip joint (upper thigh), not the outer edge of the clothing. **knee** and **ankle:** joint centres. **toe:** the tip of the shoe.
- Under loose clothing (chador, long coat, wide trousers), place the joints where the **body** is, not where the cloth is.

Before answering, check that:
- the vertical order holds: headTop < headCenter < chin < neck < chest < pelvis, and hips are above knees above ankles;
- left and right limb lengths agree within about 10%: upper arm ≈ forearm, thigh ≈ shin;
- shoulders are clearly apart, and the pelvis sits between the hips;
- every point lies on or very near the figure, not on the background.

## 2. What makes the rig work (also for `rig.refpose`)
- **One part per bone.** The engine assigns each pixel to its nearest bone (14 parts: head, torso, and near/far upper arm, forearm, hand, thigh, shin and foot). Gaps of empty background between arms and torso, and between the legs, keep parts clean.
- **Rotate around real joints.** A misplaced shoulder or hip makes the sleeve or trouser tear open when the limb rotates. Shoulders and hip girdles stay with the torso, so parts overlap at the joints.
- **Rest pose = the most common pose.** The reference is a relaxed stand, not a T- or A-pose, so the parts look right for most of the film.
- **Draw order is fixed by depth:** far arm, far leg, near leg, torso, head, near arm. The far arm comes in front of the chest only for gestures across the body.

## 3. Joint limits (degrees; positive = the joint's natural bend)
| joint | range | note |
|---|---|---|
| spine vs pelvis | −15..30 | lean forward more than back |
| head vs neck | −40..40 | the head leads turns and moods |
| upper arm | −60..175 | full overhead allowed |
| elbow | 0..150 | never bends backwards |
| wrist | −60..70 | |
| thigh | −30..110 | |
| knee | 0..150 | always bends forward |
| foot | −30..45 | |

Choose poses inside these ranges. A pose that needs an elbow or knee bending backwards, or an arm through the body, is wrong for this rig.

## 4. The engine's pose vocabulary
Use these pose ids. They are designed and tested:
`stand relaxed crossed hips explain point wave think shrug cup sip phone listen shock sad cheer`

- Hand targets are relative to the shoulder in arm-lengths. Feet are planted on the ground unless lifted.
- `cup`, `sip` and `phone` carry a held prop in the near hand. `wave` adds its own wave motion.
- There are no sitting poses for puppets yet. Do not plan seated puppet acting.

## 5. Acting with the 12 principles, the way this engine plays them
- **Pose to pose.** Each beat needs one clear key pose with a readable silhouette and line of action. Too many poses read as fidgeting. Hold a good pose for at least 1–2 seconds.
- **Staging.** One idea per pose. The speaker gestures and listeners hold `listen` or `relaxed`. Keep hands clear of the face and outside the silhouette so they read on a phone.
- **Anticipation.** Before a big move (point, cheer, shock), take a small opposite move or a beat of stillness. Big emotions need a short pause before them.
- **Overlap and follow-through.** The engine already staggers every transition: **head first (0–50%), hips and weight (0–60%, with a small weight dip), spine (8–75%), then arms (18–100%) with a slight overshoot.** Plan keys at least 0.6 s apart so a transition can finish. Closer keys blend from wherever the body is, which still works but reads as hurried.
- **Slow in, slow out.** Transitions ease at both ends. Hands overshoot and settle. Do not add your own sudden snaps.
- **Arcs.** Hands travel in arcs between targets. Prefer targets that move up or out in one direction, not zig-zags.
- **Secondary action.** Breathing, weight sway and talk beats are added automatically while a character speaks. Add a prop action (sip, phone) only when it supports the line.
- **Timing.** Fast 0.3–0.4 s for surprise. A normal 0.6 s gesture. A slow 1 s settle for sadness or thinking.
- **Exaggeration.** Push poses clearly (`shock` leans back, `sad` sinks) and keep the joint limits.
- **Appeal and solid drawing.** Asymmetry looks alive: weight on one leg (`relaxed`), one hand busy. Avoid twinning (both arms mirrored) unless the emotion is symmetric (`cheer`, `shrug`).
- **Walking.** The engine walks no-slip, with feet planted, a ramp-up and a ramp-down. Give the start and end positions, never the steps. Do not stack a gesture key in the same 0.5 s as a walk start.
- **Gaze leads.** Eyes and head turn to the speaker or target before the body. Listeners look at the speaker.

## 6. Lip-sync contract: 11 shared mouth shapes (VisemeId)
`rest mbp ah eh ee oh oo fv l sz wide`

| id | Persian sounds | shape |
|---|---|---|
| rest | silence | closed, relaxed |
| mbp | م ب پ | lips fully closed: **never skip this closure** |
| ah | آ ا (ɒ, æ) | jaw open |
| eh | اَ اِ, final ه, k g q x h | half open |
| ee | ای ی (i) | wide, teeth close |
| oh | اُ (damma) | rounded, mid open |
| oo | او (u) | small round |
| fv | ف و (f v) | lower lip under the top teeth |
| l | ل ن د ت ر | tongue up, slightly open |
| sz | س ز ص ض ظ ذ ث ش ژ چ ج | teeth together, lips apart |
| wide | strong emphasis or emotion on an open vowel | big, stretched |

- All times are in **seconds**. A span is `{id, start, end, weight?}`. Spans shorter than 0.07 s are merged into a neighbour. Shapes swap as sprites, with an optional crossfade of at most 60 ms driven by `weight`.
- Each character has its own art for these ids. A missing shape falls back: `sz→ee→eh→ah`, `wide→eh`, `oh→oo→ah`, `l→eh`, `fv→mbp→rest`.
- Don't animate every control on every syllable. Keep head and brow accents for stressed words.

## 7. Rig QA: flag these
Seam or gap at a joint, an elbow or knee flipping side, a planted foot sliding, a one-frame pop, the far arm drawn over the face, and limb lengths drifting between poses. Every frame must be computable from time alone: no randomness, no dependence on the previous frame.

---
Sources: adapted and condensed from calesthio/generative-media-skills `2d-character-rig-animation` and `performance-direction` (MIT, commit 8c85352). Provider lip-sync and AI-video steps removed. The BEHIX landmark contract, joint limits, pose ids and 11-viseme table are original and match `src/studio/v2/puppet.ts`, `pose.ts` and `mouth.ts`.
