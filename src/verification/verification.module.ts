import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VerificationService } from './verification.service';
import { CachingModule } from '../caching/caching.module'; // CacheModule'ü import et
import { UserModule } from '../user/user.module'; // UsersModule'ü import et
import { MailModule } from 'src/mail/mail.module';
// import { MailModule } from '../mail/mail.module'; // Email gönderme için MailModule eklenecek

@Module({
  imports: [
    ConfigModule,
    MailModule, // ConfigService'i kullanabilmek için
    CachingModule, // CacheService'i sağlar (Global olduğu için aslında burada import şart değil ama açıkça belirtmek iyi olabilir)
    // UsersModule circular dependency yaratacağı için forwardRef ile import edilir
    forwardRef(() => UserModule),
    // MailModule, // Email gönderme için
  ],
  providers: [VerificationService],
  exports: [VerificationService], // VerificationService'i başka modüllerin (örn: AuthModule, UsersModule) kullanabilmesi için export et
})
export class VerificationModule {}