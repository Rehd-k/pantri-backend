import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PayrollInvoiceSigner = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type SignedPayrollInvoiceResult = {
  buffer: Buffer;
  filename: string;
  documentHash: string;
};

@Injectable()
export class PayrollInvoicePdfService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSignedInvoice(
    runId: string,
    signer: PayrollInvoiceSigner,
  ): Promise<SignedPayrollInvoiceResult> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        employer: { select: { id: true, name: true } },
        lines: {
          include: {
            employee: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    const expectedKobo = run.lines.reduce((s, l) => s + l.requestedKobo, 0);
    const receivedKobo = run.lines.reduce((s, l) => s + l.collectedKobo, 0);
    const differenceKobo = expectedKobo - receivedKobo;
    const signedAt = new Date();

    const linePayload = run.lines.map((line) => ({
      employeeId: line.employeeId,
      expectedKobo: line.requestedKobo,
      actualKobo: line.collectedKobo,
      status: line.status,
    }));

    const canonical = this.canonicalJson({
      runId: run.id,
      employerId: run.employerId,
      employerName: run.employer.name,
      periodStart: run.periodStart.toISOString(),
      periodEnd: run.periodEnd.toISOString(),
      payrollDate: run.payrollDate.toISOString(),
      status: run.status,
      expectedKobo,
      receivedKobo,
      differenceKobo,
      lines: linePayload,
    });
    const documentHash = createHash('sha256').update(canonical).digest('hex');

    await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        invoiceDocumentHash: documentHash,
        invoiceSignedAt: signedAt,
        invoiceSignedById: signer.id,
      },
    });

    const buffer = await this.renderPdf({
      runId: run.id,
      employerName: run.employer.name,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      payrollDate: run.payrollDate,
      status: run.status,
      expectedKobo,
      receivedKobo,
      differenceKobo,
      lines: run.lines.map((line) => ({
        employeeName:
          `${line.employee.user.firstName} ${line.employee.user.lastName}`.trim(),
        expectedKobo: line.requestedKobo,
        actualKobo: line.collectedKobo,
        differenceKobo: line.requestedKobo - line.collectedKobo,
        status: line.status,
      })),
      signer,
      signedAt,
      documentHash,
    });

    const dateSlug = run.payrollDate.toISOString().slice(0, 10);
    const employerSlug = this.slugify(run.employer.name);
    const filename = `pantri-payroll-invoice-${employerSlug}-${dateSlug}.pdf`;

    return { buffer, filename, documentHash };
  }

  private canonicalJson(value: unknown): string {
    return JSON.stringify(this.sortKeys(value));
  }

  private sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortKeys(item));
    }
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => a.localeCompare(b),
      );
      const sorted: Record<string, unknown> = {};
      for (const [key, nested] of entries) {
        sorted[key] = this.sortKeys(nested);
      }
      return sorted;
    }
    return value;
  }

  private slugify(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'company';
  }

  private formatNaira(kobo: number): string {
    return `₦${(kobo / 100).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private async renderPdf(input: {
    runId: string;
    employerName: string;
    periodStart: Date;
    periodEnd: Date;
    payrollDate: Date;
    status: string;
    expectedKobo: number;
    receivedKobo: number;
    differenceKobo: number;
    lines: Array<{
      employeeName: string;
      expectedKobo: number;
      actualKobo: number;
      differenceKobo: number;
      status: string;
    }>;
    signer: PayrollInvoiceSigner;
    signedAt: Date;
    documentHash: string;
  }): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Pantri', { continued: false });
      doc.fontSize(14).text('Payroll Deduction Invoice', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#444444');
      doc.text(`Run ID: ${input.runId}`);
      doc.text(`Status: ${input.status}`);
      doc.moveDown();

      doc.fillColor('#000000').fontSize(12).text('Company');
      doc.fontSize(10).fillColor('#333333');
      doc.text(input.employerName);
      doc.text(
        `Period: ${this.formatDate(input.periodStart)} – ${this.formatDate(input.periodEnd)}`,
      );
      doc.text(`Payroll date: ${this.formatDate(input.payrollDate)}`);
      doc.moveDown();

      doc.fillColor('#000000').fontSize(12).text('Deduction lines');
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor('#111111');

      const drawRow = (
        employee: string,
        expected: string,
        actual: string,
        diff: string,
        status: string,
        bold = false,
      ) => {
        if (doc.y > 720) {
          doc.addPage();
        }
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        const y = doc.y;
        doc.text(employee, 50, y, { width: 160, ellipsis: true });
        doc.text(expected, 220, y, { width: 75 });
        doc.text(actual, 300, y, { width: 75 });
        doc.text(diff, 380, y, { width: 75 });
        doc.text(status, 460, y, { width: 85 });
        doc.y = y + 14;
      };

      drawRow('Employee', 'Expected', 'Actual', 'Diff', 'Status', true);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#cccccc')
        .stroke();
      doc.moveDown(0.25);

      for (const line of input.lines) {
        drawRow(
          line.employeeName || '—',
          this.formatNaira(line.expectedKobo),
          this.formatNaira(line.actualKobo),
          this.formatNaira(line.differenceKobo),
          line.status,
        );
      }

      doc.moveDown();
      doc.fillColor('#000000').fontSize(12).text('Totals');
      doc.fontSize(10).fillColor('#333333');
      doc.text(`Expected: ${this.formatNaira(input.expectedKobo)}`);
      doc.text(`Received: ${this.formatNaira(input.receivedKobo)}`);
      doc.text(`Difference: ${this.formatNaira(input.differenceKobo)}`);
      doc.moveDown(1.5);

      doc.fillColor('#000000').fontSize(12).text('Digital issuance');
      doc.fontSize(10).fillColor('#333333');
      doc.text('Digitally issued by Pantri');
      const signerName =
        `${input.signer.firstName} ${input.signer.lastName}`.trim() ||
        input.signer.email;
      doc.text(`Signed by: ${signerName} <${input.signer.email}>`);
      doc.text(`Issued at: ${input.signedAt.toISOString()}`);
      doc.text(`Document hash (SHA-256): ${input.documentHash}`);

      doc.end();
    });
  }
}
