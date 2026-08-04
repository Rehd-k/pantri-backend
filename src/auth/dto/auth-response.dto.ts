import { AuthUserDto } from './auth-user.dto';

export class AuthResponseDto {
  accessToken!: string;
  user!: AuthUserDto;
}
