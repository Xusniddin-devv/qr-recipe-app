import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ReceiptDetailComponent } from './features/receipt-detail/receipt-detail.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    component: DashboardComponent,
    data: { title: 'Dashboard', showBackButton: false, showNavigation: false },
  },
  {
    path: 'scan',
    loadComponent: () =>
      import('./features/qr-scanner/qr-scanner.component').then(
        (m) => m.QrScannerComponent
      ),
    data: { title: 'Scanner', showBackButton: false, showNavigation: true },
  },
  {
    path: 'pantry',
    loadComponent: () =>
      import('./features/pantry/pantry.component').then(
        (m) => m.PantryComponent
      ),
    data: { title: 'Pantry', showBackButton: false, showNavigation: true },
  },
  {
    path: 'recipes',
    loadComponent: () =>
      import('./features/suggestions/suggestions.component').then(
        (m) => m.SuggestionsComponent
      ),
    data: { title: 'Suggestions', showBackButton: false, showNavigation: true },
  },
  {
    path: 'receipt/:id',
    component: ReceiptDetailComponent,
    data: {
      title: 'Receipt Details',
      showBackButton: true,
      showNavigation: true,
    },
  },
  { path: '**', redirectTo: 'dashboard' },
];
