import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_ACTION_KEY = 'idempotentAction';

/**
 * Marks a controller method as idempotent under a named `action`. When
 * combined with `IdempotencyInterceptor`, requests carrying an
 * `Idempotency-Key` header will be deduplicated per (actor, action, key):
 * the first call executes normally and its response is cached; replays with
 * the same key return the cached response instead of re-running the
 * handler, and reusing the same key with a different payload is rejected.
 */
export const IdempotentAction = (
  action: string,
): MethodDecorator & ClassDecorator =>
  SetMetadata(IDEMPOTENT_ACTION_KEY, action);
