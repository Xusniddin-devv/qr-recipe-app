import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Product } from '../../../../core/check.service';
import { LoadingIndicatorComponent } from '../../shared/loading-indicator/loading-indicator.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ReceiptHistoryComponent } from '../receipt-history/receipt-histrory.component';

@Component({
  selector: 'app-receipt-summary',
  templateUrl: './receipt-summary.component.html',
  styles: [],
  standalone: true,
  imports: [CurrencyPipe, EmptyStateComponent, LoadingIndicatorComponent],
})
export class ReceiptSummaryComponent {
  @Input() summary: Product[] | null = null;
  @Output() scanClicked = new EventEmitter<void>();

  isItemPriceNaN(value: string | number | undefined | null): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      return value.trim() === '' || isNaN(parseFloat(value));
    }
    return isNaN(Number(value));
  }

  onScanClick(): void {
    this.scanClicked.emit();
  }
}
