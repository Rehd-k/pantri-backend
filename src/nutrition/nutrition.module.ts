import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MealPlanController } from './meal-plan.controller';
import { MealPlanDemandService } from './meal-plan-demand.service';
import { MealPlanService } from './meal-plan.service';
import { NutritionAdminController } from './nutrition-admin.controller';
import { NutritionCatalogService } from './nutrition-catalog.service';
import { NutritionController } from './nutrition.controller';
import { NutritionPublicController } from './nutrition-public.controller';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { ReplenishmentService } from './replenishment.service';

@Module({
  imports: [AuthModule, AiModule, InventoryModule, CartModule],
  controllers: [
    NutritionPublicController,
    NutritionController,
    MealPlanController,
    NutritionAdminController,
    RecipeController,
  ],
  providers: [
    NutritionCatalogService,
    MealPlanService,
    MealPlanDemandService,
    RecipeService,
    ReplenishmentService,
  ],
  exports: [
    NutritionCatalogService,
    MealPlanService,
    RecipeService,
    MealPlanDemandService,
    ReplenishmentService,
  ],
})
export class NutritionModule {}
