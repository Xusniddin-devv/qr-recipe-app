// health-suggestions.component.ts
import { Component, Input } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AiSuggestions } from '../../../../core/ai.suggestions.service';
import { MarkdownPipe } from '../../../../../pipes/markdownPipe';
import { LoadingIndicatorComponent } from '../../shared/loading-indicator/loading-indicator.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

@Component({
  selector: 'app-health-suggestions',
  templateUrl: './health-suggestions.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    MarkdownPipe,
    EmptyStateComponent,
    LoadingIndicatorComponent,
  ],
})
export class HealthSuggestionsComponent {
  @Input() suggestions: AiSuggestions | null = null;
  @Input() isLoading: boolean | null = false;
  @Input() hasProducts: boolean | null = false;
  @Input() error: string | null = null;
}
