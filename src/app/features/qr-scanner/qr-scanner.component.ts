import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CheckService } from '../../core/check.service';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [NgIf],
  templateUrl: './qr-scanner.component.html',
})
export class QrScannerComponent {
  isLoading = false;

  constructor(private check: CheckService, private router: Router) {}

  fakeScan() {
    this.isLoading = true;
    const receiptUrl =
      'https://ofd.soliq.uz/check?t=UZ210317259557&r=216246&c=20250427193736&s=040497462161';
    this.check.fetchProducts(receiptUrl).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/pantry']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error fetching products:', err);
      },
    });
  }
}
