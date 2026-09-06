import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  PlatformRole,
  Prisma,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { AuthUserDto } from '../auth/dto/auth-user.dto';
import { serializeAdminEmployeePortal } from '../credit/application/serialize-admin-employee';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminUserListItemDto,
  ListAdminUsersQueryDto,
} from './dto/admin-user.dto';

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
      include: { employer: true, employee: true },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user) => this.authService.toAuthUserDto(user));
  }

  async listUsers(
    query: ListAdminUsersQueryDto,
  ): Promise<AdminUserListItemDto[]> {
    const take = query.limit ?? 100;
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { businessName: { contains: q, mode: 'insensitive' } },
              { fleetName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      include: {
        employer: { select: { id: true, name: true } },
        employee: {
          select: { id: true, verificationStatus: true, employerId: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      employerId: user.employee?.employerId ?? user.employerId,
      employerName: user.employer?.name ?? null,
      employeeId: user.employee?.id ?? null,
      verificationStatus: user.employee?.verificationStatus ?? null,
      businessName: user.businessName,
      fleetName: user.fleetName,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employer: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
            payrollDayOfMonth: true,
            createdAt: true,
          },
        },
        memberships: {
          include: {
            employer: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        employee: {
          include: {
            employer: {
              select: {
                id: true,
                name: true,
                payrollDayOfMonth: true,
                creditPolicy: true,
              },
            },
            verificationDocuments: { orderBy: { createdAt: 'desc' } },
            salaryHistory: { orderBy: { effectiveAt: 'desc' } },
            orders: {
              orderBy: { createdAt: 'desc' },
              take: 100,
              include: {
                items: true,
                statusHistory: { orderBy: { createdAt: 'asc' } },
                reservation: true,
              },
            },
            creditAccount: {
              include: {
                ledgerEntries: {
                  take: 100,
                  orderBy: [{ sequence: 'desc' }],
                  include: {
                    createdBy: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
            mealPlans: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              select: {
                id: true,
                title: true,
                status: true,
                activatedAt: true,
                createdAt: true,
                reviewedAt: true,
              },
            },
            payrollLines: {
              orderBy: { createdAt: 'desc' },
              take: 50,
              include: {
                payrollRun: {
                  select: {
                    id: true,
                    periodStart: true,
                    periodEnd: true,
                    payrollDate: true,
                    status: true,
                  },
                },
              },
            },
            cookedMeals: {
              orderBy: { cookedAt: 'desc' },
              take: 30,
              include: {
                recipe: { select: { id: true, title: true, mealSlot: true } },
              },
            },
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        packages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            name: true,
            kind: true,
            visibility: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const employee = user.employee;
    const serializedEmployee = employee
      ? serializeAdminEmployeePortal({
          ...employee,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            status: user.status,
          },
          policy: employee.employer.creditPolicy,
        })
      : null;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      platformRole: user.platformRole,
      businessName: user.businessName,
      fleetName: user.fleetName,
      employerId: employee?.employerId ?? user.employerId,
      employer: user.employer
        ? {
            id: user.employer.id,
            name: user.employer.name,
            inviteCode: user.employer.inviteCode,
            payrollDayOfMonth: user.employer.payrollDayOfMonth,
            createdAt: user.employer.createdAt.toISOString(),
          }
        : employee?.employer
          ? {
              id: employee.employer.id,
              name: employee.employer.name,
              inviteCode: null,
              payrollDayOfMonth: employee.employer.payrollDayOfMonth ?? null,
              createdAt: null,
            }
          : null,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        employerId: m.employerId,
        employerName: m.employer.name,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      employee: serializedEmployee
        ? {
            ...serializedEmployee,
            employerName: employee!.employer.name,
            exposureKobo: serializedEmployee.finance?.outstandingKobo ?? 0,
            mealPlans: employee!.mealPlans.map((m) => ({
              id: m.id,
              title: m.title,
              status: m.status,
              activatedAt: m.activatedAt?.toISOString() ?? null,
              reviewedAt: m.reviewedAt?.toISOString() ?? null,
              createdAt: m.createdAt.toISOString(),
            })),
            cookedMeals: employee!.cookedMeals.map((meal) => ({
              id: meal.id,
              recipeId: meal.recipeId,
              recipeTitle: meal.recipe.title,
              mealSlot: meal.recipe.mealSlot,
              cookedAt: meal.cookedAt.toISOString(),
              energyKcal: meal.energyKcal,
            })),
          }
        : null,
      packagesCreated: user.packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        kind: pkg.kind,
        visibility: pkg.visibility,
        createdAt: pkg.createdAt.toISOString(),
      })),
      auditLogs: user.auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
      })),
      notifications: user.notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        status: n.status,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async approveUser(userId: string): Promise<AuthUserDto> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employer: true, employee: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
      include: { employer: true, employee: true },
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
      include: { employer: true, employee: true },
    });

    return this.authService.toAuthUserDto(user);
  }

  async loadNutritionistSession(): Promise<AuthResponseDto> {
    const userId = await this.ensureNutritionistUserId();
    return this.authService.issueAuthResponseForUserId(userId);
  }

  private async ensureNutritionistUserId(): Promise<string> {
    const email = 'nutritionist@pantri.app';
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing && existing.role !== UserRole.NUTRITIONIST) {
      throw new ConflictException(
        'nutritionist@pantri.app is already used by a different role.',
      );
    }

    if (existing) {
      if (existing.status !== UserStatus.ACTIVE) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { status: UserStatus.ACTIVE },
        });
      }
      return existing.id;
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('Nutrition123!', 12),
        firstName: 'Ngozi',
        lastName: 'Adeyemi',
        role: UserRole.NUTRITIONIST,
        status: UserStatus.ACTIVE,
        platformRole: PlatformRole.NUTRITIONIST,
      },
    });
    return created.id;
  }
}
