export class CompanyListItemDto {
  id!: string;
  employerId!: string;
  name!: string;
  inviteCode!: string;
}

export class PickupPointDto {
  id!: string;
  employerId!: string;
  /** @deprecated Use `employerId`. Kept for backward compat with existing Flutter clients. */
  companyId!: string;
  label!: string;
  addressLine!: string;
  city!: string;
  state!: string | null;
  latitude!: number;
  longitude!: number;
  isActive!: boolean;
  updatedAt!: string;
}

export class EmployeePickupPointDto extends PickupPointDto {
  distanceKm!: number;
}
