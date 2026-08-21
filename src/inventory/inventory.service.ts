import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  HouseholdStockLedgerReason,
  Prisma,
  RestockAlertStatus,
} from '../../generated/prisma/client';
import { packCanonicalAmount, effectiveRecipeUnit } from '../measure/measure-convert';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import {
  AddHouseholdStockDto,
  HouseholdStockResponseDto,
  RestockAlertResponseDto,
  UpdateHouseholdStockDto,
} from './dto/inventory.dto';

type Tx = Prisma.TransactionClient;

const stockInclude = {
  product: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      slug: true,
      measureFamily: { select: { dimension: true } },
    },
  },
} satisfies Prisma.HouseholdStockInclude;

type StockRow = Prisma.HouseholdStockGetPayload<{ include: typeof stockInclude }>;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  async listForUser(userId: string): Promise<HouseholdStockResponseDto[]> {
    const employee = await this.requireEmployee(userId);
    const rows = await this.prisma.householdStock.findMany({
      where: { employeeId: employee.id },
      include: stockInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toStockDto(row));
  }

  async addForUser(
    userId: string,
    dto: AddHouseholdStockDto,
  ): Promise<HouseholdStockResponseDto> {
    const employee = await this.requireEmployee(userId);
    const canonical = await this.toCanonical(
      dto.productId,
      dto.quantity,
      dto.measureUnitId,
    );
    const row = await this.prisma.$transaction(async (tx) => {
      return this.applyDelta(tx, {
        employeeId: employee.id,
        productId: dto.productId,
        deltaCanonical: canonical,
        reason: HouseholdStockLedgerReason.MANUAL_ADD,
      });
    });
    return this.toStockDto(row);
  }

  async updateForUser(
    userId: string,
    stockId: string,
    dto: UpdateHouseholdStockDto,
  ): Promise<HouseholdStockResponseDto> {
    const employee = await this.requireEmployee(userId);
    const existing = await this.prisma.householdStock.findFirst({
      where: { id: stockId, employeeId: employee.id },
    });
    if (!existing) {
      throw new NotFoundException('Pantry item not found');
    }
    if (
      dto.quantityCanonical === undefined &&
      dto.restockThresholdCanonical === undefined
    ) {
      throw new BadRequestException('No fields to update');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.quantityCanonical !== undefined) {
        const delta = dto.quantityCanonical - existing.quantityCanonical;
        if (delta !== 0) {
          return this.applyDelta(tx, {
            employeeId: employee.id,
            productId: existing.productId,
            deltaCanonical: delta,
            reason: HouseholdStockLedgerReason.MANUAL_ADJUST,
            stockId: existing.id,
          });
        }
      }
      if (dto.restockThresholdCanonical !== undefined) {
        await tx.householdStock.update({
          where: { id: existing.id },
          data: { restockThresholdCanonical: dto.restockThresholdCanonical },
        });
      }
      return tx.householdStock.findUniqueOrThrow({
        where: { id: existing.id },
        include: stockInclude,
      });
    });
    return this.toStockDto(row);
  }

  async listAlertsForUser(userId: string): Promise<RestockAlertResponseDto[]> {
    const employee = await this.requireEmployee(userId);
    const rows = await this.prisma.restockAlert.findMany({
      where: { employeeId: employee.id, status: RestockAlertStatus.OPEN },
      include: {
        stock: {
          include: {
            product: { select: { name: true, imageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((row) => this.toAlertDto(row)));
  }

  async stockUpAlert(
    userId: string,
    alertId: string,
  ): Promise<RestockAlertResponseDto> {
    const employee = await this.requireEmployee(userId);
    const alert = await this.prisma.restockAlert.findFirst({
      where: { id: alertId, employeeId: employee.id },
      include: {
        stock: {
          include: { product: { select: { name: true, imageUrl: true } } },
        },
      },
    });
    if (!alert) {
      throw new NotFoundException('Restock alert not found');
    }
    const pack = await this.cheapestPack(alert.productId);
    if (!pack) {
      throw new BadRequestException('No sellable pack found for this product');
    }
    await this.cartService.addItem(userId, { packId: pack.id, quantity: 1 });
    const updated = await this.prisma.restockAlert.update({
      where: { id: alert.id },
      data: {
        status: RestockAlertStatus.ADDED_TO_CART,
        resolvedAt: new Date(),
      },
      include: {
        stock: {
          include: { product: { select: { name: true, imageUrl: true } } },
        },
      },
    });
    return this.toAlertDto(updated, pack);
  }

  async dismissAlert(userId: string, alertId: string): Promise<RestockAlertResponseDto> {
    const employee = await this.requireEmployee(userId);
    const alert = await this.prisma.restockAlert.findFirst({
      where: { id: alertId, employeeId: employee.id },
    });
    if (!alert) {
      throw new NotFoundException('Restock alert not found');
    }
    const updated = await this.prisma.restockAlert.update({
      where: { id: alert.id },
      data: {
        status: RestockAlertStatus.DISMISSED,
        resolvedAt: new Date(),
      },
      include: {
        stock: {
          include: { product: { select: { name: true, imageUrl: true } } },
        },
      },
    });
    return this.toAlertDto(updated);
  }

  async creditFulfilledItems(
    tx: Tx,
    employeeId: string,
    lines: Array<{
      productId: string;
      packId: string | null;
      fulfilledQuantity: number;
    }>,
    orderId: string,
  ): Promise<void> {
    for (const line of lines) {
      if (!line.packId || line.fulfilledQuantity <= 0) continue;
      const pack = await tx.productPack.findUnique({
        where: { id: line.packId },
      });
      if (!pack) {
        this.logger.warn(`Fulfill credit skipped: pack ${line.packId} missing`);
        continue;
      }
      const size = packCanonicalAmount(pack);
      if (size <= 0) {
        this.logger.warn(
          `Fulfill credit skipped: pack ${line.packId} has no canonical size`,
        );
        continue;
      }
      await this.applyDelta(tx, {
        employeeId,
        productId: line.productId,
        deltaCanonical: size * line.fulfilledQuantity,
        reason: HouseholdStockLedgerReason.ORDER_FULFILLED,
        orderId,
      });
    }
  }

  async applyDelta(
    tx: Tx,
    input: {
      employeeId: string;
      productId: string;
      deltaCanonical: number;
      reason: HouseholdStockLedgerReason;
      stockId?: string;
      orderId?: string;
      cookedMealId?: string;
      note?: string;
    },
  ): Promise<StockRow> {
    const product = await tx.marketplaceProduct.findUnique({
      where: { id: input.productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let stock = input.stockId
      ? await tx.householdStock.findUnique({ where: { id: input.stockId } })
      : await tx.householdStock.findUnique({
          where: {
            employeeId_productId: {
              employeeId: input.employeeId,
              productId: input.productId,
            },
          },
        });

    if (!stock) {
      stock = await tx.householdStock.create({
        data: {
          employeeId: input.employeeId,
          productId: input.productId,
          quantityCanonical: 0,
        },
      });
    }

    const nextQty = Math.max(0, stock.quantityCanonical + input.deltaCanonical);
    const updated = await tx.householdStock.update({
      where: { id: stock.id },
      data: { quantityCanonical: nextQty },
      include: stockInclude,
    });

    await tx.householdStockLedger.create({
      data: {
        stockId: stock.id,
        reason: input.reason,
        deltaCanonical: input.deltaCanonical,
        orderId: input.orderId,
        cookedMealId: input.cookedMealId,
        note: input.note,
      },
    });

    if (nextQty <= updated.restockThresholdCanonical) {
      const open = await tx.restockAlert.findFirst({
        where: {
          stockId: stock.id,
          status: RestockAlertStatus.OPEN,
        },
      });
      if (!open) {
        await tx.restockAlert.create({
          data: {
            employeeId: input.employeeId,
            stockId: stock.id,
            productId: input.productId,
            status: RestockAlertStatus.OPEN,
          },
        });
      }
    } else {
      await tx.restockAlert.updateMany({
        where: {
          stockId: stock.id,
          status: RestockAlertStatus.OPEN,
        },
        data: {
          status: RestockAlertStatus.DISMISSED,
          resolvedAt: new Date(),
        },
      });
    }

    return updated;
  }

  private async toCanonical(
    productId: string,
    quantity: number,
    measureUnitId?: string,
  ): Promise<number> {
    const product = await this.prisma.marketplaceProduct.findUnique({
      where: { id: productId },
      include: {
        recipeUnit: true,
        measureFamily: { include: { defaultRecipeUnit: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const unit = measureUnitId
      ? await this.prisma.measureUnit.findUnique({ where: { id: measureUnitId } })
      : effectiveRecipeUnit(product);
    if (!unit) {
      throw new BadRequestException('No measure unit available for this product');
    }
    const perUnit =
      product.recipeUnitOverrideMg ??
      product.recipeUnitOverrideMl ??
      unit.milligrams ??
      unit.millilitres ??
      unit.piecesPerUnit ??
      0;
    if (perUnit <= 0) {
      throw new BadRequestException('Measure unit has no canonical size');
    }
    return quantity * perUnit;
  }

  private async cheapestPack(productId: string) {
    return this.prisma.productPack.findFirst({
      where: { productId, isActive: true, product: { isActive: true } },
      orderBy: [{ priceKobo: 'asc' }, { packAmount: 'asc' }],
    });
  }

  private async requireEmployee(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }
    return employee;
  }

  toStockDto(row: StockRow): HouseholdStockResponseDto {
    const dimension = row.product.measureFamily.dimension;
    const formatted = formatCanonical(row.quantityCanonical, dimension);
    return {
      id: row.id,
      employeeId: row.employeeId,
      productId: row.productId,
      product: {
        id: row.product.id,
        name: row.product.name,
        imageUrl: row.product.imageUrl,
        slug: row.product.slug,
      },
      quantityCanonical: row.quantityCanonical,
      restockThresholdCanonical: row.restockThresholdCanonical,
      displayQuantity: formatted.quantity,
      displayUnit: formatted.unit,
      isLow: row.quantityCanonical <= row.restockThresholdCanonical,
      isEmpty: row.quantityCanonical <= 0,
      dimension,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async toAlertDto(
    row: {
      id: string;
      employeeId: string;
      stockId: string;
      productId: string;
      status: RestockAlertStatus;
      createdAt: Date;
      updatedAt: Date;
      stock: {
        quantityCanonical: number;
        product: { name: string; imageUrl: string };
      };
    },
    pack?: { id: string; packageLabel: string } | null,
  ): Promise<RestockAlertResponseDto> {
    const suggested = pack ?? (await this.cheapestPack(row.productId));
    return {
      id: row.id,
      employeeId: row.employeeId,
      stockId: row.stockId,
      productId: row.productId,
      productName: row.stock.product.name,
      productImageUrl: row.stock.product.imageUrl,
      status: row.status,
      quantityCanonical: row.stock.quantityCanonical,
      suggestedPackId: suggested?.id ?? null,
      suggestedPackLabel: suggested?.packageLabel ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function formatCanonical(
  quantityCanonical: number,
  dimension: string,
): { quantity: string; unit: string } {
  if (dimension === 'VOLUME') {
    if (quantityCanonical >= 1000) {
      return {
        quantity: trimNumber(quantityCanonical / 1000),
        unit: 'L',
      };
    }
    return { quantity: String(quantityCanonical), unit: 'ml' };
  }
  if (dimension === 'COUNT') {
    return { quantity: String(quantityCanonical), unit: 'pcs' };
  }
  if (quantityCanonical >= 1_000_000) {
    return {
      quantity: trimNumber(quantityCanonical / 1_000_000),
      unit: 'kg',
    };
  }
  return {
    quantity: trimNumber(quantityCanonical / 1000),
    unit: 'g',
  };
}

function trimNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}
