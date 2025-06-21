import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NavVisibilityService {
  private showNavigationSubject = new BehaviorSubject<boolean>(true);
  showNavigation$ = this.showNavigationSubject.asObservable();

  showNavigationBar(): void {
    this.showNavigationSubject.next(true);
  }

  hideNavigation(): void {
    this.showNavigationSubject.next(false);
  }
}
