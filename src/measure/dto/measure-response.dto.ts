import {
  MeasureDimension,
  MeasureKind,
} from '../../../generated/prisma/client';

export class MeasureUnitResponseDto {
  id!: string;
  slug!: string;
  name!: string;
  shortLabel!: string;
  kind!: MeasureKind;
  dimension!: MeasureDimension;
  milligrams!: number | null;
  millilitres!: number | null;
  piecesPerUnit!: number | null;
  isPurchaseUnit!: boolean;
  isRecipeUnit!: boolean;
  sortOrder!: number;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

export class MeasureFamilyResponseDto {
  id!: string;
  slug!: string;
  name!: string;
  description!: string;
  dimension!: MeasureDimension;
  defaultRecipeUnitId!: string | null;
  defaultPurchaseUnitId!: string | null;
  defaultRecipeUnit!: MeasureUnitResponseDto | null;
  defaultPurchaseUnit!: MeasureUnitResponseDto | null;
  sortOrder!: number;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
}
