import { DestroyRef, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ClockService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly currentDate = signal(this.startOfToday());
  readonly today = this.currentDate.asReadonly();
  private timerId: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.scheduleMidnightRefresh();
    this.destroyRef.onDestroy(() => {
      if (this.timerId !== undefined) clearTimeout(this.timerId);
    });
  }

  refresh(now = new Date()): void {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (next.getTime() !== this.currentDate().getTime()) this.currentDate.set(next);
  }

  private scheduleMidnightRefresh(): void {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    this.timerId = setTimeout(() => {
      this.refresh();
      this.scheduleMidnightRefresh();
    }, Math.max(tomorrow.getTime() - now.getTime() + 100, 100));
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}
