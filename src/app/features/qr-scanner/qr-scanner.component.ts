import {
  Component,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject,
  PLATFORM_ID,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import jsQR from 'jsqr';
import { CheckService, ReceiptData } from '../../core/check.service';
import { Router, RouterModule } from '@angular/router';
import { BehaviorSubject, Subject, from, throwError } from 'rxjs';
import { catchError, switchMap, takeUntil, tap } from 'rxjs/operators';
import {
  ScanHistoryService,
  ScanRecord,
} from '../../core/scan-history.service';
import { ScannerStateService } from '../../core/scanner-state.service';

// Import PrimeNG components
import { ButtonModule } from 'primeng/button';
import { ReceiptStorageService } from '../../core/receipt-storage.service';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, ButtonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qr-scanner.component.html',
})
export class QrScannerComponent implements OnInit, OnDestroy {
  @ViewChild('video') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasEl!: ElementRef<HTMLCanvasElement>;

  // Services
  private cd = inject(ChangeDetectorRef);
  private check = inject(CheckService);
  private router = inject(Router);
  private scanHistoryService = inject(ScanHistoryService);
  private scannerStateService = inject(ScannerStateService);
  private receiptStorageService = inject(ReceiptStorageService);

  // State signals
  recentScans = signal<ScanRecord[]>([]);
  isLoading = signal(false);

  productsData: ReceiptData | null = null;
  showResults = false;
  isBrowser: boolean;

  showStatus = false;
  status$ = new BehaviorSubject<string>('');
  get status(): string {
    return this.status$.value;
  }

  decodedUrl: string | null = null;
  torchOn = false;
  streamActive: boolean = false;
  hasError: boolean = false;
  private track?: MediaStreamTrack;
  private animationFrameId?: number;
  private destroy$ = new Subject<void>();

