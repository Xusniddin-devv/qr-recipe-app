import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, forkJoin } from 'rxjs';
import { catchError, map, switchMap, tap, take } from 'rxjs/operators';
import { CheckService, Product, Discount } from './check.service';
import { AiSuggestionService, AiSuggestions } from './ai.suggestions.service';

export interface ReceiptRecord {
  id?: number;
  scanUrl: string;
  scanDate: number;
  totalAmount: number;
  products: StoredProduct[];
  discounts: StoredDiscount[];
  aiSuggestions?: {
    healthSuggestions: string[];
    savingSuggestions: string[];
  };
}

export interface StoredProduct {
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

export interface StoredDiscount {
  productName: string;
  discountName: string;
  discountValue: number;
}

export interface SummaryPeriod {
  startDate: Date;
  endDate: Date;
  totalSpent: number;
  topCategories: { category: string; amount: number }[];
  totalSaved: number;
  productCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReceiptStorageService {
  private http = inject(HttpClient);
  private checkService = inject(CheckService);
  private aiService = inject(AiSuggestionService);

  private apiUrl = 'http://localhost:3000/receipts';

  private weeklySummarySubject = new BehaviorSubject<SummaryPeriod | null>(
    null
  );
  weeklySummary$ = this.weeklySummarySubject.asObservable();

  private monthlySummarySubject = new BehaviorSubject<SummaryPeriod | null>(
    null
  );
  monthlySummary$ = this.monthlySummarySubject.asObservable();

  processAndSaveReceipt(scanUrl: string): Observable<ReceiptRecord | null> {
    // Use the `fetchProducts` method from CheckService to process the scan.
    // This method updates the streams in CheckService, which are then used by saveCurrentReceipt.
    return this.checkService.fetchProducts(scanUrl).pipe(
      switchMap((receiptData) => {
        if (!receiptData) {
          // If fetchProducts fails (returns null), stop the chain.
          return of(null);
        }
        return this.saveCurrentReceipt(scanUrl);
      }),
      catchError((error) => {
        console.error('Failed to process and save receipt:', error);
        return of(null); // Return null to indicate failure.
      })
    );
  }

  // Save the current receipt with products, discounts, and AI suggestions
  saveCurrentReceipt(scanUrl: string): Observable<ReceiptRecord | null> {
    // Get current data from services, using take(1) to ensure observables complete.
    return forkJoin({
      products: this.checkService.products$.pipe(take(1)),
      discounts: this.checkService.discounts$.pipe(take(1)),
      summary: this.checkService.summary$.pipe(take(1)),
      suggestions: this.aiService.suggestions$.pipe(take(1)),
    }).pipe(
      switchMap(({ products, discounts, summary, suggestions }) => {
        // Calculate total amount from summary or products
        let totalAmount = 0;
        const totalSummaryItem = summary.find(
          (item) =>
            item.name?.toLowerCase().includes('jami') ||
            item.name?.toLowerCase().includes('total')
        );

        if (totalSummaryItem && typeof totalSummaryItem.price === 'number') {
          totalAmount = totalSummaryItem.price;
        } else {
          // Calculate from products and discounts
          totalAmount = products.reduce(
            (sum, product) =>
              sum + (typeof product.price === 'number' ? product.price : 0),
            0
          );

          // Subtract discounts
          const totalDiscount = discounts.reduce(
            (sum, discount) => sum + (discount.discountValue || 0),
            0
          );

          totalAmount -= totalDiscount;
        }

        const receiptRecord: ReceiptRecord = {
          scanUrl,
          scanDate: Date.now(),
          totalAmount,
          products: products.map((p) => ({
            name: p.name,
            quantity: typeof p.quantity === 'number' ? p.quantity : 1,
            price: typeof p.price === 'number' ? p.price : 0,
            // Basic category detection could be added here
            category: this.detectCategory(p.name),
          })),
          discounts: discounts.map((d) => ({
            productName: d.productName,
            discountName: d.discountName,
            discountValue: d.discountValue,
          })),
          aiSuggestions: suggestions || undefined,
        };

        // Save to database
        return this.http.post<ReceiptRecord>(this.apiUrl, receiptRecord);
      }),
      tap(() => {
        // After saving, refresh summary data
        this.loadWeeklySummary();
        this.loadMonthlySummary();
      }),
      catchError((error) => {
        console.error('Error saving receipt:', error);
        return of(null);
      })
    );
  }
  getReceipt(id: string): Observable<ReceiptRecord> {
    return this.http.get<ReceiptRecord>(`${this.apiUrl}/${id}`);
  }
  // Get all receipts within a date range
  getReceiptsInRange(
    startDate: Date,
    endDate: Date
  ): Observable<ReceiptRecord[]> {
    const start = startDate.getTime();
    const end = endDate.getTime();

    return this.http
      .get<ReceiptRecord[]>(
        `${this.apiUrl}?scanDate_gte=${start}&scanDate_lte=${end}&_sort=scanDate&_order=desc`
      )
      .pipe(catchError(() => of([])));
  }

  // Load weekly summary
  loadWeeklySummary(): void {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday as start of week
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    this.generateSummary(startOfWeek, endOfWeek).subscribe((summary) => {
      this.weeklySummarySubject.next(summary);
    });
  }

  // Load monthly summary
  loadMonthlySummary(): void {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    this.generateSummary(startOfMonth, endOfMonth).subscribe((summary) => {
      this.monthlySummarySubject.next(summary);
    });
  }

  // Generate summary for a date range
  private generateSummary(
    startDate: Date,
    endDate: Date
  ): Observable<SummaryPeriod> {
    return this.getReceiptsInRange(startDate, endDate).pipe(
      map((receipts) => {
        // Calculate total spent
        const totalSpent = receipts.reduce(
          (sum, receipt) => sum + receipt.totalAmount,
          0
        );

        // Count products
        const productCount = receipts.reduce(
          (count, receipt) => count + receipt.products.length,
          0
        );

        // Calculate total saved from discounts
        const totalSaved = receipts.reduce(
          (sum, receipt) =>
            sum +
            receipt.discounts.reduce(
              (discountSum, discount) => discountSum + discount.discountValue,
              0
            ),
          0
        );

        // Calculate top categories
        const categoryMap = new Map<string, number>();
        receipts.forEach((receipt) => {
          receipt.products.forEach((product) => {
            const category = product.category || 'Uncategorized';
            const amount =
              typeof product.price === 'number' ? product.price : 0;
            categoryMap.set(
              category,
              (categoryMap.get(category) || 0) + amount
            );
          });
        });

        // Sort categories by amount
        const topCategories = Array.from(categoryMap.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5); // Top 5 categories

        return {
          startDate,
          endDate,
          totalSpent,
          topCategories,
          totalSaved,
          productCount,
        };
      })
    );
  }

  // Basic category detection based on product name
  private detectCategory(productName: string): string {
    const lowerName = productName.toLowerCase();

    if (
      lowerName.includes('sut') ||
      lowerName.includes('yogurt') ||
      lowerName.includes('milk') ||
      lowerName.includes('qatiq') ||
      lowerName.includes('suzma')
    ) {
      return 'Dairy';
    }

    if (
      lowerName.includes('non') ||
      lowerName.includes('bread') ||
      lowerName.includes('bulochka') ||
      lowerName.includes('lepyoshka')
    ) {
      return 'Bakery';
    }

    if (
      lowerName.includes('tovuq') ||
      lowerName.includes('mol') ||
      lowerName.includes('chicken') ||
      lowerName.includes('beef') ||
      lowerName.includes("go'sht")
    ) {
      return 'Meat';
    }

    if (
      lowerName.includes('pepsi') ||
      lowerName.includes('coca') ||
      lowerName.includes('cola') ||
      lowerName.includes('fanta') ||
      lowerName.includes('sprite')
    ) {
      return 'Beverages';
    }

    if (
      lowerName.includes('olma') ||
      lowerName.includes('banan') ||
      lowerName.includes('apelsin') ||
      lowerName.includes('mandarin')
    ) {
      return 'Fruits';
    }

    if (
      lowerName.includes('sabzi') ||
      lowerName.includes('piyoz') ||
      lowerName.includes('kartoshka')
    ) {
      return 'Vegetables';
    }

    return 'Other';
  }
}
