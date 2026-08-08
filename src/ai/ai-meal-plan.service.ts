import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type AiCatalogProduct = {
  id: string;
  name: string;
  brand: string;
  packageLabel: string;
  tags: string[];
  nutritionFacts: unknown;
};

export type AiPlanProfile = {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  lifestyle: string;
  activityLevel: string;
  allergies: string[];
  goals: string[];
  productCount: number;
};

export type AiGeneratedItem = {
  mealSlot: string;
  title: string;
  rationale?: string;
  requestedProductName?: string;
  productId?: string | null;
  matchType?: 'PRIMARY' | 'ALTERNATIVE';
  quantity?: number;
};

export type AiGeneratedDay = {
  dayIndex: number;
  label?: string;
  items: AiGeneratedItem[];
};

export type AiGeneratedPlan = {
  title: string;
  days: AiGeneratedDay[];
  raw: unknown;
};

@Injectable()
export class AiMealPlanService {
  private readonly logger = new Logger(AiMealPlanService.name);
  private readonly client: OpenAI | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async generatePlan(input: {
    profile: AiPlanProfile;
    products: AiCatalogProduct[];
  }): Promise<AiGeneratedPlan> {
    if (!this.client || input.products.length === 0) {
      return this.fallbackPlan(input);
    }

    const catalog = input.products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      packageLabel: p.packageLabel,
      tags: p.tags,
      nutritionFacts: p.nutritionFacts,
    }));

    const system = `You are Pantri's nutrition planner for Nigerian payroll-backed grocery shopping.
Return ONLY valid JSON matching this shape:
{
  "title": string,
  "days": [
    {
      "dayIndex": number,
      "label": string,
      "items": [
        {
          "mealSlot": "breakfast"|"lunch"|"dinner"|"snack",
          "title": string,
          "rationale": string,
          "requestedProductName": string,
          "productId": string|null,
          "matchType": "PRIMARY"|"ALTERNATIVE",
          "quantity": number
        }
      ]
    }
  ]
}
Rules:
- Prefer PRIMARY items that use productId values from the provided catalog only.
- If the ideal ingredient is missing or unsafe, still propose the meal and add ALTERNATIVE items using the closest catalog productId, explaining why in rationale.
- Never invent productId values that are not in the catalog.
- Create a 3-day plan with breakfast, lunch, and dinner each day.
- Respect allergies, dietary lifestyle, activity level, and goals.`;

    const user = JSON.stringify({
      profile: input.profile,
      catalog,
    });

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty AI response');
      }
      const parsed = JSON.parse(content) as {
        title?: string;
        days?: AiGeneratedDay[];
      };
      const days = Array.isArray(parsed.days) ? parsed.days : [];
      if (days.length === 0) {
        throw new Error('AI returned no days');
      }
      return {
        title: parsed.title?.trim() || 'Personalized Meal Plan',
        days: days.map((day, index) => ({
          dayIndex: day.dayIndex ?? index + 1,
          label: day.label,
          items: Array.isArray(day.items) ? day.items : [],
        })),
        raw: parsed,
      };
    } catch (error) {
      this.logger.warn(
        `OpenAI meal plan failed, using fallback: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.fallbackPlan(input);
    }
  }

  private fallbackPlan(input: {
    profile: AiPlanProfile;
    products: AiCatalogProduct[];
  }): AiGeneratedPlan {
    const products = input.products;
    const days: AiGeneratedDay[] = [];
    const slots = ['breakfast', 'lunch', 'dinner'] as const;

    for (let dayIndex = 1; dayIndex <= 3; dayIndex++) {
      const items: AiGeneratedItem[] = slots.map((mealSlot, slotIndex) => {
        const primary =
          products[(dayIndex + slotIndex) % products.length] ?? null;
        const alternative =
          products[(dayIndex + slotIndex + 1) % products.length] ?? null;
        const list: AiGeneratedItem[] = [];
        if (primary) {
          list.push({
            mealSlot,
            title: `${mealSlot} featuring ${primary.name}`,
            rationale: `Selected for ${input.profile.goals.join(', ') || 'balanced nutrition'}`,
            requestedProductName: primary.name,
            productId: primary.id,
            matchType: 'PRIMARY',
            quantity: 1,
          });
        }
        if (alternative && alternative.id !== primary?.id) {
          list.push({
            mealSlot,
            title: `Alternative: ${alternative.name}`,
            rationale: 'Catalog substitute if primary stock is unavailable',
            requestedProductName: alternative.name,
            productId: alternative.id,
            matchType: 'ALTERNATIVE',
            quantity: 1,
          });
        }
        return list;
      }).flat();

      days.push({
        dayIndex,
        label: `Day ${dayIndex}`,
        items,
      });
    }

    return {
      title: 'Personalized Meal Plan',
      days,
      raw: { fallback: true, profile: input.profile },
    };
  }
}
