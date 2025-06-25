import { Component, Input } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { AiSuggestions } from '../../../../core/ai.suggestions.service';
import { MarkdownPipe } from '../../../../../pipes/markdownPipe';
import { LoadingIndicatorComponent } from '../../shared/loading-indicator/loading-indicator.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

@Component({
  selector: 'app-health-suggestions',
  templateUrl: './health-suggestions.component.html',
  standalone: true,
  imports: [
    CommonModule,
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

  // Helper method to check if any health-related content exists
  hasHealthContent(): boolean {
    return !!(
      this.suggestions?.healthSuggestions?.length ||
      this.suggestions?.nutritionalInsights?.length
    );
  }

  // Helper method to get all health-related sections
  getHealthSections() {
    const sections = [];

    if (this.suggestions?.healthSuggestions?.length) {
      sections.push({
        title: 'Health Recommendations',
        items: this.suggestions.healthSuggestions,
        color: 'green',
        icon: '🏥',
      });
    }

    if (this.suggestions?.nutritionalInsights?.length) {
      sections.push({
        title: 'Nutritional Insights',
        items: this.suggestions.nutritionalInsights,
        color: 'blue',
        icon: '🥗',
      });
    }

    return sections;
  }
}
