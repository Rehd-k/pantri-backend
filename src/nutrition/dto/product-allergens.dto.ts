import {
  ArrayMaxSize,
  IsArray,
  IsString,
} from 'class-validator';

export class SetProductAllergensDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  allergyIds!: string[];
}
