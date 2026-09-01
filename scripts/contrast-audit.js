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
 * Four things it does that a naive checker gets wrong. Each was a real false
 * reading during F-42, and each cost more time than the bug it was hiding:
 *   1. It climbs ancestors to find the effective background, compositing every
 *      translucent layer on the way, instead of assuming the parent is opaque.
 *   2. It treats a gradient as a real surface by taking its first colour stop.
 *      Without that, the postcard — whose paper is a gradient — reported its
 *      whole contents as failures against the page background behind it.
 *   3. It composites the accumulated stack over the page rather than discarding
 *      it when nothing fully opaque is found. The postcard's paper is alpha
 *      0.98, so dropping it reported dark-on-cream as dark-on-dark.
 *   4. It reads ion-button's fill out of the shadow root. Ionic paints it on
 *      .button-native, so the host measures transparent.
 *
 * Do NOT resolve a surface by reading the --background custom property: custom
 * properties inherit, so every descendant of ion-content reports the page's
 * background as its own and the whole page reads as failing.
 *
 * Measure a POPULATED app. Spotted states draw stamps, badges and the summary
 * that an empty save never renders — a clean run against a fresh install proves
 * only that the empty state is fine.
 *
 * And know what a route walk can never see: overlays. A modal that mounts
 * mid-flow (the quiz pass, the onboarding handbook) is not in this population,
 * which is how the quiz shipped unreadable at 1.1:1 (pm-0003) and the handbook
 * chrome at 2.49:1 (F-50) while this audit read zero. Do not try to drive
 * overlays into view from here — every overlay gets an "ink discipline"
 * describe in its component spec instead, where mounting is unconditional; see
 * quiz-modal.component.spec.ts and onboarding-modal.component.spec.ts. If you
 * add an overlay, give it one.
 *
 * Baseline (audit F-42): originally 45 in light and 45 in dark on Home alone.
 * Now 0 and 0, measured across all five routes in both themes with 26 of 51
 * states spotted. Zero is the baseline; anything above it is a regression.
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

  // Every colour stop in a gradient, not just the first. A card whose ramp runs
  // from a themed dark surface to a hardcoded cream is legible at one end and
  // blank at the other, and sampling stop one reports the readable end. That is
  // how the Goals badge cards passed while "Find plates from both the East and
  // West coasts" faded to nothing halfway across.
  const gradientStops = (image) =>
    (image.match(/rgba?\([^)]+\)/g) ?? []).map(parse).filter((c) => c && c.a > 0);

  const layerOf = (node, stopIndex = 0) => {
    const cs = getComputedStyle(node);
    const solid = parse(cs.backgroundColor);
    if (solid && solid.a > 0) return solid;
    const image = cs.backgroundImage;
    if (image && image !== 'none' && /gradient/.test(image)) {
      const stops = gradientStops(image);
      if (stops.length) return stops[Math.min(stopIndex, stops.length - 1)];
    }
    // Ionic paints ion-button's fill on .button-native inside the shadow root,
    // so the host measures transparent and the climb sails past it to the page.
    // That reported the rust-filled buttons as cream-on-cream in light mode and
    // as passing in dark — a fill that never themed appearing to flip with the
    // theme is the tell that the checker, not the app, is wrong.
    const shadowFill = node.shadowRoot?.querySelector('.button-native, .toolbar-background');
    if (shadowFill) {
      const inner = parse(getComputedStyle(shadowFill).backgroundColor);
      if (inner && inner.a > 0) return inner;
    }
    return null;
  };

  const backgroundOf = (el, stopIndex = 0) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement) {
      const layer = layerOf(node, stopIndex);
      if (layer) {
        acc = acc ? over(acc, layer) : layer;
        if (acc.a >= 0.999) return acc;
      }
      node = node.parentElement;
    }
    // Composite whatever was accumulated over the page, rather than discarding
    // it. Dropping a nearly-opaque stack (the postcard's gradient is alpha 0.98)
    // reported dark-on-cream text as if it were dark-on-dark — a bug in the
    // checker that looked exactly like a bug in the app.
    return acc ? over(acc, rootBg) : rootBg;
  };

  /**
   * The worst ground this text sits on.
   *
   * Text spans the width of its container, so it has to clear AA against every
   * part of the gradient underneath it, not just wherever stop one happens to
   * be. Four stops is plenty of resolution for the ramps in this app.
   */
  const groundsFor = (el) => {
    const seen = new Map();
    for (let i = 0; i < 4; i++) {
      const bg = backgroundOf(el, i);
      seen.set(`${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}`, bg);
    }
    return [...seen.values()];
  };

  const failures = [];
  document.querySelectorAll('body *').forEach((el) => {
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!ownText) return;

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;

    const rawColor = parse(cs.color);
    if (!rawColor) return;

    let bg = null;
    let ratio = Infinity;
    for (const ground of groundsFor(el)) {
      const fg = rawColor.a < 1 ? over(rawColor, ground) : rawColor;
      const candidate = (Math.max(lum(fg.r, fg.g, fg.b), lum(ground.r, ground.g, ground.b)) + 0.05)
        / (Math.min(lum(fg.r, fg.g, fg.b), lum(ground.r, ground.g, ground.b)) + 0.05);
      if (candidate < ratio) {
        ratio = candidate;
        bg = ground;
      }
    }

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
