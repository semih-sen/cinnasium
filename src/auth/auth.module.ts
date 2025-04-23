import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VerificationModule } from 'src/verification/verification.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { MailModule } from 'src/mail/mail.module';

@Module({
  providers: [AuthService,LocalStrategy, // Kullanıcı adı/parola doğrulama stratejisi
    JwtStrategy,],
  controllers: [AuthController],
  imports: [
    UserModule,
    VerificationModule, // UsersService'i inject edebilmek için
    PassportModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule], // JwtModule içinde ConfigService'i kullanabilmek için
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRATION_TIME') },
      }),
      inject: [ConfigService], // Factory'ye ConfigService'i inject et
    }),],
})
export class AuthModule {}
