import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AnalyticsIngestionSource } from '../../generated/prisma/client';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { IngestAnalyticsEventsDto } from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsIngestController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('events')
  @UseGuards(OptionalJwtAuthGuard)
  async ingest(
    @Body() dto: IngestAnalyticsEventsDto,
    @Req() req: { user?: AuthUserPayload | null },
  ): Promise<{ accepted: number; rejected: number }> {
    const user = req.user ?? null;
    let employeeId: string | null = null;
    let employerId: string | null = user?.employerId ?? null;

    if (user) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: user.id },
        select: { id: true, employerId: true },
      });
      if (employee) {
        employeeId = employee.id;
        employerId = employee.employerId;
      } else if (!employerId) {
        const membership = await this.prisma.employerMembership.findFirst({
          where: { userId: user.id },
          select: { employerId: true },
        });
        employerId = membership?.employerId ?? null;
      }
    }

    const batch = dto.events.map((e) => ({
      eventName: e.eventName,
      occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
      userId: user?.id ?? null,
      employeeId: e.employeeId ?? employeeId,
      employerId: e.employerId ?? employerId,
      sessionId: e.sessionId ?? null,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      platform: e.platform ?? null,
      appVersion: e.appVersion ?? null,
      metadata: e.metadata ?? {},
      ingestionSource: AnalyticsIngestionSource.CLIENT,
    }));

    return this.analytics.trackBatch(batch);
  }
}
