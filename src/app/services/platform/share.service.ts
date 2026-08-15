import { Injectable } from '@angular/core';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable' | 'failed';

@Injectable({ providedIn: 'root' })
export class ShareService {
  async share(title: string, text: string): Promise<ShareOutcome> {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return 'shared';
      } catch (error) {
        return this.isCancellation(error) ? 'cancelled' : this.copy(text);
      }
    }

    return this.copy(text);
  }

  private async copy(text: string): Promise<ShareOutcome> {
    if (!navigator.clipboard?.writeText) return 'unavailable';
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  private isCancellation(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }
}
