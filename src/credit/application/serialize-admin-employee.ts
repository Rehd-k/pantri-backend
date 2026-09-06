import {
  CreditAccount,
  CreditPolicy,
  Employee,
  Employer,
  LedgerEntry,
  Order,
  OrderItem,
  OrderStatusHistory,
  PayrollDeductionLine,
  PayrollRun,
  SalaryHistory,
  User,
  VerificationDocument,
} from '../../../generated/prisma/client';
import {
  AdminCreditFinanceSummary,
  buildCreditFinanceSummary,
  mapLedgerEntries,
  monthlyDeductionFromSalary,
} from '../domain/admin-finance';

type EmployeePortalSource = Employee & {
  user: Pick<
    User,
    'id' | 'email' | 'firstName' | 'lastName' | 'status'
  >;
  employer: Pick<Employer, 'id' | 'name'> & {
    payrollDayOfMonth?: number | null;
  };
  verificationDocuments: VerificationDocument[];
  salaryHistory: SalaryHistory[];
  orders: Array<
    Order & {
      items: OrderItem[];
      statusHistory: OrderStatusHistory[];
      reservation?: {
        amountKobo: number;
        capturedKobo: number;
        releasedKobo: number;
        status: string;
      } | null;
    }
  >;
  creditAccount:
    | (CreditAccount & {
        ledgerEntries: Array<
          LedgerEntry & {
            createdBy?: {
              firstName: string;
              lastName: string;
            } | null;
          }
        >;
      })
    | null;
  payrollLines?: Array<
    PayrollDeductionLine & {
      payrollRun: Pick<
        PayrollRun,
        'id' | 'periodStart' | 'periodEnd' | 'payrollDate' | 'status'
      >;
    }
  >;
  policy?: CreditPolicy | null;
};

export function serializeAdminEmployeePortal(employee: EmployeePortalSource) {
  const ledgerEntries = employee.creditAccount?.ledgerEntries ?? [];
  const finance: AdminCreditFinanceSummary | null = buildCreditFinanceSummary({
    salaryKobo: employee.salaryKobo,
    deductionPercent: employee.deductionPercent,
    account: employee.creditAccount,
    policy: employee.policy,
    payrollDayOfMonth: employee.employer.payrollDayOfMonth,
    ledgerEntries,
  });

  const monthlyDeductionKobo = monthlyDeductionFromSalary(
    employee.salaryKobo,
    employee.deductionPercent,
  );

  return {
    id: employee.id,
    employerId: employee.employerId,
    salaryKobo: employee.salaryKobo,
    creditMultiplierBps: employee.creditMultiplierBps,
    deductionPercent: employee.deductionPercent,
    monthlyDeductionKobo,
    accountStatus: employee.accountStatus,
    verificationStatus: employee.verificationStatus,
    verifiedAt: employee.verifiedAt?.toISOString() ?? null,
    rejectionReason: employee.rejectionReason,
    phone: employee.phone,
    addressLine: employee.addressLine,
    city: employee.city,
    state: employee.state,
    createdAt: employee.createdAt.toISOString(),
    user: employee.user,
    employer: {
      id: employee.employer.id,
      name: employee.employer.name,
      payrollDayOfMonth: employee.employer.payrollDayOfMonth ?? null,
    },
    finance,
    verificationDocuments: employee.verificationDocuments.map((d) => ({
      id: d.id,
      type: d.type,
      status: d.status,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      mimeType: d.mimeType,
      note: d.note,
      createdAt: d.createdAt.toISOString(),
    })),
    salaryHistory: employee.salaryHistory.map((s) => ({
      id: s.id,
      salaryKobo: s.salaryKobo,
      effectiveAt: s.effectiveAt.toISOString(),
      reason: s.reason,
    })),
    orders: employee.orders.map((o) => {
      const fulfilledKobo = o.items.reduce(
        (sum, item) =>
          sum + item.unitPriceKobo * (item.fulfilledQuantity || 0),
        0,
      );
      const reservedKobo = o.reservation
        ? o.reservation.amountKobo -
          o.reservation.capturedKobo -
          o.reservation.releasedKobo
        : null;
      return {
        id: o.id,
        totalKobo: o.totalKobo,
        subtotalKobo: o.subtotalKobo,
        deliveryFeeKobo: o.deliveryFeeKobo,
        serviceFeeKobo: o.serviceFeeKobo,
        fulfillmentStatus: o.fulfillmentStatus,
        creditStatus: o.creditStatus,
        approvedAmountKobo: o.approvedAmountKobo,
        fulfilledKobo,
        reservedKobo,
        reservationStatus: o.reservation?.status ?? null,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          fulfilledQuantity: i.fulfilledQuantity,
          unitPriceKobo: i.unitPriceKobo,
          lineTotalKobo: i.lineTotalKobo,
        })),
        statusHistory: o.statusHistory.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          note: h.note,
          changedById: h.changedById,
          createdAt: h.createdAt.toISOString(),
        })),
      };
    }),
    creditAccount: employee.creditAccount
      ? {
          id: employee.creditAccount.id,
          creditLimitKobo: employee.creditAccount.creditLimitKobo,
          manualLimitOverrideKobo:
            employee.creditAccount.manualLimitOverrideKobo,
          availableKobo: employee.creditAccount.availableKobo,
          reservedKobo: employee.creditAccount.reservedKobo,
          principalOutstandingKobo:
            employee.creditAccount.principalOutstandingKobo,
          postedInterestKobo: employee.creditAccount.postedInterestKobo,
          postedFeesKobo: employee.creditAccount.postedFeesKobo,
          postedPenaltiesKobo: employee.creditAccount.postedPenaltiesKobo,
          status: employee.creditAccount.status,
          ledgerEntries: mapLedgerEntries(ledgerEntries),
        }
      : null,
    payrollLines: (employee.payrollLines ?? []).map((line) => ({
      id: line.id,
      requestedKobo: line.requestedKobo,
      collectedKobo: line.collectedKobo,
      differenceKobo: line.requestedKobo - line.collectedKobo,
      status: line.status,
      salarySnapshotKobo: line.salarySnapshotKobo,
      deductionPercentSnapshot: line.deductionPercentSnapshot,
      createdAt: line.createdAt.toISOString(),
      payrollRun: {
        id: line.payrollRun.id,
        periodStart: line.payrollRun.periodStart.toISOString(),
        periodEnd: line.payrollRun.periodEnd.toISOString(),
        payrollDate: line.payrollRun.payrollDate.toISOString(),
        status: line.payrollRun.status,
      },
    })),
  };
}
