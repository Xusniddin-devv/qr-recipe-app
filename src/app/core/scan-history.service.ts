import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ScanRecord {
  id?: number;
  url: string;
  timestamp: number;
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ScanHistoryService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/scans';

  getRecentScans(): Observable<ScanRecord[]> {
    return this.http
      .get<ScanRecord[]>(`${this.apiUrl}?_sort=timestamp&_order=desc&_limit=10`)
      .pipe(catchError(this.handleError<ScanRecord[]>('getRecentScans', [])));
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
