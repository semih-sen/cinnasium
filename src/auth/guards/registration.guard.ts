import { Injectable, CanActivate, ExecutionContext, Inject, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CachingService } from '../../caching/caching.service'; // CacheService'i import et
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core'; // Request'e erişmek için
import { ThrottlerException } from '@nestjs/throttler'; // Veya kendi TooManyRequestsException'ın

@Injectable()
export class RegistrationGuard implements CanActivate {
    private readonly logger = new Logger(RegistrationGuard.name);
    private readonly limit: number;
    private readonly keyPrefix = 'register_limit:';

    constructor(
        private readonly cacheService: CachingService,
        private readonly configService: ConfigService,
        private readonly reflector: Reflector, // Gerekirse context'ten metadata okumak için
    ) {
        this.limit = this.configService.get<number>('REGISTRATION_LIMIT_PER_IP_PER_DAY', 2); // Default 5
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip; // trust proxy ayarı yapıldıysa doğru IP gelir

        if (!ip) {
            this.logger.warn('IP address not found for registration request. Allowing request.');
            return true; // IP yoksa (lokal test vb.) engelleme yapamayız
        }

        const key = `${this.keyPrefix}${ip}`;
        const currentCount = await this.cacheService.get<number>(key) ?? 0; // Mevcut sayıyı al, yoksa 0

        this.logger.debug(`Registration attempt from IP: ${ip}. Current count: ${currentCount}, Limit: ${this.limit}`);

        if (currentCount >= this.limit) {
            this.logger.warn(`Registration limit exceeded for IP: ${ip}`);
            // NestJS'in Throttler modülü varsa onun exception'ını kullanmak standart olur
            throw new ThrottlerException(`Too many registration attempts from this IP address. Please try again tomorrow.`);
            // Veya: throw new TooManyRequestsException('...'); (HTTP 429)
        }

        // Limite ulaşılmadıysa, sayacı artır ve TTL'i gün sonuna ayarla
        const newCount = currentCount + 1;
        const ttlInSeconds = this.getSecondsUntilMidnight();
        const ttlInMilliseconds = ttlInSeconds * 1000;

        // Eğer Keyv veya Redis adaptörün 'incr' destekliyorsa ve TTL set edebiliyorsa o daha iyi.
        // Yoksa get/set ile yapalım:
        try {
             await this.cacheService.set(key, newCount, ttlInMilliseconds);
             this.logger.debug(`Incremented registration count for IP: ${ip} to ${newCount}. TTL: ${ttlInSeconds}s`);
        } catch(error) {
            this.logger.error(`Failed to update registration count in cache for IP: ${ip}`, error);
            // Cache yazma hatasında isteğe izin vermek genellikle daha güvenlidir.
        }


        return true; // İsteğe izin ver
    }

    /**
     * Gece yarısına kadar kalan saniyeyi hesaplar.
     */
    private getSecondsUntilMidnight(): number {
        const now = new Date();
        const midnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1, // Bir sonraki günün başlangıcı
            0, 0, 0, 0 // Saat 00:00:00.000
        );
        // Zaman damgası farkını alıp saniyeye çevir
        const diffMilliseconds = midnight.getTime() - now.getTime();
        return Math.floor(diffMilliseconds / 1000);
    }
}