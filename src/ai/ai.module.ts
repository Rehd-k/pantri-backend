import { Module } from '@nestjs/common';
import { AiMealPlanService } from './ai-meal-plan.service';

@Module({
  providers: [AiMealPlanService],
  exports: [AiMealPlanService],
})
export class AiModule {}
