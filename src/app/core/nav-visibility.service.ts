import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NavVisibilityService {
  private showNavigation = new BehaviorSubject<boolean>(true);
  public showNavigation$ = this.showNavigation.asObservable();

  hideNavigation() {
    this.showNavigation.next(false);
  }

  showNavigationBar() {
    this.showNavigation.next(true);
  }
}
