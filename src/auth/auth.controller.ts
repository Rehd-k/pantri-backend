import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterEmployeeDto } from './dto/register-employee.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { RegisterLogisticsDto } from './dto/register-logistics.dto';
import { RegisterSupplierDto } from './dto/register-supplier.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('register/employer')
  registerEmployer(
    @Body() dto: RegisterEmployerDto,
  ): Promise<AuthResponseDto> {
    return this.authService.registerEmployer(dto);
  }

  @Post('register/employee')
  registerEmployee(
    @Body() dto: RegisterEmployeeDto,
  ): Promise<AuthResponseDto> {
    return this.authService.registerEmployee(dto);
  }

  @Post('register/supplier')
  registerSupplier(
    @Body() dto: RegisterSupplierDto,
  ): Promise<AuthResponseDto> {
    return this.authService.registerSupplier(dto);
  }

  @Post('register/logistics')
  registerLogistics(
    @Body() dto: RegisterLogisticsDto,
  ): Promise<AuthResponseDto> {
    return this.authService.registerLogistics(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUserPayload): Promise<AuthUserDto> {
    return this.authService.getMe(user.id);
  }
}
