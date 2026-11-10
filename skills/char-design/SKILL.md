---
id: char-design
name: Character design and turnaround consistency for BEHIX cut-out characters
version: 1
owner: characters
tasks: [char.generate, char.keyframe, rig.refpose]
source: https://github.com/calesthio/generative-media-skills/tree/8c85352d5d75d4dcbe58480bd138e37b9742bab1/skills/production/creative-direction/character-design-continuity
license: MIT
---

# Character design for BEHIX

You design adult characters for a 2D cut-out animation engine. The image you make is not a final frame. The engine cuts it into body parts, puts them on a skeleton, and animates them for 3–5 minute films. Design for **readability, consistency and cut-out safety** before beauty.

## 1. Read order: silhouette, then color, then detail
- **Silhouette first.** Filled black, the character must still read: posture, hair mass, headscarf or chador shape, coat length, bag or tool. Two characters in the same film must have clearly different silhouettes (height, width, head shape, garment outline).
- **Shape language** sets the first impression. Round shapes read warm and safe. Square shapes read stable and stubborn. Triangles read sharp, energetic or threatening. Pick one dominant shape and one accent shape per character. This is a vocabulary, not a rule about personality.
- **Color:** at most 3 main colors plus one signature accent. Keep enough value contrast between skin, hair and clothing that the parts still separate at phone size.
- **Detail last.** Small patterns, logos, jewelry and text turn to noise at 1080×1920 and break when parts rotate. Leave them out unless the story needs them.

## 2. Adult proportions and the BEHIX style
- Realistic adult proportions, about 7–7.5 heads tall. No chibi, no oversized heads, no childish faces.
- Painterly cel shading, soft light, clean confident linework, muted palette.
- No text, captions, watermark, frame border or UI in the image.
- Hands: 4 fingers plus a thumb, relaxed and slightly apart. Feet in shoes, fully visible.

## 3. Identity lock (the character anchor)
Before any image, write a short anchor paragraph and reuse it **word for word** in every later prompt for this character. Put scene-specific changes in other paragraphs so the model does not reinterpret identity.

The anchor holds:
- name, age range, body build and posture;
- face anchors: head shape, eye spacing, brows, nose, jaw, facial hair, marks;
- hair: cut, length, part, texture, color, and what covers it (روسری, شال, چادر, کلاه);
- every garment with its cut, length, closures and color, e.g. "knee-length terracotta manteau with a stand collar and covered buttons", not "nice coat";
- signature item, and on which side of the **character's own body** it sits;
- negative identity: the common wrong versions to avoid.

Example (Persian names, English rules):
> سارا: woman, late 20s, slim, upright posture; oval face, wide-set dark eyes, straight brows; loose mustard headscarf showing dark brown hair at the front; knee-length terracotta manteau, black straight trousers, white flat sneakers; small brown shoulder bag on her own left shoulder. Not a teenager, no chador, no glasses.

Mark each element as **locked** (never changes), **flexible** (can change per scene, e.g. sleeves rolled) or **story-changing** (only when the script says, e.g. a wet coat after rain).

## 4. Prompt structure for every character image
Write prompts as five short paragraphs, always in this order:
1. **Anchor:** the identity lock, unchanged.
2. **Scene:** pose, action, framing and emotion for this image only.
3. **Continuity:** costume state, prop side, what changed since the last image (only intended changes).
4. **Style:** the fixed BEHIX style line.
5. **Avoid:** age drift, face or body change, a different hair length, the costume cut changing, props swapping side, extra fingers or limbs, text.

Keep each paragraph concrete and visual. Words like "beautiful", "epic" or "detailed" add nothing.

## 5. Character sheet (`char.generate`)
- One image, plain light-grey background, the same character three times at the same scale on one ground line: **front, three-quarter, side profile**.
- Identical face, hair, clothes, colors and proportions in all three views. Same lighting direction.
- Neutral expression and relaxed standing pose in every view. Arms slightly away from the body so the arm outline is readable.
- Nothing overlaps between the views. Leave a generous margin around each figure.
- This sheet is the reference for every later image of the character, so treat it as the canonical take.

## 6. Rig reference pose (`rig.refpose`): cut-out safe
The engine cuts this one image into 14 parts: head, torso, and near/far upper arm, forearm, hand, thigh, shin and foot. A pixel belongs to its nearest bone, so anything touching the wrong limb gets cut with it.
- Full body, **three-quarter front view**, neutral relaxed standing pose, top of the hair to the soles fully visible, with generous margin.
- **Clear background gaps:** each arm held about 25° from the torso, from armpit to hand. The legs apart with a visible gap down to the feet. Palms toward the thighs, fingers slightly apart, hands not touching clothing.
- Nothing crosses the body: no folded arms, no hand on hip, no bag strap across the chest, no hair over the shoulders hiding the neck line, no long scarf ends hanging over the arms.
- Flat, uniform, pure white background (#FFFFFF). No floor, no cast shadow, no props, no text. White clothing must keep a visible outline against the background so cut-out does not eat it.
- Long garments (chador, abaya, long coat) are allowed. Keep the hem shape clear and the gap between garment and arms visible. Expect the coat to move as one piece with the legs.
- Hair and loose cloth stay within the head and torso silhouette so they are cut with the right part.

## 7. Keyframes with the cast (`char.keyframe`)
- Use only the characters in the reference sheets. Same faces, hair and clothes. Each character appears once.
- Repeat each character's anchor. Describe position and action per character, using **character-left/right** for props and handedness.
- One cinematic frame with a layered background and depth. The characters must not merge into the background: keep value contrast at the figure edges.
- Never age, slim, recolor or restyle a character to fit a scene. If the scene needs a costume change, state it in the Continuity paragraph.

## 8. Cultural care
- Iranian settings and clothing are everyday life, not exotic costume. Represent hijab styles, chador, work clothes and urban fashion accurately and respectfully.
- No stereotypes or caricatured features. Disability, age and body type are part of identity: keep them consistent and dignified.
- Never design a recognizable real person, celebrity or private individual. If a description resembles one, change the anchors enough that it is an original character.

## 9. Self-check before returning an image
- Does the silhouette read, and does it differ from the rest of the cast?
- Do the face, hair, costume and palette match the anchor in every view?
- Is each prop on the correct side, at the correct scale?
- Adult proportions, correct finger count, feet visible?
- Is the background plain and the margin around the figure clear?
- For `rig.refpose`: are both arm gaps and the leg gap visible, and is nothing crossing the body?
- Is there no text, watermark or border?

## Common drift and the narrow fix
| Drift | Fix |
|---|---|
| Same outfit, different face | Strengthen the face anchors; use the sheet as reference. |
| Face stays, body drifts | Add body build and posture to the anchor; use full-body references. |
| Hair changes each image | Specify the cut, length, part, color and covering, not mood words. |
| Prop or mark flips side | State character-left/right explicitly. |
| Style overrides identity | Keep style in its own paragraph; shorten it. |

Change one thing at a time when repairing.

---
Sources: adapted and condensed from calesthio/generative-media-skills `character-design-continuity` (MIT, commit 8c85352) and fal-ai-community/skills `character-design` and `character-sheet` (MIT, commit ca79376). AI-video and provider-CLI steps removed. BEHIX cut-out, rig-reference and Persian content is original.
