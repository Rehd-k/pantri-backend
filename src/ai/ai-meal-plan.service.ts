import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AiProviderName = 'openai' | 'anthropic' | 'auto';

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
  instructionSteps?: string[];
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
  provider: 'openai' | 'anthropic' | 'fallback';
};

const PLAN_JSON_SHAPE = `{
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
          "instructionSteps": string[],
          "matchType": "PRIMARY",
          "ingredients": [
            { "productId": string, "quantity": number }
          ]
        }
      ]
    }
  ]
}`;

@Injectable()
export class AiMealPlanService {
  private readonly logger = new Logger(AiMealPlanService.name);
  private readonly openai: OpenAI | null;
  private readonly anthropic: Anthropic | null;

  constructor(private readonly config: ConfigService) {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    this.openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.anthropic = anthropicKey
      ? new Anthropic({ apiKey: anthropicKey })
      : null;
  }

  async generatePlan(input: {
    profile: AiPlanProfile;
    products: AiCatalogProduct[];
    dayCount?: number;
    provider?: AiProviderName;
  }): Promise<AiGeneratedPlan> {
    const dayCount = Math.min(14, Math.max(1, input.dayCount ?? 7));
    if (input.products.length === 0) {
      return this.fallbackPlan(input.profile, input.products, dayCount);
    }

    const order = this.providerOrder(input.provider);
    for (const provider of order) {
      try {
        if (provider === 'openai' && this.openai) {
          return await this.generateWithOpenAi(input, dayCount);
        }
        if (provider === 'anthropic' && this.anthropic) {
          return await this.generateWithAnthropic(input, dayCount);
        }
      } catch (error) {
        this.logger.warn(
          `${provider} meal plan failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.fallbackPlan(input.profile, input.products, dayCount);
  }

  async suggestSlot(input: {
    profile: AiPlanProfile;
    products: AiCatalogProduct[];
    mealSlot: string;
    dayLabel: string;
    existingTitles?: string[];
    provider?: AiProviderName;
  }): Promise<AiGeneratedItem> {
    const plan = await this.generatePlan({
      profile: {
        ...input.profile,
        goals: [
          ...input.profile.goals,
          `Single ${input.mealSlot} for ${input.dayLabel}`,
          ...(input.existingTitles ?? []).map((title) => `Avoid repeating ${title}`),
        ],
      },
      products: input.products,
      dayCount: 1,
      provider: input.provider,
    });
    const slot = input.mealSlot.toLowerCase();
    const match =
      plan.days[0]?.items.find((item) => item.mealSlot.toLowerCase() === slot) ??
      plan.days[0]?.items[0];
    if (!match) {
      throw new Error('AI did not return a meal for this slot');
    }
    return { ...match, mealSlot: slot };
  }

  private providerOrder(
    requested?: AiProviderName,
  ): Array<'openai' | 'anthropic'> {
    const preferred = (this.config.get<string>('AI_DEFAULT_PROVIDER') || 'auto')
      .trim()
      .toLowerCase();
    const pick =
      requested && requested !== 'auto'
        ? requested
        : preferred === 'openai' || preferred === 'anthropic'
          ? preferred
          : this.anthropic
            ? 'anthropic'
            : 'openai';
    return pick === 'anthropic' ? ['anthropic', 'openai'] : ['openai', 'anthropic'];
  }

  private systemPrompt(dayCount: number): string {
    return `You are Pantri's home-cook nutrition planner for Nigerian households.
Recipes MUST use ingredients from the provided catalog. Prefer pantry items when marked inPantry=true.
Return ONLY valid JSON matching this shape:
${PLAN_JSON_SHAPE}
Rules:
- quantity is the number of recipe units (cups, spoons, pieces) of that catalog product.
- Prefer productId values marked inPantry=true. Do not invent productId values.
- Create a ${dayCount}-day plan with breakfast, lunch, and dinner each day. Snack is optional.
- Each meal should have 2-4 ingredients sized to help the user hit their nutrition goals.
- instructionSteps must be a numbered-ready array of 3-8 short cooking steps.
- Never tell the user to buy a grocery package. If an ingredient is missing from pantry, still list it so the app can prompt a restock.
- Respect allergies, dietary lifestyle, activity level, and goals.`;
  }

  private catalogPayload(products: AiCatalogProduct[]) {
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      packageLabel: p.packageLabel,
      tags: p.tags,
      nutritionFacts: p.nutritionFacts,
      inPantry: Boolean(p.inPantry),
      pantryCanonical: p.pantryCanonical ?? 0,
    }));
  }

  private async generateWithOpenAi(
    input: {
      profile: AiPlanProfile;
      products: AiCatalogProduct[];
    },
    dayCount: number,
  ): Promise<AiGeneratedPlan> {
    if (!this.openai) {
      throw new Error('OpenAI is not configured');
    }
    const response = await this.openai.chat.completions.create({
      model: this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.systemPrompt(dayCount) },
        {
          role: 'user',
          content: JSON.stringify({
            profile: input.profile,
            catalog: this.catalogPayload(input.products),
            dayCount,
          }),
        },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty OpenAI response');
    }
    return this.parsePlan(JSON.parse(content), 'openai');
  }

  private async generateWithAnthropic(
    input: {
      profile: AiPlanProfile;
      products: AiCatalogProduct[];
    },
    dayCount: number,
  ): Promise<AiGeneratedPlan> {
    if (!this.anthropic) {
      throw new Error('Anthropic is not configured');
    }
    const response = await this.anthropic.messages.create({
      model:
        this.config.get<string>('ANTHROPIC_MODEL') ||
        'claude-sonnet-4-20250514',
      max_tokens: 8000,
      temperature: 0.4,
      system: this.systemPrompt(dayCount),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            profile: input.profile,
            catalog: this.catalogPayload(input.products),
            dayCount,
          }),
        },
      ],
    });
    const text = response.content
      .map((block) => ('text' in block ? block.text : ''))
      .join('\n')
      .trim();
    if (!text) {
      throw new Error('Empty Anthropic response');
    }
    const json = this.extractJson(text);
    return this.parsePlan(json, 'anthropic');
  }

  private extractJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced?.[1]?.trim() || text;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error('Anthropic response was not JSON');
    }
    return JSON.parse(raw.slice(start, end + 1));
  }

  private parsePlan(
    parsed: unknown,
    provider: 'openai' | 'anthropic',
  ): AiGeneratedPlan {
    const body = parsed as { title?: string; days?: AiGeneratedDay[] };
    const days = Array.isArray(body.days) ? body.days : [];
    if (days.length === 0) {
      throw new Error('AI returned no days');
    }
    return {
      title: body.title?.trim() || 'Personalized Meal Plan',
      days: days.map((day, index) => ({
        dayIndex: day.dayIndex ?? index + 1,
        label: day.label,
        items: Array.isArray(day.items)
          ? day.items.map((item) => this.normalizeItem(item))
          : [],
      })),
      raw: parsed,
      provider,
    };
  }

  private normalizeItem(item: AiGeneratedItem): AiGeneratedItem {
    const steps =
      item.instructionSteps && item.instructionSteps.length > 0
        ? item.instructionSteps
        : item.instructions
          ? item.instructions
              .split(/\n+/)
              .map((line) => line.replace(/^\s*\d+[\.)]\s*/, '').trim())
              .filter(Boolean)
          : [];
    return {
      ...item,
      instructionSteps: steps,
      instructions: steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    };
  }

  private fallbackPlan(
    profile: AiPlanProfile,
    products: AiCatalogProduct[],
    dayCount: number,
  ): AiGeneratedPlan {
    const pantry = products.filter((p) => p.inPantry);
    const pool = pantry.length > 0 ? pantry : products;
    const days: AiGeneratedDay[] = [];
    const slots = ['breakfast', 'lunch', 'dinner'] as const;

    for (let dayIndex = 1; dayIndex <= dayCount; dayIndex++) {
      const items: AiGeneratedItem[] = slots.map((mealSlot, slotIndex) => {
        const first = pool[(dayIndex + slotIndex) % pool.length] ?? null;
        const second = pool[(dayIndex + slotIndex + 1) % pool.length] ?? null;
        const ingredients: AiGeneratedIngredient[] = [];
        if (first) ingredients.push({ productId: first.id, quantity: 1 });
        if (second && second.id !== first?.id) {
          ingredients.push({ productId: second.id, quantity: 1 });
        }
        const instructionSteps = [
          `Measure the listed ${mealSlot} ingredients.`,
          'Cook over medium heat until done, stirring so nothing burns.',
          'Taste, adjust seasoning, then serve and mark the meal cooked.',
        ];
        return {
          mealSlot,
          title: `${mealSlot} for ${profile.goals[0] ?? 'balanced nutrition'}`,
          rationale: `Built from pantry staples to support ${profile.goals.join(', ') || 'your nutrition goals'}`,
          instructionSteps,
          instructions: instructionSteps
            .map((step, index) => `${index + 1}. ${step}`)
            .join('\n'),
          matchType: 'PRIMARY' as const,
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
      raw: { fallback: true, profile },
      provider: 'fallback',
    };
  }
}
