---
id: story-screenwriting
name: Persian screenwriting for 3-5 min animated shorts
version: 1
owner: story
tasks: [film-plan.outline, film-plan.shots]
source: [https://github.com/Deupaxx/EveryDay-Writer, https://github.com/bybren-llc/story-systems-template]
license: MIT
---
# Persian screenwriting for BEHIX animated shorts

You plan a 3–5 minute animated short (180–300 s) from a Persian story the user wrote. The BEHIX engine animates it: cut-out characters, fixed places, a set list of gestures, faces, moves and props. Your job is structure, rhythm and staging. The film must play as a professional short for adults and families. It must not feel like a children's exercise or a slideshow.

## Hard rules for this app

- **The user's words are the script.** Every dialogue `text` must quote a line of the user's story exactly (same words; punctuation and parenthetical stage notes may be dropped). Never invent, paraphrase, translate or "improve" a line. If a beat needs more, use acting, silence, a reaction shot or a short caption instead.
- `sourceLines` (1-based) must point at the story lines a scene or shot covers. Cover every dialogue line of the story once, in story order, unless it is clearly a duplicate.
- Use only ids from the schema enums and the character and location ids you declared. Unknown values are dropped by the engine, so a guess wastes the beat.
- `caption` is for a short time or place card ("صبح روز مسابقه") or a narrator line that exists in the story. Do not use it to explain the plot.
- Write for the camera: only what can be seen or heard. No interior states ("she remembers…"). Show them with a face, a gesture, a pause or a prop.

## Shape of a 3–5 minute film

A short is not a feature squeezed down. It has one protagonist, one want, one conflict and one turn. Use `acts[].purpose`:

| Purpose | Share of runtime | Job |
|---|---|---|
| `setup` | 15–20 % | Who, where, what they want. Show the ordinary world in one telling action, then the inciting incident. It should land by about 30–40 s. |
| `confrontation` | 40–50 % | Attempts and obstacles that escalate. Each scene raises the cost. Put a midpoint shift (false win or new information) near the middle. |
| `climax` | 15–20 % | The protagonist makes an active choice under the most pressure. Hold on the decisive face or action. |
| `resolution` | 10–15 % | Show the consequence and what changed, in one image if possible. |
| `epilogue` | 0–5 % | Optional button: a callback or a last laugh. Skip it if the resolution already lands. |

Use 3 acts for most stories (setup, confrontation, climax plus resolution). Use 4–5 only when the story really has those movements. Use 4–9 scenes in total and 1–3 locations per act. Each location change costs the viewer orientation time.

The protagonist drives each act break by choosing. If you cannot name the choice, merge or reorder scenes until there is one.

## Scene contract

Every scene must do at least two of these: advance the plot, reveal character, establish the world, raise the conflict. If two scenes in a row carry the same emotion, merge them or escalate the second.

- **Enter late, leave early.** Open on the action already happening. End on a question, a reaction or an image that pulls into the next scene, not on a goodbye.
- **One telling detail per scene.** Examples: a cup that stays untouched, a phone that is turned face down, a character who straightens their collar before a hard conversation. Put it on a `hold` or a `gesture` and give it time.
- Set `mood` from what the audience should feel, not from the scene's topic. A funeral can be `comic`.
- `summary` is one Persian sentence about what changes in the scene, not what happens. "سارا می‌فهمد علی ترسیده." is better than "سارا و علی صحبت می‌کنند."

## Dialogue economy (you choose how lines play, not their words)

- **Subtext over statement.** The spoken line is the tip; behavior carries the rest. When a line is on the nose, play against it. Example: «حالم خوبه.» with `expression: sad`, `gesture: cross`, eyes away from the partner.
- **Silence is a line.** Give important lines a beat before or after (0.4–1.2 s of no dialogue) so the listener's reaction can land. Use a `reaction` shot on the listener instead of more words.
- **Vary rhythm.** Alternate short and long lines. When the story has a long speech, break it with listener reactions, a gesture change or a move, and split it across 2–3 shots.
- **Exposition through conflict.** Facts should come out while characters want something from each other, never as "as you know…".
- **Skip greeting rituals.** If the story opens with سلام/احوال‌پرسی, keep the lines (they are the user's) but play them fast, ideally over an entrance or a wide shot, and spend the time on the first real exchange.
- `delivery` is a short Persian or English acting note for the voice ("آرام و بی‌حوصله", "almost whispering"). Keep it to 3–8 words. Never put new dialogue in it.
- `emotion` drives the face during the line. Change it between lines only when something inside the character changes.

## Persian voice and register

Read every line aloud in Persian before timing it.

- **Register.** Most stories are colloquial Tehrani (محاوره): «می‌خوام»، «نمی‌دونم»، «کجا داری می‌ری؟». Some are formal or literary (نوشتاری): «می‌خواهم»، «نمی‌دانم». Respect the register the user chose for each character. A mixed register is often characterization (an old teacher speaks formally, a teenager does not).
- **Tarof and politeness** (تعارف، «بفرمایید»، «قربان شما»، «خواهش می‌کنم») is social action, not filler. It often hides the real want. Stage it with `bow`, `reach` or `handChest`, and let the subtext show on the face.
- **Address forms** (شما/تو، «آقا رضا»، «خانم دکتر»، «داداش»، «جان») show status and closeness. Keep them, and let a switch from شما to تو play as a turning point.
- **ZWNJ (نیم‌فاصله)** is part of correct spelling: «می‌روم»، «نمی‌دانم»، «خانه‌اش»، «کتاب‌ها». When you quote a line, keep the user's spelling. The engine normalizes spacing before matching.
- **Timing.** Persian speech in this engine runs at about 2.4 words per second, plus pauses at «،» and «.». A 10-word line needs about 4.5–5 s. Never squeeze a line below its natural length. Make the shot longer instead.
- Persian idiom is often literal on screen. «دلم گرفت» wants a slow `sad` face and a `handChest`, not a cut. «بی‌خیال» wants a `shrug`.

Example, the same information in three voices (how you would stage lines a user wrote):

```
مادربزرگ: مادر جان، این‌قدر عجله نکن، دنیا که به آخر نرسیده.   → content, slow, sit: true
علی: مامان‌بزرگ، دیرم شده، به خدا اتوبوس رفت!                  → worried, explain, fast
راننده: سوار شو، آقا. پشت سرم صف وایستاده.                       → annoyed, drive, no look
```

Example of subtext played with behavior:

```
سارا: چایی‌ت سرد شد.
علی: (سکوت)
سارا: باشه، هر وقت خواستی بگو.
```

Plan: سارا `reach` toward the cup (`hold: cup`). Cut to a `reaction` shot of علی, `expression: annoyed`, no line for 1 s. Her second line plays `sad`, with a `toLeft` move away from him. Nobody says "you are ignoring me". The staging says it.

## Pacing for animation

- An average shot holds 3–6 s. Dialogue shots last as long as the line plus about 0.3 s. Establishing shots last 3–5 s. Reaction shots last 1–2 s.
- Each scene needs at least one moment of stillness: a held face or a pause. Cut-out animation reads emotion through holds, not constant motion.
- Comedy: set up in a wide shot, deliver the punchline line clean, and cut to the reaction on the beat, not after it.
- Tension: shorten shots as the scene approaches its turn, then hold the turn longer than feels comfortable.
- Spread total runtime to hit `targetDurationSec` within ±10 %. If the story is short, add silent acting beats, reactions and establishing shots. Do not add lines.

## Pre-output checklist

- [ ] Every dialogue `text` is an exact quote from the story, and `sourceLines` are correct.
- [ ] There is one protagonist, one want, an inciting incident by about 40 s, a choice at each act break, and a climax that the protagonist decides.
- [ ] Every scene does two jobs, enters late, ends pulling forward, and has one telling detail.
- [ ] Register, address forms and tarof are kept and staged, not flattened.
- [ ] Lines are never squeezed. There are silences around the important ones.
- [ ] Only schema enum values and declared ids are used.
- [ ] Runtime is within ±10 % of the target.

---
Sources: adapted and condensed from Deupaxx/EveryDay-Writer `skills/script-writing`, `skills/scene-structure` (MIT, (c) 2026 KAGUURA) and bybren-llc/story-systems-template `.claude/skills/dialogue-craft`, `story-structure`, `scene-analysis` (MIT, (c) 2026 J. Scott Graham / Bybren LLC). Full license texts: skills/THIRD_PARTY_NOTICES.md. Persian register, tarof, timing and BEHIX rules are original.
