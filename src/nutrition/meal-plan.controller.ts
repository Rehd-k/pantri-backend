import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  MealPlanDetailDto,
  MealPlanSummaryDto,
} from './dto/meal-plan.dto';
import { MealPlanService } from './meal-plan.service';

@Controller('nutrition/meal-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class MealPlanController {
  constructor(private readonly mealPlanService: MealPlanService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload): Promise<MealPlanSummaryDto[]> {
    return this.mealPlanService.listForUser(user.id);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.getForUser(user.id, id);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<MealPlanDetailDto> {
    return this.mealPlanService.generateForUser(user.id);
  }
}
