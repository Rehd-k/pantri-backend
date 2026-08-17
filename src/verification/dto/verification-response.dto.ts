import {
  EmployeeInviteStatus,
  EmployeeVerificationStatus,
  OrderFulfillmentStatus,
  VerificationDocumentStatus,
  VerificationDocumentType,
} from '../../../generated/prisma/client';

export class EmployeeInviteResponseDto {
  id!: string;
  employerId!: string;
  code!: string;
  email!: string;
  phone!: string | null;
  status!: EmployeeInviteStatus;
  expiresAt!: string;
  usedAt!: string | null;
  employeeId!: string | null;
  createdAt!: string;
}

export class VerificationDocumentResponseDto {
  id!: string;
  employeeId!: string;
  type!: VerificationDocumentType;
  status!: VerificationDocumentStatus;
  fileName!: string;
  fileUrl!: string;
  mimeType!: string | null;
  note!: string | null;
  createdAt!: string;
}

export class EmployeeVerificationResponseDto {
  id!: string;
  userId!: string;
  employerId!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  phone!: string | null;
  verificationStatus!: EmployeeVerificationStatus;
  salaryKobo!: number;
  creditMultiplierBps!: number | null;
  rejectionReason!: string | null;
  verifiedAt!: string | null;
  documents!: VerificationDocumentResponseDto[];
  createdAt!: string;
}

export class OrderStatusHistoryDto {
  id!: string;
  fromStatus!: OrderFulfillmentStatus | null;
  toStatus!: OrderFulfillmentStatus;
  note!: string | null;
  changedById!: string | null;
  createdAt!: string;
}
