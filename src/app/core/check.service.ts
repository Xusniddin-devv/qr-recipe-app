import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface Product {
  name: string;
  quantity: number;
  price: number;
}

@Injectable({ providedIn: 'root' })
export class CheckService {
  public productsSubject = new BehaviorSubject<Product[]>([]);
  public products$ = this.productsSubject.asObservable();

  constructor(private http: HttpClient) {}

  fetchProducts(url: string): Observable<Product[]> {
    return this.http
      .get<Product[]>('http://localhost:3000/api/check', {
        params: { url, browser: 'chromium' },
      })
      .pipe(tap((data) => this.productsSubject.next(data)));
  }
}
