/*
 * Contrast audit — paste into the browser console against a running dev server.
 *
 *   npm start
 *   # open http://localhost:4200, paste this, run it
 *   # then flip the OS/devtools colour scheme, RELOAD, and run it again
 *
 * This is a browser snippet rather than a node script on purpose: contrast is a
 * property of what actually rendered — resolved custom properties, inherited
 * colours, stacked translucent layers — and none of that exists outside a real
 * layout. The regex guardrail in .agents/evals/guardrails.json catches one
 * specific bad pattern; this catches the truth.
 *
 * Two things it does that a naive checker gets wrong:
 *   1. It climbs ancestors to find the effective background, compositing every
 *      translucent layer on the way, instead of assuming the parent is opaque.
 *   2. It treats a gradient as a real surface by taking its first colour stop.
 *      Without that, the postcard — whose paper is a gradient — reported its
 *      whole contents as failures against the page background behind it.
 *
 * Baseline recorded 2026-08-15 on Home: 45 failures in light, 45 in dark
 * (audit F-42). Dark mode adds none. 29 of the 45 are .plate-state-name.
 */
(() => {
  const lum = (r, g, b) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  const rootBg = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 253, g: 250, b: 233, a: 1 };

  const layerOf = (node) => {
    const cs = getComputedStyle(node);
    const solid = parse(cs.backgroundColor);
    if (solid && solid.a > 0) return solid;
    const image = cs.backgroundImage;
    if (image && image !== 'none' && /gradient/.test(image)) {
      const firstStop = parse(image);
      if (firstStop && firstStop.a > 0) return firstStop;
    }
    return null;
  };

  const backgroundOf = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement) {
      const layer = layerOf(node);
      if (layer) {
        acc = acc ? over(acc, layer) : layer;
        if (acc.a >= 0.999) return acc;
      }
      node = node.parentElement;
    }
    return acc && acc.a >= 0.999 ? acc : rootBg;
  };

  const failures = [];
  document.querySelectorAll('body *').forEach((el) => {
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!ownText) return;

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;

    const rawColor = parse(cs.color);
    if (!rawColor) return;

    const bg = backgroundOf(el);
    const fg = rawColor.a < 1 ? over(rawColor, bg) : rawColor;
    const ratio = (Math.max(lum(fg.r, fg.g, fg.b), lum(bg.r, bg.g, bg.b)) + 0.05)
      / (Math.min(lum(fg.r, fg.g, fg.b), lum(bg.r, bg.g, bg.b)) + 0.05);

    const px = parseFloat(cs.fontSize);
    const isLarge = px >= 24 || (+cs.fontWeight >= 700 && px >= 18.66);
    const required = isLarge ? 3 : 4.5;

    if (ratio < required) {
      failures.push({
        selector: typeof el.className === 'string' && el.className
          ? `.${el.className.split(' ').filter(Boolean)[0]}`
          : el.tagName,
        text: ownText.slice(0, 24),
        ratio: +ratio.toFixed(2),
        required,
        color: cs.color,
        background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      });
    }
  });

  const bySelector = {};
  failures.forEach((f) => { bySelector[f.selector] = (bySelector[f.selector] ?? 0) + 1; });

  const theme = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-ink-deep').trim() === '#f2e7d3' ? 'dark' : 'light';

  console.table(failures.sort((a, b) => a.ratio - b.ratio).slice(0, 20));
  return {
    theme,
    failures: failures.length,
    bySelector: Object.entries(bySelector).sort((a, b) => b[1] - a[1]),
  };
})();
