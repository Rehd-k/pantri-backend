import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePickupPointDto,
  UpdatePickupPointDto,
} from './dto/pickup-point-request.dto';
import {
  CompanyListItemDto,
  PickupPointDto,
} from './dto/pickup-point-response.dto';

/** Retains the historical `Companies` name for API/route compatibility; operates on `Employer` tenants. */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanies(): Promise<CompanyListItemDto[]> {
    const rows = await this.prisma.employer.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, inviteCode: true },
    });
    return rows.map((r) => ({
      id: r.id,
      employerId: r.id,
      name: r.name,
      inviteCode: r.inviteCode,
    }));
  }

  async listPickupPoints(employerId: string): Promise<PickupPointDto[]> {
    await this.ensureEmployer(employerId);
    const rows = await this.prisma.employerPickupPoint.findMany({
      where: { employerId },
      orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async createPickupPoint(
    employerId: string,
    dto: CreatePickupPointDto,
  ): Promise<PickupPointDto> {
    await this.ensureEmployer(employerId);
    const row = await this.prisma.employerPickupPoint.create({
      data: {
        employerId,
        label: dto.label,
        addressLine: dto.addressLine,
        city: dto.city,
        state: dto.state ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toDto(row);
  }

  async updatePickupPoint(
    id: string,
    dto: UpdatePickupPointDto,
  ): Promise<PickupPointDto> {
    await this.ensurePickupPoint(id);
    const row = await this.prisma.employerPickupPoint.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.addressLine !== undefined
          ? { addressLine: dto.addressLine }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toDto(row);
  }

  async deactivatePickupPoint(id: string): Promise<PickupPointDto> {
    await this.ensurePickupPoint(id);
    const row = await this.prisma.employerPickupPoint.update({
      where: { id },
      data: { isActive: false },
    });
    return this.toDto(row);
  }

  private async ensureEmployer(employerId: string): Promise<void> {
    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
    });
    if (!employer) {
      throw new NotFoundException('Employer not found');
    }
  }

  private async ensurePickupPoint(id: string): Promise<void> {
    const point = await this.prisma.employerPickupPoint.findUnique({
      where: { id },
    });
    if (!point) {
      throw new NotFoundException('Pickup point not found');
    }
  }

  private toDto(row: {
    id: string;
    employerId: string;
    label: string;
    addressLine: string;
    city: string;
    state: string | null;
    latitude: number;
    longitude: number;
    isActive: boolean;
    updatedAt: Date;
  }): PickupPointDto {
    return {
      id: row.id,
      employerId: row.employerId,
      companyId: row.employerId,
      label: row.label,
      addressLine: row.addressLine,
      city: row.city,
      state: row.state,
      latitude: row.latitude,
      longitude: row.longitude,
      isActive: row.isActive,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
