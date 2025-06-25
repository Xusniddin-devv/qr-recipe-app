import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, map, tap, timeout, retry } from 'rxjs/operators';
import { Product, Discount } from './check.service';
import { environment } from '../../environments/environment';

export interface EnrichedProduct extends Product {
  originalPrice: number;
  discountedPrice: number;
  totalDiscount: number;
  discounts: Discount[];
  savingsPercentage: number;
}

export interface AiSuggestions {
  healthSuggestions: string[];
  savingSuggestions: string[];
  nutritionalInsights?: string[];
  seasonalRecommendations?: string[];
  discountAnalysis?: {
    totalSavings: number;
    bestDeals: string[];
    missedOpportunities: string[];
  };
  budgetAnalysis?: {
    totalSpent: number;
    totalSaved: number;
    averageItemPrice: number;
    costEffectiveItems: string[];
    expensiveItems: string[];
    discountUtilization: number;
  };
}

export interface UserPreferences {
  dietaryRestrictions?: string[];
  healthGoals?: string[];
  budgetRange?: { min: number; max: number };
  familySize?: number;
  preferredCuisines?: string[];
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

  // Cache for repeated requests
  private suggestionCache = new Map<
    string,
    { data: AiSuggestions; timestamp: number }
  >();
  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  // Rate limiting
  private lastRequestTime = 0;
  private minRequestInterval = 2000; // 2 seconds between requests

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

