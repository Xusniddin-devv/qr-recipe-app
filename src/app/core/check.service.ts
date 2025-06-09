import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { AiSuggestionService } from './ai.suggestions.service'; // Import AiSuggestionService

export interface Product {
  name: string;
  quantity: any; // Allow string for items like "Bank kartasi turi"
  price: any; // Allow string for items like "Shaxsiy"
}

export interface ReceiptData {
  products: Product[];
  summary: Product[];
}

@Injectable({ providedIn: 'root' })
export class CheckService {
  private http = inject(HttpClient);
  private aiSuggestionService = inject(AiSuggestionService); // Inject AiSuggestionService

  public productsSubject = new BehaviorSubject<Product[]>([]);
  public summarySubject = new BehaviorSubject<Product[]>([]);

  public products$ = this.productsSubject.asObservable();
  public summary$ = this.summarySubject.asObservable();

  constructor() {}

  fetchProducts(url: string): Observable<ReceiptData | null> {
    // Allow null for error case
    // Clear previous data before new fetch
    this.productsSubject.next([]);
    this.summarySubject.next([]);
    this.aiSuggestionService.clearSuggestions(); // Clear old AI suggestions

    return this.http
      .get<ReceiptData>('http://localhost:30001/api/check', {
        // Ensure your backend URL is correct
        params: { url, browser: 'chromium' },
      })
      .pipe(
        tap((data: ReceiptData) => {
          console.log('CheckService: Data received from backend:', data);
          if (data && data.products && data.summary) {
            this.productsSubject.next(data.products);
            this.summarySubject.next(data.summary);

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
                    // The AI service handles its own error state for the UI.
                    // Log here if needed, but don't break the fetchProducts stream.
                    console.error(
                      'CheckService: Error from getAiSuggestions call:',
                      err
                    );
                    return of(null); // Prevent error from propagating further in this specific chain
                  })
                )
                .subscribe(); // Subscribe to initiate the call
            } else {
              // No products, ensure AI suggestions are cleared
              this.aiSuggestionService.clearSuggestions();
            }
          } else {
            console.warn(
              'CheckService: Received malformed data from backend',
              data
            );
            // Handle malformed data, perhaps by emitting empty arrays or an error
            this.productsSubject.next([]);
            this.summarySubject.next([]);
            this.aiSuggestionService.clearSuggestions();
          }
        }),
        catchError((error) => {
          console.error('CheckService: Error fetching products:', error);
          this.productsSubject.next([]); // Clear products on error
          this.summarySubject.next([]); // Clear summary on error
          this.aiSuggestionService.clearSuggestions(); // Clear AI suggestions on error
          // Optionally, rethrow the error or return a user-friendly error object
          return of(null); // Return null or an error object to signal failure
        })
      );
  }

  // Method to clear all receipt related data
  clearAllReceiptData(): void {
    this.productsSubject.next([]);
    this.summarySubject.next([]);
    this.aiSuggestionService.clearSuggestions();
    console.log('CheckService: All receipt data cleared.');
  }
}
