import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-custom-accordion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-200 rounded-md mb-2 overflow-hidden">
      <button
        (click)="toggle()"
        class="w-full flex justify-between items-center p-4 text-left bg-gray-50 hover:bg-gray-100 focus:outline-none"
        [attr.aria-expanded]="isOpen()"
      >
        <span class="font-medium text-gray-800">{{ title }}</span>
        <svg
          class="w-6 h-6 transform transition-transform"
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
      <div class="p-4 border-t border-gray-200 bg-white">
        <ng-content></ng-content>
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
