import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  maxInterestAnnualRateBps?: number;

  @IsOptional()
  @IsBoolean()
  penaltiesEnabledGlobal?: boolean;
}
