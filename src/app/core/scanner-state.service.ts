import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ScannerStateService {
  private isScanningSubject = new BehaviorSubject<boolean>(false);
  isScanning$ = this.isScanningSubject.asObservable();

  setScanningState(isScanning: boolean): void {
    this.isScanningSubject.next(isScanning);
  }
}
