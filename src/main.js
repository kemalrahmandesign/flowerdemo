/**
 * FLOWERBX concept — one film, scrubbed by scroll.
 *
 * Scroll position through the runway becomes a single 0..1 value. That value
 * seeks one concatenated film and drives every text moment.
 *
 * The film NEVER plays. It is paused for its entire life and moved only by
 * currentTime. An earlier build looped the static head of the clip at rest to
 * fake ambient wind, which fought the scrub -- playback and seeking were both
 * touching currentTime, so the two took turns winning.
 *
 * Performance rules this file follows, learned the hard way:
 *
 *   1. NEVER read computed style in the loop. An earlier version called
 *      getComputedStyle() every frame, forcing a style recalculation 60x a
 *      second for a value that never changed.
 *   2. Never write currentTime more precisely than the film can show. At
 *      20fps, seeks closer than half a frame are invisible but still cost a
 *      full decode.
 *   3. backdrop-filter is only switched on while it is actually visible.
 *      Blurring the backdrop of a scrubbing video re-runs the blur on every
 *      decoded frame, which is exactly the kind of per-frame cost this file
 *      exists to avoid.
 */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;

/** Remap v from [lo, hi] to 0..1, clamped. Every moment below is a range on
 *  the same master progress, so they cannot drift apart. */
function span(v, lo, hi) {
  if (hi === lo) return 0;
  return clamp((v - lo) / (hi - lo), 0, 1);
}

/**
 * Where things happen on the film's 0..1 timeline.
 *
 * The film is two clips concatenated, so ~0.5 is the deepest point inside the
 * flower -- the end of the push and the start of the pull-back. The three text
 * moments are placed against that: one before, one on it, one at the far end.
 */
const TIMELINE = {
  statementOut: [0, 0.14],
  scrollCueOut: [0, 0.07],
  midIn:  [0.36, 0.45],
  midOut: [0.55, 0.63],
  frostIn: [0.82, 0.94],
};

/** Frames per second of the encoded film. Used to avoid sub-frame seeks. */
const FPS = 20;

const root = document.querySelector('[data-film]');
const video = document.querySelector('[data-video]');
const stillWide = document.querySelector('[data-still="wide"]');
const stillBench = document.querySelector('[data-still="bench"]');

const cues = {
  statement: document.querySelector('[data-cue="statement"]'),
  mid: document.querySelector('[data-cue="mid"]'),
  frost: document.querySelector('[data-cue="frost"]'),
  scroll: document.querySelector('[data-cue="scroll"]'),
};
const scrims = {
  hero: document.querySelector('[data-scrim="hero"]'),
  mid: document.querySelector('[data-scrim="mid"]'),
};

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

let target = 0;
let current = 0;
let ticking = false;
let lastSeek = -1;
let scrubbable = false;
let frostLive = false;

function readProgress() {
  const rect = root.getBoundingClientRect();
  const runway = root.offsetHeight - window.innerHeight;
  if (runway <= 0) return 0;
  return clamp(-rect.top / runway, 0, 1);
}

function draw(p) {
  const statement = 1 - span(p, ...TIMELINE.statementOut);
  // In, then back out: the beat belongs to the macro frame only.
  const mid = Math.min(span(p, ...TIMELINE.midIn), 1 - span(p, ...TIMELINE.midOut));
  const frost = span(p, ...TIMELINE.frostIn);

  cues.statement.style.opacity = String(statement);
  cues.scroll.style.opacity = String(1 - span(p, ...TIMELINE.scrollCueOut));
  cues.mid.style.opacity = String(mid);
  cues.frost.style.opacity = String(frost);

  // Each scrim protects one text moment and fades with it, rather than
  // sitting there dimming the footage for its own sake.
  scrims.hero.style.opacity = String(statement);
  scrims.mid.style.opacity = String(mid);

  // Only composite the backdrop blur while the panel is actually on screen.
  const wantFrost = frost > 0.001;
  if (wantFrost !== frostLive) {
    frostLive = wantFrost;
    cues.frost.classList.toggle('is-live', wantFrost);
  }

  if (scrubbable) scrub(p);
  else drawStills(p);
}

/** Fallback only. Both plates stay at scale >= 1 -- these are object-fit:
 *  cover, so anything below 1 stops covering the frame and punches a hole
 *  through to the background. */
function drawStills(p) {
  const swap = span(p, 0.42, 0.62);
  stillWide.style.opacity = String(1 - swap);
  stillWide.style.transform = `scale(${lerp(1, 1.6, p)})`;
  stillBench.style.opacity = String(swap);
  stillBench.style.transform = `scale(${lerp(1.6, 1, p)})`;
}

function scrub(p) {
  const d = video.duration;
  if (!d || Number.isNaN(d)) return;

  const t = p * d;
  // A seek finer than half a frame cannot be seen but still costs a decode.
  if (lastSeek < 0 || Math.abs(t - lastSeek) >= 0.5 / FPS) {
    video.currentTime = t;
    lastSeek = t;
  }
}

function frame() {
  target = readProgress();
  const delta = target - current;
  // Snap once further interpolation would be invisible, so the loop can go
  // idle instead of chasing forever.
  if (Math.abs(delta) < 0.0002) {
    if (current !== target) {
      current = target;
      draw(current);
    }
    ticking = false;
    return;
  }
  // Smoothing factor. Higher = more attached to the finger, lower = more
  // filmic drift. At 0.12 the tail took ~0.6s to settle across the full
  // range, which reads as lag even when decoding is instant.
  current = lerp(current, target, 0.18);
  draw(current);
  requestAnimationFrame(frame);
}

function onScroll() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(frame);
  }
}

function revealShop() {
  const shop = document.querySelector('[data-shop]');
  shop.querySelectorAll('.card').forEach((card, i) => {
    card.style.setProperty('--i', String(i));
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        shop.classList.add('is-revealed');
        observer.disconnect();
      }
    });
  }, { threshold: 0.15 });
  observer.observe(shop);
}

function init() {
  revealShop();

  if (reduced.matches) {
    // Holds on the opening frame. The stills were composed to stand alone,
    // so the page still reads with the camera move removed entirely.
    draw(0);
    return;
  }

  // currentTime is unreliable until the file is fully buffered, especially on
  // iOS Safari. Until then the stills carry the page rather than showing a
  // hero that stutters.
  video.addEventListener('canplaythrough', () => {
    // Belt and braces: nothing should ever have started it, but a paused
    // element is the invariant this whole file depends on.
    video.pause();
    scrubbable = true;
    root.dataset.ready = 'true';
    lastSeek = -1;
    draw(current);
  }, { once: true });

  // If anything ever does start playback -- a stray gesture, a browser
  // heuristic -- put it straight back to paused rather than letting it race
  // the scrub.
  video.addEventListener('play', () => video.pause());

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  target = current = readProgress();
  draw(current);
}

init();
