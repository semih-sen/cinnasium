import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { VerificationModule } from 'src/verification/verification.module';

@Module({
   imports:[
    TypeOrmModule.forFeature([User]),
    VerificationModule
   ],
   providers: [UserService],
   exports: [UserService], // UserService'i diğer modüllere export ediyoruz
})
export class UserModule {}
