import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  AllergyResponseDto,
  CreateAllergyDto,
  CreatePrimaryGoalDto,
  PrimaryGoalResponseDto,
  UpdateAllergyDto,
  UpdatePrimaryGoalDto,
} from './dto/catalog.dto';
import {
  ApproveMealPlanDto,
  ListMealPlansQueryDto,
  MealPlanDetailDto,
  MealPlanSummaryDto,
  RejectMealPlanDto,
} from './dto/meal-plan.dto';
import { SetProductAllergensDto } from './dto/product-allergens.dto';
import { MealPlanService } from './meal-plan.service';
import { NutritionCatalogService } from './nutrition-catalog.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class NutritionAdminController {
  constructor(
    private readonly catalogService: NutritionCatalogService,
    private readonly mealPlanService: MealPlanService,
  ) {}

  @Get('nutrition/allergies')
  listAllergies(): Promise<AllergyResponseDto[]> {
    return this.catalogService.listAllergies(false);
  }

  @Post('nutrition/allergies')
  createAllergy(@Body() dto: CreateAllergyDto): Promise<AllergyResponseDto> {
    return this.catalogService.createAllergy(dto);
  }

  @Patch('nutrition/allergies/:id')
  updateAllergy(
    @Param('id') id: string,
    @Body() dto: UpdateAllergyDto,
  ): Promise<AllergyResponseDto> {
    return this.catalogService.updateAllergy(id, dto);
  }

  @Patch('nutrition/allergies/:id/deactivate')
  deactivateAllergy(@Param('id') id: string): Promise<AllergyResponseDto> {
    return this.catalogService.deactivateAllergy(id);
  }

  @Get('nutrition/goals')
  listGoals(): Promise<PrimaryGoalResponseDto[]> {
    return this.catalogService.listGoals(false);
  }

  @Post('nutrition/goals')
  createGoal(
    @Body() dto: CreatePrimaryGoalDto,
  ): Promise<PrimaryGoalResponseDto> {
    return this.catalogService.createGoal(dto);
  }

  @Patch('nutrition/goals/:id')
  updateGoal(
    @Param('id') id: string,
    @Body() dto: UpdatePrimaryGoalDto,
  ): Promise<PrimaryGoalResponseDto> {
    return this.catalogService.updateGoal(id, dto);
  }

  @Patch('nutrition/goals/:id/deactivate')
  deactivateGoal(@Param('id') id: string): Promise<PrimaryGoalResponseDto> {
    return this.catalogService.deactivateGoal(id);
  }

  @Get('marketplace/products/:id/allergens')
  getProductAllergens(
    @Param('id') id: string,
  ): Promise<{ productId: string; allergyIds: string[] }> {
    return this.catalogService.getProductAllergenIds(id).then((allergyIds) => ({
      productId: id,
      allergyIds,
    }));
  }

  @Patch('marketplace/products/:id/allergens')
  setProductAllergens(
    @Param('id') id: string,
    @Body() dto: SetProductAllergensDto,
  ): Promise<{ productId: string; allergyIds: string[] }> {
    return this.catalogService.setProductAllergens(id, dto.allergyIds);
  }

  @Get('meal-plans')
  listMealPlans(
    @Query() query: ListMealPlansQueryDto,
  ): Promise<MealPlanSummaryDto[]> {
    return this.mealPlanService.listAdmin(query.status);
  }

  @Get('meal-plans/:id')
  getMealPlan(@Param('id') id: string): Promise<MealPlanDetailDto> {
    return this.mealPlanService.getAdmin(id);
  }

  @Post('meal-plans/:id/approve')
  approveMealPlan(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: ApproveMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.approve(id, user.id, dto);
  }

  @Post('meal-plans/:id/reject')
  rejectMealPlan(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: RejectMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.reject(id, user.id, dto);
  }
}
