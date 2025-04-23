import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    Query,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
    Logger
} from '@nestjs/common';
import { PostService } from './post.service';
import { PostForCreateDto } from './dtos/post_for_create.dto';
import { PostForUpdateDto } from './dtos/post_for_update.dto';
import { FindPostsQueryDto } from './dtos/find_posts_query.dto';
import { VoteDto } from './dtos/vote.dto';
import { CommentForCreateDto } from './dtos/comment_for_create.dto';
import { FindCommentsQueryDto } from './dtos/find_comments_query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../user/entities/user.entity';

// Post işlemleri genellikle thread veya post ID'si üzerinden yapılır
@Controller() // Ana path yok, metodlardaki path'ler kullanılacak
export class PostController {
    private readonly logger = new Logger(PostController.name);

    constructor(private readonly postsService: PostService) {}

    // Bir konuya yeni cevap ekleme
    @Post('threads/:threadId/posts') // POST /threads/{threadId}/posts
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.CREATED)
    createReply(
        @Param('threadId', ParseUUIDPipe) threadId: string,
        @Body() createPostDto: PostForCreateDto,
        @Request() req,
    ) {
        const user: User = req.user;
        this.logger.log(`User ${user.username} requesting to create reply in thread ${threadId}`);
        return this.postsService.createReply(createPostDto, threadId, user);
    }

    // Bir konudaki mesajları listeleme
    @Public()
    @Get('threads/:threadId/posts') // GET /threads/{threadId}/posts
    findAllByThread(
        @Param('threadId', ParseUUIDPipe) threadId: string,
        @Query() queryDto: FindPostsQueryDto,
    ) {
        this.logger.log(`Request received to list posts for thread ${threadId}`);
        return this.postsService.findAllByThread(threadId, queryDto);
    }

    // Tek bir mesajı getirme
    @Public()
    @Get('posts/:id') // GET /posts/{postId}
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        this.logger.log(`Request received to find post ID: ${id}`);
        return this.postsService.findOne(id);
    }

    // Mesaj güncelleme
    @Patch('posts/:id') // PATCH /posts/{postId}
    @UseGuards(JwtAuthGuard)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updatePostDto: PostForUpdateDto,
        @Request() req,
    ) {
        const user: User = req.user;
        this.logger.log(`User ${user.username} requesting to update post ID: ${id}`);
        // Yetki kontrolü serviste
        return this.postsService.update(id, updatePostDto, user);
    }

    // Mesaj silme
    @Delete('posts/:id') // DELETE /posts/{postId}
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
        const user: User = req.user;
        this.logger.log(`User ${user.username} requesting to remove post ID: ${id}`);
        // Yetki kontrolü serviste
        return this.postsService.remove(id, user);
    }

    // --- Oylama Endpoint'i ---
    @Post('posts/:id/vote') // POST /posts/{postId}/vote
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK) // Başarılı oylama sonrası 200 OK
    vote(
        @Param('id', ParseUUIDPipe) postId: string,
        @Body() voteDto: VoteDto,
        @Request() req,
    ) {
        const user: User = req.user;
        this.logger.log(`User ${user.username} requesting to vote on post ID: ${postId} with value ${voteDto.value}`);
        return this.postsService.vote(postId, user, voteDto.value);
    }

    // --- Yorum Endpoint'leri ---
    @Post('posts/:id/comments') // POST /posts/{postId}/comments
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.CREATED)
    addComment(
        @Param('id', ParseUUIDPipe) postId: string,
        @Body() createCommentDto: CommentForCreateDto,
        @Request() req,
    ) {
        const user: User = req.user;
        this.logger.log(`User ${user.username} requesting to add comment to post ID: ${postId}`);
        return this.postsService.addComment(postId, user, createCommentDto.content);
    }

    @Public()
    @Get('posts/:id/comments') // GET /posts/{postId}/comments
    findComments(
        @Param('id', ParseUUIDPipe) postId: string,
        @Query() queryDto: FindCommentsQueryDto,
    ) {
         this.logger.log(`Request received to list comments for post ID: ${postId}`);
        return this.postsService.findCommentsByPost(postId, queryDto);
    }
}