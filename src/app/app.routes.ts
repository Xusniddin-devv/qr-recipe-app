import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
  // Default route redirects to dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Main dashboard route
  { path: 'dashboard', component: DashboardComponent },

  // Feature routes as siblings, not children
  {
    path: 'scan',
    loadComponent: () =>
      import('./features/qr-scanner/qr-scanner.component').then(
        (m) => m.QrScannerComponent
      ),
  },
  {
    path: 'pantry',
    loadComponent: () =>
      import('./features/pantry/pantry.component').then(
        (m) => m.PantryComponent
      ),
  },
  {
    path: 'recipes',
    loadComponent: () =>
      import('./features/suggestions/suggestions.component').then(
        (m) => m.SuggestionsComponent
      ),
  },

  // Catch-all route
  { path: '**', redirectTo: 'dashboard' },
];
