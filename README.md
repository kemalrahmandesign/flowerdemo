# Fieldnote — flower shop hero demo

A scroll-driven hero: a camera push from a wide garden into the centre of a
single ranunculus, resolving into a product grid. Design decisions and the
image-prompt vocabulary live in [STYLE.md](./STYLE.md).

## Run it

No build step, no dependencies.

```sh
python3 -m http.server 8899
# open http://127.0.0.1:8899
```

Opening `index.html` straight off the filesystem works too.

## How the hero works

The hero is a tall scroll runway (`height: 340vh`) with a sticky stage inside
it. Scroll position through that runway becomes a single `0..1` progress value,
and everything derives from it — the push, the panel opening from inset to
full-bleed, the type retiring, the scrim lifting. Because every keyframe is a
range on the same master value (`span()` in `src/main.js`), they cannot drift
out of sync with each other.

Scroll-driven motion is **linear and lerp-smoothed, never eased**. Easing a
scroll-bound value makes it feel like it is disagreeing with your finger. The
lerp (`0.12` per frame) is what separates this from the stuttering version;
writing raw scroll values to the DOM reads as jank on anything that doesn't
fire scroll events at 60Hz.

### Two source modes

Switched by `data-mode` on the `.hero` element.

- **`stills`** (current) — two layered images faked into a continuous dolly.
  The wide plate pushes past the camera while the macro plate settles in from
  larger; both are always moving *forward*, which is why the handover reads as
  one move rather than a crossfade between two photographs.
- **`video`** — a single clip scrubbed via `currentTime`.

`stills` is **not** a placeholder that gets deleted. It stays as the fallback
for `prefers-reduced-motion` and for browsers that won't scrub reliably, so the
video is an enhancement rather than a dependency.

## Adding the video

1. Drop the clip at `public/media/push-in.mp4`.
2. Point the `<video data-layer="video">` element at it:
   ```html
   <video class="plate__layer plate__layer--video" data-layer="video"
          src="./public/media/push-in.mp4"
          muted playsinline preload="auto" aria-hidden="true"></video>
   ```

`muted` and `playsinline` are load-bearing on iOS, not decoration — without
both, the ambient loop won't autoplay.

Mode flips to `video` automatically, but **only on `canplaythrough`**. That
gate is deliberate: `currentTime` is unreliable until the clip is fully
buffered, so until then the hero stays in stills mode rather than stuttering.

### Re-encode for scrubbing — do not skip this

A normal H.264 export scrubs badly. Seeking to an arbitrary `currentTime`
forces the decoder back to the nearest keyframe, and with a default keyframe
interval (~every 250 frames) that means decoding dozens of frames per seek.
The fix is an all-intra encode — every frame its own keyframe:

```sh
ffmpeg -i push-in-source.mp4 \
  -c:v libx264 -preset slow -crf 18 \
  -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -movflags +faststart \
  -an \
  public/media/push-in.mp4
```

The tradeoff is real: this inflates a 5s 1080p clip to roughly 15–25MB. That is
the price of smooth scrubbing, and it is why the clip is short. If the size is
unacceptable, the alternative is an image sequence (~100 WebP frames painted to
a canvas) — heavier to set up, but the most bulletproof option there is.

### Ambient loop

There is no second video file. The clip opens with ~1.5s of near-static wind
before the camera moves, and at rest the hero loops just that head segment
(`AMBIENT_END` in `src/main.js`). Scrolling hands control over to the scrub.

If the generated clip starts moving earlier or later than 1.5s, change that one
constant to match — it is the only place the timing is encoded.

## Tunables

| What | Where | Note |
| --- | --- | --- |
| Push length / pace | `.hero { height }` in `styles.css` | Longer runway = slower, more deliberate. |
| Type fade-out | `span(p, 0, 0.28)` in `main.js` | Type is gone by 28% of the runway. |
| Stills handover | `span(p, 0.4, 0.72)` in `main.js` | Where wide gives way to macro. |
| Scrub smoothing | `lerp(current, target, 0.12)` | Lower = heavier, more filmic. Higher = snappier. |

## Known gaps

- Product cards are empty frames. Product photography is a separate shoot from
  the hero; filling them with more garden renders would muddy the demo.
- `Fieldnote` is a placeholder name.
- Hero imagery currently loads from the Higgsfield CDN. Vendor the files into
  `public/media/` before this goes anywhere real.
