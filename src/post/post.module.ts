import { forwardRef, Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { PostVote } from './entities/post-vote.entity';
import { PostComment } from './entities/post-comment.entity';
import { ThreadModule } from 'src/thread/thread.module';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { CategoryModule } from 'src/category/category.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostVote, PostComment]),
    forwardRef(() => ThreadModule), // ThreadsService'e erişim için
    UserModule,
    AuthModule,
    CategoryModule, // CategoriesService'e erişim için
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService], 
})
export class PostModule {}
