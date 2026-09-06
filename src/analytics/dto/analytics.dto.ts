import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AnalyticsEventItemDto {
  @IsString()
  @MaxLength(120)
  eventName!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  employerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  employeeId?: string;
}

export class IngestAnalyticsEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventItemDto)
  events!: AnalyticsEventItemDto[];
}

export class AnalyticsDateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  employerId?: string;

  @IsOptional()
  @IsIn(['previous_period', 'previous_year', 'none'])
  compare?: 'previous_period' | 'previous_year' | 'none';

  @IsOptional()
  @IsString()
  segmentKey?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  orderStatus?: string;
}

export class AnalyticsExplorerQueryDto extends AnalyticsDateRangeQueryDto {
  @IsOptional()
  @IsString()
  eventName?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @IsIn(['events', 'metrics'])
  mode?: 'events' | 'metrics';

  @IsOptional()
  @IsIn(['revenue', 'orders', 'aov', 'active_users'])
  metric?: 'revenue' | 'orders' | 'aov' | 'active_users';

  @IsOptional()
  @IsIn(['employer', 'month', 'category'])
  breakdown?: 'employer' | 'month' | 'category';
}

export class AnalyticsExportQueryDto extends AnalyticsDateRangeQueryDto {
  @IsOptional()
  @IsIn(['overview', 'orders', 'events', 'products', 'search', 'employers', 'segments'])
  report?:
    | 'overview'
    | 'orders'
    | 'events'
    | 'products'
    | 'search'
    | 'employers'
    | 'segments';

  @IsOptional()
  @IsIn(['csv', 'xlsx', 'pdf'])
  format?: 'csv' | 'xlsx' | 'pdf';
}

export class AnalyticsWhyQueryDto extends AnalyticsDateRangeQueryDto {
  @IsOptional()
  @IsIn(['revenue', 'orders', 'aov', 'active_users'])
  metric?: 'revenue' | 'orders' | 'aov' | 'active_users';
}

export class AnalyticsCohortsQueryDto extends AnalyticsDateRangeQueryDto {
  @IsOptional()
  @IsIn(['first_purchase', 'signup', 'employer_onboard'])
  cohortType?: 'first_purchase' | 'signup' | 'employer_onboard';
}
