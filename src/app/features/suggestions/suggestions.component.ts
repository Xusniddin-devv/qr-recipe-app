// src/app/suggestions/suggestions.component.ts
import { Component, inject } from '@angular/core';
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { CheckService, Product } from '../../core/check.service';

@Component({
  standalone: true,
  imports: [NgForOf, AsyncPipe, NgIf],
  selector: 'app-suggestions',
  templateUrl: './suggestions.component.html',
})
export class SuggestionsComponent {
  check = inject(CheckService);
  products$ = this.check.products$;
  makeSuggestions(items: Product[]) {
    return items.map((i) => `Use ${i.quantity}× ${i.name} in a stir-fry`);
  }
}
