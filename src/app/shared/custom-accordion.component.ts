import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-custom-accordion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="border border-slate-700 rounded-lg mb-2 overflow-hidden bg-slate-800"
    >
      <button
        (click)="toggle()"
        class="w-full flex justify-between items-center p-4 text-left hover:bg-slate-700/50 focus:outline-none transition-colors duration-200"
        [attr.aria-expanded]="isOpen()"
      >
        <span class="font-medium text-lg text-white">{{ title }}</span>
        <svg
          class="w-6 h-6 transform transition-transform text-slate-400"
          [class.rotate-180]="!isOpen()"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      @if (isOpen()) {
      <div class="border-t border-slate-700 bg-slate-800">
        <div class="p-4">
          <ng-content></ng-content>
        </div>
      </div>
      }
    </div>
  `,
})
export class CustomAccordionComponent {
  @Input() title: string = 'Accordion Title';
  @Input() startOpen: boolean = false;

  isOpen = signal(false);

  ngOnInit() {
    this.isOpen.set(this.startOpen);
  }

  toggle() {
    this.isOpen.set(!this.isOpen());
  }
}
