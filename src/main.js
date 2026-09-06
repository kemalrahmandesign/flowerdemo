/**
 * FLOWERBX concept.
 *
 * The film loops on its own clock -- it is no longer scrubbed. Scroll drives
 * only the text moments, and the hero headline assembles itself out of the
 * wind on load.
 */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;

/** Remap v from [lo, hi] to 0..1, clamped. Every moment below is a range on
 *  the same master progress, so they cannot drift apart. */
function span(v, lo, hi) {
  if (hi === lo) return 0;
  return clamp((v - lo) / (hi - lo), 0, 1);
}

/** Where the text moments sit on the scroll runway. With the film on its own
 *  clock these are no longer pinned to particular frames -- they are purely
 *  positions in the scroll. */
const TIMELINE = {
  statementOut: [0, 0.18],
  scrollCueOut: [0, 0.10],
  midIn:  [0.30, 0.42],
  midOut: [0.52, 0.62],
  frostIn: [0.74, 0.90],
};

const root = document.querySelector('[data-film]');
const video = document.querySelector('[data-video]');

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

/* ------------------------------------------------------------- reveal --- */

/**
 * Split text into per-glyph spans so the headline can reassemble out of the
 * wind: each letter starts downwind -- pushed right, lifted, tilted, blurred
 * to nothing -- and settles back into place, left to right. Running the blow
 * backwards, in other words.
 *
 * Words are wrapped too, and kept nowrap, so line breaking still happens at
 * spaces rather than between letters.
 *
 * Per-glyph offsets are randomised. An identical offset on every letter reads
 * as a mechanical slide; varying them is what makes it look like air moved
 * each one separately.
 */
function splitGlyphs(el) {
  // textContent alone would run the two lines together ("Everythingin
  // season"), because a <br> contributes no character. Treat it as a space.
  const label = document.createElement('div');
  label.innerHTML = el.innerHTML.replace(/<br\s*\/?>/gi, ' ');
  el.setAttribute('aria-label', label.textContent.replace(/\s+/g, ' ').trim());
  let i = 0;

  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        // Keep whitespace as real text nodes so words can still break.
        child.textContent.split(/(\s+)/).forEach((token) => {
          if (!token) return;
          if (/^\s+$/.test(token)) {
            frag.appendChild(document.createTextNode(token));
            return;
          }
          const word = document.createElement('span');
          word.className = 'word';
          word.setAttribute('aria-hidden', 'true');
          for (const ch of token) {
            const g = document.createElement('span');
            g.className = 'glyph';
            g.textContent = ch;
            g.style.setProperty('--i', String(i++));
            // Downwind and slightly lifted, like the letter is still airborne.
            g.style.setProperty('--dx', (0.45 + Math.random() * 0.7).toFixed(2) + 'em');
            g.style.setProperty('--dy', ((Math.random() - 0.72) * 0.7).toFixed(2) + 'em');
            g.style.setProperty('--rot', ((Math.random() - 0.45) * 16).toFixed(1) + 'deg');
            word.appendChild(g);
          }
          frag.appendChild(word);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    });
  };

  walk(el);
  return i;
}

async function startReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  let total = 0;
  targets.forEach((el) => { total = Math.max(total, splitGlyphs(el)); });

  // Holds the split glyphs invisible until the run starts. Scoped to an
  // attribute only this function sets, so a script failure leaves plain
  // visible text rather than an empty hero.
  root.dataset.split = 'true';

  // The supporting line follows the last glyph rather than racing it.
  const after = document.querySelector('[data-reveal-after]');
  if (after) after.style.setProperty('--delay', `${420 + total * 26}ms`);

  // Wait for the real face: glyph boxes measured against the fallback serif
  // shift when Instrument Serif arrives, and a reflow mid-animation is very
  // visible when every letter is separately positioned. Capped, because a
  // font that never resolves must not mean a hero that never appears.
  await Promise.race([
    document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve(),
    new Promise((r) => setTimeout(r, 1200)),
  ]);

  root.dataset.revealing = 'true';
}

/* --------------------------------------------------------------- scroll --- */

let target = 0;
let current = 0;
let ticking = false;
let frostLive = false;

function readProgress() {
  const rect = root.getBoundingClientRect();
  const runway = root.offsetHeight - window.innerHeight;
  if (runway <= 0) return 0;
  return clamp(-rect.top / runway, 0, 1);
}

function draw(p) {
  const statement = 1 - span(p, ...TIMELINE.statementOut);
  // In, then back out: the beat is a passing thought, not a caption.
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

  // Only composite the backdrop blur while the panel is on screen. Blurring
  // the backdrop of a playing video re-runs the blur on every decoded frame.
  const wantFrost = frost > 0.001;
  if (wantFrost !== frostLive) {
    frostLive = wantFrost;
    cues.frost.classList.toggle('is-live', wantFrost);
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
    // No looping footage and no assembling text. The poster frame was
    // composed to stand alone, so the hero still reads.
    video.removeAttribute('autoplay');
    video.pause();
    draw(0);
    return;
  }

  startReveal();

  // Autoplay can still be refused (battery saver, some mobile data-saver
  // modes). The poster frame is already the fallback, so there is nothing to
  // repair -- just do not let the rejection surface as an unhandled error.
  const attempt = video.play();
  if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  target = current = readProgress();
  draw(current);
}

init();
