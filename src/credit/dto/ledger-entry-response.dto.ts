import {
  LedgerEntry,
  LedgerEntryType,
  ProductType,
} from '../../../generated/prisma/client';

export class LedgerEntryResponseDto {
  id!: string;
  sequence!: number;
  entryType!: LedgerEntryType;
  amountKobo!: number;
  balanceAfterKobo!: number;
  reservedAfterKobo!: number;
  productType!: ProductType | null;
  referenceType!: string | null;
  referenceId!: string | null;
  createdAt!: string;
}

export function toLedgerEntryResponseDto(
  entry: LedgerEntry,
): LedgerEntryResponseDto {
  return {
    id: entry.id,
    sequence: entry.sequence,
    entryType: entry.entryType,
    amountKobo: entry.amountKobo,
    balanceAfterKobo: entry.balanceAfterKobo,
    reservedAfterKobo: entry.reservedAfterKobo,
    productType: entry.productType,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    createdAt: entry.createdAt.toISOString(),
  };
}
