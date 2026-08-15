import { TestBed } from '@angular/core/testing';

import { ShareService } from './share.service';

/**
 * Sharing has four ways to not happen and they must not look alike to the
 * caller: the user cancelling is not a failure, and an unavailable clipboard is
 * not a failed write. The summary page picks its message from this distinction.
 */
describe('ShareService', () => {
  let service: ShareService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ShareService] });
    service = TestBed.inject(ShareService);
  });

  let originalClipboard: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalClipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')
      ?? Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  });

  afterEach(() => {
    delete (navigator as { share?: unknown }).share;
    // navigator.clipboard is a prototype getter, not an own value, so it is
    // redefined rather than assigned — and must be put back or later specs
    // inherit the stub.
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  });

  function stubClipboard(value: unknown) {
    Object.defineProperty(navigator, 'clipboard', { value, configurable: true, writable: true });
  }

  // navigator.share is a read-only prototype property in Chrome, so it has to be
  // redefined rather than assigned — same as clipboard above.
  function stubShare(impl: () => Promise<void>) {
    Object.defineProperty(navigator, 'share', { value: impl, configurable: true, writable: true });
  }

  it('reports a successful native share', async () => {
    stubShare(async () => undefined);

    expect(await service.share('title', 'text')).toBe('shared');
  });

  it('treats an aborted share as a cancellation, not a failure', async () => {
    stubShare(async () => { throw new DOMException('user bailed', 'AbortError'); });

    expect(await service.share('title', 'text')).toBe('cancelled');
  });

  it('falls back to the clipboard when the native share errors', async () => {
    stubShare(async () => { throw new Error('sheet exploded'); });
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    stubClipboard({ writeText });

    expect(await service.share('title', 'text')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('text');
  });

  it('copies when the platform has no share sheet at all', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    stubClipboard({ writeText });

    expect(await service.share('title', 'text')).toBe('copied');
  });

  it('distinguishes an absent clipboard from a failed write', async () => {
    stubClipboard(undefined);
    expect(await service.share('title', 'text')).toBe('unavailable');
  });

  it('reports a clipboard write that rejects', async () => {
    const writeText = jasmine.createSpy('writeText').and.rejectWith(new Error('denied'));
    stubClipboard({ writeText });

    expect(await service.share('title', 'text')).toBe('failed');
  });
});
