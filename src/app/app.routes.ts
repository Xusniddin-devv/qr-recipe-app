import { Routes } from '@angular/router';
import { PantryComponent } from './features/pantry/pantry.component';
import { QrScannerComponent } from './features/qr-scanner/qr-scanner.component';
import { SuggestionsComponent } from './features/suggestions/suggestions.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', redirectTo: 'scan', pathMatch: 'full' },
      { path: 'scan', component: QrScannerComponent },
      { path: 'pantry', component: PantryComponent },
      { path: 'recipes', component: SuggestionsComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
