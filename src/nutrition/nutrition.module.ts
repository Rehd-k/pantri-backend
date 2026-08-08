import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { MealPlanController } from './meal-plan.controller';
import { MealPlanService } from './meal-plan.service';
import { NutritionAdminController } from './nutrition-admin.controller';
import { NutritionCatalogService } from './nutrition-catalog.service';
import { NutritionController } from './nutrition.controller';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [
    NutritionController,
    MealPlanController,
    NutritionAdminController,
  ],
  providers: [NutritionCatalogService, MealPlanService],
  exports: [NutritionCatalogService, MealPlanService],
})
export class NutritionModule {}
