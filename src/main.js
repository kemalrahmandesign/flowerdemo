/**
 * Fieldnote hero — scroll-driven camera push.
 *
 * Scroll position through the hero runway becomes a 0..1 progress value.
 * That single number drives everything: the push, the panel opening out to
 * full-bleed, and the type retiring. Nothing here eases -- scroll-driven
 * motion tracks the finger linearly and is smoothed by a lerp instead
 * (STYLE.md §4.2). The lerp is what separates "expensive" from "janky";
 * writing scroll values straight to the DOM reads as stuttering on any
 * device that doesn't fire scroll events at 60Hz.
 */

const hero = document.querySelector('[data-hero]');
const panel = document.querySelector('[data-panel]');
const wide = document.querySelector('[data-layer="wide"]');
const macro = document.querySelector('[data-layer="macro"]');
const video = document.querySelector('[data-layer="video"]');
const shop = document.querySelector('[data-shop]');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Seconds at the head of the clip that are near-static wind, before the
 *  camera starts moving. At rest we loop just this segment, which buys the
 *  ambient "everything is alive" state without a second video file. */
const AMBIENT_END = 1.5;

/** Below this progress the hero is considered at rest. */
const REST = 0.015;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;

/** Remap v from [inLo, inHi] to 0..1, clamped. Every keyframe below is a
 *  range on the same master progress value rather than its own timeline,
 *  which keeps them impossible to desynchronise. */
function span(v, inLo, inHi) {
  if (inHi === inLo) return 0;
  return clamp((v - inLo) / (inHi - inLo), 0, 1);
}

let target = 0;   // where the scroll says we are
let current = 0;  // where we're actually drawing, chasing target
let ticking = false;

function readProgress() {
  const rect = hero.getBoundingClientRect();
  const runway = hero.offsetHeight - window.innerHeight;
  if (runway <= 0) return 0;
  return clamp(-rect.top / runway, 0, 1);
}

function draw(p) {
  // Panel opens from inset to full-bleed as the camera commits. The inset is
  // the "print" signal at rest; losing it is what makes the arrival feel like
  // you've gone inside the frame rather than watched it in a box.
  const opening = span(p, 0, 0.9);
  const gutter = getComputedStyle(document.documentElement)
    .getPropertyValue('--gutter').trim();
  panel.style.setProperty('--panel-inset', `calc(${gutter} * ${1 - opening})`);
  panel.style.setProperty('--panel-radius', `${lerp(2, 0, opening)}px`);

  // Type retires early and fast -- it has said its piece by the time the
  // camera is moving with any conviction. One layer moves at a time
  // (STYLE.md §4.1): the world moves, the type only fades.
  panel.style.setProperty('--type-opacity', String(1 - span(p, 0, 0.28)));

  // Scrim is only there to protect type. Once the type is gone, so is it.
  panel.style.setProperty('--scrim-opacity', String(1 - span(p, 0.34, 0.6)));

  if (hero.dataset.mode === 'video') {
    drawVideo(p);
  } else {
    drawStills(p);
  }
}

/** Stills mode: two layers faking a continuous dolly. The wide plate pushes
 *  past the camera while the macro plate settles in from larger -- both are
 *  always moving *forward*, so the handover reads as one continuous move
 *  rather than a crossfade between two photographs. */
function drawStills(p) {
  const push = span(p, 0, 1);
  wide.style.transform = `scale(${lerp(1, 2.6, push)})`;
  wide.style.opacity = String(1 - span(p, 0.4, 0.72));

  macro.style.transform = `scale(${lerp(1.7, 1, push)})`;
  macro.style.opacity = String(span(p, 0.4, 0.72));
}

/** Video mode: scrub currentTime directly. */
function drawVideo(p) {
  if (!video.duration || Number.isNaN(video.duration)) return;

  if (p <= REST) {
    // At rest: let the wind play. Loop only the static head of the clip.
    if (video.paused) video.play().catch(() => {});
    if (video.currentTime >= AMBIENT_END) video.currentTime = 0;
    return;
  }

  if (!video.paused) video.pause();
  video.currentTime = p * video.duration;
}

function frame() {
  // Snap when we're close enough that further interpolation is invisible,
  // so the rAF loop can actually go idle instead of chasing forever.
  const delta = target - current;
  if (Math.abs(delta) < 0.0002) {
    current = target;
    draw(current);
    ticking = false;
    return;
  }
  current = lerp(current, target, 0.12);
  draw(current);
  requestAnimationFrame(frame);
}

function onScroll() {
  target = readProgress();
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(frame);
  }
}

function init() {
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

  if (reduced.matches) {
    // Hero holds on frame 0; the composition was built to stand alone.
    draw(0);
    return;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // A scrubbable clip must be fully buffered before currentTime is reliable,
  // especially on iOS Safari. Until it is, stay in stills mode rather than
  // showing a hero that stutters.
  if (video && video.getAttribute('src')) {
    video.addEventListener('canplaythrough', () => {
      hero.dataset.mode = 'video';
      onScroll();
    }, { once: true });
  }

  target = current = readProgress();
  draw(current);
  onScroll();
}

init();
