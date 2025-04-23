import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Keyv from 'keyv';
import  KeyvAdapter  from '@keyv/redis';
import { ConfigService } from '@nestjs/config'; // Konfigürasyon için

@Injectable()
export class CachingService implements OnModuleInit, OnModuleDestroy {
  private keyv: Keyv;
  private readonly logger = new Logger(CachingService.name);
  private readonly defaultTtl: number; // Varsayılan TTL (milisaniye)

  constructor(private readonly configService: ConfigService) {
    // Redis bağlantı bilgisini .env dosyasından alalım
    const redisUrl = this.configService.get<string>('REDIS_URL'); // Örn: redis://:password@hostname:port
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set.');
    }

    const redisAdapter = new KeyvAdapter(redisUrl);
    redisAdapter.on('error', (err) => this.logger.error('Redis Adapter Error:', err));

    this.keyv = new Keyv({
      store: redisAdapter,
      namespace: 'ehlisir-cache', // İsteğe bağlı: Redis'te key'lere ön ek ekler
    });

    this.keyv.on('error', (err) => this.logger.error('Keyv Error:', err));

    // Varsayılan TTL'yi de config'den alabiliriz (örn: 1 saat)
    this.defaultTtl = this.configService.get<number>('CACHE_DEFAULT_TTL_MS', 3600 * 1000);
  }

  async onModuleInit() {
    this.logger.log('CacheService initialized and connected to Redis.');
    // İsteğe bağlı: Bağlantıyı test etmek için basit bir set/get
    try {
      await this.keyv.set('cache-init-test', 'ok', 10000); // 10 saniye TTL
      const testValue = await this.keyv.get('cache-init-test');
      if (testValue === 'ok') {
        this.logger.log('Redis connection test successful.');
      } else {
        this.logger.warn('Redis connection test returned unexpected value.');
      }
      await this.keyv.delete('cache-init-test');
    } catch (error) {
        this.logger.error('Redis connection test failed:', error);
    }
  }

  async onModuleDestroy() {
    try {
        // Keyv v4.x.x'den itibaren disconnect metodu olmayabilir.
        // Adapter'ın veya underlying client'ın disconnect'i çağrılabilir.
        // Şimdilik sadece log bırakalım. Gerekirse KeyvAdapter'ın detaylarına bakılabilir.
        this.logger.log('CacheService disconnecting (Keyv does not require explicit disconnect).');
    } catch (error) {
        this.logger.error('Error during Keyv disconnect:', error);
    }
  }

  /**
   * Cache'e veri ekler.
   * @param key Anahtar
   * @param value Değer
   * @param ttl Milisaniye cinsinden Time-To-Live (opsiyonel, varsayılan kullanılır)
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.keyv.set(key, value, ttl ?? this.defaultTtl);
      this.logger.debug(`Cache SET - Key: ${key}, TTL: ${ttl ?? this.defaultTtl}ms`);
    } catch (error) {
      this.logger.error(`Cache SET failed - Key: ${key}`, error);
      // Hata yönetimi eklenebilir (örn: tekrar deneme, Circuit Breaker vb.)
      throw error; // Hatanın yukarıya fırlatılması
    }
  }

  /**
   * Cache'den veri okur.
   * @param key Okunacak anahtar
   * @returns Değer veya bulunamazsa undefined
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.keyv.get(key);
      this.logger.debug(`Cache GET - Key: ${key}, Found: ${value !== undefined}`);
      return value as T | undefined;
    } catch (error) {
      this.logger.error(`Cache GET failed - Key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Cache'den veri siler.
   * @param key Silinecek anahtar
   * @returns Silme başarılıysa true, anahtar yoksa veya hata olursa false
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.keyv.delete(key);
      this.logger.debug(`Cache DELETE - Key: ${key}, Result: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Cache DELETE failed - Key: ${key}`, error);
      // Silme işleminde hata olursa genellikle false dönmek yeterli olabilir
      return false;
    }
  }

  /**
   * Cache'i tamamen temizler (Namespace kullanılıyorsa sadece o namespace'i).
   * Dikkatli kullanılmalı!
   */
  async clear(): Promise<void> {
    try {
      await this.keyv.clear();
      this.logger.warn('Cache cleared!');
    } catch (error) {
      this.logger.error('Cache CLEAR failed', error);
      throw error;
    }
  }
}