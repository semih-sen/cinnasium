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
import { Repository } from 'typeorm';
import { Thread } from './entities/thread.entity';
import { ThreadForCreateDto } from './dtos/thread_for_create.dto';
import { ThreadForUpdateDto } from './dtos/thread_for_update.dto';
import { CategoryService } from '../category/category.service';
import { UserService } from '../user/user.service';
import { User, UserRole } from '../user/entities/user.entity'; // User ve UserRole lazım
import { PostService } from '../post/post.service'; // İlk postu oluşturmak için
import { FindThreadsQueryDto } from './dtos/find_threads_query.dto';
import { Category } from '../category/entities/category.entity';
import { Post } from 'src/post/entities/post.entity';
import { paginate, Pagination } from 'nestjs-typeorm-paginate';
import { ConfigService } from '@nestjs/config';
import { CachingService } from 'src/caching/caching.service';

@Injectable()
export class ThreadService {
  private readonly logger = new Logger(ThreadService.name);
  private readonly viewCountTtlSeconds: number;
  private readonly viewCountKeyPrefix = 'viewed_thread:';
  constructor(
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    private readonly categoriesService: CategoryService,
    private readonly cacheService: CachingService,
    private readonly configService: ConfigService,
    private readonly usersService: UserService, // Kullanıcı bilgilerini almak için
    // PostsService'e forwardRef ile inject ediyoruz (çünkü PostsModule de ThreadsService'i import edebilir)
    @Inject(forwardRef(() => PostService))
    private readonly postsService: PostService,
  ) {
    this.viewCountTtlSeconds = this.configService.get<number>('THREAD_VIEW_UNIQUENESS_TTL_SECONDS', 86400); // Default 24 saat
  }

  async create(
    createThreadDto: ThreadForCreateDto,
    author: User,
  ): Promise<Thread> {
    this.logger.log(
      `User ${author.username} attempting to create thread in category ${createThreadDto.categoryId}`,
    );
    const { title, content, categoryId } = createThreadDto;

    // 1. Kategori var mı ve kullanıcının konu açma izni var mı?
    const category = await this.categoriesService.findOne(categoryId); // findOne zaten NotFound fırlatır
    this.checkPermission(
      category.minThreadRole,
      author.role,
      'create threads in this category',
    );

    // 2. Thread nesnesini oluştur (henüz kaydetme)
    const thread = this.threadRepository.create({
      title,
      category, // İlişkiyi kur
      author, // İlişkiyi kur
      categoryId: category.id, // Foreign key'i de set edelim
      authorId: author.id, // Foreign key'i de set edelim
      // Slug ve diğer default değerler entity'deki @BeforeInsert ile gelecek
      // replyCount, lastPost vs. ilk post eklendikten sonra güncellenecek
    });

    // 3. Konuyu ve ilk mesajı transaction içinde kaydet
    try {
      const savedThread = await this.threadRepository.save(thread); // Önce thread'i kaydet ki ID'si oluşsun
      this.logger.log(`Thread entity saved with ID: ${savedThread.id}`);

      // 4. İlk Post'u oluştur (PostsService kullanarak)
      const initialPost = await this.postsService.createInitialPost(
        { content }, // CreatePostDto benzeri yapı
        savedThread.id,
        author,
        true, // isThreadStarter = true
      );
      this.logger.log(`Initial post created with ID: ${initialPost.id}`);

      // 5. Thread'in istatistiklerini ilk posta göre güncelle
      //    (Listener/Subscriber kullanmak daha iyi olurdu)
      savedThread.replyCount = 0; // İlk post cevap sayılmaz
      savedThread.lastPostId = initialPost.id;
      savedThread.lastPostAt = initialPost.createdAt;
      savedThread.lastPostById = author.id;
      const finalThread = await this.threadRepository.save(savedThread);
      this.logger.log(
        `Thread ${finalThread.id} stats updated with initial post info.`,
      );

      // 6. Kategori istatistiklerini güncelle (Listener/Subscriber daha iyi)
      await this.categoriesService.incrementThreadCount(category.id);
      await this.categoriesService.incrementPostCount(category.id); // İlk post için

      // 7. Kullanıcı istatistiklerini güncelle (Listener/Subscriber daha iyi)
      // await this.usersService.incrementPostCount(author.id);

      // İlişkileriyle birlikte (ilk post hariç) thread'i döndür
      // Controller'a döndürürken hassas verileri temizle (örn: post içeriği çok uzunsa)
      // veya sadece temel bilgileri döndür. Şimdilik tam nesneyi dönelim.
      return finalThread;
    } catch (error) {
      this.logger.error(
        `Failed to create thread or initial post for user ${author.username}`,
        error,
      );
      if (error.code === '23505') {
        // PostgreSQL unique violation (slug)
        throw new BadRequestException(
          'A thread with a similar title might already exist.',
        );
      }
      // Transaction rollback mantığı TypeORM veya QueryRunner ile eklenebilir
      throw error;
    }
  }

