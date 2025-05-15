import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CheckService, Product } from '../../core/check.service'; // Assuming Product is exported from CheckService or a model file
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-pantry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pantry.component.html',
})
export class PantryComponent implements OnInit {
  check = inject(CheckService);
  products$!: Observable<Product[]>;
  ngOnInit(): void {
    this.products$ = this.check.products$.pipe(
      tap((products) => {
        console.log('Products received in PantryComponent:', products);
      })
    );
  }
}
