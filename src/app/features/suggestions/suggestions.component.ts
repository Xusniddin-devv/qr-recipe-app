import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe, CurrencyPipe, NgForOf, NgIf } from '@angular/common';
import { CheckService, Product } from '../../core/check.service';
import { Observable, tap } from 'rxjs';

@Component({
  imports: [NgForOf, AsyncPipe, NgIf, CurrencyPipe],
  selector: 'app-suggestions',
  templateUrl: './suggestions.component.html',
})
export class SuggestionsComponent implements OnInit {
  check = inject(CheckService);
  products$!: Observable<Product[]>;
  summary$!: Observable<Product[]>;
  isItemPriceNaN(price: any): boolean {
    return isNaN(Number(price));
  }
  makeSuggestions(items: Product[]): string[] {
    return items.map(
      (i: Product) => `Use ${i.quantity}× ${i.name} in a stir-fry`
    );
  }
  ngOnInit(): void {
    this.summary$ = this.check.summary$.pipe(
      tap((summary) => {
        console.log('Summary received in PantryComponent:', summary);
      })
    );
  }
}
