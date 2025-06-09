import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe, CurrencyPipe, NgClass } from '@angular/common';
import { CheckService, Product } from '../../core/check.service';
import { Observable, Subject } from 'rxjs';
import { tap, takeUntil, map, startWith } from 'rxjs/operators';
import {
  AiSuggestions,
  AiSuggestionService,
} from '../../core/ai.suggestions.service';
import { MarkdownPipe } from '../../../pipes/markdownPipe';

@Component({
  imports: [AsyncPipe, NgClass, CurrencyPipe, MarkdownPipe],
  selector: 'app-suggestions',
  templateUrl: './suggestions.component.html',
  standalone: true,
})
export class SuggestionsComponent implements OnInit, OnDestroy {
  private checkService = inject(CheckService);
  private aiSuggestionService = inject(AiSuggestionService);
  private destroy$ = new Subject<void>();

  paymentSummary$: Observable<Product[]>;
  aiSuggestions$: Observable<AiSuggestions | null>;
  isLoadingAiSuggestions$: Observable<boolean>;
  aiError$: Observable<string | null>;
  hasProductsForSuggestions$: Observable<boolean>;

  activeSuggestionTab: 'receipt' | 'health' | 'saving' = 'receipt';

  constructor() {
    this.paymentSummary$ = this.checkService.summary$.pipe(
      tap((summary) =>
        console.log('SuggestionsComponent: Payment Summary updated:', summary)
      ),
      takeUntil(this.destroy$)
    );

    this.aiSuggestions$ = this.aiSuggestionService.suggestions$.pipe(
      tap((suggestions) =>
        console.log(
          'SuggestionsComponent: AI Suggestions updated:',
          suggestions
        )
      ),
      takeUntil(this.destroy$)
    );
    this.isLoadingAiSuggestions$ = this.aiSuggestionService.isLoading$.pipe(
      tap((loading) =>
        console.log('SuggestionsComponent: AI Loading state:', loading)
      ),
      takeUntil(this.destroy$)
    );
    this.aiError$ = this.aiSuggestionService.error$.pipe(
      tap((error) =>
        console.log('SuggestionsComponent: AI Error state:', error)
      ),
      takeUntil(this.destroy$)
    );

    this.hasProductsForSuggestions$ = this.checkService.products$.pipe(
      map((products) => !!products && products.length > 0),
      startWith(false),
      tap((hasProducts) =>
        console.log(
          'SuggestionsComponent: Has products for suggestions:',
          hasProducts
        )
      ),
      takeUntil(this.destroy$)
    );
  }

  ngOnInit(): void {
    // AI suggestions are now triggered by CheckService.
    // This component just consumes the state from AiSuggestionService.
    console.log(
      'SuggestionsComponent initialized. AI fetch is handled by CheckService.'
    );
  }

  isItemPriceNaN(value: string | number | undefined | null): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      return value.trim() === '' || isNaN(parseFloat(value));
    }
    return isNaN(Number(value));
  }

  setActiveTab(tab: 'receipt' | 'health' | 'saving'): void {
    this.activeSuggestionTab = tab;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
