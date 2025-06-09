import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Product } from './check.service'; // Product interface should have price as number for actual products
import { environment } from '../../environments/environment';

export interface AiSuggestions {
  healthSuggestions: string[];
  savingSuggestions: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AiSuggestionService {
  private http = inject(HttpClient);
  private openRouterApiKey: string = environment.openRouterApiKey;
  private openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

  private suggestionsSubject = new BehaviorSubject<AiSuggestions | null>(null);
  suggestions$ = this.suggestionsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  constructor() {
    if (
      !this.openRouterApiKey ||
      this.openRouterApiKey === 'YOUR_DEV_OPENROUTER_API_KEY' ||
      this.openRouterApiKey === 'YOUR_PROD_OPENROUTER_API_KEY'
    ) {
      console.warn(
        'AiSuggestionService: OpenRouter API key is not configured correctly. AI suggestions may not work.'
      );
    }
  }

  getAiSuggestions(products: Product[]): Observable<AiSuggestions | null> {
    if (
      !this.openRouterApiKey ||
      this.openRouterApiKey === 'YOUR_DEV_OPENROUTER_API_KEY' ||
      this.openRouterApiKey === 'YOUR_PROD_OPENROUTER_API_KEY'
    ) {
      const errorMsg = 'OpenRouter API key is not configured.';
      this.errorSubject.next(errorMsg);
      this.isLoadingSubject.next(false);
      this.suggestionsSubject.next(null);
      return of(null);
    }

    if (!products || products.length === 0) {
      this.clearSuggestions();
      return of(null);
    }

    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);
    this.suggestionsSubject.next(null);

    const productList = products
      .map(
        (p) =>
          `${p.name} (${p.quantity ? `quantity: ${p.quantity}, ` : ''}price: ${
            p.price
          })`
      )
      .join('; ');

    // Calculate total sum, ensuring prices are treated as numbers
    // This assumes 'products' are actual grocery items where 'price' is numeric or a parsable numeric string.
    const validPricedProducts = products.filter(
      (p) =>
        p.price !== null &&
        p.price !== undefined &&
        !isNaN(Number(String(p.price).replace(/[^0-9.-]+/g, '')))
    );
    const totalSum = validPricedProducts.reduce(
      (sum, p) => sum + Number(String(p.price).replace(/[^0-9.-]+/g, '')), // Attempt to clean and parse price
      0
    );
    // Format totalSum for readability in the prompt, e.g., "UZS 24,502"
    // Using a simple formatting here; adjust if a more robust currency formatting is needed for the AI.
    const formattedTotalSum = `UZS ${totalSum.toFixed(0)}`;

    const prompt = `
You are a friendly and insightful AI assistant helping users make healthier and more economical choices based on their grocery receipt.

The user has purchased the following items:
${productList}

The total sum for these specific items is: ${formattedTotalSum}.

IMPORTANT CONTEXT AND RULES:
- These items are from Uzbekistan and may include Uzbek product names
- "Xonim kartoshkali" is a specific Uzbek food item - it is made of potato and flour
- "Tovuq sonidan" refers to chicken
- NEVER refer to Xonim kartoshkali as a vegetable, non-potato veggie, or anything similar
- Only comment on items if you're absolutely certain what they are
- If you don't know what an item is, just make general comments about balanced diet or saving

Please provide:
1.  **Health Suggestions**: Based *only* on the list of items purchased (${productList}). Offer 2-3 specific, actionable, and encouraging health tips.
    *   Mention if certain items are good choices (e.g., "Those fresh vegetables are a fantastic source of nutrients!").
    *   Use **bold text** for emphasis (use double asterisks like **this**) - this is important as the bold formatting will be displayed to users
    *   Use emojis to make the suggestions engaging.

2.  **Saving Suggestions**: Based on the list of items purchased (${productList}) AND the total sum (${formattedTotalSum}). Offer 2-3 practical and creative saving tips.
    *   Suggest ways to reduce waste or extend the life of purchased items
    *   Use **bold text** for emphasis (use double asterisks like **this**) - this is important as the bold formatting will be displayed to users
    *   Include relevant emojis.

Format your ENTIRE response as a single JSON object with EXACTLY these two keys: "healthSuggestions" and "savingSuggestions".
Each key must have an array of strings, where each string is a complete suggestion.

Example JSON output format (follow this EXACTLY):
{
  "healthSuggestions": [
    "🍎 The fresh fruits you bought are a **fantastic** source of fiber! Great choice for a healthy snack. 👍",
    "Consider making a large batch of salad with the fresh greens 🥬 and veggies. It's an **easy way** to get your nutrients!",
    "Try to include **protein sources** with every meal for balanced nutrition. ✨"
  ],
  "savingSuggestions": [
    "💡 To make fresh produce last longer, store them properly in the refrigerator - **different** items need **different** storage methods. 🧊",
    "Remember to check your pantry before shopping next time to avoid buying duplicates. **Smart planning saves money!** 💰",
    "Considering your total of ${formattedTotalSum}, perhaps explore store brands for some staple items next time. 🛒"
  ]
}
`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.openRouterApiKey}`,
      'Content-Type': 'application/json',
    });

    const body = {
      model: 'deepseek/deepseek-r1:free', // Or your preferred model
      messages: [{ role: 'user', content: prompt }],
    };

    return this.http.post<any>(this.openRouterUrl, body, { headers }).pipe(
      map((response) => {
        try {
          let content = response.choices[0].message.content;
          const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
          const match = content.match(jsonRegex);
          if (match && match[1]) {
            content = match[1];
          }
          content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');

          // Clean the content to help with parsing
          content = content.trim();

          // Parse the JSON
          let parsedContent = JSON.parse(content);

          // Normalize keys - handle the "savingTips" vs "savingSuggestions" mismatch
          let parsedSuggestions: AiSuggestions = {
            healthSuggestions: parsedContent.healthSuggestions || [],
            savingSuggestions:
              parsedContent.savingSuggestions || parsedContent.savingTips || [],
          };

          if (
            !Array.isArray(parsedSuggestions.healthSuggestions) ||
            !Array.isArray(parsedSuggestions.savingSuggestions)
          ) {
            console.error('AI response JSON structure is invalid:', content);
            throw new Error('AI response has an invalid JSON structure.');
          }

          return parsedSuggestions;
        } catch (e) {
          console.error(
            'Error parsing AI response content:',
            response.choices[0].message.content,
            e
          );
          throw new Error('Failed to parse AI suggestions from response.');
        }
      }),
      tap((suggestions) => {
        this.suggestionsSubject.next(suggestions);
        this.isLoadingSubject.next(false);
        this.errorSubject.next(null);
      }),
      catchError((error: HttpErrorResponse | Error) => {
        console.error('Error in AI suggestion pipeline:', error);
        let userMessage = 'Failed to fetch AI suggestions. ';
        if (error instanceof HttpErrorResponse) {
          if (error.status === 401) {
            userMessage +=
              'Please check your OpenRouter API key (Unauthorized).';
          } else if (error.error?.error?.message) {
            userMessage += error.error.error.message;
          } else if (error.message) {
            userMessage += error.message;
          }
        } else if (error instanceof Error) {
          userMessage += error.message;
        }
        this.errorSubject.next(userMessage);
        this.isLoadingSubject.next(false);
        this.suggestionsSubject.next(null);
        return throwError(() => new Error(userMessage));
      })
    );
  }

  clearSuggestions(): void {
    this.suggestionsSubject.next(null);
    this.errorSubject.next(null);
    this.isLoadingSubject.next(false);
  }
}
