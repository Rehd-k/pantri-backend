import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class RequestWriteOffDto {
  @IsString()
  @IsNotEmpty()
  creditAccountId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountKobo!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
