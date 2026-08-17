import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  OrderFulfillmentStatus,
  UserRole,
} from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EmployerCreditService } from '../credit/application/employer-credit.service';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { FulfillOrderDto } from './dto/fulfill-order.dto';
import { OrderResponseDto, toOrderResponseDto } from './dto/order-response.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { OrderService } from './order.service';

/**
 * Employer/logistics-facing order lifecycle operations (M5): approval,
 * rejection, fulfillment (with credit capture), cancellation, and refunds.
 * ADMIN acts platform-wide; EMPLOYER staff are scoped to their own tenant.
 */
@Controller('employer/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderOpsController {
  constructor(
    private readonly orderService: OrderService,
    private readonly employerCredit: EmployerCreditService,
  ) {}

  @Get()
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async list(
    @CurrentUser() user: AuthUserPayload,
    @Query('status') status?: OrderFulfillmentStatus,
  ): Promise<OrderResponseDto[]> {
    const employerId = await this.resolveEmployerScope(user);
    const orders = await this.orderService.listOrders(employerId, status);
    return orders.map(toOrderResponseDto);
  }

  @Post(':id/approve')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async approve(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: ApproveOrderDto,
  ): Promise<OrderResponseDto> {
    const employerId = await this.resolveEmployerScope(user);
    const order = await this.orderService.approveOrder(
      id,
      user.id,
      dto.reducedAmountKobo,
      employerId,
    );
    return toOrderResponseDto(order);
  }

  @Post(':id/reject')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async reject(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    const employerId = await this.resolveEmployerScope(user);
    const order = await this.orderService.rejectOrder(id, user.id, employerId);
    return toOrderResponseDto(order);
  }

  @Post(':id/fulfill')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN, UserRole.LOGISTICS)
  async fulfill(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: FulfillOrderDto,
  ): Promise<OrderResponseDto> {
    const employerId = await this.resolveEmployerScope(user);
    const order = await this.orderService.fulfillOrder(
      id,
      user.id,
      dto.items,
      employerId,
    );
    return toOrderResponseDto(order);
  }

  @Post(':id/cancel')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async cancel(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    const employerId = await this.resolveEmployerScope(user);
    const order = await this.orderService.cancelOrder(id, user.id, employerId);
    return toOrderResponseDto(order);
  }

  @Post(':id/refund')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async refund(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
  ): Promise<OrderResponseDto> {
    const employerId = await this.resolveEmployerScope(user);
    const order = await this.orderService.refundOrder(
      id,
      user.id,
      dto.amountKobo,
      dto.reason,
      employerId,
    );
    return toOrderResponseDto(order);
  }

  @Post(':id/transition')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN, UserRole.LOGISTICS)
  async transition(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() body: { status: OrderFulfillmentStatus; note?: string },
  ): Promise<OrderResponseDto> {
    const employerId = await this.resolveEmployerScope(user);
    const order = await this.orderService.transitionFulfillmentStatus(
      id,
      body.status,
      user.id,
      body.note,
      employerId,
    );
    return toOrderResponseDto(order);
  }

  /** EMPLOYER staff are scoped to their resolved tenant; ADMIN/LOGISTICS bypass employer scoping (status transitions still enforce validity). */
  private async resolveEmployerScope(
    user: AuthUserPayload,
  ): Promise<string | undefined> {
    if (user.role === UserRole.EMPLOYER) {
      return this.employerCredit.resolveEmployerId(user.id);
    }
    return undefined;
  }
}
