import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CheckService, Product } from '../../core/check.service';
import { AiSuggestionService } from '../../core/ai.suggestions.service';

import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MarkdownPipe } from '../../../pipes/markdownPipe';

@Component({
  selector: 'app-pantry',
  imports: [CommonModule],
  templateUrl: './pantry.component.html',
})
export class PantryComponent implements OnInit {
  check = inject(CheckService);
  aiService = inject(AiSuggestionService);
  products$!: Observable<Product[]>;
  summary$!: Observable<Product[]>;

  isItemPriceNaN(price: any): boolean {
    return isNaN(Number(price));
  }

  // Helper method to calculate price per unit
  getPricePerUnit(price: number, quantity: number): number {
    if (!quantity || quantity === 0) return price;
    return price / quantity;
  }

  ngOnInit(): void {
    this.products$ = this.check.products$.pipe(
      tap((products) => {
        console.log('Products received in PantryComponent:', products);
        if (products && products.length > 0) {
          this.aiService.getAiSuggestions(products).subscribe();
        }
      })
    );

    this.summary$ = this.check.summary$.pipe(
      tap((summary) => {
        console.log('Summary received in PantryComponent:', summary);
      })
    );
  }
}
