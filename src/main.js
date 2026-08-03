/**
 * FLOWERBX concept — scroll-driven camera moves.
 *
 * Each scene is a tall runway with a sticky stage. Scroll position through
 * that runway becomes a single 0..1 progress value, and every keyframe in the
 * scene is a range on that one value (see `span`), so they cannot drift out
 * of sync with each other.
 *
 * Nothing here eases. Scroll-driven motion tracks the finger linearly and is
 * smoothed by a lerp instead (STYLE.md §4.2) -- easing a scroll-bound value
 * makes it feel like it is arguing with the input. Entrance motion, which
 * fires on its own, does ease; that lives in CSS.
 */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;

/** Remap v from [lo, hi] to 0..1, clamped. */
function span(v, lo, hi) {
  if (hi === lo) return 0;
  return clamp((v - lo) / (hi - lo), 0, 1);
}

/**
 * Per-scene choreography. Each receives the scene's progress and its parts.
 *
 * The two scenes are deliberate mirrors. Scene 1 pushes in: the world
 * enlarges, type retires, the panel opens out to full-bleed. Scene 2 pulls
 * back: the world recedes, type arrives, and the frame stays open. Both keep
 * their two plates moving in the *same* direction as each other so the
 * handover reads as one continuous camera move rather than a crossfade.
 */
const CHOREOGRAPHY = {
  hero(p, { panel, from, to }) {
    // Panel opens from inset to full-bleed as the camera commits. The inset
    // is the "print" signal at rest; losing it is what makes the arrival feel
    // like going inside the frame rather than watching it in a box.
    const opening = span(p, 0, 0.9);
    const gutter = getComputedStyle(document.documentElement)
      .getPropertyValue('--gutter').trim();
    panel.style.setProperty('--panel-inset', `calc(${gutter} * ${1 - opening})`);
    panel.style.setProperty('--panel-radius', `${lerp(2, 0, opening)}px`);

    // Type has said its piece before the camera moves with any conviction.
    panel.style.setProperty('--type-opacity', String(1 - span(p, 0, 0.28)));
    // The scrim exists only to protect type. Once type is gone, so is it.
    panel.style.setProperty('--scrim-opacity', String(1 - span(p, 0.34, 0.6)));

    // Both plates push forward; the near one past the lens, the far one
    // settling in from larger.
    from.style.transform = `scale(${lerp(1, 2.6, p)})`;
    from.style.opacity = String(1 - span(p, 0.4, 0.72));
    to.style.transform = `scale(${lerp(1.7, 1, p)})`;
    to.style.opacity = String(span(p, 0.4, 0.72));
  },

  studio(p, { panel, from, to }) {
    // Type arrives late, once the shot has resolved enough to have somewhere
    // to put it -- the inverse of the hero, where it leaves early.
    panel.style.setProperty('--type-opacity', String(span(p, 0.52, 0.82)));
    panel.style.setProperty('--scrim-opacity', String(span(p, 0.42, 0.75)));

    // A pull-back cannot be built by shrinking plates. These are object-fit:
    // cover, so anything below scale(1) stops covering the panel and punches
    // a hole to the background. Both plates therefore stay >= 1, and the
    // recede is expressed by the incoming wide plate UN-zooming from 2x down
    // to its natural size -- which is what pulling back actually looks like.
    //
    // The macro plate holds at exactly 1 rather than drifting, because scene
    // 1 ends on that same frame at that same scale. Any other value here pops
    // at the seam.
    from.style.transform = 'scale(1)';
    from.style.opacity = String(1 - span(p, 0.12, 0.42));
    to.style.transform = `scale(${lerp(2, 1, p)})`;
    to.style.opacity = String(span(p, 0.12, 0.42));
  },
};

/** Seconds at the head of the hero clip that are near-static wind, before
 *  the camera starts moving. At rest we loop only this segment, which buys
 *  the ambient "everything is alive" state without a second video file.
 *  If the generated clip starts moving at a different time, this is the only
 *  place that timing is encoded. */
const AMBIENT_END = 1.5;

/** Below this progress a scene counts as at rest. */
const REST = 0.015;

class Scene {
  constructor(root) {
    this.root = root;
    this.name = root.dataset.scene;
    this.panel = root.querySelector('[data-panel]');
    this.from = root.querySelector('[data-layer="from"]');
    this.to = root.querySelector('[data-layer="to"]');
    this.video = root.querySelector('[data-layer="video"]');
    this.choreograph = CHOREOGRAPHY[this.name];

    this.target = 0;
    this.current = 0;

    // Only the hero idles on ambient wind; the studio scene has no at-rest
    // state worth looping, since you arrive at it already scrolling.
    this.ambient = this.name === 'hero';

    this.wireVideo();
  }

  wireVideo() {
    if (!this.video || !this.video.getAttribute('src')) return;
    // A scrubbable clip must be fully buffered before currentTime is
    // reliable, especially on iOS Safari. Until then, stay on stills rather
    // than show a hero that stutters.
    this.video.addEventListener('canplaythrough', () => {
      this.root.dataset.mode = 'video';
    }, { once: true });
  }

  readProgress() {
    const rect = this.root.getBoundingClientRect();
    const runway = this.root.offsetHeight - window.innerHeight;
    if (runway <= 0) return 0;
    return clamp(-rect.top / runway, 0, 1);
  }

  /** True while still interpolating toward the scroll position. */
  step() {
    this.target = this.readProgress();
    const delta = this.target - this.current;
    // Snap once further interpolation would be invisible, so the rAF loop
    // can actually go idle instead of chasing forever.
    if (Math.abs(delta) < 0.0002) {
      if (this.current === this.target) return false;
      this.current = this.target;
      this.draw();
      return false;
    }
    this.current = lerp(this.current, this.target, 0.12);
    this.draw();
    return true;
  }

  draw() {
    const p = this.current;
    this.choreograph(p, { panel: this.panel, from: this.from, to: this.to });
    if (this.root.dataset.mode === 'video') this.scrub(p);
  }

  scrub(p) {
    const v = this.video;
    if (!v || !v.duration || Number.isNaN(v.duration)) return;

    if (this.ambient && p <= REST) {
      // At rest: let the wind play, looping only the static head of the clip.
      if (v.paused) v.play().catch(() => {});
      if (v.currentTime >= AMBIENT_END) v.currentTime = 0;
      return;
    }

    if (!v.paused) v.pause();
    v.currentTime = p * v.duration;
  }
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const scenes = [...document.querySelectorAll('[data-scene]')].map((el) => new Scene(el));

let ticking = false;

function frame() {
  // Step every scene each frame; keep looping while any is still settling.
  const busy = scenes.map((s) => s.step()).some(Boolean);
  if (busy) {
    requestAnimationFrame(frame);
  } else {
    ticking = false;
  }
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
    // Both scenes hold on their opening frame. The stills were composed to
    // stand alone, so the page still reads with the camera moves removed.
    scenes.forEach((s) => s.draw());
    return;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  scenes.forEach((s) => {
    s.target = s.current = s.readProgress();
    s.draw();
  });
  onScroll();
}

init();
