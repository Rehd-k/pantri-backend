import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Anything that can execute Prisma model queries: either the long-lived
 * PrismaService singleton, or the scoped client handed to a
 * `$transaction(async (tx) => ...)` callback. Services accept this type so
 * they can be composed inside a caller's transaction or run standalone.
 */
export type PrismaTx = PrismaService | Prisma.TransactionClient;
