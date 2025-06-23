import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UiStateService {
  private showChromeSignal = signal(true);

  /** An observable-like signal that emits true when the main UI (header/footer) should be shown. */
  public showChrome$ = this.showChromeSignal.asReadonly();

  /**
   * Sets the visibility of the main UI chrome.
   * @param isVisible - Pass true to show header/footer, false to hide.
   */
  setChromeVisibility(isVisible: boolean): void {
    this.showChromeSignal.set(isVisible);
  }
}
