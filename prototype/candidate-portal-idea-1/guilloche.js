/* Guilloche seals. Each verified employer's rosette is derived from its registry id,
   so no two organisations print the same mark. Real hypotrochoid geometry, drawn on
   canvas — not an image, and not a decoration. */

function seedOf(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rngFrom(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/* Rose-engine guilloche: concentric rings whose radius is sinusoidally modulated, each ring
   phase-shifted from the last so the lobes interleave into a woven lace. This is what an
   engine-turned plate actually is — not a star, and not a spirograph cusp. */
function plateFor(registryId) {
  const rand = rngFrom(seedOf(registryId));
  const lobes = 5 + Math.floor(rand() * 6);        // 5..10 lobes around the ring
  return {
    lobes,
    rings: 13 + Math.floor(rand() * 6),            // 13..18 concentric passes
    amp: 0.13 + rand() * 0.09,                     // lobe depth, as a share of the field
    rot: rand() * Math.PI * 2,
    drift: (0.30 + rand() * 0.55) / lobes,         // phase walk per ring — makes the weave
    coreLobes: 3 + Math.floor(rand() * 4),         // the counter-pattern at the centre
    coreRings: 6 + Math.floor(rand() * 4),
  };
}

function drawSeal(canvas, registryId, progress) {
  const w = canvas.clientWidth || 60;
  const h = canvas.clientHeight || w;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const styles = getComputedStyle(document.documentElement);
  const tint = styles.getPropertyValue('--tint').trim() || '#0E8074';
  const tint2 = styles.getPropertyValue('--tint-2').trim() || '#4DBFB5';
  const ink = styles.getPropertyValue('--ink').trim() || '#0B1F1C';

  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.min(w, h) / 2 - 1.5;
  const p = plateFor(registryId);
  const watermark = canvas.hasAttribute('data-watermark');

  // a seal carries its rings; a watermark is only the turning
  if (!watermark) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 0.6;
    ctx.strokeStyle = tint2;
    ctx.beginPath();
    ctx.arc(cx, cy, outer - 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  const field = watermark ? outer : outer - 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /* One band of engine turning: `rings` closed curves between two radii, each modulated by
     `lobes` and walked forward by `drift`, so neighbouring rings cross and weave. */
  function band(rInner, rOuter, rings, lobes, amp, phase0, drift, width, colour) {
    const end = Math.PI * 2 * progress;
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    for (let i = 0; i < rings; i++) {
      const base = rInner + (rOuter - rInner) * (i / (rings - 1));
      const phase = phase0 + i * drift;
      ctx.beginPath();
      for (let a = 0; a <= end + 0.02; a += 0.03) {
        const rad = base + amp * Math.sin(lobes * a + phase);
        const x = cx + rad * Math.cos(a);
        const y = cy + rad * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (progress >= 1) ctx.closePath();
      ctx.stroke();
    }
  }

  const amp = field * p.amp;
  band(field * 0.42, field - amp, p.rings, p.lobes, amp, p.rot, p.drift, 0.42, tint);
  band(field * 0.10, field * 0.34, p.coreRings, p.coreLobes,
       field * 0.055, -p.rot, -p.drift * 1.7, 0.4, tint2);
}

function strikeSeals() {
  const slots = Array.from(document.querySelectorAll('canvas[data-registry]'));
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  slots.forEach(function (canvas, i) {
    const id = canvas.dataset.registry;
    if (still) { drawSeal(canvas, id, 1); return; }

    const delay = i * 90;
    const dur = 820;
    const start = performance.now() + delay;

    let settled = false;
    function frame(now) {
      if (settled) return;
      const t = (now - start) / dur;
      if (t < 0) { requestAnimationFrame(frame); return; }
      const e = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);   // exponential ease-out
      drawSeal(canvas, id, e);
      if (t < 1) requestAnimationFrame(frame); else settled = true;
    }
    drawSeal(canvas, id, 0);
    requestAnimationFrame(frame);

    // the seal is content, not decoration: guarantee the finished plate even when
    // rAF is throttled (background tab, iframe, low power) and never completes.
    setTimeout(function () {
      if (settled) return;
      settled = true;
      drawSeal(canvas, id, 1);
    }, delay + dur + 150);
  });
}

window.restrikeSeals = function () {
  document.querySelectorAll("canvas[data-registry]").forEach(function (c) { drawSeal(c, c.dataset.registry, 1); });
};
document.addEventListener("DOMContentLoaded", strikeSeals);
window.addEventListener('resize', function () {
  document.querySelectorAll('canvas[data-registry]').forEach(function (c) {
    drawSeal(c, c.dataset.registry, 1);
  });
});
