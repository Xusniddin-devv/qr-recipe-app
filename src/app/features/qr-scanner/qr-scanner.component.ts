import {
  Component,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject,
  PLATFORM_ID,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, NgIf } from '@angular/common';
import jsQR from 'jsqr';
import { CheckService, ReceiptData } from '../../core/check.service';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, from, throwError } from 'rxjs';
import { catchError, switchMap, takeUntil, tap } from 'rxjs/operators';

@Component({
  selector: 'app-qr-scanner',
  imports: [NgIf, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qr-scanner.component.html',
})
export class QrScannerComponent implements OnDestroy {
  @ViewChild('video') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasEl!: ElementRef<HTMLCanvasElement>;

  productsData: ReceiptData | null = null;
  showResults = false;
  isBrowser: boolean;

  // Status handling with visibility control
  showStatus = false;
  status$ = new BehaviorSubject<string>('');
  get status(): string {
    return this.status$.value;
  }

  decodedUrl: string | null = null;
  torchOn = false;
  streamActive: boolean = false;
  private track?: MediaStreamTrack;
  private animationFrameId?: number;
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(PLATFORM_ID) platformId: any,
    private cd: ChangeDetectorRef,
    private check: CheckService,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
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
    this.status$.next('Scanning...');
    this.cd.markForCheck();

    if (!navigator.mediaDevices) {
      this.status$.next('Camera API not available in this browser');
      this.streamActive = false;
      this.cd.markForCheck();
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
          this.cd.markForCheck();
        }),
        switchMap((stream) => from(this.videoEl.nativeElement.play())),
        catchError((err) => {
          console.error('Camera error:', err);
          this.status$.next('❌ Camera access denied');
          this.streamActive = false;
          this.cd.markForCheck();
          return throwError(() => err);
        })
      )
      .subscribe({
        next: () => {
          this.animationFrameId = requestAnimationFrame(() => this.scanLoop());
        },
        error: () => this.cd.markForCheck(),
      });
  }

  stopScanner() {
    if (!this.isBrowser) return;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    // Hide status when stopping scanner
    this.showStatus = false;
    this.status$.next('');
    this.decodedUrl = null;
    this.torchOn = false;
    this.streamActive = false;

    if (this.track) {
      this.track.stop();
      this.track = undefined;
    }

    this.cd.markForCheck();
  }
  // Only the scanFrame method needs to be modified

  private scanFrame() {
    if (!this.videoEl?.nativeElement || !this.canvasEl?.nativeElement) return;

    const video = this.videoEl.nativeElement;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const vw = video.videoWidth,
      vh = video.videoHeight;
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

      // Cancel animation frame first to stop further scanning
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = undefined;
      }

      // Ensure we stop the scanner before processing results
      this.streamActive = false;

      if (/^https?:\/\//i.test(text)) {
        // Update state variables before UI updates
        this.decodedUrl = text;
        console.log('QR code detected:', text);

        // Stop video playback
        if (this.videoEl?.nativeElement) {
          this.videoEl.nativeElement.pause();
        }

        // Stop camera track
        if (this.track) {
          this.track.stop();
          this.track = undefined;
        }

        // Update status message last and force change detection
        this.status$.next('Scan complete, redirecting, please wait');
        this.cd.detectChanges(); // Force immediate update

        if (this.decodedUrl) {
          setTimeout(() => {
            this.check.fetchProducts(this.decodedUrl!).subscribe({
              next: (data) => {
                this.productsData = data;
                this.showResults = true;
                this.status$.next('Receipt processed successfully');
                this.cd.detectChanges();

                setTimeout(() => {
                  this.router.navigate(['/pantry']);
                }, 2000);
              },
              error: (err) => {
                console.error('Error processing receipt:', err);
                this.status$.next('Error processing receipt');
                this.cd.markForCheck();
              },
            });
          }, 1000);
        }
      } else {
        this.status$.next(`❗ Scanned data: ${text}`);
        this.cd.detectChanges();

        // Resume scanning after a non-URL QR code
        this.streamActive = true;
        this.animationFrameId = requestAnimationFrame(() => this.scanLoop());
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

      try {
        this.track.applyConstraints({
          advanced: [{ torch: this.torchOn } as any],
        });
      } catch (err) {
        console.error('Error toggling torch:', err);
        this.torchOn = false;
      }

      this.cd.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.stopScanner();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
