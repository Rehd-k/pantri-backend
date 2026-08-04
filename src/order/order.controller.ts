import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EmployeePickupPointDto } from '../companies/dto/pickup-point-response.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { EmployeeDashboardDto } from './dto/employee-dashboard.dto';
import { EmployeeLocationDto } from './dto/employee-location.dto';
import { UpdateEmployeeLocationDto } from './dto/update-employee-location.dto';
import { OrderService } from './order.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('employees/me/dashboard')
  getDashboard(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<EmployeeDashboardDto> {
    return this.orderService.getEmployeeDashboard(user.id);
  }

  @Get('employees/me/location')
  getLocation(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<EmployeeLocationDto> {
    return this.orderService.getLocation(user.id);
  }

  @Put('employees/me/location')
  updateLocation(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateEmployeeLocationDto,
  ): Promise<EmployeeLocationDto> {
    return this.orderService.updateLocation(user.id, dto);
  }

  @Get('employees/me/pickup-points')
  listPickupPoints(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<EmployeePickupPointDto[]> {
    return this.orderService.listPickupPoints(user.id);
  }

  @Post('orders/checkout')
  checkout(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    return this.orderService.checkout(user.id, dto);
  }
}
