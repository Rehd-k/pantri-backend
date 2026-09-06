import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Allows unauthenticated ingest; attaches user when Bearer token is valid. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const activate = super.canActivate(context);
    if (activate instanceof Promise) {
      return activate.catch(() => true);
    }
    return activate as boolean;
  }
}
