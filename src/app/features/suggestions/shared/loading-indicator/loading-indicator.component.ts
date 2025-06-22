// loading-indicator.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.component.html',
  standalone: true,
})
export class LoadingIndicatorComponent {
  @Input() message: string = 'Loading...';
}
