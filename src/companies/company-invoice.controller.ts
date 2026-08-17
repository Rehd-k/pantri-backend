import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CompanyInvoiceService } from './company-invoice.service';
import { GenerateCompanyInvoiceDto } from './dto/generate-company-invoice.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCompanyInvoiceController {
  constructor(private readonly invoices: CompanyInvoiceService) {}

  @Post('companies/:companyId/invoices/generate')
  generate(
    @CurrentUser() user: AuthUserPayload,
    @Param('companyId') companyId: string,
    @Body() dto: GenerateCompanyInvoiceDto,
  ) {
    return this.invoices.generate(companyId, user.id, dto);
  }

  @Get('companies/:companyId/invoices')
  list(@Param('companyId') companyId: string) {
    return this.invoices.listAdminInvoices(companyId);
  }

  @Get('invoices/:id')
  get(@Param('id') id: string) {
    return this.invoices.getAdminInvoice(id);
  }

  @Get('invoices/:id/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="company-invoice.csv"')
  csv(@Param('id') id: string): Promise<string> {
    return this.invoices.exportCsv(id);
  }
}

@Controller('employer/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER)
export class EmployerCompanyInvoiceController {
  constructor(private readonly invoices: CompanyInvoiceService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.invoices.listEmployerInvoices(user.id);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ) {
    return this.invoices.getEmployerInvoice(user.id, id);
  }
}
