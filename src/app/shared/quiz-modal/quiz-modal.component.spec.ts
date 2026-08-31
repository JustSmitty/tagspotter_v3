import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';

import { QuizModalComponent } from './quiz-modal.component';

describe('QuizModalComponent', () => {
  let component: QuizModalComponent;
  let fixture: ComponentFixture<QuizModalComponent>;
  let modalController: jasmine.SpyObj<ModalController>;

  beforeEach(async () => {
    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['dismiss']);

    await TestBed.configureTestingModule({
      imports: [QuizModalComponent],
      providers: [{ provide: ModalController, useValue: modalController }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuizModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('question', {
      topic: 'Capital',
      prompt: 'What is Alabama\'s capital?',
      correctAnswer: 'Montgomery',
      options: ['Montgomery', 'Juneau', 'Phoenix', 'Austin'],
    });
    fixture.componentRef.setInput('stateCode', 'AL');
    fixture.componentRef.setInput('stateName', 'Alabama');
    fixture.componentRef.setInput('imageSrc', '/assets/stateflags/Alabama.svg');
    fixture.componentRef.setInput('questionIndex', 1);
    fixture.componentRef.setInput('questionCount', 3);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds the progress dots from the question count', () => {
    expect(component.progressDots.length).toBe(3);
  });

  it('derives the visual region from the state code', () => {
    fixture.componentRef.setInput('stateCode', 'CA');
    fixture.detectChanges();

    expect(component.stateRegion).toBe('west');
    expect((fixture.nativeElement as HTMLElement).querySelector('.quiz-pass')?.getAttribute('data-region')).toBe('west');
  });

  it('shows feedback and dismisses with a score after continuing', () => {
    component.onSelect('Montgomery');

    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.answer-feedback')?.textContent).toContain('Right on the money');
    expect(modalController.dismiss).not.toHaveBeenCalled();

    component.onContinue();

    expect(modalController.dismiss).toHaveBeenCalledWith({
      kind: 'answered',
      score: 1,
    });
  });

  it('dismisses with a cancel result when closed', () => {
    component.onClose();

    expect(modalController.dismiss).toHaveBeenCalledWith({
      kind: 'cancelled',
    });
  });

  it('correctly parses state name from flag URL', () => {
    expect(component.stateNameFromUrl('/assets/stateflags/Alabama.svg')).toBe('Flag of Alabama');
    expect(component.stateNameFromUrl('/assets/stateflags/New Hampshire.svg')).toBe('Flag of New Hampshire');
    expect(component.stateNameFromUrl('')).toBe('State flag');
  });
});

/**
 * dec-0015 — "An ink themes only if the thing it is printed on themes."
 *
 * The quiz pass is ephemera: card stock that stays daylight-cream in dark mode
 * (dec-0012), so every ink and ground printed on it must be fixed. Dark mode is
 * nothing but the prefers-color-scheme block in src/theme/variables.scss
 * redefining tokens on :root — so redefining those same tokens here IS the
 * theme flip, minus the media query ChromeHeadless cannot toggle per-spec.
 *
 * This lives in a spec, not in scripts/contrast-audit.js, because the audit
 * walks routes and this modal only exists behind an overlay flow — it shipped
 * unreadable to a phone without any check going red (pm-0003, F-42 scope gap).
 */
describe('QuizModalComponent ink discipline (dec-0015)', () => {
  let fixture: ComponentFixture<QuizModalComponent>;

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

  beforeEach(async () => {
    const modalController = jasmine.createSpyObj<ModalController>('ModalController', ['dismiss']);

    await TestBed.configureTestingModule({
      imports: [QuizModalComponent],
      providers: [{ provide: ModalController, useValue: modalController }],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizModalComponent);
    fixture.componentRef.setInput('question', {
      topic: 'Capital',
      prompt: 'What is the capital of Alabama?',
      correctAnswer: 'Montgomery',
      options: ['Montgomery', 'Juneau', 'Phoenix', 'Austin'],
    });
    fixture.componentRef.setInput('stateCode', 'AL');
    fixture.componentRef.setInput('stateName', 'Alabama');
    fixture.componentRef.setInput('imageSrc', '/assets/stateflags/Alabama.svg');
    fixture.componentRef.setInput('questionIndex', 1);
    fixture.componentRef.setInput('questionCount', 3);
    fixture.detectChanges();

    // Answer so the feedback slip renders too — it was one of the ghost inks.
    fixture.componentInstance.onSelect('Montgomery');
    fixture.detectChanges();
  });

  afterEach(() => {
    const root = document.documentElement;
    for (const token of THEMED_TOKENS) {
      root.style.removeProperty(token);
    }
    root.style.removeProperty('--app-bg-cream-rgb');
  });

  function hasOwnGlyphs(el: Element): boolean {
    return Array.from(el.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim().length > 0,
    );
  }

  function signature(el: Element): string {
    const cs = getComputedStyle(el);
    // Only elements that draw glyphs themselves are held to fixed ink; a
    // container may inherit a themed colour it never prints. Likewise a border
    // colour only counts on a side that is actually drawn — border-color
    // defaults to currentColor, so a zero-width border tracks the inherited
    // (themed) text colour without putting any of it on screen.
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

  it('is printed entirely in fixed ink: flipping the themed palette moves nothing', () => {
    const host = fixture.nativeElement as HTMLElement;
    // The ion-content host is the one legitimately themed surface here: it is
    // the page showing through behind the ticket, and the page is chrome
    // (dec-0012). Everything else in this component is printed matter.
    const targets: Element[] = [host, ...Array.from(host.querySelectorAll('*'))]
      .filter((el) => el.tagName.toLowerCase() !== 'ion-content');
    const before = targets.map(signature);

    const root = document.documentElement;
    for (const token of THEMED_TOKENS) {
      root.style.setProperty(token, SENTINEL);
    }
    root.style.setProperty('--app-bg-cream-rgb', '0, 255, 0');

    const moved = targets
      .map((el, i) => ({ el, was: before[i], now: signature(el) }))
      .filter((d) => d.was !== d.now)
      .map((d) => {
        const tag = d.el.tagName.toLowerCase();
        const cls = (d.el as HTMLElement).className;
        return `${tag}.${cls}  ${d.was}  ->  ${d.now}`;
      });

    expect(moved).toEqual([]);
  });

  function parseColor(value: string): [number, number, number, number] {
    // Computed styles normalise to rgb(r, g, b) / rgba(r, g, b, a).
    const inner = value.slice(value.indexOf('(') + 1, value.indexOf(')'));
    const parts = inner.split(',').map((p) => parseFloat(p));
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }

  function overWhite(c: [number, number, number, number]): [number, number, number] {
    const a = c[3];
    return [c[0] * a + 255 * (1 - a), c[1] * a + 255 * (1 - a), c[2] * a + 255 * (1 - a)];
  }

  function luminance(rgb: [number, number, number]): number {
    const chan = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }

  function contrast(ink: string, ground: string): number {
    const l1 = luminance(overWhite(parseColor(ink)));
    const l2 = luminance(overWhite(parseColor(ground)));
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function gradientStops(backgroundImage: string): string[] {
    const stops: string[] = [];
    let from = backgroundImage.indexOf('rgb');
    while (from !== -1) {
      const to = backgroundImage.indexOf(')', from);
      stops.push(backgroundImage.slice(from, to + 1));
      from = backgroundImage.indexOf('rgb', to);
    }
    return stops;
  }

  it('keeps AA contrast between the question inks and the stock they sit on', () => {
    const host = fixture.nativeElement as HTMLElement;
    const pass = host.querySelector('.quiz-pass') as HTMLElement;
    const option = host.querySelector('.quiz-option') as HTMLElement;
    const question = host.querySelector('.question-text') as HTMLElement;
    const label = host.querySelector('.option-label') as HTMLElement;
    const feedback = host.querySelector('.answer-feedback') as HTMLElement;

    const cardStops = gradientStops(getComputedStyle(pass).backgroundImage);
    expect(cardStops.length).toBeGreaterThanOrEqual(2);

    const checks: Array<[string, string, string]> = [];
    for (const stop of cardStops) {
      checks.push(['question-text on card stock', getComputedStyle(question).color, stop]);
    }
    checks.push(['option-label on option row', getComputedStyle(label).color, getComputedStyle(option).backgroundColor]);
    checks.push(['answer-feedback on its slip', getComputedStyle(feedback).color, getComputedStyle(feedback).backgroundColor]);

    const failures = checks
      .map(([what, ink, ground]) => ({ what, ratio: contrast(ink, ground) }))
      .filter((c) => c.ratio < 4.5)
      .map((c) => `${c.what}: ${c.ratio.toFixed(2)}:1`);

    expect(failures).toEqual([]);
  });
});
