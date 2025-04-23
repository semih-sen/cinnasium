import { forwardRef, Module } from '@nestjs/common';
import { ThreadController } from './thread.controller';
import { ThreadService } from './thread.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Thread } from './entities/thread.entity';
import { CategoryModule } from 'src/category/category.module';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { PostModule } from 'src/post/post.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Thread]),
    CategoryModule, // CategoriesService'i sağlar
    UserModule, // UsersService'i sağlar
    AuthModule,
    forwardRef(() => PostModule), // PostsModule'e (veya Service'ine) erişim için
  ],
  controllers: [ThreadController],
  providers: [ThreadService],
  exports: [ThreadService],
})
export class ThreadModule {}
