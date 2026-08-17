import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeVerificationStatus,
  LedgerEntryType,
  OrderFulfillmentStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePickupPointDto,
  UpdatePickupPointDto,
} from './dto/pickup-point-request.dto';
import {
  CompanyListItemDto,
  PickupPointDto,
} from './dto/pickup-point-response.dto';

/** Retains the historical `Companies` name for API/route compatibility; operates on `Employer` tenants. */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanies(): Promise<CompanyListItemDto[]> {
    const rows = await this.prisma.employer.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, inviteCode: true },
    });
    return rows.map((r) => ({
      id: r.id,
      employerId: r.id,
      name: r.name,
      inviteCode: r.inviteCode,
    }));
  }

  async getCompanyPortal(employerId: string) {
    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
      include: {
        employees: {
          select: {
            verificationStatus: true,
            updatedAt: true,
            id: true,
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!employer) {
      throw new NotFoundException('Employer not found');
    }

    const [accounts, purchases, repayments, recentOrders] = await Promise.all([
      this.prisma.creditAccount.findMany({
        where: { employee: { employerId } },
        select: {
          principalOutstandingKobo: true,
          postedInterestKobo: true,
          postedFeesKobo: true,
          postedPenaltiesKobo: true,
        },
      }),
      this.prisma.order.aggregate({
        where: {
          employerId,
          fulfillmentStatus: OrderFulfillmentStatus.FULFILLED,
        },
        _sum: { totalKobo: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          creditAccount: { employee: { employerId } },
          entryType: LedgerEntryType.PAYROLL_REPAYMENT,
        },
        _sum: { amountKobo: true },
      }),
      this.prisma.order.findMany({
        where: { employerId },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          employeeId: true,
          fulfillmentStatus: true,
          totalKobo: true,
          updatedAt: true,
          employee: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    const verificationActivity = employer.employees
      .filter(
        (employee) =>
          employee.verificationStatus !==
          EmployeeVerificationStatus.REGISTERED,
      )
      .map((employee) => ({
        type: 'VERIFICATION' as const,
        id: employee.id,
        employeeId: employee.id,
        employeeName: `${employee.user.firstName} ${employee.user.lastName}`,
        status: employee.verificationStatus,
        occurredAt: employee.updatedAt.toISOString(),
      }));
    const orderActivity = recentOrders.map((order) => ({
      type: 'ORDER' as const,
      id: order.id,
      employeeId: order.employeeId,
      employeeName: `${order.employee.user.firstName} ${order.employee.user.lastName}`,
      status: order.fulfillmentStatus,
      totalKobo: order.totalKobo,
      occurredAt: order.updatedAt.toISOString(),
    }));

    return {
      id: employer.id,
      employerId: employer.id,
      name: employer.name,
      inviteCode: employer.inviteCode,
      employeeCount: employer.employees.length,
      verifiedCount: employer.employees.filter(
        (employee) =>
          employee.verificationStatus ===
          EmployeeVerificationStatus.APPROVED,
      ).length,
      pendingVerificationCount: employer.employees.filter(
        (employee) =>
          employee.verificationStatus ===
            EmployeeVerificationStatus.REGISTERED ||
          employee.verificationStatus ===
            EmployeeVerificationStatus.DOCS_SUBMITTED,
      ).length,
      amountOwedKobo: accounts.reduce(
        (sum, account) =>
          sum +
          account.principalOutstandingKobo +
          account.postedInterestKobo +
          account.postedFeesKobo +
          account.postedPenaltiesKobo,
        0,
      ),
      totalPurchasesKobo: purchases._sum.totalKobo ?? 0,
      remittedKobo: Math.abs(repayments._sum.amountKobo ?? 0),
      recentActivity: [...orderActivity, ...verificationActivity]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 15),
    };
  }

  async listCompanyEmployees(employerId: string) {
    await this.ensureEmployer(employerId);
    const employees = await this.prisma.employee.findMany({
      where: { employerId },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        creditAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return employees.map((employee) => ({
      id: employee.id,
      userId: employee.userId,
      firstName: employee.user.firstName,
      lastName: employee.user.lastName,
      email: employee.user.email,
      phone: employee.phone,
      verificationStatus: employee.verificationStatus,
      salaryKobo: employee.salaryKobo,
      exposureKobo: employee.creditAccount
        ? employee.creditAccount.principalOutstandingKobo +
          employee.creditAccount.postedInterestKobo +
          employee.creditAccount.postedFeesKobo +
          employee.creditAccount.postedPenaltiesKobo
        : 0,
      createdAt: employee.createdAt.toISOString(),
    }));
  }

  async getEmployeePortal(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        employer: { select: { id: true, name: true } },
        verificationDocuments: { orderBy: { createdAt: 'desc' } },
        salaryHistory: { orderBy: { effectiveAt: 'desc' } },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            statusHistory: { orderBy: { createdAt: 'asc' } },
          },
        },
        creditAccount: {
          include: {
            ledgerEntries: {
              take: 50,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async exportExposureCsv(): Promise<string> {
    const employers = await this.prisma.employer.findMany({
      orderBy: { name: 'asc' },
      include: {
        employees: {
          include: { creditAccount: true },
        },
      },
    });
    const rows = [
      ['employerId', 'companyName', 'employeeCount', 'exposureKobo'],
      ...employers.map((employer) => [
        employer.id,
        employer.name,
        String(employer.employees.length),
        String(
          employer.employees.reduce((sum, employee) => {
            const account = employee.creditAccount;
            return account
              ? sum +
                  account.principalOutstandingKobo +
                  account.postedInterestKobo +
                  account.postedFeesKobo +
                  account.postedPenaltiesKobo
              : sum;
          }, 0),
        ),
      ]),
    ];
    return rows
      .map((row) => row.map((value) => csvEscape(value)).join(','))
      .join('\n');
  }

  async listPickupPoints(employerId: string): Promise<PickupPointDto[]> {
    await this.ensureEmployer(employerId);
    const rows = await this.prisma.employerPickupPoint.findMany({
      where: { employerId },
      orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async createPickupPoint(
    employerId: string,
    dto: CreatePickupPointDto,
  ): Promise<PickupPointDto> {
    await this.ensureEmployer(employerId);
    const row = await this.prisma.employerPickupPoint.create({
      data: {
        employerId,
        label: dto.label,
        addressLine: dto.addressLine,
        city: dto.city,
        state: dto.state ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toDto(row);
  }

  async updatePickupPoint(
    id: string,
    dto: UpdatePickupPointDto,
  ): Promise<PickupPointDto> {
    await this.ensurePickupPoint(id);
    const row = await this.prisma.employerPickupPoint.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.addressLine !== undefined
          ? { addressLine: dto.addressLine }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toDto(row);
  }

  async deactivatePickupPoint(id: string): Promise<PickupPointDto> {
    await this.ensurePickupPoint(id);
    const row = await this.prisma.employerPickupPoint.update({
      where: { id },
      data: { isActive: false },
    });
    return this.toDto(row);
  }

  private async ensureEmployer(employerId: string): Promise<void> {
    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
    });
    if (!employer) {
      throw new NotFoundException('Employer not found');
    }
  }

  private async ensurePickupPoint(id: string): Promise<void> {
    const point = await this.prisma.employerPickupPoint.findUnique({
      where: { id },
    });
    if (!point) {
      throw new NotFoundException('Pickup point not found');
    }
  }

  private toDto(row: {
    id: string;
    employerId: string;
    label: string;
    addressLine: string;
    city: string;
    state: string | null;
    latitude: number;
    longitude: number;
    isActive: boolean;
    updatedAt: Date;
  }): PickupPointDto {
    return {
      id: row.id,
      employerId: row.employerId,
      companyId: row.employerId,
      label: row.label,
      addressLine: row.addressLine,
      city: row.city,
      state: row.state,
      latitude: row.latitude,
      longitude: row.longitude,
      isActive: row.isActive,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
