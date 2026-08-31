import { UserRole, UserStatus } from '../../../generated/prisma/client';

export class AuthUserDto {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  role!: UserRole;
  status!: UserStatus;
  employerId!: string | null;
  employerName!: string | null;
  employerInviteCode!: string | null;
  /** @deprecated Use `employerId`. Kept populated for backward compat with existing Flutter clients. */
  companyId!: string | null;
  /** @deprecated Use `employerName`. */
  companyName!: string | null;
  /** @deprecated Use `employerInviteCode`. */
  companyInviteCode!: string | null;
  businessName!: string | null;
  fleetName!: string | null;
  /** Present for employees  verification gate for credit. */
  employeeId!: string | null;
  verificationStatus!: string | null;
  phone!: string | null;
}
