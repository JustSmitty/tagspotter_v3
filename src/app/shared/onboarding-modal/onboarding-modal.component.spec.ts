import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';

import { OnboardingModalComponent } from './onboarding-modal.component';

describe('OnboardingModalComponent', () => {
  let component: OnboardingModalComponent;
  let fixture: ComponentFixture<OnboardingModalComponent>;
  let modalController: jasmine.SpyObj<ModalController>;

  beforeEach(async () => {
    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['dismiss']);

    await TestBed.configureTestingModule({
      imports: [OnboardingModalComponent],
      providers: [{ provide: ModalController, useValue: modalController }],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('pages forward and never below the first page', () => {
    component.prev();
    expect(component.currentPage()).toBe(0);

    component.next();
    expect(component.currentPage()).toBe(1);

    component.prev();
    expect(component.currentPage()).toBe(0);
  });

  it('dismisses once the last page is passed', () => {
    for (let i = 0; i < component.totalPages - 1; i++) {
      component.next();
    }
    expect(component.currentPage()).toBe(component.totalPages - 1);
    expect(modalController.dismiss).not.toHaveBeenCalled();

    component.next();
    expect(modalController.dismiss).toHaveBeenCalledWith(true);
  });

  it('skipping dismisses immediately', () => {
    component.finish();
    expect(modalController.dismiss).toHaveBeenCalledWith(true);
  });

  it('names the icon-only back control and hides the decorative page tally', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.guide-btn')?.getAttribute('aria-label')).toBe('Previous page');
    expect(host.querySelector('.page-dots')?.getAttribute('aria-hidden')).toBe('true');
  });
});

/**
 * dec-0015 — "An ink themes only if the thing it is printed on themes."
 *
 * The handbook is a MIXED surface, unlike the quiz pass. ion-content is fixed
 * cream paper — printed matter that keeps its daylight colours in dark mode
 * (dec-0012). The header and footer are not printed on that paper: ion-header
 * paints nothing and its toolbar is transparent, so the chrome's real ground is
 * the modal's ::part(content) background, var(--app-surface-card), which goes
 * near-black at night (.handbook-modal in global.scss).
 *
 * So this spec holds both halves of the rule: the paper's inks must NOT move
 * when the themed palette flips, and the chrome's inks MUST — fixed pine on the
 * themed card is how SKIP and the title shipped at 2.49:1 in dark mode (F-50).
 *
 * This lives in a spec, not in scripts/contrast-audit.js, because the audit
 * walks routes and this modal only exists behind the first-run flow (pm-0003:
 * overlays are never in the audit's population).
 */
describe('OnboardingModalComponent ink discipline (dec-0015)', () => {
  let fixture: ComponentFixture<OnboardingModalComponent>;
  let noMotion: HTMLStyleElement;

  // Every colour token the dark block redefines. Non-colour tokens (shadows,
  // opacities, texture lines) are left out: they cannot masquerade as ink.
  const THEMED_TOKENS = [
    '--app-bg-cream', '--app-bg-paper',
    '--app-surface-paper', '--app-surface-card', '--app-surface-raised', '--app-surface-alert',
    '--app-ink-deep', '--app-ink-muted', '--app-ink-subtle',
    '--app-rust-ink', '--app-success-ink', '--app-nav-ink',
    '--app-thread', '--app-tag-hole',
    '--card-bg', '--card-border',
    '--atlas-state-fill', '--atlas-state-hover', '--atlas-stroke', '--atlas-stroke-strong', '--atlas-label-ink',
  ];
  const SENTINEL = 'rgb(0, 255, 0)';
  const appliedTokens = new Set<string>();

  beforeEach(async () => {
    const modalController = jasmine.createSpyObj<ModalController>('ModalController', ['dismiss']);

    await TestBed.configureTestingModule({
      imports: [OnboardingModalComponent],
      providers: [{ provide: ModalController, useValue: modalController }],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingModalComponent);
    fixture.detectChanges();

    // The dots ease their background for 0.2s; a computed style read mid-tween
    // would compare an interpolated colour against the flipped token.
    noMotion = document.createElement('style');
    noMotion.textContent = 'app-onboarding-modal, app-onboarding-modal * { transition: none !important; animation: none !important; }';
    document.head.appendChild(noMotion);
  });

  afterEach(() => {
    const root = document.documentElement;
    for (const token of THEMED_TOKENS) {
      root.style.removeProperty(token);
    }
    for (const token of appliedTokens) {
      root.style.removeProperty(token);
    }
    appliedTokens.clear();
    noMotion.remove();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function showPage(page: number): void {
    fixture.componentInstance.currentPage.set(page);
    fixture.detectChanges();
  }

  function resolve(token: string, on: Element = document.documentElement): string {
    return getComputedStyle(on).getPropertyValue(token).trim();
  }

  function setSentinel(): void {
    for (const token of THEMED_TOKENS) {
      document.documentElement.style.setProperty(token, SENTINEL);
    }
  }

  function clearSentinel(): void {
    for (const token of THEMED_TOKENS) {
      document.documentElement.style.removeProperty(token);
    }
  }

  function hasOwnGlyphs(el: Element): boolean {
    return Array.from(el.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim().length > 0,
    );
  }

  function signature(el: Element): string {
    const cs = getComputedStyle(el);
    // Only elements that draw glyphs themselves are held to fixed ink; a
    // container may inherit a themed colour it never prints. Likewise a border
    // colour only counts on a side that is actually drawn.
    const ink = hasOwnGlyphs(el) ? cs.color : '(no glyphs)';
    const borders = (['Top', 'Right', 'Bottom', 'Left'] as const)
      .map((side) => {
        const width = cs.getPropertyValue(`border-${side.toLowerCase()}-width`);
        const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
        if (width === '0px' || style === 'none') return `(no ${side} border)`;
        return cs.getPropertyValue(`border-${side.toLowerCase()}-color`);
      })
      .join(' ');
    return [ink, cs.backgroundColor, cs.backgroundImage, borders].join(' | ');
  }

  function parseColor(value: string): [number, number, number] {
    const s = value.trim();
    if (s.startsWith('#')) {
      return [
        parseInt(s.slice(1, 3), 16),
        parseInt(s.slice(3, 5), 16),
        parseInt(s.slice(5, 7), 16),
      ];
    }
    // Computed styles normalise to rgb(r, g, b) / rgba(r, g, b, a). Every ink
    // and ground checked here is opaque, so alpha is ignored on purpose.
    const inner = s.slice(s.indexOf('(') + 1, s.indexOf(')'));
    const parts = inner.split(',').map((p) => parseFloat(p));
    return [parts[0], parts[1], parts[2]];
  }

  function asRgb(value: string): string {
    const [r, g, b] = parseColor(value);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function luminance(rgb: [number, number, number]): number {
    const chan = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }

  function contrast(ink: string, ground: string): number {
    const l1 = luminance(parseColor(ink));
    const l2 = luminance(parseColor(ground));
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /**
   * The palettes, read out of the compiled stylesheets rather than duplicated
   * here — a copy in the spec would keep passing after the palette moved. The
   * light palette is the bare :root block in variables.scss; dark is the
   * prefers-color-scheme override that layers on top of it. Applying a palette
   * explicitly also frees every assertion from the ambient colour scheme of
   * the Karma Chrome, which runs dark on this machine (pm-0003) and may run
   * light on another.
   */
  function palettes(): { light: Map<string, string>; dark: Map<string, string> } {
    const light = new Map<string, string>();
    const dark = new Map<string, string>();
    const collect = (rule: CSSStyleRule, into: Map<string, string>) => {
      for (let i = 0; i < rule.style.length; i++) {
        const name = rule.style[i];
        if (name.startsWith('--')) into.set(name, rule.style.getPropertyValue(name).trim());
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule && rule.selectorText === ':root') collect(rule, light);
        if (rule instanceof CSSMediaRule && /prefers-color-scheme:\s*dark/.test(rule.conditionText)) {
          for (const inner of Array.from(rule.cssRules)) {
            if (inner instanceof CSSStyleRule && inner.selectorText === ':root') collect(inner, dark);
          }
        }
      }
    }
    return { light, dark };
  }

  function applyPalette(palette: Map<string, string>): void {
    // If the block is missing the styles were not loaded, and every assertion
    // below would silently measure the wrong theme. Fail loudly instead.
    expect(palette.get('--app-surface-card')).toBeTruthy();
    for (const [token, value] of palette) {
      document.documentElement.style.setProperty(token, value);
      appliedTokens.add(token);
    }
  }

  /**
   * SKIP's wiring is asserted on the compiled rules rather than on the
   * rendered button: ion-buttons forwards the toolbar ink into its slotted
   * buttons through a self-referencing fallback that leaves the host's
   * computed --color unreadable in this harness (the live DOM resolves the
   * outer rule normally — it is how the F-50 literal actually rendered).
   */
  function skipButtonRules(): { base?: CSSStyleRule; active?: CSSStyleRule } {
    const out: { base?: CSSStyleRule; active?: CSSStyleRule } = {};
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule) || !rule.selectorText.includes('.skip-btn')) continue;
        if (rule.selectorText.includes(':active')) out.active = rule;
        else out.base = rule;
      }
    }
    return out;
  }

  function contrastFailures(pairs: Array<[string, string, string, number]>): string[] {
    return pairs
      .map(([what, ink, ground, floor]) => ({ what, floor, ratio: contrast(ink, ground) }))
      .filter((c) => c.ratio < c.floor)
      .map((c) => `${c.what}: ${c.ratio.toFixed(2)}:1 (needs ${c.floor}:1)`);
  }

  /**
   * Chrome pairs are checked at token level: the wiring test below pins each
   * chrome element to its token, and these pin each token to its ground. Text
   * is held to AA 4.5:1; icons, rules and the page dots to 3:1 non-text.
   */
  function chromeFailures(): string[] {
    const card = resolve('--app-surface-card');
    return contrastFailures([
      ['handbook title on the card', resolve('--app-nav-ink'), card, 4.5],
      ['SKIP resting ink on the card', resolve('--app-ink-muted'), card, 4.5],
      ['SKIP active ink on the card', resolve('--app-ink-deep'), card, 4.5],
      ['back chevron on the card', resolve('--app-nav-ink'), card, 3],
      ['inactive page dot on the card', resolve('--app-ink-subtle'), card, 3],
      ['active page dot on the card', resolve('--app-nav-ink'), card, 3],
      ['rust rules on the card', resolve('--ion-color-primary'), card, 3],
      ['action button label on its fill', resolve('--app-ink-on-fill'), resolve('--ion-color-secondary'), 4.5],
      ['header seal icon on its fill', resolve('--app-ink-on-fill'), resolve('--app-rust-fill'), 3],
      // The folder tab is drawn by .ephemera-modal::after in global.scss on
      // fixed manila stock; the literal here matches that declaration.
      ['folder tab label on manila', resolve('--app-ink-on-ephemera-muted'), '#e6dcc6', 4.5],
    ]);
  }

  /**
   * Paper pairs are element-grounded and walked across all five pages, since
   * ngSwitch only ever mounts one page at a time.
   */
  function paperFailures(): string[] {
    const failures: string[] = [];
    const content = host().querySelector('ion-content') as HTMLElement;
    const paper = resolve('--background', content);

    for (let page = 0; page < 5; page++) {
      showPage(page);
      const pairs: Array<[string, string, string, number]> = [];
      const on = (selector: string): HTMLElement | null => host().querySelector(selector);

      const h2 = on('.handbook-h2');
      if (h2) pairs.push([`p${page} heading on paper`, getComputedStyle(h2).color, paper, 4.5]);
      for (const p of Array.from(host().querySelectorAll('.handbook-p'))) {
        pairs.push([`p${page} body on paper`, getComputedStyle(p).color, paper, 4.5]);
      }
      const secondary = on('.handbook-p.secondary');
      if (secondary) pairs.push([`p${page} secondary note on paper`, getComputedStyle(secondary).color, paper, 4.5]);
      const strong = on('.handbook-p strong');
      if (strong) pairs.push([`p${page} strong on paper`, getComputedStyle(strong).color, paper, 4.5]);
      const li = on('.handbook-list li');
      if (li) pairs.push([`p${page} list item on paper`, getComputedStyle(li).color, paper, 4.5]);
      const hero = on('.hero-icon');
      if (hero) pairs.push([`p${page} hero icon on paper`, getComputedStyle(hero).color, paper, 3]);

      const table = on('.points-table');
      if (table) {
        const tableBg = getComputedStyle(table).backgroundColor;
        pairs.push([`p${page} points label on the table`, getComputedStyle(on('.p-lvl')!).color, tableBg, 4.5]);
        pairs.push([`p${page} points value on the table`, getComputedStyle(on('.p-pts')!).color, tableBg, 4.5]);
      }
      for (const tag of Array.from(host().querySelectorAll('.demo-tag'))) {
        const cs = getComputedStyle(tag);
        pairs.push([`p${page} ${tag.className} label on its chip`, cs.color, cs.backgroundColor, 4.5]);
      }

      failures.push(...contrastFailures(pairs));
    }
    return failures;
  }

  it('the paper does not move: flipping the themed palette changes nothing printed on it', () => {
    for (let page = 0; page < 5; page++) {
      showPage(page);
      // Everything inside ion-content is printed matter, and so is the header's
      // seal (a fixed rust ribbon). The rest of the header/footer is chrome and
      // is covered by the wiring test, where it must do the opposite.
      const targets: Element[] = [
        host().querySelector('.header-seal') as Element,
        ...Array.from(host().querySelectorAll('ion-content *')),
      ];
      const before = targets.map(signature);

      setSentinel();
      const moved = targets
        .map((el, i) => ({ el, was: before[i], now: signature(el) }))
        .filter((d) => d.was !== d.now)
        .map((d) => `page ${page}: ${d.el.tagName.toLowerCase()}.${(d.el as HTMLElement).className}  ${d.was}  ->  ${d.now}`);
      clearSentinel();

      expect(moved).toEqual([]);
    }
  });

  it('the chrome is wired to themed tokens and follows a palette flip', () => {
    const toolbar = host().querySelector('.handbook-header ion-toolbar') as HTMLElement;
    const guideBtn = host().querySelector('.guide-btn') as HTMLElement;
    const actionBtn = host().querySelector('.guide-action-btn') as HTMLElement;
    const activeDot = host().querySelector('.dot.active') as HTMLElement;
    const idleDot = host().querySelector('.dot:not(.active)') as HTMLElement;

    // .dot eases its background for 0.2s, and a synchronous computed-style
    // read lands mid-tween on the start colour; inline beats the sheet.
    activeDot.style.transition = 'none';
    idleDot.style.transition = 'none';

    // Identity first: each chrome ink is the named themed token, so the AA
    // token pairs above are statements about these elements.
    expect(resolve('--color', toolbar)).toBe(resolve('--app-nav-ink'));
    expect(resolve('--color', guideBtn)).toBe(resolve('--app-nav-ink'));
    expect(resolve('--background', actionBtn)).toBe(resolve('--ion-color-secondary'));
    expect(resolve('--color', actionBtn)).toBe(resolve('--app-ink-on-fill'));
    expect(getComputedStyle(activeDot).backgroundColor).toBe(asRgb(resolve('--app-nav-ink')));
    expect(getComputedStyle(idleDot).backgroundColor).toBe(asRgb(resolve('--app-ink-subtle')));

    const skip = skipButtonRules();
    expect(skip.base?.style.getPropertyValue('--color').trim()).toBe('var(--app-ink-muted)');
    expect(skip.active?.style.getPropertyValue('--color').trim()).toBe('var(--app-ink-deep)');

    // Then the flip: chrome ink must follow its ground. A fixed literal here
    // reintroduces F-50 and this is the assertion that goes red.
    setSentinel();
    expect(resolve('--color', toolbar)).toBe(SENTINEL);
    expect(resolve('--color', guideBtn)).toBe(SENTINEL);
    expect(getComputedStyle(activeDot).backgroundColor).toBe(SENTINEL);
    expect(getComputedStyle(idleDot).backgroundColor).toBe(SENTINEL);
    // The ticket punch holes are the ground itself, so they flip with it —
    // while the button's own fill is a fixed token and must not.
    expect(getComputedStyle(actionBtn, '::before').backgroundColor).toBe(SENTINEL);
    expect(resolve('--background', actionBtn)).toBe(resolve('--ion-color-secondary'));
    clearSentinel();
  });

  it('keeps AA contrast in the daylight palette', () => {
    applyPalette(palettes().light);
    expect(chromeFailures()).toEqual([]);
    expect(paperFailures()).toEqual([]);
  });

  it('keeps AA contrast under the real dark palette', () => {
    const { light, dark } = palettes();
    expect(dark.get('--app-surface-card')).not.toBe(light.get('--app-surface-card'));
    // Dark only redefines the tokens that change, so it layers on light —
    // the same cascade the media block performs.
    applyPalette(light);
    applyPalette(dark);
    expect(chromeFailures()).toEqual([]);
    // The paper's grounds and inks are fixed, so this re-run is the direct
    // statement of the invariant: still readable at night.
    expect(paperFailures()).toEqual([]);
  });
});
