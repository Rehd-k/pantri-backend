import { IsNotEmpty, IsString } from 'class-validator';

export class PerfectForItemDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  imageUrl!: string;
}
