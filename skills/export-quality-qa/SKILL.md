---
id: export-quality-qa
name: Final-delivery QA for BEHIX 3-5 minute animated shorts
version: 1
owner: export
tasks: [export.qa]
source: https://github.com/calesthio/generative-media-skills/tree/8c85352d5d75d4dcbe58480bd138e37b9742bab1/skills/production/governance-delivery
license: MIT
---
# Export quality QA

Use when reviewing a BEHIX film plan, timeline, or finished MP4 + SRT before publishing. QA is a release decision, not taste: judge against the project settings and the gates below, with evidence for every call.

## Evidence lanes
Label each finding:
- **Fact**: comes from the project settings, the BEHIX engine limits listed here, or a file probe (duration, codecs, size, fps).
- **Observation**: something seen or heard in the frames, captions, or audio, with a timecode such as `01:42.300`.
- **Heuristic**: a craft default used when no binding spec exists. Say that it is a default.

Never pass a gate you could not check; mark it "not verified" and name the input that would verify it.

## Severity and verdict
- **Critical** (must not ship): the file is corrupt or will not play, the duration is wrong, audio is missing when the story has dialogue, captions are missing, unreadable or out of sync, the fps does not match the project, there is unsafe flashing, or there is a rights problem (an unlicensed font, music, or likeness).
- **Major** (fix before a normal release): a caption or title sits outside the safe area, lip-sync drift, clipping, Opus audio where AAC was expected, a caption cue over three lines, or wrong line breaks in Persian.
- **Minor**: an awkward line break, a slightly long cue, or a tiny artifact visible only on pause.
- **Observation**: note it without blocking.
Never mark a defect on a face, a mouth during lip-sync, caption text, or an accessibility item as Minor.
Verdict: `Pass`, `Pass with notes`, `Revise`, or `Reject`.

## Gate 1: technical file (fact)
BEHIX exports H.264 (`avc1`) in a normal, non-fragmented MP4: boxes `ftyp`, `moov`, then `mdat`, so the file starts fast.
- Raster must match the project format exactly. Portrait 9:16 is 1080x1920, square 1:1 is 1080x1080, and landscape 16:9 is 1920x1080. There are no other sizes, and no letterboxing.
- Duration must equal the timeline duration within 0.1 s. AAC adds up to about 0.08 s of frame padding at the end, which is acceptable.
- Video ≈ 5 Mbps (30 fps) / 8 Mbps (60 fps): about 0.6 MB/s at 30 fps, ≈150 MB for 5 min. Flag files under half or over double that.

## Gate 2: frame rate (fact)
- The project setting is `fps: 30 | 60`, and the export must report the same constant frame rate. Any other value, or a variable frame rate, is Critical.
- Default 30 fps (half the frames, render time and phone memory). Use 60 only for fast moves that judder at 30, and plan a cloud render (Gate 6). Never mix frame rates in one film.

## Gate 3: safe areas per format (fact plus heuristic)
BEHIX draws the caption box centred at 84% of the frame height, with text wrapped to 84% of the width and a box up to 96% of the width.
| Format | Caption centre | Keep titles and faces inside | Avoid |
|---|---|---|---|
| Portrait 1080x1920 | y ≈ 1613 | x 54-1026, y 192-1440 | top 10% (status bar, profile) and bottom 15% (app buttons and progress bar on Reels, Shorts and TikTok) for anything other than the caption |
| Square 1080x1080 | y ≈ 907 | an inner 90% box (54 px margins) | a speaking mouth in the bottom quarter |
| Landscape 1920x1080 | y ≈ 907 | an inner 90% action box and 80% title box (192 px side margins for titles) | the floor line at 70% height when caption and feet collide |
- The caption must never cover a speaking character's mouth. If a staging puts the head below about 78% of the frame height, fix the layout or the camera, not the caption.
- Compose each format separately (a centre crop is not safe) and check frames at phone size.

