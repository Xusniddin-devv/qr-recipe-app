import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CheckService, Product, Discount } from '../../core/check.service';
import { AiSuggestionService } from '../../core/ai.suggestions.service';
import { ReceiptStorageService } from '../../core/receipt-storage.service'; // Add this
import { ActivatedRoute } from '@angular/router'; // Add this
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'; // Add this for better subscription management

import { Observable, combineLatest } from 'rxjs'; // Add combineLatest
import { tap, switchMap, catchError, filter } from 'rxjs/operators'; // Add these operators
import { UiStateService } from '../../core/ui.state.service';

@Component({
  selector: 'app-pantry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pantry.component.html',
})
export class PantryComponent implements OnInit {
  // Injected services
  check = inject(CheckService);
  aiService = inject(AiSuggestionService);
  receiptStorage = inject(ReceiptStorageService); // Add this
  route = inject(ActivatedRoute); // Add this
  private uiStateService = inject(UiStateService);

  // Observables for the template
  products$!: Observable<Product[]>;
  discounts$!: Observable<Discount[]>;
  summary$!: Observable<Product[]>;

  // Track if we've already saved this receipt
  private receiptSaved = false;

  // Helper methods for the template
  isItemPriceNaN(price: any): boolean {
    return isNaN(Number(price));
  }

  // Helper method to calculate price per unit
  getPricePerUnit(price: number, quantity: number): number {
    if (!quantity || quantity === 0) return price;
    return price / quantity;
  }

  // These are now delegated to the service
  getDiscountsForProduct(productName: string): Discount[] {
    return this.check.getProductDiscounts(productName);
  }

  hasDiscount(productName: string): boolean {
    return this.check.hasDiscount(productName);
  }

  getTotalDiscountAmount(productName: string): number {
    return this.check.getTotalDiscountAmountSync(productName);
  }

  // Calculate total for all discounts
  calculateTotalDiscounts(discounts: Discount[]): number {
    if (!discounts || !discounts.length) return 0;
    return discounts.reduce((sum, d) => sum + (d.discountValue || 0), 0);
  }

  ngOnInit(): void {
    // Get scan URL from route params if available
    const scanUrl = this.route.snapshot.queryParams['url'];
    this.uiStateService.setChromeVisibility(true);

    // Simply use the service's observable streams
    this.products$ = this.check.products$.pipe(
      tap((products) => {
        console.log('Products in PantryComponent:', products);

        // Save to database when we have products and a scanUrl (but only once)
        if (products.length > 0 && scanUrl && !this.receiptSaved) {
          this.saveReceiptToDatabase(scanUrl);
        }
      })
    );

    this.discounts$ = this.check.discounts$.pipe(
      tap((discounts) => {
        console.log('Discounts received in PantryComponent:', discounts);
      })
    );

    this.summary$ = this.check.summary$.pipe(
      tap((summary) => {
        console.log('Summary received in PantryComponent:', summary);
      })
    );
  }

  // Add new method to save receipt data to database
  private saveReceiptToDatabase(scanUrl: string): void {
    this.receiptSaved = true; // Mark as saved to prevent duplicate saves

    this.receiptStorage
      .saveCurrentReceipt(scanUrl)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (savedReceipt) => {
          console.log('Receipt saved to database successfully:', savedReceipt);
          // Optional: Show a success message to the user
        },
        error: (error) => {
          console.error('Error saving receipt to database:', error);
          this.receiptSaved = false; // Reset flag so we can try again
          // Optional: Show an error message to the user
        },
      });
  }
}
