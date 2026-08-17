import {
  Controller,
  Get,
  Param,
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
  CookMealResponseDto,
  NutritionProgressQueryDto,
  NutritionProgressResponseDto,
  RecipeResponseDto,
} from './dto/recipe.dto';
import { RecipeService } from './recipe.service';

@Controller('nutrition')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Get('progress')
  progress(
    @CurrentUser() user: AuthUserPayload,
    @Query() query: NutritionProgressQueryDto,
  ): Promise<NutritionProgressResponseDto> {
    return this.recipeService.progressForUser(user.id, query);
  }

  @Get('recipes/:id')
  getOne(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<RecipeResponseDto> {
    return this.recipeService.getForUser(user.id, id);
  }

  @Post('recipes/:id/cook')
  cook(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<CookMealResponseDto> {
    return this.recipeService.cookForUser(user.id, id);
  }
}
