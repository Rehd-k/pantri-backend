import { PlatformSettings } from '../../../generated/prisma/client';

export class PlatformSettingsResponseDto {
  id!: string;
  maxInterestAnnualRateBps!: number;
  penaltiesEnabledGlobal!: boolean;
  updatedAt!: string;
}

export function toPlatformSettingsResponseDto(
  settings: PlatformSettings,
): PlatformSettingsResponseDto {
  return {
    id: settings.id,
    maxInterestAnnualRateBps: settings.maxInterestAnnualRateBps,
    penaltiesEnabledGlobal: settings.penaltiesEnabledGlobal,
    updatedAt: settings.updatedAt.toISOString(),
  };
}
