import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
  NavigationEnd,
} from '@angular/router';
import { NavVisibilityService } from './core/nav-visibility.service';
import { filter, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  showNavigation = true;
  private subscription: Subscription = new Subscription();

  constructor(
    private router: Router,
    private navService: NavVisibilityService
  ) {}

  ngOnInit() {
    // Monitor route changes
    this.subscription.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe((event: any) => {
          // Hide navigation on dashboard, show on other routes
          if (event.url === '/dashboard' || event.url === '/') {
            this.navService.hideNavigation();
          } else {
            this.navService.showNavigationBar();
          }
        })
    );

    // Subscribe to the visibility service
    this.subscription.add(
      this.navService.showNavigation$.subscribe(
        (show) => (this.showNavigation = show)
      )
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