  constructor(@Inject(PLATFORM_ID) platformId: any) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.loadRecentScans();
  }

  loadRecentScans(): void {
    this.isLoading.set(true);
    this.scanHistoryService.getRecentScans().subscribe({
      next: (scans) => {
        this.recentScans.set(scans);
        this.isLoading.set(false);
        this.cd.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load recent scans', err);
        this.isLoading.set(false);
        this.cd.markForCheck();
      },
    });
  }

  formatScanDate(timestamp: number): string {
    return this.scanHistoryService.formatScanDate(timestamp);
  }

  scanLoop() {
    if (!this.streamActive) {
      return;
    }

    this.scanFrame();

    if (this.streamActive) {
      this.animationFrameId = requestAnimationFrame(() => this.scanLoop());
    }
    this.cd.markForCheck();
  }

  startScanner() {
    if (!this.isBrowser) return;

    this.streamActive = true;
    this.showStatus = true;
    this.decodedUrl = null;
    this.hasError = false;
    this.status$.next('');
    this.scannerStateService.setScanningState(true);
    this.cd.markForCheck();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.status$.next('Camera API not available.');
      this.hasError = true;
      this.streamActive = false;
      this.scannerStateService.setScanningState(false);
      this.cd.detectChanges();
      return;
    }

    from(
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
    )
      .pipe(
        takeUntil(this.destroy$),
        tap((stream) => {
          this.track = stream.getVideoTracks()[0];
          const video = this.videoEl.nativeElement;
          video.srcObject = stream;
          this.hasError = false;
          this.cd.markForCheck();
        }),
        switchMap(() => from(this.videoEl.nativeElement.play())),
        catchError((err) => {
          console.error('Camera error:', err);
          let errorMessage = 'Could not access camera.';
          if (err instanceof Error) {
            if (err.name === 'NotAllowedError') {
              errorMessage = 'Camera permission denied.';
            } else if (err.name === 'NotFoundError') {
              errorMessage = 'No camera found.';
            } else if (err.name === 'NotReadableError') {
              errorMessage = 'Camera is already in use or unreadable.';
            }
          }
          this.status$.next(`❌ ${errorMessage}`);
          this.hasError = true;
          this.streamActive = false;
          this.scannerStateService.setScanningState(false);
          this.cd.detectChanges();
          return throwError(() => new Error(errorMessage));
        })
      )
      .subscribe({
        next: () => {
          if (this.streamActive) {
            this.animationFrameId = requestAnimationFrame(() =>
              this.scanLoop()
            );
          }
        },
        error: (_err) => {
          if (!this.hasError) {
            this.status$.next('An unexpected error occurred.');
            this.hasError = true;
          }
          this.streamActive = false;
          this.scannerStateService.setScanningState(false);
          this.cd.detectChanges();
        },
      });
  }

  stopScanner() {
    if (!this.isBrowser) return;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    this.showStatus = false;
    this.status$.next('');
    this.decodedUrl = null;
    this.torchOn = false;
    this.streamActive = false;
    this.hasError = false;
    this.scannerStateService.setScanningState(false);

    if (this.track) {
      this.track.stop();
      this.track = undefined;
    }
    if (this.videoEl?.nativeElement) {
      this.videoEl.nativeElement.srcObject = null;
      this.videoEl.nativeElement.pause();
    }

    this.cd.markForCheck();
  }

  saveScan(
    url: string,
    success: boolean,
    receiptId?: string,
    totalAmount?: number
  ): void {
    const scan: ScanRecord = {
      url: url,
      timestamp: Date.now(),
      success: success,
      receiptId: receiptId,
      totalAmount: totalAmount,
    };

    this.scanHistoryService.addScan(scan).subscribe({
      next: () => {
        this.loadRecentScans();
      },
      error: (err) => console.error('Failed to save scan', err),
    });
  }

  private scanFrame() {
    if (
      !this.videoEl?.nativeElement ||
      !this.canvasEl?.nativeElement ||
      !this.streamActive
    ) {
      return;
    }

    const video = this.videoEl.nativeElement;
    if (video.readyState !== video.HAVE_ENOUGH_DATA || video.paused) {
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (vw === 0 || vh === 0) {
      return;
    }

    const canvas = this.canvasEl.nativeElement;
    canvas.width = vw;
    canvas.height = vh;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, vw, vh);
    const imgData = ctx.getImageData(0, 0, vw, vh);
    const code = jsQR(imgData.data, vw, vh);

    if (code) {
      const text = code.data.trim();

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = undefined;
      }

      if (/^https?:\/\//i.test(text)) {
        this.decodedUrl = text;
        this.hasError = false;
        console.log('QR code detected (URL):', text);

        if (this.videoEl?.nativeElement) {
          this.videoEl.nativeElement.pause();
        }

        this.status$.next('URL found, processing receipt...');
        this.showStatus = true;
        this.cd.detectChanges();

        if (this.decodedUrl) {
          // --- REFACTORED CODE ---
          // Use the single, encapsulated method from the storage service.
          this.receiptStorageService
            .processAndSaveReceipt(this.decodedUrl)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (savedReceipt) => {
                this.status$.next('Receipt saved, redirecting...');
                this.hasError = false;

                // The check remains the same, but the data is now more reliable.
                if (
                  savedReceipt &&
                  savedReceipt.id &&
                  typeof savedReceipt.totalAmount === 'number'
                ) {
                  // SUCCESS CASE: We have a full receipt object.
                  this.saveScan(
                    this.decodedUrl!,
                    true,
                    savedReceipt.id.toString(),
                    savedReceipt.totalAmount
                  );
                } else {
                  // FAILURE CASE: Receipt data is incomplete, but may still have totalAmount
                  console.warn(
                    'Receipt processed, but ID or totalAmount was missing. Logging as a failed scan. Received:',
                    savedReceipt
                  );

                  // Pass the totalAmount even for "failed" scans if it exists
                  this.saveScan(
                    this.decodedUrl!,
                    false,
                    undefined,
                    savedReceipt?.totalAmount
                  );
                }

                this.cd.detectChanges();

                setTimeout(() => {
                  if (this.track) {
                    this.track.stop();
                    this.track = undefined;
                  }
                  this.streamActive = false;
                  this.scannerStateService.setScanningState(false);
                  this.showStatus = false;
                  this.cd.detectChanges();
                  this.router.navigate(['/pantry']);
                }, 500);
              },
              error: (err) => {
                console.error('Error processing or saving receipt:', err);
                this.status$.next('Error processing receipt.');
                this.hasError = true;

                if (this.decodedUrl) {
                  // Include 0 as totalAmount for error cases so the template shows a number instead of URL
                  this.saveScan(this.decodedUrl, false, undefined, 0);
                }

                this.cd.detectChanges();
              },
            });
        }
      } else {
        this.status$.next(
          `Scanned: "${text.substring(0, 40)}..." Not a valid receipt URL.`
        );
        this.hasError = true;
        this.decodedUrl = null;
        this.cd.detectChanges();

        setTimeout(() => {
          if (
            this.videoEl?.nativeElement &&
            this.videoEl.nativeElement.paused
          ) {
            this.videoEl.nativeElement
              .play()
              .catch((e) => console.error('Error re-playing video', e));
          }

          if (this.videoEl.nativeElement.srcObject && this.track) {
            this.status$.next('');
            this.hasError = false;
            if (this.streamActive) {
              this.animationFrameId = requestAnimationFrame(() =>
                this.scanLoop()
              );
            }
            this.cd.markForCheck();
          } else {
            this.stopScanner();
            this.status$.next(
              'Camera stream issue. Please start camera again.'
            );
            this.hasError = true;
            this.showStatus = true;
            this.cd.detectChanges();
          }
        }, 2500);
      }
    }
  }

  toggleTorch() {
    if (!this.track || !this.streamActive) {
      return;
    }

    const capabilities = this.track.getCapabilities() as any;

    if (capabilities && 'torch' in capabilities) {
      this.torchOn = !this.torchOn;
      this.track
        .applyConstraints({
          advanced: [{ torch: this.torchOn } as any],
        })
        .then(() => {
          this.cd.markForCheck();
        })
        .catch((err) => {
          console.error('Error toggling torch:', err);
          this.torchOn = !this.torchOn;
          this.status$.next('Could not toggle torch.');
          this.hasError = true;
          this.cd.detectChanges();
          setTimeout(() => {
            if (this.status === 'Could not toggle torch.') {
              this.status$.next(this.streamActive ? '' : this.status$.value);
              this.hasError = false;
              this.cd.detectChanges();
            }
          }, 2000);
        });
    } else {
      this.status$.next('Torch not available on this camera.');
      this.cd.detectChanges();
      setTimeout(() => {
        if (this.status === 'Torch not available on this camera.') {
          this.status$.next(this.streamActive ? '' : this.status$.value);
          this.cd.detectChanges();
        }
      }, 2000);
    }
  }

  ngOnDestroy(): void {
    this.stopScanner();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
