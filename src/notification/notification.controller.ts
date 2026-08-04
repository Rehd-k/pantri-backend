import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  NotificationResponseDto,
  toNotificationResponseDto,
} from './dto/notification-response.dto';
import { NotificationService } from './notification.service';

/** Employee-facing in-app notification inbox. */
@Controller('employees/me/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<NotificationResponseDto[]> {
    const list = await this.notifications.listForUser(user.id);
    return list.map(toNotificationResponseDto);
  }

  @Post(':id/read')
  async markRead(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notifications.markRead(id, user.id);
    return toNotificationResponseDto(notification);
  }
}
