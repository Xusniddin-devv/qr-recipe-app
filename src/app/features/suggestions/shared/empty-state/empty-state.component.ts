// empty-state.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.component.html',
  standalone: true,
})
export class EmptyStateComponent {
  @Input() icon: 'receipt' | 'receipt-missing' | 'analysis' = 'receipt';
  @Input() title: string = 'No data available';
  @Input() description: string = '';
  @Input() showScanButton: boolean = false;
  @Output() actionClicked = new EventEmitter<void>();

  onActionClick(): void {
    this.actionClicked.emit();
  }
}