  async findAllByCategory(
    categoryIdOrSlug: string,
    queryDto: FindThreadsQueryDto,
    user?: User | null,
  ): Promise<Pagination<Thread>> {
    this.logger.log(
      `Fetching threads for category: ${categoryIdOrSlug}, page: ${queryDto.page}, limit: ${queryDto.limit}`,
    );

    const category = await this.categoriesService.findOne(categoryIdOrSlug);
    this.checkCategoryViewPermission(category, user);

    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .where('thread.categoryId = :categoryId', { categoryId: category.id })
      .leftJoinAndSelect('thread.author', 'author')
      .leftJoinAndSelect('thread.lastPostBy', 'lastPostBy')
      .orderBy('thread.isPinned', 'DESC')
      .addOrderBy('thread.lastPostAt', 'DESC');

    return paginate<Thread>(queryBuilder, {
      page: queryDto.page || 1,
      limit: queryDto.limit || 15,
    });
  }

  async findOne(idOrSlug: string, user?: User | null,ipAddress?: string): Promise<Thread> {
    this.logger.log(`Finding thread by id or slug: ${idOrSlug}`);
    let thread: Thread | null = null;
    const isUUID =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        idOrSlug,
      );

    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.author', 'author') // Yazar bilgisini join et
      .leftJoinAndSelect('thread.category', 'category'); // Kategori bilgisini join et

    if (isUUID) {
      thread = await queryBuilder
        .where('thread.id = :id', { id: idOrSlug })
        .getOne();
    } else {
      thread = await queryBuilder
        .where('thread.slug = :slug', { slug: idOrSlug })
        .getOne();
    }

    if (!thread) {
      this.logger.warn(`Thread not found: ${idOrSlug}`);
      throw new NotFoundException(
        `Thread with identifier ${idOrSlug} not found`,
      );
    }

    // TODO: Kategori görüntüleme iznini kontrol et (thread.category.minViewRole vs.)
    if (!thread.category) {
      this.logger.error(
        `Thread ${thread.id} is missing category information for permission check.`,
      );
      throw new ForbiddenException(
        'Cannot determine access permissions for this thread.',
      ); // Veya InternalServerError
    }
    this.checkCategoryViewPermission(thread.category, user);
    // Görüntülenme sayısını artır (Basit yöntem, race condition olabilir)
    // Daha iyisi: Redis gibi bir yerde sayıp periyodik olarak DB'ye yazmak veya message queue kullanmak.
    //planda çalışsın, hatayı loglasın ama akışı durdurmasın.


    if (ipAddress) { // IP adresi varsa işlem yap
      const viewKey = `${this.viewCountKeyPrefix}${thread.id}:${ipAddress}`;
      try {
          const alreadyViewed = await this.cacheService.get(viewKey);

          if (!alreadyViewed) { // Bu IP bu konuyu daha önce (TTL içinde) görmemiş
              this.logger.debug(`Unique view detected for thread ${thread.id} from IP ${ipAddress}. Incrementing count.`);
              // Sayacı artır (arka planda, hatayı sadece logla)
              this.threadRepository.increment({ id: thread.id }, 'viewCount', 1).catch(err => {
                  this.logger.error(`Failed to increment view count for thread ${thread.id}`, err);
              });
              // Bu IP'nin gördüğünü işaretle ve TTL ata
              const ttlMilliseconds = this.viewCountTtlSeconds * 1000;
              await this.cacheService.set(viewKey, 1, ttlMilliseconds); // Değer önemli değil, varlığı yeterli
          } else {
               this.logger.debug(`IP ${ipAddress} has already viewed thread ${thread.id} within TTL. Not incrementing count.`);
          }
      } catch(error) {
           this.logger.error(`Cache error during view count check for thread ${thread.id} and IP ${ipAddress}`, error);
           // Cache hatasında sayacı artırmamak daha güvenli olabilir.
      }
  } else {
       this.logger.warn(`No IP address provided for view count tracking on thread ${thread.id}`);
       // IP yoksa eski usul artırma yapılabilir veya hiç artırılmaz. Şimdilik artırmayalım.
       /*
       this.threadRepository.increment({ id: thread.id }, 'viewCount', 1).catch(err => {
          this.logger.error(`Failed to increment view count for thread ${thread.id}`, err);
       });
       */
  }


