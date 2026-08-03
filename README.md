# FLOWERBX — concept redesign

An unofficial concept redesign. Scroll drives one continuous camera move: a
push from a wide garden into the centre of a single ranunculus, then a pull
back out to the hands that cut it, resolving into a product grid.

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

**One film, one scrub, one runway.** The two generated clips are concatenated
into a single 10s file, so nothing switches source at runtime and there is no
seam to hide. Scroll position through a 600vh runway becomes a single `0..1`
value that seeks the film and drives every caption. Captions are ranges on
that one timeline (`TIMELINE` in `src/main.js`), so they cannot drift apart.

Scroll-driven motion is linear and lerp-smoothed, never eased — easing a
scroll-bound value makes it feel like it is arguing with your finger.

The stills are a fallback only: `prefers-reduced-motion`, or a video that
never becomes scrubbable. The page holds on them until `canplaythrough`,
because `currentTime` is unreliable until the file is fully buffered.

## Why the first build was laggy

Worth recording, because every one of these is a trap you hit again.

1. **The clips were never encoded for scrubbing.** Two 1080p24 files, ~31MB
   each, with a normal keyframe interval. Every `currentTime` write sent the
   decoder back to the previous keyframe and re-decoded forward — over 62MB of
   video streamed from a CDN. The merged, all-intra, 20fps, 1280-wide film is
   **7MB with all 202 frames as keyframes**, so a seek decodes exactly one.
2. **A forced style recalculation every frame.** The draw loop called
   `getComputedStyle()` to resolve `--gutter`, 60× a second, for a value that
   never changes. Now JS writes only unitless numbers into custom properties
   and CSS does the arithmetic in `calc()`. Verified at zero calls during a
   scroll burst.
3. **Two video elements both `preload="auto"`**, both decoding, both with
   `will-change` pinning large textures in GPU memory. Now one film, and
   `will-change` only on the fallback stills.
4. **Sub-frame seeks.** At 20fps, `currentTime` writes closer together than
   half a frame are invisible but still cost a decode. They are now skipped.

There is also a rule the layout depends on: the plates are `object-fit:
cover`, so **any scale below 1 stops covering the panel** and punches a hole
through to the background. A pull-back has to be built by un-zooming the
incoming layer from above 1, never by shrinking anything.

## Rebuilding the film

`./scripts/vendor.sh` downloads the source clips and stills, merges the clips,
re-encodes all-intra, verifies the keyframe count, and repoints `index.html`
at the local files. Needs `ffmpeg` (`brew install ffmpeg`).

Run it before this goes anywhere real — the CDN URLs are generation
artifacts, not hosting, and they can rotate.

If 7MB is still too heavy, the escalation is an image sequence: ~200 WebP
frames painted to a canvas. Heavier to set up, but the most bulletproof
scrubbing there is.

## Tunables

| What | Where | Note |
| --- | --- | --- |
| Pace of the whole move | `.film { height: 600vh }` | Longer runway = slower, more deliberate. |
| Caption timing | `TIMELINE` in `main.js` | Ranges on the film's 0..1 timeline. |
| Scrub smoothing | `lerp(current, target, 0.18)` | Higher = attached to the finger. Below ~0.12 the tail reads as lag. |
| Ambient loop length | `AMBIENT_END` | Seconds of static wind at the head, looped at rest. |

## Known gaps

- Product cards are empty frames. Product photography is a separate shoot.
- Mobile is unaddressed by choice — the 16:9 film crops to a centre strip in
  a portrait panel.