  getAiSuggestions(
    products: Product[],
    discounts: Discount[] = [],
    userPreferences?: UserPreferences
  ): Observable<AiSuggestions | null> {
    if (!this.validateApiKey()) {
      return this.handleApiKeyError();
    }

    if (!products || products.length === 0) {
      this.clearSuggestions();
      return of(null);
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(
      products,
      discounts,
      userPreferences
    );
    const cached = this.getCachedSuggestions(cacheKey);
    if (cached) {
      this.suggestionsSubject.next(cached);
      return of(cached);
    }

    // Rate limiting
    if (!this.canMakeRequest()) {
      const errorMsg = 'Please wait before making another request.';
      this.errorSubject.next(errorMsg);
      return throwError(() => new Error(errorMsg));
    }

    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);
    this.suggestionsSubject.next(null);

    const enrichedProducts = this.enrichProductsWithDiscounts(
      products,
      discounts
    );
    const { productList, budgetAnalysis, discountAnalysis } =
      this.analyzeProductsWithDiscounts(enrichedProducts);
    const prompt = this.buildEnhancedPrompt(
      productList,
      budgetAnalysis,
      discountAnalysis,
      userPreferences
    );

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.openRouterApiKey}`,
      'Content-Type': 'application/json',
    });

    const body = {
      model: 'deepseek/deepseek-r1:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1800, // Increased for more detailed analysis
    };

    return this.http.post<any>(this.openRouterUrl, body, { headers }).pipe(
      timeout(30000),
      retry(2),
      map((response) => this.parseAiResponse(response)),
      tap((suggestions) => {
        if (suggestions) {
          this.cacheSuggestions(cacheKey, suggestions);
        }
        this.suggestionsSubject.next(suggestions);
        this.isLoadingSubject.next(false);
        this.errorSubject.next(null);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  private enrichProductsWithDiscounts(
    products: Product[],
    discounts: Discount[]
  ): EnrichedProduct[] {
    return products.map((product) => {
      const productDiscounts = discounts.filter(
        (d) => d.productName === product.name
      );
      const originalPrice = this.parsePrice(product.price);
      const totalDiscount = productDiscounts.reduce(
        (sum, d) => sum + (d.discountValue || 0),
        0
      );
      const discountedPrice = originalPrice - totalDiscount;
      const savingsPercentage =
        originalPrice > 0 ? (totalDiscount / originalPrice) * 100 : 0;

      return {
        ...product,
        originalPrice,
        discountedPrice,
        totalDiscount,
        discounts: productDiscounts,
        savingsPercentage,
      };
    });
  }

  private parsePrice(price: any): number {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const numericPrice = parseFloat(price.replace(/[^0-9.-]+/g, ''));
      return isNaN(numericPrice) ? 0 : numericPrice;
    }
    return 0;
  }

  private analyzeProductsWithDiscounts(enrichedProducts: EnrichedProduct[]) {
    const validProducts = enrichedProducts.filter((p) => p.originalPrice > 0);

    const totalOriginalSpent = validProducts.reduce(
      (sum, p) => sum + p.originalPrice,
      0
    );
    const totalActualSpent = validProducts.reduce(
      (sum, p) => sum + p.discountedPrice,
      0
    );
    const totalSaved = totalOriginalSpent - totalActualSpent;

    const averagePrice =
      validProducts.length > 0 ? totalActualSpent / validProducts.length : 0;

    // Sort by actual price paid
    const sortedByActualPrice = [...validProducts].sort(
      (a, b) => b.discountedPrice - a.discountedPrice
    );

    // Sort by savings percentage
    const sortedBySavings = [...validProducts].sort(
      (a, b) => b.savingsPercentage - a.savingsPercentage
    );

    const budgetAnalysis = {
      totalSpent: totalActualSpent,
      totalSaved: totalSaved,
      averageItemPrice: averagePrice,
      costEffectiveItems: sortedByActualPrice.slice(-3).map((p) => p.name),
      expensiveItems: sortedByActualPrice.slice(0, 3).map((p) => p.name),
      discountUtilization:
        validProducts.length > 0
          ? (validProducts.filter((p) => p.totalDiscount > 0).length /
              validProducts.length) *
            100
          : 0,
    };

    const discountAnalysis = {
      totalSavings: totalSaved,
      bestDeals: sortedBySavings
        .slice(0, 3)
        .filter((p) => p.savingsPercentage > 0)
        .map((p) => `${p.name} (${p.savingsPercentage.toFixed(1)}% off)`),
      missedOpportunities: validProducts
        .filter((p) => p.totalDiscount === 0)
        .slice(0, 3)
        .map((p) => p.name),
    };

    const productList = enrichedProducts
      .map((p) => {
        let description = `${p.name}`;
        if (p.quantity) description += ` (quantity: ${p.quantity})`;

        if (p.totalDiscount > 0) {
          description += ` - Original: UZS ${p.originalPrice.toFixed(
            0
          )}, Paid: UZS ${p.discountedPrice.toFixed(
            0
          )}, Saved: UZS ${p.totalDiscount.toFixed(
            0
          )} (${p.savingsPercentage.toFixed(1)}% off)`;
        } else {
          description += ` - Price: UZS ${p.originalPrice.toFixed(0)}`;
        }

        return description;
      })
      .join('; ');

    return { productList, budgetAnalysis, discountAnalysis };
  }

  private buildEnhancedPrompt(
    productList: string,
    budgetAnalysis: any,
    discountAnalysis: any,
    userPreferences?: UserPreferences
  ): string {
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const preferencesText = userPreferences
      ? this.formatUserPreferences(userPreferences)
      : '';

    return `
You are an expert nutritionist and financial advisor specializing in Uzbek cuisine and local grocery shopping patterns.

PURCHASE ANALYSIS WITH DISCOUNTS:
Items purchased: ${productList}
Total originally priced: UZS ${(
      budgetAnalysis.totalSpent + budgetAnalysis.totalSaved
    ).toFixed(0)}
Total actually paid: UZS ${budgetAnalysis.totalSpent.toFixed(0)}
Total saved through discounts: UZS ${budgetAnalysis.totalSaved.toFixed(0)}
Discount utilization: ${budgetAnalysis.discountUtilization.toFixed(
      1
    )}% of items had discounts
Average item price: UZS ${budgetAnalysis.averageItemPrice.toFixed(0)}

DISCOUNT PERFORMANCE:
Best deals: ${
      discountAnalysis.bestDeals.length > 0
        ? discountAnalysis.bestDeals.join(', ')
        : 'None'
    }
Items without discounts: ${
      discountAnalysis.missedOpportunities.length > 0
        ? discountAnalysis.missedOpportunities.join(', ')
        : 'All items had discounts'
    }

${preferencesText}

CULTURAL CONTEXT:
- These are Uzbek products from local markets
- Consider local seasonal availability (current month: ${currentMonth})
- Respect local dietary customs and preferences
- Focus on traditional Uzbek ingredients and cooking methods

ENHANCED ANALYSIS REQUIRED:
Provide a comprehensive JSON response with these sections:

{
  "healthSuggestions": [
    "2-3 specific health tips with **bold** emphasis and emojis, considering the actual items purchased"
  ],
  "savingSuggestions": [
    "2-3 practical money-saving tips with **bold** emphasis and emojis, considering discount patterns and missed opportunities"
  ],
  "nutritionalInsights": [
    "1-2 nutritional analysis points about the purchased items and their combinations"
  ],
  "seasonalRecommendations": [
    "1-2 seasonal suggestions for ${currentMonth} in Uzbekistan, considering cost-effectiveness"
  ],
  "discountAnalysis": {
    "totalSavings": ${discountAnalysis.totalSavings},
    "bestDeals": ${JSON.stringify(discountAnalysis.bestDeals)},
    "missedOpportunities": ${JSON.stringify(
      discountAnalysis.missedOpportunities
    )}
  },
  "budgetAnalysis": {
    "totalSpent": ${budgetAnalysis.totalSpent},
    "totalSaved": ${budgetAnalysis.totalSaved},
    "averageItemPrice": ${budgetAnalysis.averageItemPrice},
    "costEffectiveItems": ${JSON.stringify(budgetAnalysis.costEffectiveItems)},
    "expensiveItems": ${JSON.stringify(budgetAnalysis.expensiveItems)},
    "discountUtilization": ${budgetAnalysis.discountUtilization}
  }
}

SPECIFIC FOCUS AREAS:
1. **Discount Strategy**: Analyze the discount patterns and suggest how to find similar deals
2. **Value Assessment**: Comment on whether the discounted items were good value
3. **Future Shopping**: Suggest timing and strategies for better discounts
4. **Health vs. Budget**: Balance nutritional value with cost savings

FORMATTING RULES:
- Use **bold** for emphasis (double asterisks)
- Include relevant emojis
- Keep suggestions actionable and specific
- Consider local Uzbek context
- Be encouraging about savings achieved
- Provide constructive advice on missed opportunities
`;
  }

  private validateApiKey(): boolean {
    return !(
      !this.openRouterApiKey ||
      this.openRouterApiKey === 'YOUR_DEV_OPENROUTER_API_KEY' ||
      this.openRouterApiKey === 'YOUR_PROD_OPENROUTER_API_KEY'
    );
  }

  private handleApiKeyError(): Observable<AiSuggestions | null> {
    const errorMsg = 'OpenRouter API key is not configured.';
    this.errorSubject.next(errorMsg);
    this.isLoadingSubject.next(false);
    this.suggestionsSubject.next(null);
    return of(null);
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    if (now - this.lastRequestTime < this.minRequestInterval) {
      return false;
    }
    this.lastRequestTime = now;
    return true;
  }

  private generateCacheKey(
    products: Product[],
    discounts: Discount[],
    preferences?: UserPreferences
  ): string {
    const productKey = products
      .map((p) => `${p.name}-${p.price}-${p.quantity}`)
      .sort()
      .join('|');
    const discountKey = discounts
      .map((d) => `${d.productName}-${d.discountValue}`)
      .sort()
      .join('|');
    const prefKey = preferences ? JSON.stringify(preferences) : '';
    return btoa(`${productKey}-${discountKey}-${prefKey}`);
  }

  private getCachedSuggestions(key: string): AiSuggestions | null {
    const cached = this.suggestionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached.data;
    }
    if (cached) {
      this.suggestionCache.delete(key);
    }
    return null;
  }

  private cacheSuggestions(key: string, suggestions: AiSuggestions): void {
    this.suggestionCache.set(key, {
      data: suggestions,
      timestamp: Date.now(),
    });
  }

  private formatUserPreferences(preferences: UserPreferences): string {
    let text = 'USER PREFERENCES:\n';

    if (preferences.dietaryRestrictions?.length) {
      text += `- Dietary restrictions: ${preferences.dietaryRestrictions.join(
        ', '
      )}\n`;
    }
    if (preferences.healthGoals?.length) {
      text += `- Health goals: ${preferences.healthGoals.join(', ')}\n`;
    }
    if (preferences.budgetRange) {
      text += `- Budget range: UZS ${preferences.budgetRange.min} - ${preferences.budgetRange.max}\n`;
    }
    if (preferences.familySize) {
      text += `- Family size: ${preferences.familySize} people\n`;
    }
    if (preferences.preferredCuisines?.length) {
      text += `- Preferred cuisines: ${preferences.preferredCuisines.join(
        ', '
      )}\n`;
    }

    return text + '\n';
  }

  private parseAiResponse(response: any): AiSuggestions {
    try {
      let content = response.choices[0].message.content;

      // Enhanced JSON extraction
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = content.match(jsonRegex);
      if (match && match[1]) {
        content = match[1];
      }

      // Clean the content
      content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      content = content.trim();

      // Parse and validate JSON
      const parsedContent = JSON.parse(content);

      const suggestions: AiSuggestions = {
        healthSuggestions: parsedContent.healthSuggestions || [],
        savingSuggestions:
          parsedContent.savingSuggestions || parsedContent.savingTips || [],
        nutritionalInsights: parsedContent.nutritionalInsights || [],
        seasonalRecommendations: parsedContent.seasonalRecommendations || [],
        discountAnalysis: parsedContent.discountAnalysis || undefined,
        budgetAnalysis: parsedContent.budgetAnalysis || undefined,
      };

      // Validate required arrays
      if (
        !Array.isArray(suggestions.healthSuggestions) ||
        !Array.isArray(suggestions.savingSuggestions)
      ) {
        throw new Error('Invalid response structure');
      }

      return suggestions;
    } catch (e) {
      console.error('Error parsing AI response:', e);
      throw new Error('Failed to parse AI suggestions from response.');
    }
  }

  private handleError(error: HttpErrorResponse | Error): Observable<never> {
    console.error('Error in AI suggestion pipeline:', error);

    let userMessage = 'Failed to fetch AI suggestions. ';

    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          userMessage += 'Please check your OpenRouter API key (Unauthorized).';
          break;
        case 429:
          userMessage += 'Too many requests. Please try again later.';
          break;
        case 500:
          userMessage += 'Server error. Please try again.';
          break;
        default:
          userMessage +=
            error.error?.error?.message ||
            error.message ||
            'Unknown error occurred.';
      }
    } else if (error instanceof Error) {
      userMessage += error.message;
    }

    this.errorSubject.next(userMessage);
    this.isLoadingSubject.next(false);
    this.suggestionsSubject.next(null);

    return throwError(() => new Error(userMessage));
  }

  // Enhanced public methods
  getUserPreferences(): UserPreferences | null {
    const stored = localStorage.getItem('userPreferences');
    return stored ? JSON.parse(stored) : null;
  }

  saveUserPreferences(preferences: UserPreferences): void {
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
  }

  clearCache(): void {
    this.suggestionCache.clear();
  }

  clearSuggestions(): void {
    this.suggestionsSubject.next(null);
    this.errorSubject.next(null);
    this.isLoadingSubject.next(false);
  }
}