    return thread;
  }

  async update(
    id: string,
    updateThreadDto: ThreadForUpdateDto,
    user: User,
  ): Promise<Thread> {
    this.logger.log(
      `User ${user.username} attempting to update thread ID: ${id}`,
    );
    const thread = await this.threadRepository.findOne({
      where: { id },
      relations: ['author', 'category'],
    }); // Yazar ve kategori bilgisini al

    if (!thread) {
      throw new NotFoundException(`Thread with ID ${id} not found`);
    }

    // Yetki kontrolü: Ya yazar ya da Admin/Mod olmalı
    const isOwner = thread.authorId === user.id;
    const isAdminOrMod =
      user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR; // Mod rolü varsa

    if (!isOwner && !isAdminOrMod) {
      this.logger.warn(
        `User ${user.username} forbidden to update thread ID: ${id}`,
      );
      throw new ForbiddenException(
        'You do not have permission to update this thread.',
      );
    }

    // Sadece izin verilen alanları güncelle (örn: kategori taşıma ayrı bir işlem olabilir)
    const { title, isLocked, isPinned } = updateThreadDto;
    const updateData: Partial<Thread> = {};
    if (title !== undefined) updateData.title = title;
    if (isLocked !== undefined && isAdminOrMod) updateData.isLocked = isLocked; // Sadece admin/mod kilitleyebilir/açabilir
    if (isPinned !== undefined && isAdminOrMod) updateData.isPinned = isPinned; // Sadece admin/mod sabitleyebilir/kaldırabilir

    // merge ile sadece değişen alanları uygula
    this.threadRepository.merge(thread, updateData);

    try {
      // Slug title değişirse @BeforeUpdate ile güncellenir
      const updatedThread = await this.threadRepository.save(thread);
      this.logger.log(
        `Thread ID: ${id} updated successfully by user ${user.username}`,
      );
      return updatedThread;
    } catch (error) {
      this.logger.error(`Failed to update thread ID: ${id}`, error);
      if (error.code === '23505') {
        // Slug unique hatası
        throw new BadRequestException(
          'A thread with a similar title might already exist.',
        );
      }
      throw error;
    }
  }

  async remove(id: string, user: User): Promise<void> {
    this.logger.log(
      `User ${user.username} attempting to remove thread ID: ${id}`,
    );
    // İlişkili post sayısını almak için thread'i ilişkileriyle bulalım
    const thread = await this.threadRepository.findOne({
      where: { id },
      relations: ['author', 'category', 'posts'], // Postları da alalım (saymak için)
    });

    if (!thread) {
      throw new NotFoundException(`Thread with ID ${id} not found`);
    }

    // Yetki kontrolü: Ya yazar ya da Admin/Mod olmalı
    const isOwner = thread.authorId === user.id;
    const isAdminOrMod =
      user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR;

    if (!isOwner && !isAdminOrMod) {
      this.logger.warn(
        `User ${user.username} forbidden to remove thread ID: ${id}`,
      );
      throw new ForbiddenException(
        'You do not have permission to remove this thread.',
      );
    }

    const categoryId = thread.categoryId;
    const authorId = thread.authorId;
    // Silinecek post sayısı (ilk post dahil)
    const postCountToRemove =
      (await this.postsService.countPostsInThread(thread.id)) || 0;

    try {
      await this.threadRepository.remove(thread); // Bu işlem Posts için CASCADE delete tetiklemeli (entity tanımına göre)
      this.logger.log(
        `Thread ID: ${id} removed successfully by user ${user.username}`,
      );

      // İstatistikleri güncelle (Listener/Subscriber daha iyi)
      if (categoryId) {
        await this.categoriesService.decrementThreadCount(categoryId);
        if (postCountToRemove > 0) {
          await this.categoriesService.decrementPostCount(
            categoryId,
            postCountToRemove,
          );
        }
      }
      // if (authorId && postCountToRemove > 0) {
      //    await this.usersService.decrementPostCount(authorId, postCountToRemove);
      // }
    } catch (error) {
      this.logger.error(`Failed to remove thread ID: ${id}`, error);
      throw error;
    }
  }

  // İstatistik Güncelleme Yardımcı Metotları (Listener/Subscriber Alternatifi)
  async updateThreadStatsOnNewPost(
    threadId: string,
    postId: string,
    postCreatedAt: Date,
    postAuthorId: string,
  ) {
    try {
      // replyCount'ı artır, lastPost bilgilerini güncelle
      await this.threadRepository.update(threadId, {
        replyCount: () => '"replyCount" + 1', // Atomik artırma (raw SQL gibi)
        lastPostId: postId,
        lastPostAt: postCreatedAt,
        lastPostById: postAuthorId,
      });
      this.logger.debug(
        `Updated stats for thread ${threadId} after new post ${postId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update stats for thread ${threadId} after new post`,
        error,
      );
    }
  }

  async updateThreadStatsOnDeletePost(threadId: string, deletedPostId: string) {
    this.logger.debug(
      `Updating stats for thread ${threadId} after deleting post ${deletedPostId}`,
    );
    const thread = await this.threadRepository.findOneBy({ id: threadId });
    if (!thread) {
      this.logger.warn(
        `Thread ${threadId} not found while trying to update stats after post deletion.`,
      );
      return; // Thread yoksa işlem yapma
    }

    // Eğer silinen post son post ise, yeni son postu bulmamız gerekir
    let newLastPost: Post | null = null; // Post tipini belirtelim
    if (thread.lastPostId === deletedPostId) {
      // Silinen post dışındaki en son postu bulalım
      newLastPost = await this.postsService.findLastPostInThread(
        threadId,
        deletedPostId,
      ); // Exclude deleted post ID
      this.logger.debug(
        `Finding new last post for thread ${threadId} (excluding ${deletedPostId}). Found: ${newLastPost?.id ?? 'None'}`,
      );
    }

    try {
      // Güncellenecek verileri içeren nesne
      const updateData: Partial<Record<keyof Thread, any>> = {
        // Daha güvenli tip kullanımı
        // Atomik azaltma için Decrement operatörünü kullan
        replyCount: () => thread.replyCount - 1,
      };

      // Sadece lastPostId silinen postun ID'si ise ve yeni bir son post bulunduysa (null dahil) güncelle
      if (thread.lastPostId === deletedPostId) {
        updateData.lastPostId = newLastPost?.id ?? null;
        updateData.lastPostAt = newLastPost?.createdAt ?? null;
        updateData.lastPostById = newLastPost?.authorId ?? null;
        this.logger.debug(
          `Updating last post info for thread ${threadId} to post ${newLastPost?.id ?? 'null'}`,
        );
      }
      // else durumunda lastPost bilgileri değişmez, çünkü silinen post zaten son post değildi.

      // Eğer replyCount 0'ın altına düşmeyecekse veya başka kontroller varsa burada eklenebilir.
      // Örneğin: if (thread.replyCount > 0) { await ... }

      // updateData içinde en az bir alan varsa (sadece replyCount bile olsa) update yap
      await this.threadRepository.update({ id: threadId }, updateData); // ID ile güncelle
      this.logger.debug(
        `Updated stats for thread ${threadId} after deleting post ${deletedPostId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update stats for thread ${threadId} after deleting post`,
        error,
      );
      // Hata durumunda ne yapılacağına karar verilebilir (örn: tekrar deneme, kuyruğa atma)
    }
  }

  private checkCategoryViewPermission(
    category: Category,
    user?: User | null,
  ): void {
    const requiredRole = category.minViewRole;
    console.log(user);
    const userRole = user ? user.role : UserRole.GUEST; // Kullanıcı yoksa misafir

    // Rol hiyerarşisi (düşük sayı daha yetkili)
    const roleHierarchy = {
      [UserRole.ADMIN]: 0,
      [UserRole.MODERATOR]: 1,
      [UserRole.USER]: 2,
      [UserRole.GUEST]: 3,
    };

    // Admin her zaman görebilir varsayımı (opsiyonel)
    if (userRole === UserRole.ADMIN) {
      this.logger.verbose(
        `Admin user ${user?.username} bypassing view permission check for category ${category.id}`,
      );
      return; // Admin ise kontrole gerek yok
    }

    // Kullanıcının rol seviyesi, gereken rol seviyesinden büyükse (daha az yetkiliyse) izin verme
    if (roleHierarchy[userRole] > roleHierarchy[requiredRole]) {
      this.logger.warn(
        `Permission denied for user role ${userRole} to view category ${category.id} (requires ${requiredRole})`,
      );
      // NotFoundException fırlatmak, kategorinin varlığını gizler ama kafa karıştırıcı olabilir.
      // ForbiddenException daha net bilgi verir.
      throw new ForbiddenException(
        `You do not have permission to view this category. Required role: ${requiredRole}`,
      );
    }
    this.logger.verbose(
      `User role ${userRole} has permission to view category ${category.id} (requires ${requiredRole})`,
    );
    // İzin varsa metot sessizce biter.
  }

  // Basit İzin Kontrolü Yardımcı Metodu
  private checkPermission(
    requiredRole: UserRole,
    userRole: UserRole,
    action: string,
  ) {
    const roleHierarchy = {
      // Rollerin sayısal değerleri (düşük = daha yetkili)
      [UserRole.ADMIN]: 0,
      [UserRole.MODERATOR]: 1,
      [UserRole.USER]: 2,
      [UserRole.GUEST]: 3,
    };

    if (roleHierarchy[userRole] > roleHierarchy[requiredRole]) {
      this.logger.warn(
        `Permission denied for user role ${userRole} to ${action} (requires ${requiredRole})`,
      );
      throw new ForbiddenException(`You do not have permission to ${action}.`);
    }
  }
}
