---
id: audio-mix
name: Soundtrack mix, loudness and Lyria music cues for BEHIX shorts
version: 1
owner: audio
tasks: [music.cue]
source: [https://github.com/GoogleCloudPlatform/genmedia-creative-studio/tree/19eecec3578751bfbb1ab20109fb93e08ddb8666/experiments/mcp-genmedia/skills/genmedia-audio-engineer, https://github.com/calesthio/generative-media-skills/tree/8c85352/skills/production/audio-craft/audio-mixing-mastering, https://github.com/calesthio/generative-media-skills/tree/8c85352/skills/providers/music-generation/google-lyria]
license: [Apache-2.0, MIT]
---

# Soundtrack mix and music for BEHIX

BEHIX films are 3–5 minute Persian animated shorts watched mostly on **phones, through phone speakers and earbuds**. The mix exists to make every word of dialogue understood. Music and ambience support the story and must never compete with speech. Build the mix from the foreground outward: dialogue first, then SFX that matter to the story, then music, then ambience and room tone. Silence is a tool. Accidental digital silence between clips is a bug.

## Tracks and levels (working targets; check on a phone speaker)
| Track | Level relative to dialogue | Notes |
|---|---|---|
| Dialogue (Gemini TTS, 24 kHz mono, centred) | reference, 0 dB | Level clip by clip first. Gentle high-pass only. No heavy EQ on synthetic voices, because harsh presence boosts make TTS sound artificial. |
| Music under dialogue | −18 to −24 dB (after ducking) | Lead melody and vocals out from under speech. Arrangement beats level. |
| Music in the clear (titles, montage, end) | −6 to −10 dB | Swells resolve on a musical boundary, not on an arbitrary fade. |
| Ambience / room tone | −20 to −26 dB | Continuous under each scene so cuts have no holes. Low end controlled. |
| SFX (story-important) | −6 to −12 dB peaks | Short transients. No effect may push the limiter into heavy gain reduction. |
| SFX (decorative) | −15 dB or cut | Fewer, better effects. Vary repeated hits. |

Accessibility: in essential speech, keep background sound **at least 20 dB below dialogue** where feasible (WCAG low-background guidance). If words vanish on a phone, lower the music. Do not raise the master.

## Ducking (interval-based, the BEHIX mix model)
- **Ducking triggers.** Every dialogue clip interval ducks music by **−12 dB**, and ambience by −6 dB.
- **Curve.** Attack 0.08 s before the word, hold 0.15 s after the clip ends, release 0.45 s. Times are in seconds, the same as the timeline.
- **Gaps.** Merge ducks when the gap between lines is shorter than attack + hold + release (≈0.7 s). Otherwise music pumps up between every line.
- **Duck depth.** Use −15 to −18 dB under dense or whispered dialogue, and −8 dB under a single shouted word.
- **Ducking is an aid, not the whole mix.** If the music still masks speech, choose or edit a sparser cue.

## Loudness and master
- **Target.** **−16 LUFS integrated** (ITU-R BS.1770 K-weighted, gated), with a true-peak ceiling of **−1 dBTP**. This is a working target for speech-first web and phone delivery, close to the Apple Podcasts guidance (−16 ±1). It is not a platform rule.
- **Two passes.** First measure the full mix's integrated loudness. Then apply one static gain to reach −16 and run the look-ahead limiter at −1 dB. If the limiter is doing more than about 3 dB of gain reduction, fix the balance instead.
- **Rendering.** Render at 48 kHz stereo in 10–30 s segments on phones, carrying the limiter state across segment seams. Encode AAC (Opus fallback) after limiting, then re-check that there are no clicks at seams.
- **Fades.** Every clip edge gets a 5–10 ms fade. Music cues get longer fades (see Crossfades).

## Music with Lyria 3 Pro (`lyria-3-pro-preview`)
- **Limits.** Preview model, global location, one clip per request, **at most 184 s**, MP3 at 44.1 kHz/192 kbps, about 10 requests per minute. Negative prompting is not a parameter.
- **Language.** **Write prompts in English only.** Describe Persian colour through instruments and modes, for example "santur and tar, Dastgah-e Shur feel". Never use Persian lyrics.
- **Under dialogue, always ask for instrumental:** "Instrumental only, no vocals, no choir, no spoken words".
- **Prompt as a music brief,** not a keyword list. Include purpose, exact duration, mode (instrumental), genre and era, tempo (BPM), key, instruments, emotional arc, structure and mix notes.
- **For film scoring, time the structure** with `[mm:ss - mm:ss]` sections and intensity values (1–10) that follow the cut.
- **No named artists** and no famous melodies. Describe traits instead.

Example cue (scene 2, 95 s, under dialogue):
```text
Create a 95-second instrumental underscore for a gentle Persian family drama scene. 84 BPM, D minor,
intimate and warm, not childish, not melodramatic. Santur and soft felt piano, sustained cello pad,
light tombak played with fingers, no drums kit. Instrumental only: no vocals, no choir, no spoken words.
Leave room for dialogue: sparse mid-range, no busy lead melody, no harsh risers, controlled low end.
[00:00 - 00:12] Quiet establishing: santur arpeggio, intensity 2/10.
[00:12 - 01:10] Under conversation: steady pad and soft tombak pulse, intensity 3/10, no melodic peaks.
[01:10 - 01:25] Emotional turn: cello rises, intensity 5/10.
[01:25 - 01:35] Resolve: clean cadence with a short tail that can be cut at exactly 95 seconds.
```

Example sting (6 s, title card): "6-second instrumental title sting, modern cinematic with kamancheh and ney over warm strings, single swell resolving on a clean final note, intensity 6/10, no vocals."

## Crossfades and long films
- A 3–5 minute film needs **two or three cues** of 184 s or less, usually one per act or scene group. Never loop a short cue for minutes.
- **Overlap cues by 2–4 s** with an equal-power crossfade, placed at a musical boundary or a scene cut, and keep the tempo or key related between neighbours.
- **Fade in** over 0.5–1.5 s under the first scene. **Fade out** over 2–3 s, or end on the cue's own cadence, timed to the last cut.
- Trim to the picture before mastering. If a cue is too short, make another cue for the next section rather than time-stretching.

## QA before export
Check each of these:
- Every line is intelligible on a phone speaker at medium volume.
- There is no pumping between lines.
- There are no clicks at clip edges or render-segment seams.
- No vocals appear in instrumental cues.
- Integrated loudness is −16 ±1 LUFS, and the peak is at or below −1 dBTP after encoding.
- Room tone runs continuously across cuts.
- Music ends on a cadence or a planned fade.

---
Sources:
- Lyria prompt shape and dialogue-over-music layering: adapted from GoogleCloudPlatform/genmedia-creative-studio `genmedia-audio-engineer` (Apache-2.0, commit 19eecec).
- Mix hierarchy, ducking, loudness targets and music QA: condensed from calesthio/generative-media-skills `audio-mixing-mastering` and `providers/music-generation/google-lyria` (MIT, commit 8c85352).
- The BEHIX interval-ducking numbers, phone rendering, Persian instrument guidance and examples are original.
