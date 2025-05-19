import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface Product {
  name: string;
  quantity: number;
  price: number;
}

export interface ReceiptData {
  products: Product[];
  summary: Product[];
}

@Injectable({ providedIn: 'root' })
export class CheckService {
  public productsSubject = new BehaviorSubject<Product[]>([]);
  public summarySubject = new BehaviorSubject<Product[]>([]);

  public products$ = this.productsSubject.asObservable();
  public summary$ = this.summarySubject.asObservable();

  constructor(private http: HttpClient) {}

  fetchProducts(url: string): Observable<ReceiptData> {
    return this.http
      .get<ReceiptData>('http://localhost:3000/api/check', {
        params: { url, browser: 'chromium' },
      })
      .pipe(
        tap((data: ReceiptData) => {
          this.productsSubject.next(data.products);
          this.summarySubject.next(data.summary);
        })
      );
  }
}
