import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  PlatformRole,
  PrismaClient,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

const USER_ROLES = Object.values(UserRole);
const PLATFORM_ROLES = Object.values(PlatformRole);

type CliOptions = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  platformRole?: PlatformRole;
  status: UserStatus;
  updatePassword: boolean;
  help: boolean;
};

function printHelp(): void {
  console.log(`
Create or update a Pantri user from the terminal.

Usage:
  pnpm user:create -- [options]

Options:
  --email <email>           User email (required)
  --password <password>     Password (min ${MIN_PASSWORD_LENGTH} chars). Falls back to CREATE_USER_PASSWORD env var.
  --first-name <name>       First name (default: "Admin" for ADMIN role, otherwise "User")
  --last-name <name>        Last name (default: "User")
  --role <role>             User role (default: ADMIN). One of: ${USER_ROLES.join(', ')}
  --platform-role <role>    Optional platform role. One of: ${PLATFORM_ROLES.join(', ')}
  --status <status>         User status (default: ACTIVE). One of: ACTIVE, PENDING_APPROVAL, SUSPENDED
  --update-password         Update password if the user already exists
  --help                    Show this help message

Examples:
  pnpm user:create -- --email admin@pantri.app --password 'Admin123!'
  CREATE_USER_PASSWORD='Admin123!' pnpm user:create -- --email admin@pantri.app
  pnpm user:create -- --email admin@pantri.app --password 'NewPass123!' --update-password
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    updatePassword: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--email':
        options.email = next;
        i += 1;
        break;
      case '--password':
        options.password = next;
        i += 1;
        break;
      case '--first-name':
        options.firstName = next;
        i += 1;
        break;
      case '--last-name':
        options.lastName = next;
        i += 1;
        break;
      case '--role':
        options.role = next as UserRole;
        i += 1;
        break;
      case '--platform-role':
        options.platformRole = next as PlatformRole;
        i += 1;
        break;
      case '--status':
        options.status = next as UserStatus;
        i += 1;
        break;
      case '--update-password':
        options.updatePassword = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function assertEnumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${label}: ${value}. Allowed values: ${allowed.join(', ')}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const email = options.email?.trim().toLowerCase();
  if (!email) {
    throw new Error('Missing required --email argument. Run with --help for usage.');
  }

  const password = options.password ?? process.env.CREATE_USER_PASSWORD;
  if (!password) {
    throw new Error(
      'Missing password. Pass --password or set CREATE_USER_PASSWORD in the environment.',
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  assertEnumValue(options.role, USER_ROLES, 'role');
  assertEnumValue(options.status, Object.values(UserStatus), 'status');
  if (options.platformRole) {
    assertEnumValue(options.platformRole, PLATFORM_ROLES, 'platform role');
  }

  const firstName =
    options.firstName?.trim() ||
    (options.role === UserRole.ADMIN ? 'Admin' : 'User');
  const lastName = options.lastName?.trim() || 'User';

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (!options.updatePassword) {
        throw new Error(
          `User already exists: ${email}. Re-run with --update-password to change the password.`,
        );
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          firstName,
          lastName,
          role: options.role,
          status: options.status,
          platformRole: options.platformRole ?? null,
        },
      });

      console.log(`Updated user: ${email} (${options.role})`);
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: options.role,
        status: options.status,
        platformRole: options.platformRole,
      },
    });

    console.log(`Created user: ${email} (${user.role})`);
    console.log(`User id: ${user.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
