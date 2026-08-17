import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyInvoiceStatus,
  LedgerEntryType,
  OrderFulfillmentStatus,
} from '../../generated/prisma/client';
import { EmployerCreditService } from '../credit/application/employer-credit.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateCompanyInvoiceDto } from './dto/generate-company-invoice.dto';

const FEE_ENTRY_TYPES: LedgerEntryType[] = [
  LedgerEntryType.DELIVERY_FEE,
  LedgerEntryType.SERVICE_FEE,
  LedgerEntryType.PENALTY,
];

@Injectable()
export class CompanyInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employerCredit: EmployerCreditService,
  ) {}

  async generate(
    employerId: string,
    generatedById: string,
    dto: GenerateCompanyInvoiceDto,
  ) {
    await this.ensureEmployer(employerId);
    const { periodStart, periodEnd, endExclusive } = this.parsePeriod(dto);

    const existing = await this.prisma.companyInvoice.findUnique({
      where: {
        employerId_periodStart_periodEnd: {
          employerId,
          periodStart,
          periodEnd,
        },
      },
    });
    if (existing) {
      throw new ConflictException('An invoice already exists for this period');
    }

    const [orders, charges, repayments] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          employerId,
          fulfillmentStatus: OrderFulfillmentStatus.FULFILLED,
          statusHistory: {
            some: {
              toStatus: OrderFulfillmentStatus.FULFILLED,
              createdAt: { gte: periodStart, lt: endExclusive },
            },
          },
        },
        include: {
          employee: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.ledgerEntry.findMany({
        where: {
          creditAccount: { employee: { employerId } },
          entryType: {
            in: [LedgerEntryType.INTEREST, ...FEE_ENTRY_TYPES],
          },
          amountKobo: { gt: 0 },
          createdAt: { gte: periodStart, lt: endExclusive },
        },
        include: {
          creditAccount: {
            include: {
              employee: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          creditAccount: { employee: { employerId } },
          entryType: LedgerEntryType.PAYROLL_REPAYMENT,
          createdAt: { gte: periodStart, lt: endExclusive },
        },
        _sum: { amountKobo: true },
      }),
    ]);

    const subtotalKobo = orders.reduce(
      (sum, order) => sum + order.totalKobo,
      0,
    );
    const interestKobo = charges
      .filter((entry) => entry.entryType === LedgerEntryType.INTEREST)
      .reduce((sum, entry) => sum + entry.amountKobo, 0);
    const feesKobo = charges
      .filter((entry) => entry.entryType !== LedgerEntryType.INTEREST)
      .reduce((sum, entry) => sum + entry.amountKobo, 0);
    const remittedKobo = Math.abs(repayments._sum.amountKobo ?? 0);

    const invoice = await this.prisma.companyInvoice.create({
      data: {
        employerId,
        periodStart,
        periodEnd,
        status: CompanyInvoiceStatus.ISSUED,
        subtotalKobo,
        feesKobo,
        interestKobo,
        totalDueKobo: subtotalKobo + feesKobo + interestKobo,
        remittedKobo,
        generatedById,
        issuedAt: new Date(),
        lines: {
          create: [
            ...orders.map((order) => ({
              employeeId: order.employeeId,
              orderId: order.id,
              description: `Fulfilled order ${order.id} — ${order.employee.user.firstName} ${order.employee.user.lastName}`,
              amountKobo: order.totalKobo,
              category: 'PURCHASE',
            })),
            ...charges.map((entry) => {
              const employee = entry.creditAccount.employee;
              return {
                employeeId: employee.id,
                orderId:
                  entry.referenceType === 'Order' ? entry.referenceId : null,
                description: `${entry.entryType.replaceAll('_', ' ')} — ${employee.user.firstName} ${employee.user.lastName}`,
                amountKobo: entry.amountKobo,
                category:
                  entry.entryType === LedgerEntryType.INTEREST
                    ? 'INTEREST'
                    : 'FEE',
              };
            }),
          ],
        },
      },
    });

    return this.getAdminInvoice(invoice.id);
  }

  async listAdminInvoices(employerId: string) {
    await this.ensureEmployer(employerId);
    return this.prisma.companyInvoice.findMany({
      where: { employerId },
      include: { _count: { select: { lines: true } } },
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getAdminInvoice(invoiceId: string) {
    const invoice = await this.prisma.companyInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        employer: { select: { id: true, name: true } },
        generatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        lines: {
          include: {
            employee: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async listEmployerInvoices(userId: string) {
    const employerId = await this.resolveEmployerId(userId);
    return this.listAdminInvoices(employerId);
  }

  async getEmployerInvoice(userId: string, invoiceId: string) {
    const employerId = await this.resolveEmployerId(userId);
    const invoice = await this.getAdminInvoice(invoiceId);
    if (invoice.employerId !== employerId) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async exportCsv(invoiceId: string): Promise<string> {
    const invoice = await this.getAdminInvoice(invoiceId);
    const rows = [
      [
        'lineId',
        'employeeId',
        'employeeName',
        'employeeEmail',
        'category',
        'description',
        'orderId',
        'amountKobo',
      ],
      ...invoice.lines.map((line) => [
        line.id,
        line.employeeId ?? '',
        line.employee
          ? `${line.employee.user.firstName} ${line.employee.user.lastName}`
          : '',
        line.employee?.user.email ?? '',
        line.category,
        line.description,
        line.orderId ?? '',
        String(line.amountKobo),
      ]),
    ];
    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }

  private parsePeriod(dto: GenerateCompanyInvoiceDto): {
    periodStart: Date;
    periodEnd: Date;
    endExclusive: Date;
  } {
    const periodStart = new Date(`${dto.periodStart.slice(0, 10)}T00:00:00.000Z`);
    const periodEnd = new Date(`${dto.periodEnd.slice(0, 10)}T00:00:00.000Z`);
    if (periodStart > periodEnd) {
      throw new BadRequestException('periodStart must not be after periodEnd');
    }
    const endExclusive = new Date(periodEnd);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    return { periodStart, periodEnd, endExclusive };
  }

  private async resolveEmployerId(userId: string): Promise<string> {
    return this.employerCredit.resolveEmployerId(userId);
  }

  private async ensureEmployer(employerId: string): Promise<void> {
    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
      select: { id: true },
    });
    if (!employer) {
      throw new NotFoundException('Employer not found');
    }
  }
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
