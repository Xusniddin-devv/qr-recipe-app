import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import {
  Router,
  NavigationEnd,
  ActivatedRoute,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { filter, map, mergeMap } from 'rxjs/operators';
import { ScannerStateService } from './core/scanner-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private location = inject(Location);
  private activatedRoute = inject(ActivatedRoute);
  private scannerStateService = inject(ScannerStateService);
  private destroyRef = inject(DestroyRef);
  showNavigation = true;
  isScanningActive = false;
  currentRoute = '';
  private _shouldShowBackButton = false;

  constructor() {
    // Subscribe to scanner state
    this.scannerStateService.isScanning$
      .pipe(takeUntilDestroyed())
      .subscribe((isActive) => {
        this.isScanningActive = isActive;
      });
  }

  ngOnInit(): void {
    // Subscribe to router events to update header state declaratively
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        ),
        map(() => {
          let route = this.activatedRoute;
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route;
        }),
        filter((route) => route.outlet === 'primary'),
        mergeMap((route) => route.data),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data) => {
        this.currentRoute = data['title'] || '';
        this._shouldShowBackButton = data['showBackButton'] === true;
        this.showNavigation = data['showNavigation'] !== false;
      });
  }

  shouldShowBackButton(): boolean {
    return this._shouldShowBackButton;
  }

  goBack(): void {
    this.location.back();
  }
}
