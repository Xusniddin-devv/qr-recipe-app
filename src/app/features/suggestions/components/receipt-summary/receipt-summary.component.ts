import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
} from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Product } from '../../../../core/check.service';
import { LoadingIndicatorComponent } from '../../shared/loading-indicator/loading-indicator.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { AccordionModule } from 'primeng/accordion';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';

import {
  ReceiptStorageService,
  SummaryPeriod,
} from '../../../../core/receipt-storage.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-receipt-summary',
  templateUrl: './receipt-summary.component.html',
  styles: [
    `
      .chart-container {
        position: relative;
        min-height: 200px;
        width: 100%;
      }
      p-chart {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
  standalone: true,
  imports: [
    AsyncPipe,
    CurrencyPipe,
    DatePipe,
    EmptyStateComponent,
    LoadingIndicatorComponent,
    AccordionModule,
    ChartModule,
    CardModule,
  ],
})
export class ReceiptSummaryComponent implements OnInit {
  @Input() summary: Product[] | null = null;
  @Output() scanClicked = new EventEmitter<void>();

  private receiptService = inject(ReceiptStorageService);

  // Define observable properties
  weeklySummary$ = this.receiptService.weeklySummary$;
  monthlySummary$ = this.receiptService.monthlySummary$;

  weeklyChartData: any;
  monthlyChartData: any;

  chartOptions = {
    plugins: {
      legend: {
        labels: {
          color: '#495057',
        },
      },
    },
  };

  constructor() {
    // Subscribe to weekly summary to create chart data
    this.weeklySummary$
      .pipe(
        takeUntilDestroyed() // This works in constructor because it's in injection context
      )
      .subscribe((summary) => {
        if (summary) {
          this.weeklyChartData = this.createChartData(summary);
        }
      });

    // Subscribe to monthly summary to create chart data
    this.monthlySummary$
      .pipe(
        takeUntilDestroyed() // This works in constructor because it's in injection context
      )
      .subscribe((summary) => {
        if (summary) {
          this.monthlyChartData = this.createChartData(summary);
        }
      });
  }

  ngOnInit() {
    // Load summary data on init
    this.receiptService.loadWeeklySummary();
    this.receiptService.loadMonthlySummary();
  }

  // Create chart data from summary
  createChartData(summary: SummaryPeriod) {
    if (
      !summary ||
      !summary.topCategories ||
      summary.topCategories.length === 0
    ) {
      return {
        labels: ['No Data'],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#EEEEEE'],
          },
        ],
      };
    }

    return {
      labels: summary.topCategories.map((cat) => cat.category),
      datasets: [
        {
          data: summary.topCategories.map((cat) => cat.amount),
          backgroundColor: [
            '#42A5F5',
            '#66BB6A',
            '#FFA726',
            '#26C6DA',
            '#7E57C2',
          ],
        },
      ],
    };
  }

  formatDateRange(startDate: Date, endDate: Date): string {
    if (!startDate || !endDate) return 'Invalid date range';

    const start = new Date(startDate);
    const end = new Date(endDate);

    const startMonth = start.toLocaleString('default', { month: 'short' });
    const endMonth = end.toLocaleString('default', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
    } else {
      return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
    }
  }

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
