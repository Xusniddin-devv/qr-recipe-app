import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiSuggestions } from '../../../../core/ai.suggestions.service';
import { MarkdownPipe } from '../../../../../pipes/markdownPipe';
import { LoadingIndicatorComponent } from '../../shared/loading-indicator/loading-indicator.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

@Component({
  selector: 'app-saving-suggestions',
  templateUrl: './saving-suggestions.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MarkdownPipe,
    LoadingIndicatorComponent,
    EmptyStateComponent,
  ],
})
export class SavingSuggestionsComponent {
  @Input() suggestions: AiSuggestions | null = null;
  @Input() isLoading: boolean | null = false;
  @Input() hasProducts: boolean | null = false;
  @Input() error: string | null = null;

  // Helper method to check if any saving-related content exists
  hasSavingContent(): boolean {
    return !!(
      this.suggestions?.savingSuggestions?.length ||
      this.suggestions?.seasonalRecommendations?.length ||
      this.suggestions?.budgetAnalysis
    );
  }

  // Helper method to get all saving-related sections
  getSavingSections() {
    const sections = [];

    if (this.suggestions?.savingSuggestions?.length) {
      sections.push({
        title: 'Money-Saving Tips',
        items: this.suggestions.savingSuggestions,
        color: 'orange',
        icon: '💰',
      });
    }

    if (this.suggestions?.seasonalRecommendations?.length) {
      sections.push({
        title: 'Seasonal Recommendations',
        items: this.suggestions.seasonalRecommendations,
        color: 'purple',
        icon: '🌱',
      });
    }

    return sections;
  }

  // Helper method to format budget analysis
  getBudgetAnalysis() {
    return this.suggestions?.budgetAnalysis;
  }

  // Helper method to format currency
  formatCurrency(amount: number): string {
    return `UZS ${amount.toFixed(0)}`;
  }
}
