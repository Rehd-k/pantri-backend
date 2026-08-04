import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { AuthUserDto } from '../auth/dto/auth-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listPendingUsers(): Promise<AuthUserDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.PENDING_APPROVAL,
        role: { in: [UserRole.SUPPLIER, UserRole.LOGISTICS] },
      },
      include: { employer: true },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user) => this.authService.toAuthUserDto(user));
  }

  async approveUser(userId: string): Promise<AuthUserDto> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employer: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
      include: { employer: true },
    });

    return this.authService.toAuthUserDto(user);
  }

  async suspendUser(userId: string): Promise<AuthUserDto> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
      include: { employer: true },
    });

    return this.authService.toAuthUserDto(user);
  }
}
