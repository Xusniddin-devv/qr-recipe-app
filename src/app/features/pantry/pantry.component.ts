import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CheckService, Product } from '../../core/check.service';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-pantry',
  imports: [CommonModule],
  templateUrl: './pantry.component.html',
})
export class PantryComponent implements OnInit {
  isNaN(arg0: number) {
    throw new Error('Method not implemented.');
  }

  check = inject(CheckService);
  products$!: Observable<Product[]>;
  summary$!: Observable<Product[]>;

  isItemPriceNaN(price: any): boolean {
    return isNaN(Number(price));
  }

  ngOnInit(): void {
    this.products$ = this.check.products$.pipe(
      tap((products) => {
        console.log('Products received in PantryComponent:', products);
      })
    );

    this.summary$ = this.check.summary$.pipe(
      tap((summary) => {
        console.log('Summary received in PantryComponent:', summary);
      })
    );
  }
}
