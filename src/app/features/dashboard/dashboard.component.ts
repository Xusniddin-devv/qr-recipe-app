// filepath: c:\Users\D1n\OneDrive\Desktop\Project\qr-recipe-app\src\app\features\dashboard\dashboard.component.ts
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {}
