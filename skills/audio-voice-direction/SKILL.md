---
id: audio-voice-direction
name: Persian (fa-IR) voice casting and TTS direction for BEHIX characters
version: 1
owner: audio
tasks: [tts.line]
source: https://github.com/GoogleCloudPlatform/genmedia-creative-studio/tree/19eecec3578751bfbb1ab20109fb93e08ddb8666/experiments/mcp-genmedia/skills/genmedia-voice-director
license: Apache-2.0
---

# Voice direction for BEHIX (gemini-3.8-flash-tts)

You direct synthetic voice actors for 3–5 minute Persian animated shorts. The model decides how to say a line as well as what to say, so you shape the performance through three things: the voice, a short style, and well-written spoken text. The films are for a general audience and must sound **professional and grounded, never cartoonish or childish**. That holds even for child characters.

**Models.** `gemini-3.8-flash-tts` is for final lines, because it handles acting nuance, vocal sounds and dialect best. `gemini-3.8-flash-lite-tts` is for previews and fallback. Both take the same request. The engine sends one line per call: `text` is the transcript and `speechMetadata.style` is the style.

## What goes where
| Slot | Put here | Never put here |
|---|---|---|
| Voice | Permanent traits: gender, age range, timbre | Emotion or pace |
| `style` | Short English delivery direction, **under ~15 words**: emotion, pace, energy, dialect | "Read this line as…", "Say the following…", "Do not add words", long persona briefs, scene descriptions |
| `text` | **Only the words to be spoken**, in Persian script, plus inline vocal tags | Speaker names (`علی:`), headings, take labels, stage directions. All of these get spoken aloud. |

## Casting the 30 prebuilt voices for fa-IR
The voices' Persian has not been rated by Google. Every pick below is **needs a live listening check** before it becomes a default. Keep a different voice for each character in a scene. Never solve "child" by pitching a voice up or by choosing a squeaky voice.

| Archetype (BEHIX `look.kind`) | First choice | Alternatives | Notes |
|---|---|---|---|
| Adult man, lead/hero (`man`) | Charon (informative) | Orus (firm), Iapetus (clear), Alnilam (firm) | Calm authority. Avoid Fenrir unless the role is excitable. |
| Adult man, warm/comic support | Achird (friendly) | Umbriel (easy-going), Zubenelgenubi (casual) | Comedy comes from timing, not funny voices. |
| Adult man, antagonist / gruff | Algenib (gravelly) | Alnilam (firm), Enceladus (breathy) for menace | Menace = low energy plus slow pace, not shouting. |
| Adult woman, lead (`woman`) | Kore (firm) | Erinome (clear), Despina (smooth), Aoede (breezy) | |
| Adult woman, warm/mother | Sulafat (warm) | Achernar (soft), Vindemiatrix (gentle) | |
| Teen / young adult | Puck (upbeat, m), Zephyr (bright, f) | Laomedeia (upbeat), Autonoe (bright) | Natural teen energy, no baby talk. |
| Child (`boy`, `girl`) | Leda (youthful, f), Puck (m) | Achird | Direct as "young, natural, unforced". Never "cute" or "squeaky". |
| Elderly man (`oldMan`) | Algenib | Rasalgethi (informative), Gacrux (mature) | Slower pace in style; no fake tremble unless the script asks. |
| Elderly woman (`oldWoman`) | Vindemiatrix (gentle) | Sulafat (warm), Gacrux (mature) | |
| Narrator | Sadaltager (knowledgeable) | Charon, Schedar (even), Rasalgethi | Calm and measured; `<long pause>` where the picture breathes. |

Prebuilt traits come from the official voice list: Kore = firm, Puck = upbeat, Charon = informative, Leda = youthful, and so on. Persian suitability is our hypothesis.

## Writing the style
1. **Try with no emotion first.** The default style is only a dialect hint: `natural, colloquial Tehrani Persian`.
2. **Then add the smallest direction that works:** `warm, smiling` · `angry, clipped` · `sad, voice close to breaking` · `whispering, tense` · `speaking slowly, thoughtful` · `excited, quick pace` · `dry sarcasm` · `out of breath`.
3. **Make it physical and specific,** and keep it in agreement with the words. A style that contradicts the text, such as "furious" on «چه روز قشنگی», often loses to the text.
4. **One emotion per call.** If the mood changes mid-line, split the line into two clips. The story engine already gives each line one mood.
5. **Keep a baseline per character.** Reuse that character's style words across lines and change only the emotion word.
6. Don't ask for "consistent voice", and don't describe age or gender in the style. The voice carries identity.

