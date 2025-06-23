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
}
