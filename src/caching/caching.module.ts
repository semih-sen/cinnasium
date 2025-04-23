import { Global, Module } from '@nestjs/common';
import { CachingService } from './caching.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';

@Global()
@Module({
    imports: [ConfigModule,
      CacheModule.registerAsync({
          useFactory: async () => {
            return {
              stores: [
                new KeyvRedis('redis://localhost:6379'),
              ],
            }; 
          },
        }),], // ConfigService'e erişim için ConfigModule import edilmeli
  providers: [CachingService],
    exports:[CachingService]
})
export class CachingModule {}
