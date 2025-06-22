import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of, map } from 'rxjs';
import { AiSuggestionService } from './ai.suggestions.service';

export interface Product {
  name: string;
  quantity: any; // Allow string for items like "Bank kartasi turi"
  price: any; // Allow string for items like "Shaxsiy"
}

export interface Discount {
  productName: string;
  discountName: string;
  discountValue: number;
}

export interface ReceiptData {
  products: Product[];
  discounts: Discount[];
  summary: Product[];
}

@Injectable({ providedIn: 'root' })
export class CheckService {
  private http = inject(HttpClient);
  private aiSuggestionService = inject(AiSuggestionService);

  // BehaviorSubjects for state management
  public productsSubject = new BehaviorSubject<Product[]>([]);
  public discountsSubject = new BehaviorSubject<Discount[]>([]);
  public summarySubject = new BehaviorSubject<Product[]>([]);

  // Exposed Observables
  public products$ = this.productsSubject.asObservable();
  public discounts$ = this.discountsSubject.asObservable();
  public summary$ = this.summarySubject.asObservable();

  // Cached discount map for quick lookups (updated whenever discounts change)
  private _discountMapCache: { [productName: string]: Discount[] } = {};

  constructor() {
    // Subscribe to discount changes to keep the cache updated
    this.discounts$.subscribe((discounts) => {
      this._updateDiscountMap(discounts);
    });
  }

  // Update internal discount map when discounts change
  private _updateDiscountMap(discounts: Discount[]): void {
    this._discountMapCache = {};

    if (discounts && discounts.length) {
      discounts.forEach((discount) => {
        if (!this._discountMapCache[discount.productName]) {
          this._discountMapCache[discount.productName] = [];
        }
        this._discountMapCache[discount.productName].push(discount);
      });
    }
  }

  fetchProducts(url: string): Observable<ReceiptData | null> {
    // Clear previous data before new fetch
    this.clearAllReceiptData();

    return this.http
      .get<ReceiptData>('http://localhost:30001/api/check', {
        params: { url, browser: 'chromium' },
      })
      .pipe(
        tap((data: ReceiptData) => {
          console.log('CheckService: Data received from backend:', data);

          if (data && data.products) {
            this.productsSubject.next(data.products);

            // Handle discounts if available
            if (data.discounts) {
              console.log('CheckService: Discounts received:', data.discounts);
              this.discountsSubject.next(data.discounts);
            } else {
              this.discountsSubject.next([]);
            }

            // Handle summary data
            if (data.summary) {
              this.summarySubject.next(data.summary);
            } else {
              this.summarySubject.next([]);
            }

            // Trigger AI suggestions as soon as products are available
            if (data.products.length > 0) {
              console.log(
                'CheckService: Triggering AI suggestions for products:',
                data.products
              );
              this.aiSuggestionService
                .getAiSuggestions(data.products)
                .pipe(
                  catchError((err) => {
                    console.error(
                      'CheckService: Error from getAiSuggestions call:',
                      err
                    );
                    return of(null);
                  })
                )
                .subscribe();
            }
          } else {
            console.warn(
              'CheckService: Received malformed data from backend',
              data
            );
            this.clearAllReceiptData();
          }
        }),
        catchError((error) => {
          console.error('CheckService: Error fetching products:', error);
          this.clearAllReceiptData();
          return of(null);
        })
      );
  }

  // Method to clear all receipt related data
  clearAllReceiptData(): void {
    this.productsSubject.next([]);
    this.discountsSubject.next([]);
    this.summarySubject.next([]);
    this.aiSuggestionService.clearSuggestions();
    this._discountMapCache = {};
    console.log('CheckService: All receipt data cleared.');
  }

  // PRICE CALCULATION METHODS

  // Calculate the price after applying all discounts
  getDiscountedPrice(product: Product): Observable<number> {
    return this.getTotalDiscountAmount(product.name).pipe(
      map((totalDiscount) => {
        // Original price minus total discount
        const originalPrice =
          typeof product.price === 'number' ? product.price : 0;
        return originalPrice - totalDiscount;
      })
    );
  }

  // The original price is already in product.price
  getOriginalPrice(product: Product): number {
    return typeof product.price === 'number' ? product.price : 0;
  }

  // DISCOUNT METHODS

  // Get all discounts for a specific product (synchronous, uses cache)
  getProductDiscounts(productName: string): Discount[] {
    return this._discountMapCache[productName] || [];
  }

  // Get all discounts for a specific product (Observable version)
  getDiscountsForProduct(productName: string): Observable<Discount[]> {
    return this.discounts$.pipe(
      map((discounts) => discounts.filter((d) => d.productName === productName))
    );
  }

  // Calculate total discount amount for a product
  getTotalDiscountAmount(productName: string): Observable<number> {
    return this.getDiscountsForProduct(productName).pipe(
      map((discounts) =>
        discounts.reduce(
          (total, discount) => total + (discount.discountValue || 0),
          0
        )
      )
    );
  }

  // Get total discount amount (synchronous, uses cache)
  getTotalDiscountAmountSync(productName: string): number {
    const discounts = this.getProductDiscounts(productName);
    return discounts.reduce(
      (total, discount) => total + (discount.discountValue || 0),
      0
    );
  }

  // Check if a product has any discounts (Observable)
  hasProductDiscount(productName: string): Observable<boolean> {
    return this.getDiscountsForProduct(productName).pipe(
      map((discounts) => discounts.length > 0)
    );
  }

  // Check if a product has any discounts (synchronous, uses cache)
  hasDiscount(productName: string): boolean {
    const discounts = this._discountMapCache[productName];
    return !!discounts && discounts.length > 0;
  }

  // Calculate total discount across all products
  calculateTotalDiscounts(): Observable<number> {
    return this.discounts$.pipe(
      map((discounts) =>
        discounts.reduce((sum, d) => sum + (d.discountValue || 0), 0)
      )
    );
  }
}
