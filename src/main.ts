import { networkInterfaces } from 'os';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

function lanIpv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const net of addrs ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`\n  Pantri API listening on:`);
  // eslint-disable-next-line no-console
  console.log(`    local:    http://localhost:${port}/api/v1`);
  for (const ip of lanIpv4Addresses()) {
    // eslint-disable-next-line no-console
    console.log(`    network:  http://${ip}:${port}/api/v1`);
  }
  // eslint-disable-next-line no-console
  console.log('');
}
bootstrap();
