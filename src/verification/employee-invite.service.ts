import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  EmployeeInvite,
  EmployeeInviteStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeInviteDto } from './dto/verification.dto';
import { EmployeeInviteResponseDto } from './dto/verification-response.dto';

@Injectable()
export class EmployeeInviteService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvite(
    employerId: string,
    createdById: string,
    dto: CreateEmployeeInviteDto,
  ): Promise<EmployeeInviteResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const pending = await this.prisma.employeeInvite.findFirst({
      where: {
        employerId,
        email,
        status: EmployeeInviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
    if (pending) {
      throw new ConflictException(
        'A pending invite already exists for this email',
      );
    }

    const expiresInDays = dto.expiresInDays ?? 14;
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );
    const code = await this.generateUniqueCode();

    const invite = await this.prisma.employeeInvite.create({
      data: {
        employerId,
        code,
        email,
        phone: dto.phone?.trim() || null,
        expiresAt,
        createdById,
      },
    });

    return this.toDto(invite);
  }

  async listInvites(employerId: string): Promise<EmployeeInviteResponseDto[]> {
    await this.expireStaleInvites(employerId);
    const invites = await this.prisma.employeeInvite.findMany({
      where: { employerId },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map((i) => this.toDto(i));
  }

  async revokeInvite(
    employerId: string,
    inviteId: string,
  ): Promise<EmployeeInviteResponseDto> {
    const invite = await this.prisma.employeeInvite.findFirst({
      where: { id: inviteId, employerId },
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.status !== EmployeeInviteStatus.PENDING) {
      throw new BadRequestException(
        `Cannot revoke invite in status ${invite.status}`,
      );
    }
    const updated = await this.prisma.employeeInvite.update({
      where: { id: inviteId },
      data: { status: EmployeeInviteStatus.REVOKED },
    });
    return this.toDto(updated);
  }

  async consumeInvite(params: {
    code: string;
    email: string;
    phone?: string | null;
    userId: string;
    employeeId: string;
  }): Promise<EmployeeInvite> {
    const code = params.code.trim().toUpperCase();
    const email = params.email.toLowerCase().trim();

    const invite = await this.prisma.employeeInvite.findUnique({
      where: { code },
    });
    if (!invite) {
      throw new NotFoundException('Invalid employee invite code');
    }
    if (invite.status !== EmployeeInviteStatus.PENDING) {
      throw new BadRequestException(
        `Invite is no longer valid (${invite.status.toLowerCase()})`,
      );
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      await this.prisma.employeeInvite.update({
        where: { id: invite.id },
        data: { status: EmployeeInviteStatus.EXPIRED },
      });
      throw new BadRequestException('Invite has expired');
    }
    if (invite.email.toLowerCase() !== email) {
      throw new BadRequestException(
        'This invite is bound to a different email address',
      );
    }
    if (
      invite.phone &&
      params.phone &&
      invite.phone.replace(/\D/g, '') !== params.phone.replace(/\D/g, '')
    ) {
      throw new BadRequestException(
        'This invite is bound to a different phone number',
      );
    }

    return this.prisma.employeeInvite.update({
      where: { id: invite.id },
      data: {
        status: EmployeeInviteStatus.USED,
        usedAt: new Date(),
        usedByUserId: params.userId,
        employeeId: params.employeeId,
      },
    });
  }

  async findValidInviteByCode(code: string): Promise<EmployeeInvite> {
    const invite = await this.prisma.employeeInvite.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!invite) {
      throw new NotFoundException('Invalid employee invite code');
    }
    if (invite.status !== EmployeeInviteStatus.PENDING) {
      throw new BadRequestException(
        `Invite is no longer valid (${invite.status.toLowerCase()})`,
      );
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      await this.prisma.employeeInvite.update({
        where: { id: invite.id },
        data: { status: EmployeeInviteStatus.EXPIRED },
      });
      throw new BadRequestException('Invite has expired');
    }
    return invite;
  }

  private async expireStaleInvites(employerId: string): Promise<void> {
    await this.prisma.employeeInvite.updateMany({
      where: {
        employerId,
        status: EmployeeInviteStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: EmployeeInviteStatus.EXPIRED },
    });
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.prisma.employeeInvite.findUnique({
        where: { code },
      });
      if (!existing) {
        return code;
      }
    }
    throw new ConflictException('Unable to generate a unique invite code');
  }

  toDto(invite: EmployeeInvite): EmployeeInviteResponseDto {
    return {
      id: invite.id,
      employerId: invite.employerId,
      code: invite.code,
      email: invite.email,
      phone: invite.phone,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
      usedAt: invite.usedAt?.toISOString() ?? null,
      employeeId: invite.employeeId,
      createdAt: invite.createdAt.toISOString(),
    };
  }
}
