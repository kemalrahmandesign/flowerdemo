# Fieldnote — Design Style

Working name: **Fieldnote**. Placeholder, swap freely — it exists as a single
constant in the code, not scattered through markup.

Register: **editorial minimal**. Reference points are Aesop, Kinfolk, Toteme —
restraint, generous air, one confident serif, and a palette narrow enough that
a single blush note reads as an event.

This document is the source of truth for two things that are easy to let drift
apart: the CSS, and the language we feed the image model. Section 5 exists
because generated footage bakes the look into pixels — regenerating costs
credits, so the prompt vocabulary is version-controlled like any other asset.

---

## 1. Palette

| Token | Hex | Use |
| --- | --- | --- |
| `--paper` | `#F5F2EC` | Page background. Warm bone, never pure white. |
| `--paper-raised` | `#FBFAF7` | Cards, the product grid, anything lifted off the page. |
| `--ink` | `#2A2724` | All body text. Warm near-black, never `#000`. |
| `--ink-soft` | `#6B655D` | Secondary text, captions, meta. |
| `--sage` | `#8A9080` | Rules, borders, dormant UI. |
| `--stem` | `#4A5244` | Deep green. Rare — hover states and the footer only. |
| `--blush` | `#D9B5AC` | The single accent. See the budget below. |

**Blush budget: three uses per viewport, maximum.** This is the rule that keeps
the whole thing from tipping into generic wellness-brand. When everything is
bone and sage, one blush underline carries real weight. Five of them carry none.

Pure black and pure white appear nowhere. Every neutral is warm-shifted — that
is most of what separates "expensive" from "default Tailwind" here.

## 2. Typography

- **Display** — Instrument Serif, regular. High-contrast, genuinely editorial,
  and free. Used at sizes that feel slightly too large: the wordmark and the
  hero line want `clamp(3rem, 9vw, 8rem)`.
- **Body / UI** — Inter. `400` for prose, `500` for buttons and labels.

Rules:

- Display type gets **negative tracking** (`-0.02em`) and tight leading (`0.95`)
  at large sizes. Untracked serif at 8rem looks like a word processor.
- UI labels get **positive tracking** (`0.08em`) at small sizes, uppercase,
  `--ink-soft`. This contrast between the two — loose small caps against tight
  huge serif — is doing most of the editorial work.
- Never more than two type sizes visible in one viewport besides the display.

## 3. Layout

- Content column maxes at `1240px`, but the hero video panel is **inset**, not
  full-bleed: `margin: 0 clamp(1rem, 5vw, 5rem)`, corners at `2px` (nearly
  square — rounded corners read as software, not print).
- Whitespace is the product. Vertical rhythm in multiples of `8px`, and section
  padding that feels excessive: `clamp(6rem, 14vh, 12rem)`.
- Asymmetry over centering for everything except the flower itself. The
  wordmark sits left, the nav right, the hero line hangs at the lower-left of
  the video panel.

## 4. Motion

Three rules, in priority order:

1. **One layer moves at a time.** Either the world moves and the type is
   perfectly still, or the type moves and the world holds. Both moving is where
   hero sections turn to soup.
2. **Scroll-driven motion is linear-tracked, entrance motion is eased.** Anything
   tied to scroll position must feel like the user is dragging it directly —
   `linear`, with a lerp for smoothing, never an ease curve. Anything that fires
   on its own (fades, reveals) uses `cubic-bezier(0.22, 1, 0.36, 1)` over
   `600–800ms`.
3. **Nothing bounces.** No overshoot, no spring, no elastic. A florist is not
   playful; it is composed.

`prefers-reduced-motion` is not an afterthought here — the ambient loop pauses
on frame 0 and the scrub is replaced by plain opacity fades. The hero still
reads because the still frames were composed to stand alone.

## 5. Image prompt vocabulary

Every generated asset pulls from this block. Consistency across frames matters
more than any single frame being beautiful, because the push-in interpolates
between them — a palette shift mid-scrub reads as a glitch.

**Always include:**

> muted desaturated editorial palette, bone and cream and pale sage green, a
> single note of soft blush, soft diffused overcast light, extremely shallow
> depth of field, fine 35mm film grain, gentle halation, nostalgic analog
> cinematic feel like a remembered film, calm and still, no vivid saturation

The nostalgia note is doing more work than it looks. Grain and halation soften
exactly the edges where generated footage betrays itself — over-crisp petal
boundaries, too-clean gradients — so the analog treatment buys authenticity as
well as mood. Keep it on every asset, stills included, or the video will not
cut against them.

**Always exclude** (the failure modes of AI garden footage):

> vivid rainbow flowerbeds, mixed bright colors, harsh direct sunlight, hard
> specular highlights, HDR, oversaturated greens, glossy digital rendering,
> lens flare, busy backgrounds

**Subject constant:** cream ranunculus on slender stems. The macro payoff is the
tightly whorled petal spiral at the center — that is the shot the entire scroll
is traveling toward, so it gets composed first and everything else matches it.

**Framing constant:** negative space reserved in the upper third of wide shots
for typography. Composing this in beats masking it out later.

## 6. What this deliberately is not

- Not full-bleed video. Full-bleed reads generic-agency; an inset panel with air
  around it reads print.
- Not a rainbow of blooms. One species, one palette.
- Not bouncy, not parallax-everywhere, not a scroll-jacked five-act narrative.
  One camera move, executed cleanly.
