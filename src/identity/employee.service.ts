import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreditAccount,
  Employee,
  EmployeeAccountStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditAccountService } from '../credit/application/credit-account.service';

export interface CreateEmployeeWithAccountParams {
  userId: string;
  employerId: string;
  salaryKobo: number;
  deductionPercent?: number;
}

export interface CreateEmployeeWithAccountResult {
  employee: Employee;
  creditAccount: CreditAccount;
}

/**
 * Identity/tenancy glue between `User` and the credit engine: resolves the
 * `Employee` row for an authenticated user, and onboards new employees onto
 * an employer's payroll (creating their `Employee` record, an initial
 * `SalaryHistory` entry, and their `CreditAccount`).
 */
@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditAccountService: CreditAccountService,
  ) {}

  async resolveEmployeeByUserId(userId: string): Promise<Employee> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }
    return employee;
  }

  async createEmployeeWithAccount(
    params: CreateEmployeeWithAccountParams,
  ): Promise<CreateEmployeeWithAccountResult> {
    const employer = await this.prisma.employer.findUnique({
      where: { id: params.employerId },
      include: { creditPolicy: true },
    });
    if (!employer) {
      throw new NotFoundException('Employer not found');
    }

    const deductionPercent =
      params.deductionPercent ??
      employer.creditPolicy?.defaultDeductionPercent ??
      20;

    const employee = await this.prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          userId: params.userId,
          employerId: params.employerId,
          salaryKobo: params.salaryKobo,
          deductionPercent,
          accountStatus: EmployeeAccountStatus.ACTIVE,
        },
      });

      await tx.salaryHistory.create({
        data: {
          employeeId: created.id,
          salaryKobo: params.salaryKobo,
          reason: 'Initial salary on onboarding',
        },
      });

      return created;
    });

    const creditAccount = await this.creditAccountService.getOrCreateAccount(
      employee.id,
    );

    return { employee, creditAccount };
  }
}
