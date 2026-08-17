import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditAccountStatus,
  EmployeeVerificationStatus,
  OrderFulfillmentStatus,
  OrderCreditStatus,
  Prisma,
  VerificationDocumentStatus,
  VerificationDocumentType,
} from '../../generated/prisma/client';
import { CreditAccountService } from '../credit/application/credit-account.service';
import { ReservationService } from '../credit/application/reservation.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApproveEmployeeVerificationDto,
  AttachVerificationDocumentDto,
  RejectEmployeeVerificationDto,
} from './dto/verification.dto';
import {
  EmployeeVerificationResponseDto,
  VerificationDocumentResponseDto,
} from './dto/verification-response.dto';

type EmployeeWithUserDocs = Prisma.EmployeeGetPayload<{
  include: {
    user: true;
    verificationDocuments: true;
  };
}>;

@Injectable()
export class EmployeeVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditAccounts: CreditAccountService,
    private readonly reservations: ReservationService,
  ) {}

  async listPendingForAdmin(): Promise<EmployeeVerificationResponseDto[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        verificationStatus: {
          in: [
            EmployeeVerificationStatus.REGISTERED,
            EmployeeVerificationStatus.DOCS_SUBMITTED,
          ],
        },
      },
      include: { user: true, verificationDocuments: true },
      orderBy: { createdAt: 'asc' },
    });
    return employees.map((e) => this.toDto(e));
  }

  async listForEmployer(
    employerId: string,
  ): Promise<EmployeeVerificationResponseDto[]> {
    const employees = await this.prisma.employee.findMany({
      where: { employerId },
      include: { user: true, verificationDocuments: true },
      orderBy: { createdAt: 'desc' },
    });
    return employees.map((e) => this.toDto(e));
  }

  async getEmployee(
    employeeId: string,
    employerId?: string,
  ): Promise<EmployeeVerificationResponseDto> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(employerId ? { employerId } : {}),
      },
      include: { user: true, verificationDocuments: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return this.toDto(employee);
  }

  async attachDocument(
    uploadedById: string,
    employerId: string | undefined,
    dto: AttachVerificationDocumentDto,
  ): Promise<VerificationDocumentResponseDto> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        ...(employerId ? { employerId } : {}),
      },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (
      employee.verificationStatus === EmployeeVerificationStatus.APPROVED ||
      employee.verificationStatus === EmployeeVerificationStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot attach documents when verification is ${employee.verificationStatus}`,
      );
    }

    const type = dto.type as VerificationDocumentType;
    if (!Object.values(VerificationDocumentType).includes(type)) {
      throw new BadRequestException('Invalid document type');
    }

    const doc = await this.prisma.verificationDocument.create({
      data: {
        employeeId: employee.id,
        type,
        status: VerificationDocumentStatus.UPLOADED,
        fileName: dto.fileName.trim(),
        fileUrl: dto.fileUrl.trim(),
        imageKitFileId: dto.imageKitFileId ?? null,
        mimeType: dto.mimeType ?? null,
        uploadedById,
        note: dto.note?.trim() || null,
      },
    });

    return {
      id: doc.id,
      employeeId: doc.employeeId,
      type: doc.type,
      status: doc.status,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      mimeType: doc.mimeType,
      note: doc.note,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  async submitDocuments(
    employeeId: string,
    employerId: string,
  ): Promise<EmployeeVerificationResponseDto> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, employerId },
      include: { user: true, verificationDocuments: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (
      employee.verificationStatus !== EmployeeVerificationStatus.REGISTERED &&
      employee.verificationStatus !==
        EmployeeVerificationStatus.DOCS_SUBMITTED
    ) {
      throw new BadRequestException(
        `Cannot submit documents from status ${employee.verificationStatus}`,
      );
    }

    const hasEmployment = employee.verificationDocuments.some(
      (d) => d.type === VerificationDocumentType.EMPLOYMENT_PROOF,
    );
    const hasPayroll = employee.verificationDocuments.some(
      (d) => d.type === VerificationDocumentType.PAYROLL_PROOF,
    );
    if (!hasEmployment || !hasPayroll) {
      throw new BadRequestException(
        'Both employment proof and payroll proof documents are required',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationDocument.updateMany({
        where: { employeeId },
        data: { status: VerificationDocumentStatus.SUBMITTED },
      });
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          verificationStatus: EmployeeVerificationStatus.DOCS_SUBMITTED,
        },
      });
    });

    return this.getEmployee(employeeId, employerId);
  }

  async approve(
    employeeId: string,
    adminUserId: string,
    dto: ApproveEmployeeVerificationDto,
  ): Promise<EmployeeVerificationResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true, verificationDocuments: true, creditAccount: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (
      employee.verificationStatus !==
        EmployeeVerificationStatus.DOCS_SUBMITTED &&
      employee.verificationStatus !== EmployeeVerificationStatus.REGISTERED
    ) {
      throw new BadRequestException(
        `Cannot approve employee in status ${employee.verificationStatus}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          salaryKobo: dto.salaryKobo,
          creditMultiplierBps: dto.creditMultiplierBps,
          verificationStatus: EmployeeVerificationStatus.APPROVED,
          verifiedAt: new Date(),
          verifiedById: adminUserId,
          rejectionReason: null,
          accountStatus: 'ACTIVE',
        },
      });
      await tx.salaryHistory.create({
        data: {
          employeeId,
          salaryKobo: dto.salaryKobo,
          reason: dto.note?.trim() || 'Admin verification approval',
        },
      });
    });

    const account = await this.creditAccounts.getOrCreateAccount(employeeId);
    await this.prisma.creditAccount.update({
      where: { id: account.id },
      data: { status: CreditAccountStatus.ACTIVE },
    });
    await this.creditAccounts.recalculateLimit(employeeId);

    await this.promoteVerificationHoldOrders(employeeId, adminUserId);

    return this.getEmployee(employeeId);
  }

  async reject(
    employeeId: string,
    adminUserId: string,
    dto: RejectEmployeeVerificationDto,
  ): Promise<EmployeeVerificationResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        verificationStatus: EmployeeVerificationStatus.REJECTED,
        rejectionReason: dto.reason.trim(),
        verifiedById: adminUserId,
        verifiedAt: new Date(),
      },
    });

    // Cancel verification-hold orders.
    const holds = await this.prisma.order.findMany({
      where: {
        employeeId,
        fulfillmentStatus: OrderFulfillmentStatus.VERIFICATION_HOLD,
      },
    });
    for (const order of holds) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: OrderFulfillmentStatus.CANCELLED },
      });
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: OrderFulfillmentStatus.VERIFICATION_HOLD,
          toStatus: OrderFulfillmentStatus.CANCELLED,
          note: 'Employee verification rejected',
          changedById: adminUserId,
        },
      });
    }

    return this.getEmployee(employeeId);
  }

  /**
   * After verification approval, promote hold orders into PENDING_APPROVAL
   * and attempt credit reservation for each.
   */
  private async promoteVerificationHoldOrders(
    employeeId: string,
    actorUserId: string,
  ): Promise<void> {
    const holds = await this.prisma.order.findMany({
      where: {
        employeeId,
        fulfillmentStatus: OrderFulfillmentStatus.VERIFICATION_HOLD,
      },
      include: { reservation: true },
      orderBy: { createdAt: 'asc' },
    });

    const account = await this.creditAccounts.getOrCreateAccount(employeeId);
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: { employer: { include: { creditPolicy: true } } },
    });
    const ttlHours =
      employee.employer.creditPolicy?.reservationTtlHours ?? 72;
    const approvalTtlHours =
      employee.employer.creditPolicy?.approvalTtlHours ?? 72;

    for (const order of holds) {
      try {
        await this.reservations.reserve({
          creditAccountId: account.id,
          orderId: order.id,
          amountKobo: order.totalKobo,
          ttlHours,
          createdByUserId: actorUserId,
          idempotencyKey: `verify-promote:${order.id}`,
        });

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            fulfillmentStatus: OrderFulfillmentStatus.PENDING_APPROVAL,
            creditStatus: OrderCreditStatus.RESERVED,
            approvalExpiresAt: new Date(
              Date.now() + approvalTtlHours * 60 * 60 * 1000,
            ),
          },
        });
        await this.prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: OrderFulfillmentStatus.VERIFICATION_HOLD,
            toStatus: OrderFulfillmentStatus.PENDING_APPROVAL,
            note: 'Promoted after employee verification approval',
            changedById: actorUserId,
          },
        });
      } catch {
        // Leave on hold if reservation fails (e.g. insufficient limit).
        await this.prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: OrderFulfillmentStatus.VERIFICATION_HOLD,
            toStatus: OrderFulfillmentStatus.VERIFICATION_HOLD,
            note: 'Verification approved but credit reservation failed; order remains on hold',
            changedById: actorUserId,
          },
        });
      }
    }
  }

  toDto(employee: EmployeeWithUserDocs): EmployeeVerificationResponseDto {
    return {
      id: employee.id,
      userId: employee.userId,
      employerId: employee.employerId,
      email: employee.user.email,
      firstName: employee.user.firstName,
      lastName: employee.user.lastName,
      phone: employee.phone,
      verificationStatus: employee.verificationStatus,
      salaryKobo: employee.salaryKobo,
      creditMultiplierBps: employee.creditMultiplierBps,
      rejectionReason: employee.rejectionReason,
      verifiedAt: employee.verifiedAt?.toISOString() ?? null,
      documents: employee.verificationDocuments.map((d) => ({
        id: d.id,
        employeeId: d.employeeId,
        type: d.type,
        status: d.status,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        mimeType: d.mimeType,
        note: d.note,
        createdAt: d.createdAt.toISOString(),
      })),
      createdAt: employee.createdAt.toISOString(),
    };
  }
}
