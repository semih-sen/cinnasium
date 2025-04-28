import { Module } from '@nestjs/common';
import { ProfileImageService } from './profile-image.service';
import { ProfileImageController } from './profile-image.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    UserModule
    ,
    
    AuthModule,
  ],
  controllers: [ProfileImageController],
  providers: [ProfileImageService],
})
export class ProfileImageModule {}