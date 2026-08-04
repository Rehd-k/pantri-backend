/**
 * Domain-layer enum mirrors and value objects for the credit engine.
 *
 * The domain layer must not depend on infrastructure (the generated Prisma
 * client) so that money/payoff math stays pure and unit-testable without a
 * database. These string unions are structurally identical to the Prisma
 * enums declared in `schema.prisma`, so values coming from the generated
 * client (e.g. `LedgerEntryType.PURCHASE_POSTED`) are assignable to these
 * types without casting.
 *
 * If `schema.prisma`'s enums change, update these mirrors to match.
 */

export const LedgerEntryType = {
  RESERVATION_CREATED: 'RESERVATION_CREATED',
  RESERVATION_RELEASED: 'RESERVATION_RELEASED',
  PURCHASE_POSTED: 'PURCHASE_POSTED',
  DELIVERY_FEE: 'DELIVERY_FEE',
  SERVICE_FEE: 'SERVICE_FEE',
  INTEREST: 'INTEREST',
  PENALTY: 'PENALTY',
  PAYROLL_REPAYMENT: 'PAYROLL_REPAYMENT',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
  CREDIT_LIMIT_ADJUSTMENT: 'CREDIT_LIMIT_ADJUSTMENT',
  WRITE_OFF: 'WRITE_OFF',
  MANUAL_CREDIT: 'MANUAL_CREDIT',
  MANUAL_DEBIT: 'MANUAL_DEBIT',
  MIGRATION: 'MIGRATION',
} as const;
export type LedgerEntryType =
  (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const ProductType = {
  FOOD: 'FOOD',
  ELECTRONICS: 'ELECTRONICS',
  RENT: 'RENT',
  SCHOOL_FEES: 'SCHOOL_FEES',
  HEALTH: 'HEALTH',
  OTHER: 'OTHER',
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const CreditAccountStatus = {
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
} as const;
export type CreditAccountStatus =
  (typeof CreditAccountStatus)[keyof typeof CreditAccountStatus];

export const CreditReservationStatus = {
  ACTIVE: 'ACTIVE',
  PARTIALLY_CAPTURED: 'PARTIALLY_CAPTURED',
  CAPTURED: 'CAPTURED',
  RELEASED: 'RELEASED',
  EXPIRED: 'EXPIRED',
} as const;
export type CreditReservationStatus =
  (typeof CreditReservationStatus)[keyof typeof CreditReservationStatus];

export const WriteOffStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
} as const;
export type WriteOffStatus =
  (typeof WriteOffStatus)[keyof typeof WriteOffStatus];

/**
 * Snapshot of the numeric balance fields on `CreditAccount` needed to run
 * domain calculations (available credit, payoff simulation, etc).
 */
export interface CreditAccountBalances {
  creditLimitKobo: number;
  principalOutstandingKobo: number;
  postedInterestKobo: number;
  postedFeesKobo: number;
  postedPenaltiesKobo: number;
  reservedKobo: number;
}
