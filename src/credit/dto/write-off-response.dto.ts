import { WriteOffStatus } from '../../../generated/prisma/client';
import { WriteOffWithRelations } from '../application/write-off.service';

export class WriteOffResponseDto {
  id!: string;
  creditAccountId!: string;
  employeeId!: string | null;
  employeeName!: string | null;
  employerName!: string | null;
  amountKobo!: number;
  reason!: string;
  status!: WriteOffStatus;
  requestedById!: string;
  requestedByName!: string | null;
  approvedById!: string | null;
  approvedByName!: string | null;
  createdAt!: string;
  updatedAt!: string;
}

function fullName(
  user?: { firstName: string; lastName: string } | null,
): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

export function toWriteOffResponseDto(
  request: WriteOffWithRelations,
): WriteOffResponseDto {
  const employee = request.creditAccount?.employee ?? null;
  return {
    id: request.id,
    creditAccountId: request.creditAccountId,
    employeeId: employee?.id ?? null,
    employeeName: fullName(employee?.user ?? null),
    employerName: employee?.employer?.name ?? null,
    amountKobo: request.amountKobo,
    reason: request.reason,
    status: request.status,
    requestedById: request.requestedById,
    requestedByName: fullName(request.requestedBy ?? null),
    approvedById: request.approvedById,
    approvedByName: fullName(request.approvedBy ?? null),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
