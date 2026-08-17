import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { AuthUserDto } from '../auth/dto/auth-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
import {
  AdminUserListItemDto,
  ListAdminUsersQueryDto,
} from './dto/admin-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('pending-users')
  listPendingUsers(): Promise<AuthUserDto[]> {
    return this.adminService.listPendingUsers();
  }

  @Get('users')
  listUsers(
    @Query() query: ListAdminUsersQueryDto,
  ): Promise<AdminUserListItemDto[]> {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/approve')
  approveUser(@Param('id') id: string): Promise<AuthUserDto> {
    return this.adminService.approveUser(id);
  }

  @Patch('users/:id/suspend')
  suspendUser(@Param('id') id: string): Promise<AuthUserDto> {
    return this.adminService.suspendUser(id);
  }
}
