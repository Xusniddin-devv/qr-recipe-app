import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';

    // Handle bold text (**text**)
    const boldText = value.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Handle italic text (*text*)
    const formattedText = boldText.replace(/\*(.*?)\*/g, '<em>$1</em>');

    return this.sanitizer.bypassSecurityTrustHtml(formattedText);
  }
}
