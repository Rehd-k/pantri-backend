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
  inPantry?: boolean;
  pantryCanonical?: number;
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

export type AiGeneratedIngredient = {
  productId: string;
  quantity?: number;
};

export type AiGeneratedItem = {
  mealSlot: string;
  title: string;
  rationale?: string;
  instructions?: string;
  requestedProductName?: string;
  productId?: string | null;
  matchType?: 'PRIMARY' | 'ALTERNATIVE';
  quantity?: number;
  ingredients?: AiGeneratedIngredient[];
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
      inPantry: Boolean(p.inPantry),
      pantryCanonical: p.pantryCanonical ?? 0,
    }));

    const system = `You are Pantri's home-cook nutrition planner for Nigerian households.
Recipes MUST use ingredients the employee already has in their pantry whenever possible.
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
          "instructions": string,
          "matchType": "PRIMARY",
          "ingredients": [
            { "productId": string, "quantity": number }
          ]
        }
      ]
    }
  ]
}
Rules:
- quantity is the number of recipe units (cups, spoons, pieces) of that catalog product.
- Prefer productId values marked inPantry=true. Do not invent productId values.
- Create a 3-day plan with breakfast, lunch, and dinner each day.
- Each meal should have 2-4 ingredients sized to help the user hit their nutrition goals.
- Never tell the user to buy a grocery package. If an ingredient is missing from pantry, still list it so the app can prompt a restock.
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
    const pantry = input.products.filter((p) => p.inPantry);
    const pool = pantry.length > 0 ? pantry : input.products;
    const days: AiGeneratedDay[] = [];
    const slots = ['breakfast', 'lunch', 'dinner'] as const;

    for (let dayIndex = 1; dayIndex <= 3; dayIndex++) {
      const items: AiGeneratedItem[] = slots.map((mealSlot, slotIndex) => {
        const first = pool[(dayIndex + slotIndex) % pool.length] ?? null;
        const second = pool[(dayIndex + slotIndex + 1) % pool.length] ?? null;
        const ingredients: AiGeneratedIngredient[] = [];
        if (first) ingredients.push({ productId: first.id, quantity: 1 });
        if (second && second.id !== first?.id) {
          ingredients.push({ productId: second.id, quantity: 1 });
        }
        return {
          mealSlot,
          title: `${mealSlot} for ${input.profile.goals[0] ?? 'balanced nutrition'}`,
          rationale: `Built from pantry staples to support ${input.profile.goals.join(', ') || 'your nutrition goals'}`,
          instructions:
            'Prep and cook the listed pantry ingredients. Measure each item, then mark the meal cooked so Pantri can log nutrients and reduce stock.',
          matchType: 'PRIMARY',
          ingredients,
          requestedProductName: first?.name ?? '',
          productId: first?.id ?? null,
          quantity: 1,
        };
      });

      days.push({
        dayIndex,
        label: `Day ${dayIndex}`,
        items,
      });
    }

    return {
      title: 'Pantry meal plan',
      days,
      raw: { fallback: true, profile: input.profile },
    };
  }
}
