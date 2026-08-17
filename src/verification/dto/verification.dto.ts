import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEmployeeInviteDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** Days until the invite expires (default 14). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;
}

export class AttachVerificationDocumentDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  type!: 'EMPLOYMENT_PROOF' | 'PAYROLL_PROOF' | 'OTHER';

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  imageKitFileId?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ApproveEmployeeVerificationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  salaryKobo!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(100_000)
  creditMultiplierBps!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}

export class RejectEmployeeVerificationDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class TransitionOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
