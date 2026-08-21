import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  AiGenerateMealPlanDto,
  AiSlotSuggestionDto,
  AiSuggestSlotDto,
  ApproveMealPlanDto,
  CatalogProductPickDto,
  CreateMealPlanDraftDto,
  ListCatalogProductsQueryDto,
  ListMealPlansQueryDto,
  ListNutritionEmployeesQueryDto,
  MealPlanDetailDto,
  MealPlanSummaryDto,
  NutritionEmployeeDto,
  PatchMealPlanItemDto,
  RejectMealPlanDto,
  UpdateMealPlanDraftDto,
  UpsertMealPlanItemDto,
  UpsertMealRecipeDto,
} from './dto/meal-plan.dto';
import { SetProductAllergensDto } from './dto/product-allergens.dto';
import { MealPlanService } from './meal-plan.service';
import { NutritionCatalogService } from './nutrition-catalog.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NutritionAdminController {
  constructor(
    private readonly catalogService: NutritionCatalogService,
    private readonly mealPlanService: MealPlanService,
  ) {}

  @Get('nutrition/allergies')
  @Roles(UserRole.ADMIN)
  listAllergies(): Promise<AllergyResponseDto[]> {
    return this.catalogService.listAllergies(false);
  }

  @Post('nutrition/allergies')
  @Roles(UserRole.ADMIN)
  createAllergy(@Body() dto: CreateAllergyDto): Promise<AllergyResponseDto> {
    return this.catalogService.createAllergy(dto);
  }

  @Patch('nutrition/allergies/:id')
  @Roles(UserRole.ADMIN)
  updateAllergy(
    @Param('id') id: string,
    @Body() dto: UpdateAllergyDto,
  ): Promise<AllergyResponseDto> {
    return this.catalogService.updateAllergy(id, dto);
  }

  @Patch('nutrition/allergies/:id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivateAllergy(@Param('id') id: string): Promise<AllergyResponseDto> {
    return this.catalogService.deactivateAllergy(id);
  }

  @Get('nutrition/goals')
  @Roles(UserRole.ADMIN)
  listGoals(): Promise<PrimaryGoalResponseDto[]> {
    return this.catalogService.listGoals(false);
  }

  @Post('nutrition/goals')
  @Roles(UserRole.ADMIN)
  createGoal(
    @Body() dto: CreatePrimaryGoalDto,
  ): Promise<PrimaryGoalResponseDto> {
    return this.catalogService.createGoal(dto);
  }

  @Patch('nutrition/goals/:id')
  @Roles(UserRole.ADMIN)
  updateGoal(
    @Param('id') id: string,
    @Body() dto: UpdatePrimaryGoalDto,
  ): Promise<PrimaryGoalResponseDto> {
    return this.catalogService.updateGoal(id, dto);
  }

  @Patch('nutrition/goals/:id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivateGoal(@Param('id') id: string): Promise<PrimaryGoalResponseDto> {
    return this.catalogService.deactivateGoal(id);
  }

  @Get('marketplace/products/:id/allergens')
  @Roles(UserRole.ADMIN)
  getProductAllergens(
    @Param('id') id: string,
  ): Promise<{ productId: string; allergyIds: string[] }> {
    return this.catalogService.getProductAllergenIds(id).then((allergyIds) => ({
      productId: id,
      allergyIds,
    }));
  }

  @Patch('marketplace/products/:id/allergens')
  @Roles(UserRole.ADMIN)
  setProductAllergens(
    @Param('id') id: string,
    @Body() dto: SetProductAllergensDto,
  ): Promise<{ productId: string; allergyIds: string[] }> {
    return this.catalogService.setProductAllergens(id, dto.allergyIds);
  }

  @Get('nutrition/employees')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  listNutritionEmployees(
    @Query() query: ListNutritionEmployeesQueryDto,
  ): Promise<NutritionEmployeeDto[]> {
    return this.mealPlanService.listNutritionEmployees(query);
  }

  @Get('nutrition/catalog-products')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  searchCatalogProducts(
    @Query() query: ListCatalogProductsQueryDto,
  ): Promise<CatalogProductPickDto[]> {
    return this.mealPlanService.searchCatalogProducts(query);
  }

  @Get('meal-plans')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  listMealPlans(
    @Query() query: ListMealPlansQueryDto,
  ): Promise<MealPlanSummaryDto[]> {
    return this.mealPlanService.listAdmin(query.status);
  }

  @Post('meal-plans')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  createMealPlan(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateMealPlanDraftDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.createDraft(user.id, dto);
  }

  @Get('meal-plans/:id')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  getMealPlan(@Param('id') id: string): Promise<MealPlanDetailDto> {
    return this.mealPlanService.getAdmin(id);
  }

  @Patch('meal-plans/:id')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  updateMealPlan(
    @Param('id') id: string,
    @Body() dto: UpdateMealPlanDraftDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.updateDraft(id, dto);
  }

  @Post('meal-plans/:id/items')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  upsertMealPlanItem(
    @Param('id') id: string,
    @Body() dto: UpsertMealPlanItemDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.upsertItem(id, dto);
  }

  @Patch('meal-plans/:id/items/:itemId')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  patchMealPlanItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: PatchMealPlanItemDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.patchItem(id, itemId, dto);
  }

  @Delete('meal-plans/:id/items/:itemId')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  deleteMealPlanItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.deleteItem(id, itemId);
  }

  @Put('meal-plans/:id/items/:itemId/recipe')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  upsertMealRecipe(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpsertMealRecipeDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.upsertRecipe(id, itemId, dto);
  }

  @Post('meal-plans/:id/publish')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  publishMealPlan(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: ApproveMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.publish(id, user.id, dto);
  }

  @Post('meal-plans/:id/ai/generate')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  generateMealPlanAi(
    @Param('id') id: string,
    @Body() dto: AiGenerateMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.generateWithAi(id, dto);
  }

  @Post('meal-plans/:id/ai/suggest-slot')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  suggestMealPlanSlot(
    @Param('id') id: string,
    @Body() dto: AiSuggestSlotDto,
  ): Promise<AiSlotSuggestionDto> {
    return this.mealPlanService.suggestSlot(id, dto);
  }

  @Post('meal-plans/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  approveMealPlan(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: ApproveMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.approve(id, user.id, dto);
  }

  @Post('meal-plans/:id/reject')
  @Roles(UserRole.ADMIN, UserRole.NUTRITIONIST)
  rejectMealPlan(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: RejectMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.reject(id, user.id, dto);
  }
}
