import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { VerificationService } from './verification/verification.service';
import { CacheModule } from '@nestjs/cache-manager';
import { CachingService } from './caching/caching.service';

import { CachingModule } from './caching/caching.module';
import { VerificationModule } from './verification/verification.module';
import { MailModule } from './mail/mail.module';
import KeyvRedis from '@keyv/redis';
import { MailService } from './mail/mail.service';
import { ConfigModule } from '@nestjs/config';
import { CategoryModule } from './category/category.module';
import { ThreadModule } from './thread/thread.module';
import { PostModule } from './post/post.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '1234',
      database: 'cinnasium',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    
    UserModule,
    AuthModule,
   
    CachingModule,
    VerificationModule,
    MailModule,
    CategoryModule,
    ThreadModule,
    PostModule,
  ],
  controllers: [AppController],
  providers: [AppService, VerificationService, CachingService, MailService],
})
export class AppModule {}
