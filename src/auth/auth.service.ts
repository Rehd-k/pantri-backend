import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  Employer,
  EmployerMembershipRole,
  User,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client';
import { EmployeeService } from '../identity/employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterEmployeeDto } from './dto/register-employee.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { RegisterLogisticsDto } from './dto/register-logistics.dto';
import { RegisterSupplierDto } from './dto/register-supplier.dto';

type UserWithEmployer = User & { employer: Employer | null };

/** Assumed monthly salary (₦500,000) for employees who register without providing one. */
const DEFAULT_EMPLOYEE_SALARY_KOBO = 500_000_00;

@Injectable()
export class AuthService {
  private readonly bcryptRounds = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly employeeService: EmployeeService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { employer: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.PENDING_APPROVAL) {
      throw new ForbiddenException(
        'Your account is pending admin approval. Please try again later.',
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended.');
    }

    return this.buildAuthResponse(user);
  }

  async registerEmployer(dto: RegisterEmployerDto): Promise<AuthResponseDto> {
    await this.ensureEmailAvailable(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    const inviteCode = await this.generateUniqueInviteCode();

    const user = await this.prisma.$transaction(async (tx) => {
      const employer = await tx.employer.create({
        data: {
          name: dto.companyName.trim(),
          inviteCode,
        },
      });

      await tx.creditPolicy.create({ data: { employerId: employer.id } });

      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: UserRole.EMPLOYER,
          status: UserStatus.ACTIVE,
          employerId: employer.id,
        },
        include: { employer: true },
      });

      await tx.employerMembership.create({
        data: {
          userId: createdUser.id,
          employerId: employer.id,
          role: EmployerMembershipRole.EMPLOYER_ADMIN,
        },
      });

      return createdUser;
    });

    return this.buildAuthResponse(user);
  }

  async registerEmployee(dto: RegisterEmployeeDto): Promise<AuthResponseDto> {
    await this.ensureEmailAvailable(dto.email);

    const employer = await this.prisma.employer.findUnique({
      where: { inviteCode: dto.inviteCode.trim().toUpperCase() },
    });

    if (!employer) {
      throw new NotFoundException('Invalid employer invite code');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        employerId: employer.id,
      },
      include: { employer: true },
    });

    const { employee } = await this.employeeService.createEmployeeWithAccount({
      userId: user.id,
      employerId: employer.id,
      salaryKobo: dto.salaryKobo ?? DEFAULT_EMPLOYEE_SALARY_KOBO,
    });

    await this.prisma.riskProfile.upsert({
      where: { employeeId: employee.id },
      create: { employeeId: employee.id },
      update: {},
    });

    return this.buildAuthResponse(user);
  }

  async registerSupplier(dto: RegisterSupplierDto): Promise<AuthResponseDto> {
    await this.ensureEmailAvailable(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: UserRole.SUPPLIER,
        status: UserStatus.PENDING_APPROVAL,
        businessName: dto.businessName.trim(),
      },
      include: { employer: true },
    });

    return this.buildAuthResponse(user, { issueToken: false });
  }

  async registerLogistics(
    dto: RegisterLogisticsDto,
  ): Promise<AuthResponseDto> {
    await this.ensureEmailAvailable(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: UserRole.LOGISTICS,
        status: UserStatus.PENDING_APPROVAL,
        fleetName: dto.fleetName.trim(),
      },
      include: { employer: true },
    });

    return this.buildAuthResponse(user, { issueToken: false });
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employer: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toAuthUserDto(user);
  }

  async findUserById(userId: string): Promise<UserWithEmployer | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { employer: true },
    });
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.prisma.employer.findUnique({
        where: { inviteCode: code },
      });
      if (!existing) {
        return code;
      }
    }
    throw new ConflictException('Unable to generate a unique invite code');
  }

  private buildAuthResponse(
    user: UserWithEmployer,
    options: { issueToken?: boolean } = {},
  ): AuthResponseDto {
    const issueToken = options.issueToken ?? true;
    const authUser = this.toAuthUserDto(user);

    if (!issueToken) {
      return { accessToken: '', user: authUser };
    }

    const expiresIn = (this.config.get<string>('JWT_EXPIRES_IN') ??
      '7d') as `${number}d` | `${number}h` | `${number}s`;
    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
      employerId: user.employerId,
    }, { expiresIn });

    return { accessToken, user: authUser };
  }

  toAuthUserDto(user: UserWithEmployer): AuthUserDto {
    const employerId = user.employerId;
    const employerName = user.employer?.name ?? null;
    const employerInviteCode = user.employer?.inviteCode ?? null;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      employerId,
      employerName,
      employerInviteCode,
      companyId: employerId,
      companyName: employerName,
      companyInviteCode: employerInviteCode,
      businessName: user.businessName,
      fleetName: user.fleetName,
    };
  }
}
