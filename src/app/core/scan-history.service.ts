import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface ScanRecord {
  id?: string;
  url: string;
  timestamp: number;
  success: boolean;
  receiptId?: string;
  totalAmount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ScanHistoryService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/scans';

  getRecentScans(): Observable<ScanRecord[]> {
    return this.http.get<ScanRecord[]>(this.apiUrl).pipe(
      switchMap((scans) => {
        // Get all receipt IDs from successful scans
        const receiptIds = scans
          .filter((scan) => scan.success && scan.receiptId)
          .map((scan) => scan.receiptId);

        // If no valid receipt IDs, return the scans as is
        if (receiptIds.length === 0) {
          return of(scans);
        }

        // Get all the receipts to extract totalAmounts
        return this.http.get<any[]>('http://localhost:3000/receipts').pipe(
          map((receipts) => {
            // Create receipt lookup map
            const receiptMap = new Map(
              receipts.map((receipt) => [receipt.id.toString(), receipt])
            );

            // Add totalAmount to each scan from its receipt
            return scans.map((scan) => {
              if (
                scan.success &&
                scan.receiptId &&
                receiptMap.has(scan.receiptId)
              ) {
                return {
                  ...scan,
                  totalAmount: receiptMap.get(scan.receiptId)?.totalAmount || 0,
                };
              }
              return {
                ...scan,
                totalAmount: scan.totalAmount || 0,
              };
            });
          })
        );
      }),
      catchError((error) => {
        console.error('Error fetching recent scans', error);
        return of([]);
      })
    );
  }

  addScan(scan: ScanRecord): Observable<ScanRecord> {
    return this.http
      .post<ScanRecord>(this.apiUrl, scan)
      .pipe(catchError(this.handleError<ScanRecord>('addScan')));
  }

  formatScanDate(timestamp: number): string {
    const scanDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if the date is today
    if (scanDate.toDateString() === today.toDateString()) {
      return `Today, ${this.formatTime(scanDate)}`;
    }

    // Check if the date is yesterday
    if (scanDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${this.formatTime(scanDate)}`;
    }

    // Return date in format "MMM DD, YYYY, HH:MM AM/PM"
    return `${scanDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}, ${this.formatTime(scanDate)}`;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      return of(result as T);
    };
  }
}
