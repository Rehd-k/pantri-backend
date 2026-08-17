import {
  Body,
  Controller,
  Get,
  Param,
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
import { OrderResponseDto, toOrderResponseDto } from './dto/order-response.dto';
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

  @Get('employees/me/orders')
  async listMyOrders(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<OrderResponseDto[]> {
    const orders = await this.orderService.listOrdersForEmployee(user.id);
    return orders.map(toOrderResponseDto);
  }

  @Get('employees/me/orders/:id')
  async getMyOrder(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.orderService.getOrderForEmployee(user.id, id);
    return toOrderResponseDto(order);
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
