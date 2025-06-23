import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  ReceiptStorageService,
  ReceiptRecord,
} from '../../core/receipt-storage.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { MarkdownPipe } from '../../../pipes/markdownPipe';

@Component({
  selector: 'app-receipt-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, MarkdownPipe],
  templateUrl: './receipt-detail.component.html',
})
export class ReceiptDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private receiptService = inject(ReceiptStorageService);

  receipt$!: Observable<ReceiptRecord>;
  /**
   * Converts an array of suggestion strings into a single,
   * multi-line string for markdown rendering.
   * @param suggestions An array of strings.
   * @returns A single string with each suggestion on a new line.
   */
  formatSuggestions(suggestions: string[]): string {
    return suggestions.join('\n');
  }
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.receipt$ = this.receiptService.getReceipt(id);
    } else {
      this.router.navigate(['/scanner']);
    }
  }
}
