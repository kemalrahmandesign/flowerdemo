/**
 * FLOWERBX concept — one film, scrubbed by scroll.
 *
 * Scroll position through the runway becomes a single 0..1 value. That value
 * seeks one concatenated film and drives every caption. There is no source
 * switching, no crossfading between clips, and no per-scene state.
 *
 * Performance rules this file follows, learned the hard way:
 *
 *   1. NEVER read computed style in the loop. Earlier versions called
 *      getComputedStyle() every frame to resolve --gutter, which forces a
 *      style recalculation 60x a second. Now JS writes only unitless numbers
 *      into custom properties and CSS does the arithmetic in calc().
 *   2. Never write currentTime more precisely than the film can show. At
 *      20fps, seeks closer together than half a frame are invisible work,
 *      and each one still costs a decode.
 *   3. Nothing large is transformed. The film element is never scaled -- the
 *      camera move is baked into the footage, which is the whole point.
 */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;

/** Remap v from [lo, hi] to 0..1, clamped. Every keyframe below is a range on
 *  the same master progress, so they cannot drift apart. */
function span(v, lo, hi) {
  if (hi === lo) return 0;
  return clamp((v - lo) / (hi - lo), 0, 1);
}

/**
 * Where things happen on the film's 0..1 timeline.
 *
 * The film is two generated clips concatenated, so the midpoint is roughly
 * where the push-in becomes the pull-back -- the moment the camera is deepest
 * inside the flower. Captions are placed either side of it.
 */
const TIMELINE = {
  // The opening statement has said its piece before the camera commits.
  statementOut: [0, 0.16],
  scrollCueOut: [0, 0.08],
  // The studio caption arrives as the worktable resolves, landing in the
  // open upper-left the shot was composed to leave empty.
  asideIn: [0.70, 0.88],
  // The panel opens from inset to full-bleed early, then stays open.
  panelOpen: [0, 0.22],
};

/** Frames per second of the encoded film. Used to avoid sub-frame seeks. */
const FPS = 20;

/** Seconds at the head of the film that are near-static wind, before the
 *  camera starts moving. At rest we loop only this, which gives the ambient
 *  "everything is alive" state without a second file. */
const AMBIENT_END = 1.5;

/** Below this progress the film counts as at rest. */
const REST = 0.012;

const root = document.querySelector('[data-film]');
const panel = document.querySelector('[data-panel]');
const video = document.querySelector('[data-video]');
const stillWide = document.querySelector('[data-still="wide"]');
const stillBench = document.querySelector('[data-still="bench"]');
const cues = {
  statement: document.querySelector('[data-cue="statement"]'),
  aside: document.querySelector('[data-cue="aside"]'),
  scroll: document.querySelector('[data-cue="scroll"]'),
};
const scrims = {
  bottom: document.querySelector('[data-scrim="bottom"]'),
  corner: document.querySelector('[data-scrim="corner"]'),
};

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

let target = 0;
let current = 0;
let ticking = false;
let lastSeek = -1;
let scrubbable = false;

function readProgress() {
  const rect = root.getBoundingClientRect();
  const runway = root.offsetHeight - window.innerHeight;
  if (runway <= 0) return 0;
  return clamp(-rect.top / runway, 0, 1);
}

function draw(p) {
  // Only unitless numbers cross the JS/CSS boundary. CSS resolves the units.
  const open = span(p, ...TIMELINE.panelOpen);
  panel.style.setProperty('--open', String(1 - open));

  cues.statement.style.opacity = String(1 - span(p, ...TIMELINE.statementOut));
  cues.scroll.style.opacity = String(1 - span(p, ...TIMELINE.scrollCueOut));
  cues.aside.style.opacity = String(span(p, ...TIMELINE.asideIn));

  // Each scrim exists only to protect the caption above it, so it tracks
  // that caption exactly rather than sitting there dimming the footage.
  scrims.bottom.style.opacity = String(1 - span(p, ...TIMELINE.statementOut));
  scrims.corner.style.opacity = String(span(p, ...TIMELINE.asideIn));

  if (scrubbable) scrub(p);
  else drawStills(p);
}

/** Fallback only. Both plates stay at scale >= 1 -- these are object-fit:
 *  cover, so anything below 1 stops covering the panel and punches a hole
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

  if (p <= REST) {
    // At rest: let the wind play, looping only the static head.
    if (video.paused) video.play().catch(() => {});
    if (video.currentTime >= AMBIENT_END) video.currentTime = 0;
    lastSeek = -1;
    return;
  }

  if (!video.paused) video.pause();

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
  // range, which reads as lag even when decoding is instant. 0.18 keeps the
  // weight without the rubber band.
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
    scrubbable = true;
    root.dataset.ready = 'true';
    draw(current);
  }, { once: true });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  target = current = readProgress();
  draw(current);
}

init();
