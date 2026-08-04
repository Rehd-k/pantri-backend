import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
} as const;

const METHOD_COLOR: Record<string, string> = {
  GET: ANSI.green,
  POST: ANSI.cyan,
  PUT: ANSI.yellow,
  PATCH: ANSI.magenta,
  DELETE: ANSI.red,
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { id?: string; role?: string } }>();
    const res = http.getResponse<Response>();
    const startedAt = Date.now();

    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = this.resolveIp(req);
    const userAgent = req.get('user-agent') ?? '-';
    const userLabel = req.user
      ? `${req.user.role ?? 'user'}:${req.user.id ?? '?'}`
      : 'anonymous';

    return next.handle().pipe(
      tap({
        next: () => {
          this.printLine({
            method,
            url,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            ip,
            userAgent,
            userLabel,
          });
        },
        error: (err: unknown) => {
          const statusCode =
            typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as { status: unknown }).status === 'number'
              ? (err as { status: number }).status
              : 500;

          this.printLine({
            method,
            url,
            statusCode,
            durationMs: Date.now() - startedAt,
            ip,
            userAgent,
            userLabel,
          });
        },
      }),
    );
  }

  private printLine(info: {
    method: string;
    url: string;
    statusCode: number;
    durationMs: number;
    ip: string;
    userAgent: string;
    userLabel: string;
  }): void {
    const methodColor = METHOD_COLOR[info.method] ?? ANSI.white;
    const statusColor = this.statusColor(info.statusCode);
    const durationColor =
      info.durationMs >= 1000
        ? ANSI.red
        : info.durationMs >= 300
          ? ANSI.yellow
          : ANSI.green;

    const method = `${methodColor}${ANSI.bold}${info.method.padEnd(7)}${ANSI.reset}`;
    const status = `${statusColor}${info.statusCode}${ANSI.reset}`;
    const duration = `${durationColor}${String(info.durationMs).padStart(4)}ms${ANSI.reset}`;
    const url = `${ANSI.white}${info.url}${ANSI.reset}`;
    const meta = `${ANSI.dim}${info.ip} · ${info.userLabel} · ${this.shortUa(info.userAgent)}${ANSI.reset}`;

    this.logger.log(`${method} ${status} ${duration}  ${url}  ${meta}`);
  }

  private statusColor(status: number): string {
    if (status >= 500) return ANSI.red;
    if (status >= 400) return ANSI.yellow;
    if (status >= 300) return ANSI.cyan;
    return ANSI.green;
  }

  private resolveIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() || req.ip || '-';
    }
    return req.ip || req.socket.remoteAddress || '-';
  }

  private shortUa(ua: string): string {
    if (ua === '-') return ua;
    if (ua.includes('Dart')) return 'Flutter/Dart';
    if (ua.includes('Postman')) return 'Postman';
    if (ua.includes('insomnia')) return 'Insomnia';
    if (ua.includes('Mozilla')) return 'Browser';
    return ua.length > 24 ? `${ua.slice(0, 24)}…` : ua;
  }
}
