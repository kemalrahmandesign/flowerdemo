# FLOWERBX — concept redesign

An unofficial concept redesign. A looping film carries one continuous camera
move — a push from a wide garden into the centre of a single ranunculus, then
a pull back out to the hands that cut it — behind a headline that assembles
itself out of the wind, resolving into a product grid.

Not affiliated with FLOWERBX Ltd. Products, prices and imagery are fictional.

Design decisions and the image-prompt vocabulary live in [STYLE.md](./STYLE.md).

## Run it

No build step, no dependencies.

```sh
python3 -m http.server 8899
# open http://127.0.0.1:8899
```

Live at https://kemalrahmandesign.github.io/flowerdemo/ — pushes to
`claude/flower-shop-hero-section-a2026s` redeploy automatically.

## Architecture

**The film loops on its own clock.** The two generated clips are concatenated
into a single 10s file that autoplays, muted, on repeat. Scroll no longer
touches it.

Scroll drives only the text moments, as ranges on a 300vh runway (`TIMELINE`
in `src/main.js`). Because the film is no longer scrubbed, those moments are
**not** pinned to particular frames any more — they appear over whatever is
playing. The mid beat and the frosted panel were originally written against
the macro centre and the worktable; if that pairing matters, the scrub has to
come back.

Scroll-driven opacity is linear and lerp-smoothed, never eased — easing a
scroll-bound value makes it feel like it is arguing with your finger.

The video's `poster` is the opening still. It covers the gap before the first
frame decodes, and stands in entirely when autoplay is refused or reduced
motion is set.

### The wind reveal

The hero headline assembles itself out of the air on load. Each glyph starts
downwind — pushed right, lifted, tilted, blurred to nothing — and settles into
place, left to right: a blow-away run backwards.

Text is split into per-word and per-glyph spans by `splitGlyphs()`. Words stay
`nowrap` so lines still break at spaces rather than between letters, and the
original string is preserved as an `aria-label` with the split spans hidden
from assistive tech.

Per-glyph offsets are **randomised**. An identical offset on every letter
reads as a mechanical slide; the variation is the whole reason it looks like
air moved each one separately.

Two details that matter:

- The run waits for `document.fonts.ready` before starting, because glyph
  boxes measured against the fallback serif shift when Instrument Serif
  arrives, and a reflow mid-animation is very visible when every letter is
  separately positioned. The wait is capped at 1.2s — a font that never
  resolves must not mean a hero that never appears.
- Both hiding rules are scoped to attributes only JS sets (`data-split`,
  `data-revealing`), so if the script fails the text is simply there.

## Why scroll-scrubbing was laggy

The scrub is gone for now, but this is kept because every one of these is a
trap you hit again the moment it comes back.

1. **The clips were never encoded for scrubbing.** Two 1080p24 files, ~31MB
   each, with a normal keyframe interval. Every `currentTime` write sent the
   decoder back to the previous keyframe and re-decoded forward — over 62MB of
   video streamed from a CDN. The merged, all-intra, 30fps, 1280-wide film is
   **7.4MB with all 303 frames as keyframes**, so a seek decodes exactly one.
2. **Seeks were being issued faster than they could complete.** Seeking is
   asynchronous: assigning `currentTime` while a previous seek is in flight
   makes the browser abort and restart it. Writing on every animation frame —
   60 a second, against a decoder that manages 20–30 — meant most seeks were
   thrown away mid-flight and the picture lurched between whichever few
   survived. Now exactly one seek is ever in flight and it chases the latest
   target on completion. Measured at **100% completion rate, max 1 in
   flight**, against a deliberately harder non-all-intra test clip.
3. **20fps was the wrong encode.** Scrubbing exposes every frame boundary when
   you scroll slowly, so more frames is smoother — the opposite of the
   tradeoff that applies to normal playback. 30fps cost 6% more bytes for 50%
   more frames.
4. **A forced style recalculation every frame.** The draw loop called
   `getComputedStyle()` to resolve `--gutter`, 60× a second, for a value that
   never changes. Now JS writes only unitless numbers into custom properties
   and CSS does the arithmetic in `calc()`. Verified at zero calls during a
   scroll burst.
5. **Two video elements both `preload="auto"`**, both decoding, both with
   `will-change` pinning large textures in GPU memory. Now one film, and
   `will-change` only on the fallback stills.
6. **Sub-frame seeks.** At 30fps, `currentTime` writes closer together than
   half a frame are invisible but still cost a decode. They are now skipped.

There is also a rule the layout depends on: the plates are `object-fit:
cover`, so **any scale below 1 stops covering the panel** and punches a hole
through to the background. A pull-back has to be built by un-zooming the
incoming layer from above 1, never by shrinking anything.

## Rebuilding the film

`./scripts/vendor.sh` downloads the source clips and stills, merges the clips,
re-encodes all-intra at 30fps, verifies the keyframe count, and repoints `index.html`
at the local files. Needs `ffmpeg` (`brew install ffmpeg`).

Run it before this goes anywhere real — the CDN URLs are generation
artifacts, not hosting, and they can rotate.

If 7.4MB is still too heavy, the escalation is an image sequence: ~300 WebP
frames painted to a canvas. Heavier to set up, but the most bulletproof
scrubbing there is.

## Tunables

| What | Where | Note |
| --- | --- | --- |
| Length of the text journey | `.film { height: 300vh }` | Longer runway = more scroll between moments. |
| Text moment timing | `TIMELINE` in `main.js` | Ranges on the scroll runway, 0..1. |
| Fade smoothing | `lerp(current, target, 0.18)` | Higher = more attached to the finger. |
| Reveal stagger | `--i * 26ms` in `styles.css` | Per-glyph delay. Higher = slower left-to-right sweep. |
| Reveal drift | `--dx / --dy / --rot` in `splitGlyphs()` | How far downwind each glyph starts. |

## Known gaps

- Product cards are empty frames. Product photography is a separate shoot.
- Mobile is unaddressed by choice — the 16:9 film crops to a centre strip in
  a portrait panel.
