import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import {
  ReceiptStorageService,
  SummaryPeriod,
} from '../../../../core/receipt-storage.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomAccordionComponent } from '../../../../shared/custom-accordion.component';

@Component({
  selector: 'app-receipt-history',
  templateUrl: './receipt-history.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    CurrencyPipe,
    DatePipe,
    CustomAccordionComponent,
    AccordionModule,
    ChartModule,
    CardModule,
  ],
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
})
export class ReceiptHistoryComponent implements OnInit {
  private receiptService = inject(ReceiptStorageService);

  weeklySummary$ = this.receiptService.weeklySummary$;
  monthlySummary$ = this.receiptService.monthlySummary$;

  hasHistory$ = combineLatest([this.weeklySummary$, this.monthlySummary$]).pipe(
    map(([weekly, monthly]) => !!(weekly || monthly))
  );

  weeklyChartData: any;
  monthlyChartData: any;

  // UPDATED: Chart options for dark theme and responsiveness
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false, // This is the key fix for the resizing issue
    plugins: {
      legend: {
        labels: {
          // Set text color to be visible on a dark background
          color: '#e5e7eb', // This is Tailwind's gray-200
        },
      },
    },
  };

  constructor() {
    this.weeklySummary$.pipe(takeUntilDestroyed()).subscribe((summary) => {
      if (summary) {
        this.weeklyChartData = this.createChartData(summary);
      }
    });

    this.monthlySummary$.pipe(takeUntilDestroyed()).subscribe((summary) => {
      if (summary) {
        this.monthlyChartData = this.createChartData(summary);
      }
    });
  }

  ngOnInit() {
    this.receiptService.loadWeeklySummary();
    this.receiptService.loadMonthlySummary();
  }

  // UPDATED: Chart data creation with dark theme colors
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
            // Use a dark color for the "No Data" state
            backgroundColor: ['#4b5563'], // Tailwind's gray-600
            borderWidth: 0,
          },
        ],
      };
    }

    return {
      labels: summary.topCategories.map((cat) => cat.category),
      datasets: [
        {
          data: summary.topCategories.map((cat) => cat.amount),
          // Provide a new, vibrant color palette for the chart
          backgroundColor: [
            '#3b82f6', // blue-500
            '#22c55e', // green-500
            '#f97316', // orange-500
            '#14b8a6', // teal-500
            '#8b5cf6', // violet-500
            '#ec4899', // pink-500
          ],
          borderWidth: 0, // A border is not needed on a dark background
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
}
