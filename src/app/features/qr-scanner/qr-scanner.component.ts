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
import { CommonModule, isPlatformBrowser } from '@angular/common';
import jsQR from 'jsqr';
import { CheckService, ReceiptData } from '../../core/check.service';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, from, throwError } from 'rxjs';
import { catchError, switchMap, takeUntil, tap } from 'rxjs/operators';

@Component({
  selector: 'app-qr-scanner',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qr-scanner.component.html',
})
export class QrScannerComponent implements OnDestroy {
  @ViewChild('video') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasEl!: ElementRef<HTMLCanvasElement>;

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
      // If scanFrame didn't stop it and streamActive is still true
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
    this.cd.markForCheck();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.status$.next('Camera API not available.');
      this.hasError = true;
      this.streamActive = false;
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
        error: (err) => {
          if (!this.hasError) {
            this.status$.next('An unexpected error occurred.');
            this.hasError = true;
          }
          this.streamActive = false;
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
          this.check.fetchProducts(this.decodedUrl).subscribe({
            next: (data) => {
              this.productsData = data;
              this.showResults = true;
              this.status$.next('Receipt processed, redirecting...');
              this.hasError = false;
              this.cd.detectChanges();

              setTimeout(() => {
                if (this.track) {
                  this.track.stop();
                  this.track = undefined;
                }
                this.streamActive = false;
                this.showStatus = false;
                this.cd.detectChanges();
                this.router.navigate(['/pantry']);
              }, 500);
            },
            error: (err) => {
              console.error('Error processing receipt:', err);
              this.status$.next('Error processing receipt.');
              this.hasError = true;
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
