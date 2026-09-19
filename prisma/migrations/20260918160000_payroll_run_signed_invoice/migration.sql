-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN "invoiceDocumentHash" TEXT,
ADD COLUMN "invoiceSignedAt" TIMESTAMP(3),
ADD COLUMN "invoiceSignedById" TEXT;

-- CreateIndex
CREATE INDEX "PayrollRun_invoiceSignedById_idx" ON "PayrollRun"("invoiceSignedById");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_invoiceSignedById_fkey" FOREIGN KEY ("invoiceSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
