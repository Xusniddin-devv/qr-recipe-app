import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
  NavigationEnd,
  Event,
} from '@angular/router';
import { NavVisibilityService } from './core/nav-visibility.service';
import { filter, Subscription } from 'rxjs';
import { CommonModule, Location } from '@angular/common';
import { ScannerStateService } from './core/scanner-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  showNavigation = true;
  isScanningActive = false;
  currentRoute = 'Home';
  breadcrumbItems: string[] = [];
  private subscription: Subscription = new Subscription();

  constructor(
    private router: Router,
    private navService: NavVisibilityService,
    private scannerStateService: ScannerStateService,
    private location: Location
  ) {}

  ngOnInit() {
    // Subscribe to navigation visibility service
    this.subscription.add(
      this.navService.showNavigation$.subscribe(
        (show) => (this.showNavigation = show)
      )
    );

    // Subscribe to scanner state service
    this.subscription.add(
      this.scannerStateService.isScanning$.subscribe(
        (isScanning) => (this.isScanningActive = isScanning)
      )
    );

    // Handle navigation events for visibility and breadcrumbs
    this.subscription.add(
      this.router.events
        .pipe(
          filter(
            (event: Event): event is NavigationEnd =>
              event instanceof NavigationEnd
          )
        )
        .subscribe((event: NavigationEnd) => {
          // Handle navigation visibility
          if (event.url === '/dashboard' || event.url === '/') {
            this.navService.hideNavigation();
          } else {
            this.navService.showNavigationBar();
          }

          // Update breadcrumbs
          this.updateBreadcrumbs(event.urlAfterRedirects);
        })
    );
  }

  private updateBreadcrumbs(url: string): void {
    // Remove leading slash and split by '/'
    const urlSegments = url.slice(1).split('/');

    // Set current route based on first segment (or 'Home' if empty)
    if (urlSegments[0]) {
      // Format the route name (capitalize first letter)
      this.currentRoute = this.formatRouteName(urlSegments[0]);

      // Set breadcrumb items based on additional segments
      this.breadcrumbItems = urlSegments
        .slice(1)
        .map((segment) => this.formatRouteName(segment));
    } else {
      this.currentRoute = 'Home';
      this.breadcrumbItems = [];
    }
  }

  private formatRouteName(name: string): string {
    if (!name) return '';

    // Handle special cases
    switch (name.toLowerCase()) {
      case 'scan':
        return 'Scanner';
      case 'pantry':
        return 'Pantry';
      case 'recipes':
        return 'Suggestions';
      default:
        return name
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
    }
  }

  shouldShowBackButton(): boolean {
    // Show back button on deeper routes or specific pages
    // Root routes (/scan, /pantry, /recipes) don't need back button
    const url = this.router.url;
    if (
      url === '/scan' ||
      url === '/pantry' ||
      url === '/recipes' ||
      url === '/'
    ) {
      return false;
    }
    return true;
  }

  goBack(): void {
    this.location.back();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
