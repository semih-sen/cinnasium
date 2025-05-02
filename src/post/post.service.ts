import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm'; // DataSource (transaction için)
import { Post } from './entities/post.entity';
import { PostVote } from './entities/post-vote.entity';
import { PostComment } from './entities/post-comment.entity';
import { PostForCreateDto } from './dtos/post_for_create.dto';
import { PostForUpdateDto } from './dtos/post_for_update.dto';
import { ThreadService } from '../thread/thread.service';
import { UserService } from '../user/user.service';
import { User, UserRole } from '../user/entities/user.entity';
import { FindPostsQueryDto } from './dtos/find_posts_query.dto';
import { CommentForCreateDto } from './dtos/comment_for_create.dto';
import { FindCommentsQueryDto } from './dtos/find_comments_query.dto';
import { CategoryService } from '../category/category.service';
import { Thread } from '../thread/entities/thread.entity'; // Thread tipini almak için
import { paginate, Pagination } from 'nestjs-typeorm-paginate';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @InjectRepository(Post) private readonly postRepository: Repository<Post>,
    @InjectRepository(PostVote)
    private readonly postVoteRepository: Repository<PostVote>,
    @InjectRepository(PostComment)
    private readonly postCommentRepository: Repository<PostComment>,
    // Döngüsel bağımlılık için forwardRef
    @Inject(forwardRef(() => ThreadService))
    private readonly threadsService: ThreadService,
    private readonly usersService: UserService, // Nadiren gerekebilir
    private readonly categoriesService: CategoryService,
    private readonly dataSource: DataSource, // Transaction yönetimi için
  ) {}

  // --- Internal Helper (ThreadsService tarafından çağrılır) ---
  async createInitialPost(
    createPostDto: { content: string },
    threadId: string,
    author: User,
    isThreadStarter: boolean = true, // Varsayılan true ama açıkça belirtmek iyi
  ): Promise<Post> {
    this.logger.log(
      `Creating initial post for thread ${threadId} by user ${author.username}`,
    );
    const post = this.postRepository.create({
      ...createPostDto,
      threadId,
      authorId: author.id,
      author, // İlişkiyi kur
      isThreadStarter: isThreadStarter, // Mutlaka true olmalı
      // parentPostId burada null olur
    });
    // İstatistik güncellemesi burada yapılmaz, thread oluşturulduktan sonra yapılır.
    return this.postRepository.save(post);
  }
  // --- Internal Helper Sonu ---

  async createReply(
    createPostDto: PostForCreateDto,
    threadId: string,
    author: User,
  ): Promise<Post> {
    this.logger.log(
      `User ${author.username} attempting to reply to thread ${threadId}`,
    );
    const { content, parentPostId } = createPostDto;

    // 1. Konu var mı, kilitli mi, kullanıcının yazma izni var mı?
    // findOne içinde kategori bilgisi de geliyor olmalı (relation ile)
    const thread = await this.threadsService.findOne(threadId); // NotFound fırlatır
    if (thread.isLocked) {
      this.logger.warn(`Attempt to post in locked thread ${threadId}`);
      throw new ForbiddenException('This thread is locked.');
    }
    // Kategoriye yazma iznini kontrol et (ThreadsService'deki helper kullanılabilir)
    // this.threadsService.checkPermission(thread.category.minPostRole, author.role, 'reply in this category');

    // 2. Eğer cevap yazılıyorsa, parent post var mı?
    let parentPost: Post | null = null;
    if (parentPostId) {
      parentPost = await this.postRepository.findOne({
        where: { id: parentPostId, threadId: threadId },
      }); // Aynı konuda olmalı
      if (!parentPost) {
        this.logger.warn(
          `Parent post ${parentPostId} not found in thread ${threadId}`,
        );
        throw new NotFoundException(
          `Parent post with ID ${parentPostId} not found in this thread.`,
        );
      }
    }

    // 3. Post nesnesini oluştur
    const post = this.postRepository.create({
      content,
      threadId,
      authorId: author.id,
      author,
      parentPostId: parentPost?.id, // Varsa ata
      isThreadStarter: false, // Cevaplar asla starter olamaz
    });

    // 4. Post'u kaydet
    try {
      const savedPost = await this.postRepository.save(post);
      this.logger.log(
        `Reply post created with ID: ${savedPost.id} in thread ${threadId}`,
      );

      // 5. İstatistikleri güncelle (IDEALDE LISTENER/SUBSCRIBER İLE YAPILMALI)
      await this.threadsService.updateThreadStatsOnNewPost(
        threadId,
        savedPost.id,
        savedPost.createdAt,
        author.id,
      );
      await this.categoriesService.incrementPostCount(thread.categoryId);
      // await this.usersService.incrementPostCount(author.id);

      return savedPost;
    } catch (error) {
      this.logger.error(`Failed to create reply in thread ${threadId}`, error);
      throw error;
    }
  }

  async findAllByThread(
    threadId: string,
    queryDto: FindPostsQueryDto,
  ): Promise<Pagination<Post>> {
    this.logger.log(
      `Fetching posts for thread: ${threadId}, page: ${queryDto.page}, limit: ${queryDto.limit}`,
    );

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .where('post.threadId = :threadId', { threadId })
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.votes', 'votes')
      .leftJoinAndSelect('post.comments', 'comments')
      .orderBy('post.createdAt', 'ASC');

    return paginate<Post>(queryBuilder, {
      page: queryDto.page || 1,
      limit: queryDto.limit || 20,
    });
  }

  async findOne(id: string): Promise<Post> {
    this.logger.log(`Finding post by ID: ${id}`);
    const post = await this.postRepository.findOne({
      where: { id },
      relations: [
        'author',
        'thread',
        'thread.category',
        'parentPost',
        'parentPost.author',
      ], // Gerekli ilişkiler
    });

    if (!post) {
      this.logger.warn(`Post with ID ${id} not found.`);
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    // TODO: Konu/Kategori görüntüleme iznini kontrol et
    return post;
  }

  async update(
    id: string,
    updatePostDto: PostForUpdateDto,
    user: User,
  ): Promise<Post> {
    this.logger.log(
      `User ${user.username} attempting to update post ID: ${id}`,
    );
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['author'],
    }); // Yazarı kontrol için al

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    // Yetki kontrolü: Yazar veya Admin/Mod
    const isOwner = post.authorId === user.id;
    const isAdminOrMod =
      user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR;

    if (!isOwner && !isAdminOrMod) {
      this.logger.warn(
        `User ${user.username} forbidden to update post ID: ${id}`,
      );
      throw new ForbiddenException(
        'You do not have permission to update this post.',
      );
    }

    // İçeriği güncelle ve düzenlendi işaretini koy
    post.content = updatePostDto.content;
    post.isEdited = true; // Düzenlendi olarak işaretle

    try {
      const updatedPost = await this.postRepository.save(post);
      this.logger.log(
        `Post ID: ${id} updated successfully by user ${user.username}`,
      );
      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to update post ID: ${id}`, error);
      throw error;
    }
  }

  async remove(id: string, user: User): Promise<void> {
    this.logger.log(
      `User ${user.username} attempting to remove post ID: ${id}`,
    );
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['author', 'thread'],
    }); // Thread bilgisi lazım

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    // Yetki kontrolü: Yazar veya Admin/Mod
    const isOwner = post.authorId === user.id;
    const isAdminOrMod =
      user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR;

    if (!isOwner && !isAdminOrMod) {
      this.logger.warn(
        `User ${user.username} forbidden to remove post ID: ${id}`,
      );
      throw new ForbiddenException(
        'You do not have permission to remove this post.',
      );
    }

    // Başlangıç postu silinemez (konuyu silmek gerekir)
    if (post.isThreadStarter) {
      this.logger.warn(
        `Attempt to remove the starting post (ID: ${id}) of thread ${post.threadId}`,
      );
      throw new BadRequestException(
        'Cannot delete the starting post of a thread. Delete the thread instead.',
      );
    }

    const threadId = post.threadId;
    const categoryId = post.thread.categoryId; // İlişkiden al
    const authorId = post.authorId;

    try {
      await this.postRepository.remove(post); // Post'u sil
      this.logger.log(
        `Post ID: ${id} removed successfully by user ${user.username}`,
      );

      // İstatistikleri güncelle (IDEALDE LISTENER/SUBSCRIBER İLE YAPILMALI)
      await this.threadsService.updateThreadStatsOnDeletePost(threadId, id);
      if (categoryId) {
        await this.categoriesService.decrementPostCount(categoryId);
      }
      // if(authorId){
      //     await this.usersService.decrementPostCount(authorId);
      // }
    } catch (error) {
      this.logger.error(`Failed to remove post ID: ${id}`, error);
      throw error;
    }
  }

  // --- Oylama İşlemleri ---
  async vote(
    postId: string,
    user: User,
    value: 1 | -1,
  ): Promise<{ currentScore: number; userVote: number | null }> {
    this.logger.log(
      `User ${user.username} voting on post ${postId} with value ${value}`,
    );
    const post = await this.postRepository.findOneBy({ id: postId });
    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found.`);
    }

    // Transaction başlat
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let currentUserVote: number | null = null; // Kullanıcının mevcut oy durumu

    try {
      const postRepo = queryRunner.manager.getRepository(Post);
      const voteRepo = queryRunner.manager.getRepository(PostVote);

      // Kullanıcının bu posta daha önceki oyunu bul
      const existingVote = await voteRepo.findOne({
        where: { postId, userId: user.id },
      });

      let scoreChange = 0;
      let upvoteChange = 0;
      let downvoteChange = 0;

      if (existingVote) {
        // Daha önce oy vermiş
        if (existingVote.value === value) {
          // Aynı oyu tekrar vermiş -> Oyu kaldır
          await voteRepo.remove(existingVote);
          scoreChange = -value; // Skoru tersine çevir
          if (value === 1) upvoteChange = -1;
          else downvoteChange = -1;
          currentUserVote = null; // Oyu kaldırıldı
          this.logger.debug(
            `Vote removed for user ${user.id} on post ${postId}`,
          );
        } else {
          // Farklı oy vermiş -> Oyu güncelle
          const oldValue = existingVote.value;
          existingVote.value = value;
          await voteRepo.save(existingVote);
          scoreChange = value - oldValue; // Yeni skor - eski skor (örn: -1'den +1'e -> 1 - (-1) = 2)
          if (oldValue === 1) upvoteChange = -1;
          else downvoteChange = -1;
          if (value === 1) upvoteChange += 1;
          else downvoteChange += 1;
          currentUserVote = value; // Yeni oy
          this.logger.debug(
            `Vote updated for user ${user.id} on post ${postId} to ${value}`,
          );
        }
      } else {
        // İlk defa oy veriyor
        const newVote = voteRepo.create({ postId, userId: user.id, value });
        await voteRepo.save(newVote);
        scoreChange = value;
        if (value === 1) upvoteChange = 1;
        else downvoteChange = 1;
        currentUserVote = value; // Yeni oy
        this.logger.debug(
          `New vote created for user ${user.id} on post ${postId} with value ${value}`,
        );
      }

      // Post istatistiklerini atomik olarak güncelle
      if (scoreChange !== 0 || upvoteChange !== 0 || downvoteChange !== 0) {
        await postRepo.update(postId, {
          score: () => `"score" + ${scoreChange}`,
          upvotes: () => `"upvotes" + ${upvoteChange}`,
          downvotes: () => `"downvotes" + ${downvoteChange}`,
        });
        this.logger.debug(
          `Post ${postId} stats updated: scoreChange=${scoreChange}, upvoteChange=${upvoteChange}, downvoteChange=${downvoteChange}`,
        );
      }

      // Transaction'ı commit et
      await queryRunner.commitTransaction();

      // Güncel skoru tekrar oku (veya hesapla)
      const updatedPost = await postRepo.findOneBy({ id: postId });
      const finalScore = updatedPost?.score ?? post.score + scoreChange; // Güncel skoru al veya hesapla

      return { currentScore: finalScore, userVote: currentUserVote };
    } catch (err) {
      // Hata olursa transaction'ı rollback yap
      this.logger.error(`Vote transaction failed for post ${postId}`, err);
      await queryRunner.rollbackTransaction();
      throw err; // Hatanın yukarıya fırlatılması
    } finally {
      // Query runner'ı release et
      await queryRunner.release();
    }
  }

  // --- Yorum İşlemleri ---
  async addComment(
    postId: string,
    user: User,
    content: string,
  ): Promise<PostComment> {
    this.logger.log(`User ${user.username} adding comment to post ${postId}`);
    // Post var mı kontrolü
    const postExists = await this.postRepository.existsBy({ id: postId });
    if (!postExists) {
      throw new NotFoundException(`Post with ID ${postId} not found.`);
    }

    const comment = this.postCommentRepository.create({
      content,
      postId,
      authorId: user.id,
      author: user,
    });

    try {
      const savedComment = await this.postCommentRepository.save(comment);
      this.logger.log(`Comment ${savedComment.id} added to post ${postId}`);

      // Post'un yorum sayısını güncelle (Listener/Subscriber daha iyi)
      await this.postRepository.increment({ id: postId }, 'commentCount', 1);

      return savedComment;
    } catch (error) {
      this.logger.error(`Failed to add comment to post ${postId}`, error);
      throw error;
    }
  }

  async findCommentsByPost(
    postId: string,
    queryDto: FindCommentsQueryDto,
  ): Promise<Pagination<PostComment>> {
    this.logger.log(
      `Workspaceing comments for post: ${postId}, page: ${queryDto.page}, limit: ${queryDto.limit}`,
    );
    // Post var mı kontrolü
    const postExists = await this.postRepository.existsBy({ id: postId });
    if (!postExists) {
      throw new NotFoundException(`Post with ID ${postId} not found.`);
    }

    const queryBuilder = this.postCommentRepository
      .createQueryBuilder('comment')
      .where('comment.postId = :postId', { postId })
      .leftJoinAndSelect('comment.author', 'author')
      .orderBy('createdAt', 'ASC');
    /* const { page = 1, limit = 10 } = queryDto;
       const skip = (page - 1) * limit;

       const [comments, total] = await this.postCommentRepository.findAndCount({
           where: { postId: postId },
           relations: ['author'], // Yazar bilgisini çek
           order: {
               createdAt: 'ASC', // Yorumları eskiden yeniye sırala
           },
           skip: skip,
           take: limit,
       });*/

    //this.logger.log(`Found ${comments.length} comments out of ${total} for post ${postId}`);
    return paginate<PostComment>(queryBuilder, {
      page: queryDto.page || 1,
      limit: queryDto.limit || 20,
    });
  }

  // --- Helper Metotlar (ThreadsService için) ---
  async countPostsInThread(threadId: string): Promise<number> {
    return this.postRepository.count({ where: { threadId } });
  }

  async findLastPostInThread(
    threadId: string,
    excludePostId?: string,
  ): Promise<Post | null> {
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .where('post.threadId = :threadId', { threadId });

    if (excludePostId) {
      queryBuilder.andWhere('post.id != :excludePostId', { excludePostId });
    }

    return queryBuilder.orderBy('post.createdAt', 'DESC').getOne();
  }
}
