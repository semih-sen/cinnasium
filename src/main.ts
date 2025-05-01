import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';

async function bootstrap() {
  const adapter = new ExpressAdapter();
  adapter.set("trust-proxy",1);
  const app = await NestFactory.create(AppModule,adapter);
  app.enableCors()
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  const reflector = app.get(Reflector); // Reflector'u al (metadata okumak için)
  // JwtAuthGuard'ı global olarak tanımla. Bu guard Reflector'u kullanarak @Public() decorator'ını kontrol edecek.
  //app.set('trust proxy', true);
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
