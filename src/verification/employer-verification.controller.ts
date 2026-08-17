import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EmployerCreditService } from '../credit/application/employer-credit.service';
import { MediaService } from '../media/media.service';
import { CreateEmployeeInviteDto } from './dto/verification.dto';
import {
  EmployeeInviteResponseDto,
  EmployeeVerificationResponseDto,
  VerificationDocumentResponseDto,
} from './dto/verification-response.dto';
import { EmployeeInviteService } from './employee-invite.service';
import { EmployeeVerificationService } from './employee-verification.service';
import {
  AttachVerificationDocumentDto,
} from './dto/verification.dto';

@Controller('employer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class EmployerVerificationController {
  constructor(
    private readonly invites: EmployeeInviteService,
    private readonly verification: EmployeeVerificationService,
    private readonly employerCredit: EmployerCreditService,
    private readonly media: MediaService,
  ) {}

  @Post('invites')
  async createInvite(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateEmployeeInviteDto,
  ): Promise<EmployeeInviteResponseDto> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    return this.invites.createInvite(employerId, user.id, dto);
  }

  @Get('invites')
  async listInvites(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<EmployeeInviteResponseDto[]> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    return this.invites.listInvites(employerId);
  }

  @Patch('invites/:id/revoke')
  async revokeInvite(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<EmployeeInviteResponseDto> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    return this.invites.revokeInvite(employerId, id);
  }

  @Get('verification/employees')
  async listEmployees(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<EmployeeVerificationResponseDto[]> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    return this.verification.listForEmployer(employerId);
  }

  @Get('verification/employees/:employeeId')
  async getEmployee(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
  ): Promise<EmployeeVerificationResponseDto> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    return this.verification.getEmployee(employeeId, employerId);
  }

  @Post('verification/documents')
  async attachDocument(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: AttachVerificationDocumentDto,
  ): Promise<VerificationDocumentResponseDto> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    return this.verification.attachDocument(user.id, employerId, dto);
  }

  @Post('verification/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndAttach(
    @CurrentUser() user: AuthUserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      employeeId: string;
      type: 'EMPLOYMENT_PROOF' | 'PAYROLL_PROOF' | 'OTHER';
      note?: string;
    },
  ): Promise<VerificationDocumentResponseDto> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    const uploaded = await this.media.uploadBuffer(
      file,
      '/pantri/verification',
    );
    return this.verification.attachDocument(user.id, employerId, {
      employeeId: body.employeeId,
      type: body.type,
      fileName: uploaded.name,
      fileUrl: uploaded.url,
      imageKitFileId: uploaded.fileId,
      note: body.note,
    });
  }

  @Post('verification/employees/:employeeId/submit')
  async submitDocs(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
  ): Promise<EmployeeVerificationResponseDto> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    return this.verification.submitDocuments(employeeId, employerId);
  }
}
