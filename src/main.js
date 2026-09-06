/**
 * FLOWERBX — hero scene.
 *
 * One looping film, one headline that assembles itself out of the wind on
 * load. No scroll, no scrubbing: the film is encoded for playback and left
 * to play.
 */

const root = document.querySelector('[data-hero]');
const video = document.querySelector('[data-video]');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

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
 * as a mechanical slide; the variation is what makes it look like air moved
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
  let total = 0;
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    total = Math.max(total, splitGlyphs(el));
  });

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

function init() {
  if (reduced.matches) {
    // No looping footage and no assembling text. The poster frame was
    // composed to stand alone, so the hero still reads.
    video.removeAttribute('autoplay');
    video.pause();
    return;
  }

  startReveal();

  // Autoplay can still be refused (battery saver, some data-saver modes).
  // The poster frame is already the fallback, so there is nothing to repair --
  // just do not let the rejection surface as an unhandled error.
  const attempt = video.play();
  if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
}

init();
