import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiSuggestions } from '../../../../core/ai.suggestions.service';
import { MarkdownPipe } from '../../../../../pipes/markdownPipe';

@Component({
  selector: 'app-saving-suggestions',
  templateUrl: './saving-suggestions.component.html',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
})
export class SavingSuggestionsComponent {
  @Input() suggestions: AiSuggestions | null = null;
  @Input() isLoading: boolean | null = false;
  @Input() hasProducts: boolean | null = false;
  @Input() error: string | null = null;
}
