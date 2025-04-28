// src/subscribers/post-stats.subscriber.ts
import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    RemoveEvent,
    EntityManager, // Transaction içindeki işlemleri yapmak için
    DataSource,
    Repository, // Veya Connection - DI ve register için
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'; // NestJS DI için
import { Post } from '../post/entities/post.entity';
import { Thread } from '../thread/entities/thread.entity';
import { Category } from '../category/entities/category.entity';
// import { User } from '../users/entities/user.entity'; // Gerekirse

@Injectable() // NestJS DI için Injectable yapalım
@EventSubscriber() // TypeORM'e bunun bir subscriber olduğunu söyleyelim
export class PostStatsSubscriber implements EntitySubscriberInterface<Post> {
    private readonly logger = new Logger(PostStatsSubscriber.name);

    // Subscriber'ı DataSource'a manuel olarak kaydedeceğiz constructor içinde
    constructor(
        @InjectDataSource() readonly dataSource: DataSource,
        // VEYA EntityManager'ı direkt inject edebiliriz, ama DataSource daha genel
        // private readonly entityManager: EntityManager
        // Diğer repoları veya servisleri buraya inject edebiliriz
         @InjectRepository(Thread) private readonly threadRepository: Repository<Thread>,
         @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    ) {
        // Subscriber'ı TypeORM connection/dataSource'a manuel olarak kaydet
        dataSource.subscribers.push(this);
        this.logger.fatal('PostStatsSubscriber registered.');
    }

    // Hangi Entity'yi dinleyeceğimizi belirtiyoruz
    listenTo() {
        return Post;
    }

    /**
     * Bir Post veritabanına eklendikten SONRA çalışır.
     */
    async afterInsert(event: InsertEvent<Post>): Promise<void> {
        this.logger.debug(`Post INSERT detected: ${event.entity.id}`);
        // event.entity: Yeni eklenen Post nesnesi
        // event.manager: Bu transaction'ı yöneten EntityManager

        // Başlangıç postları için istatistik güncellemesini ThreadService yapar, burada atla
        if (event.entity.isThreadStarter) {
            this.logger.debug('Skipping stats update for initial post.');
            return;
        }

        const { threadId, authorId, id: postId, createdAt } = event.entity;
        const entityManager = event.manager; // Aynı transaction içinde çalış

        try {
             // 1. Thread istatistiklerini güncelle (replyCount, lastPost...)
             //    EntityManager.update veya increment/decrement kullanılabilir
            await entityManager.update(Thread, threadId, {
                replyCount: () => '"replyCount" + 1', // Atomik artırma
                lastPostId: postId,
                lastPostAt: createdAt,
                lastPostById: authorId,
            });
             this.logger.debug(`Updated thread ${threadId} stats after post insert.`);

             // 2. Kategori istatistiklerini güncelle (postCount)
             // Önce thread'den categoryId'yi almamız lazım (eğer event.entity'de yoksa)
             // Veya entityManager ile thread'i bulup categoryId'yi al
             const thread = await entityManager.findOneBy(Thread, { id: threadId });
             if (thread?.categoryId) {
                 await entityManager.increment(Category, { id: thread.categoryId }, 'postCount', 1);
                 this.logger.debug(`Incremented post count for category ${thread.categoryId}`);
             }

             // 3. Kullanıcı istatistiklerini güncelle (postCount)
             // if (authorId) {
             //     await entityManager.increment(User, { id: authorId }, 'postCount', 1);
             // }

        } catch (error) {
             this.logger.error(`Error in PostStatsSubscriber afterInsert for post ${event.entity.id}`, error);
             // Hata yönetimi: Transaction otomatik rollback olur, ama ekstra loglama vs yapılabilir.
             // Transaction'ı burada manuel rollback yapmaya gerek yok.
        }
    }

    /**
     * Bir Post veritabanından silindikten SONRA çalışır.
     */
    async afterRemove(event: RemoveEvent<Post>): Promise<void> {
         // event.databaseEntity: Silinmeden ÖNCEKİ Post nesnesi
         // event.entity: undefined (çünkü silindi)
         // event.entityId: Silinen Post'un ID'si
        if (!event.databaseEntity) {
            this.logger.warn('Post REMOVE event detected, but no databaseEntity found.');
            return; // Silinmeden önceki veri yoksa bir şey yapamayız
        }

         this.logger.debug(`Post REMOVE detected: ${event.databaseEntity.id}`);
         const { threadId, authorId, id: deletedPostId } = event.databaseEntity;
         const entityManager = event.manager;

          // Başlangıç postu silinemez kuralı serviste olduğu için burada tekrar kontrol etmeye gerek yok.

         try {
            // 1. Thread istatistiklerini güncelle (replyCount, lastPost...)
            //    Yeni son postu bulmamız gerekecek
            const newLastPost = await entityManager.findOne(Post, {
                 where: { threadId: threadId }, // Silinen hariç aynı thread'deki
                 order: { createdAt: 'DESC' } // En sonuncuyu al
             });
            this.logger.debug(`Finding new last post for thread ${threadId} after deleting ${deletedPostId}. Found: ${newLastPost?.id ?? 'None'}`);

            await entityManager.update(Thread, threadId, {
                 replyCount: () => '"replyCount" - 1', // Atomik azaltma (CHECK constraint önemli!)
                 lastPostId: newLastPost?.id ?? null,
                 lastPostAt: newLastPost?.createdAt ?? null,
                 lastPostById: newLastPost?.authorId ?? null,
             });
            this.logger.debug(`Updated thread ${threadId} stats after post remove.`);


            // 2. Kategori istatistiklerini güncelle (postCount)
             const thread = await entityManager.findOneBy(Thread, { id: threadId });
             if (thread?.categoryId) {
                // decrement kullanmak daha güvenli (0'ın altına düşmemesini sağlar, DB'ye bağlı)
                 await entityManager.decrement(Category, { id: thread.categoryId }, 'postCount', 1);
                  this.logger.debug(`Decremented post count for category ${thread.categoryId}`);
             }

            // 3. Kullanıcı istatistiklerini güncelle (postCount)
             // if (authorId) {
             //    await entityManager.decrement(User, { id: authorId }, 'postCount', 1);
             // }

         } catch (error) {
             this.logger.error(`Error in PostStatsSubscriber afterRemove for post ${deletedPostId}`, error);
         }
    }

    // afterUpdate gibi diğer event listener'lar da eklenebilir (örn: post başka konuya taşınırsa)
}