BEHIX mood → style: smile `warmly, with a smile` · grin `excitedly` · laugh `while laughing` · smirk `sarcastically` · angry `angrily` · furious `shouting furiously` · sad `sadly` · cry `crying, voice breaking` · shocked `in shock` · scared `fearfully, trembling` · worried `worried, anxious` · content `calmly` · thinking `thoughtfully, slowly` · sleepy `sleepily`.

## Inline vocal tags
- Use English angle-bracket tags for momentary human sounds only, placed exactly where the sound happens: `<sigh>` `<laugh>` `<chuckle>` `<gasp>` `<breath>` `<heavy breath>` `<cough>` `<throat-clearing>` `<groan>` `<sob>` `<yawn>` `<tsk>` `<short pause>` `<long pause>`.
- **Sustained deliveries go in the style,** not in tags: whispering, shouting, crying, speaking fast or slow. `<whispering>` is often read out as a word.
- **No sound effects:** no `<door slam>` or `<applause>`. Those belong to the SFX track.
- **Disfluencies are words:** «اِم…»، «خب…»، «یعنی…».
- **Rhythm comes from punctuation:** `،` `…` `—` `؟` `!`.
- **Emphasis:** Persian has no capitals. Put a `<short pause>` before the stressed word, or name the word's role in the style (`stressing the last word`), or reorder the sentence.

## Persian text hygiene (the transcript is read verbatim)
- **ZWNJ (نیم‌فاصله).** Write `می‌روم`، `کتاب‌ها`، `خانه‌ام`، `نمی‌دانم`. With a space or no joiner, the model can split or merge syllables.
- **Ezafe.** Where reading is ambiguous, mark it: `کتابِ من`، `دستِ راست`. After final ه use `خانهٔ` or `خانه‌ی`. After ا or و use `ی`: `پای چپ`، `موی بلند`.
- **Numbers to words.** «ساعت ۷» → «ساعت هفت»، «۱۴۰۳» → «هزار و چهارصد و سه»، «۲۵٪» → «بیست و پنج درصد». Write dates and times as they should be spoken.
- **Loanwords and acronyms.** Write them in Persian script the way Tehranis say them: «اینترنت»، «موبایل»، «اس‌ام‌اس». Spell acronyms letter by letter. Don't use Latin script inside a Persian line.
- **Colloquial vs formal.** The text is spoken as written. For everyday dialogue write the colloquial forms: «می‌خوام»، «نمی‌دونم»، «اومد»، «کجایی؟». Keep the formal forms («می‌خواهم») only for a narrator, a letter or a speech.
- **Arabic letters.** Normalise ي → ی and ك → ک. Strip tatweel (ـ).
- **Lip-sync.** The text you send is also aligned to the audio for lip-sync. Every word you add, such as a filler, must stay in the script line, or the lips drift.

## Do / Don't
✅ style `worried, anxious` · text «یعنی چی؟ <short pause> گوشیش خاموشه…»
✅ style `warmly, with a smile; natural, colloquial Tehrani Persian` · text «سلام! <laugh> چقدر دلم برات تنگ شده بود.»
✅ style `speaking slowly, thoughtful` · text «شاید… <long pause> شاید حق با تو بود.»
❌ text «علی: سلام» (the speaker name is spoken)
❌ style `Read this line as a child in Persian. Do not add words.` (a preamble, plus age in the style)
❌ text «[whispering] بیا اینجا» (whispering belongs in the style)
❌ text «ساعت 7 بیا» (use words: «ساعت هفت بیا»)
❌ a squeaky, sped-up "kid voice". Cast Leda or Puck and direct them naturally instead.

## Takes and repairs
- For a retake, keep the words identical. Change the style first, then the tags or punctuation. Make one call per take and never put "Take 1" in the text.
- If a word is mispronounced, fix the spelling first (ezafe mark, ZWNJ, colloquial form). Change the style only after that.
- Lines of 400 characters or more are split at sentence or clause boundaries by the engine. Write lines that make sense at those cuts.

---
Sources: adapted and condensed from GoogleCloudPlatform/genmedia-creative-studio `experiments/mcp-genmedia/skills/genmedia-voice-director` and its `references/` (Apache-2.0, commit 19eecec), with legacy-model and MCP-tool content removed. Persian casting, text hygiene, the BEHIX mood map and the lip-sync notes are original.
