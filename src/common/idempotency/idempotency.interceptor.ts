import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IDEMPOTENT_ACTION_KEY } from './idempotency.decorator';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const DEFAULT_TTL_HOURS = 24;

interface AuthedRequest extends Request {
  user?: { id: string };
}

/**
 * Basic `Idempotency-Key` support backed by `IdempotencyRecord`. Only
 * applies to routes annotated with `@IdempotentAction(action)`; every other
 * route is passed through unchanged.
 *
 * Behavior:
 *  - No header, or no authenticated actor: request runs normally (not deduped).
 *  - Unseen key: request runs; response + request hash are stored keyed on
 *    (actorId, action, key).
 *  - Seen key with a matching request body: cached response is replayed
 *    without re-invoking the handler.
 *  - Seen key with a different request body: rejected with 409, since this
 *    almost always indicates a client bug (reusing a key for a new request).
 *  - Seen key past `expiresAt`: treated as unseen (old record is purged).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(
      IDEMPOTENT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!action || context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthedRequest>();
    const response = http.getResponse<Response>();

    const headerValue = request.headers[IDEMPOTENCY_HEADER];
    const idempotencyKey = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    const actorId = request.user?.id;

    if (!idempotencyKey || !actorId) {
      return next.handle();
    }

    const requestHash = hashRequestBody(request.body);

    return from(
      this.prisma.idempotencyRecord.findUnique({
        where: { actorId_action_key: { actorId, action, key: idempotencyKey } },
      }),
    ).pipe(
      switchMap((existing) => {
        if (!existing) {
          return this.proceed(next, response, {
            actorId,
            action,
            idempotencyKey,
            requestHash,
          });
        }

        if (existing.expiresAt.getTime() < Date.now()) {
          return from(
            this.prisma.idempotencyRecord.delete({
              where: { id: existing.id },
            }),
          ).pipe(
            switchMap(() =>
              this.proceed(next, response, {
                actorId,
                action,
                idempotencyKey,
                requestHash,
              }),
            ),
          );
        }

        if (existing.requestHash !== requestHash) {
          throw new ConflictException(
            'This Idempotency-Key was already used with a different request payload',
          );
        }

        if (existing.responseCode) {
          response.status(existing.responseCode);
        }
        return of(existing.responseJson ?? null);
      }),
    );
  }

  private proceed(
    next: CallHandler,
    response: Response,
    ctx: {
      actorId: string;
      action: string;
      idempotencyKey: string;
      requestHash: string;
    },
  ): Observable<unknown> {
    return next.handle().pipe(
      tap({
        next: (body: unknown) => {
          const expiresAt = new Date(
            Date.now() + DEFAULT_TTL_HOURS * 60 * 60 * 1000,
          );
          void this.prisma.idempotencyRecord
            .upsert({
              where: {
                actorId_action_key: {
                  actorId: ctx.actorId,
                  action: ctx.action,
                  key: ctx.idempotencyKey,
                },
              },
              create: {
                actorId: ctx.actorId,
                action: ctx.action,
                key: ctx.idempotencyKey,
                requestHash: ctx.requestHash,
                responseJson: toJsonValue(body),
                responseCode: response.statusCode,
                expiresAt,
              },
              update: {
                requestHash: ctx.requestHash,
                responseJson: toJsonValue(body),
                responseCode: response.statusCode,
                expiresAt,
              },
            })
            .catch(() => undefined);
        },
      }),
    );
  }
}

function hashRequestBody(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');
}

function toJsonValue(
  body: unknown,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return body === undefined || body === null ? Prisma.JsonNull : body;
}