## Gate 4: Persian captions (fact plus heuristic)
Burned-in captions use Vazirmatn at weight 800 with `direction: rtl`, centred, as white on a near-black box (#0b0b0b), which is far above 4.5:1 contrast.
- **Shaping**: letters must join (for example «سلام» never appears as separate letters). Separate letters, boxes (tofu), or Tahoma-looking glyphs mean the Vazirmatn font was not loaded before render, which is Major.
- **Zero-width non-joiner (ZWNJ, U+200C)**: keep it in «می‌خواهم», «نمی‌دانم», «خانه‌ها» and «کتاب‌ها». A missing ZWNJ, or a plain space in its place, is a line-break and reading defect.
- **Direction**: Latin words or digits inside a Persian line must not flip the sentence order. Prefer Persian digits («۳ دقیقه») in caption text.
- **Length**: at most 2 lines, with a hard limit of 3. Aim for about 42 characters per line or less. A cue that shrinks the font to fit is too dense; split it or shorten it.
- **Reading speed**: aim for 17 characters per second or less, and keep each cue on screen for at least about 1.2 s. Captions follow the final audio timing, never the script timing.
- **Line breaks**: break at phrase boundaries. Do not separate «را» from its object, a preposition from its noun, or a name and surname.
- **SRT sidecar**: UTF-8, numbered from 1, `HH:MM:SS,mmm --> HH:MM:SS,mmm` with a comma, start times in order, each end after its start, no overlapping cues, and a blank line between blocks. The BEHIX dialogue SRT puts the speaker and mood before the text, for example:

```
3
00:01:12,400 --> 00:01:14,900
مریم (خجالت‌زده): ببخشید، دیر رسیدم.
```

  The speaker labels must match the cast names. The SRT text must match the burned-in caption and the spoken line.
- Name off-screen speakers; add story-relevant sounds, e.g. «[صدای در]».

## Gate 5: audio (fact plus heuristic)
- The expected codec is **AAC-LC (`mp4a.40.2`)**, mono, at 128 kbps. BEHIX encodes AAC with a WASM encoder when the device has no native one.
- **Opus** in MP4 is a warned fallback that many galleries, messengers and editors cannot play: Major; re-export with AAC (other device or cloud).
- A film with dialogue but no audio track is Critical. A silent film is valid only if the story has no voiced lines.
- Loudness (heuristic for phone and social use): about -14 to -16 LUFS integrated, true peak no higher than -1 dBTP, no clipping, and dialogue clearly above music and ambience. Duck music under lines.
- Lip-sync at start, middle and end: closed mouth on «ب/پ/م» within 1-2 frames of the sound; growing drift is Major.

## Gate 6: phone memory and render location (fact plus heuristic)
BEHIX renders on the device by streaming the MP4 into private browser storage (OPFS), so the finished file is not held in RAM.
- Fact: a measured 5-minute 1080p30 film with audio rendered in about 76 s in desktop Chrome. Peak memory for the whole browser rose by about 0.36 GB, and the file was about 149 MB.
- Phones are 3-6x slower (expect 4-8 min) and need free storage of about 1.2x the file size.
- Recommend a **cloud render** when any of these is true:
  - the film is at 60 fps;
  - on Android, the film is longer than 120 s on a phone with 4 GB of memory or less (`navigator.deviceMemory` ≤ 4);
  - the film is longer than 300 s;
  - the device reports that it cannot encode this size and fps;
  - free storage is low;
  - a previous on-device export failed or the app was killed while in the background.
- Otherwise render on device; tell the user to keep the app in the foreground (Android may kill a background WebView).
- Always state frames (duration × fps), expected size, and phone vs cloud time.

## Gate 7: picture and motion (observation)
- No frames that are black, frozen, or repeated where the timeline moves.
- Continuity: costume, props, screen direction, time of day (night stays night); no popping limbs or props.
- No flashing more than 3 times per second (WCAG 2.3.1). Lightning and alarms must stay under that limit, and captions must never flash or shake.

## Report format
Reply with:
- verdict;
- project settings checked (format, fps, duration, captions on or off);
- the probe facts;
- a findings table: severity | timecode | gate | issue | evidence | fix | owner (story, characters, world, audio, export);
- what was not verified;
- the render recommendation (device or cloud) with its estimate.
Keep it short; user-facing text in Persian.

---
Sources: adapted and heavily condensed from calesthio/generative-media-skills (MIT, commit 8c85352): `governance-delivery/generated-media-qa`, `governance-delivery/media-qc-delivery`, and `audio-craft/captions-media-accessibility`. The BEHIX gates for fps, safe areas, Persian captions, AAC audio and phone memory are original and come from the BEHIX export code.
