import { Injectable, Logger, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { CachingService } from '../caching/caching.service';
import { UserService } from '../user/user.service'; // Kullanıcı işlemlerini yapacak servis
import { User, UserStatus } from '../user/entities/user.entity'; // User entity ve enum'ları
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid'; // Benzersiz token üretmek için
import { MailService } from 'src/mail/mail.service';

// Bu servis muhtemelen UsersService'e ihtiyaç duyacak, UsersService de buna
// ihtiyaç duyabilir (circular dependency). forwardRef kullanılabilir.
// Ayrıca bir MailService'e de ihtiyaç duyulacak (email göndermek için).

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly verificationTokenPrefix = 'verify_token:'; // Redis key ön eki
  private readonly verificationTokenPrefix2 = 'verify_token_by_id:'; // Redis key ön eki
  private readonly tokenTtlSeconds: number;

  constructor(
    private readonly cacheService: CachingService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService, // Email göndermek için eklenecek
    // Circular dependency'yi çözmek için forwardRef kullanıyoruz
    @Inject(forwardRef(() => UserService))
    private readonly usersService: UserService,
    // private readonly mailService: MailService // Email göndermek için eklenecek
  ) {
    // Token geçerlilik süresini .env'den alalım (örn: 24 saat)
    this.tokenTtlSeconds = this.configService.get<number>('VERIFICATION_TOKEN_TTL_SECONDS', 86400);
  }

 
  async resendVerificationToken(username: string): Promise<string> {
    // Kullanıcıyı bul
    const user = await this.usersService.findByUsernameOrEmail(username);
     // Kullanıcının ID'sini al
    if (!user) {
      this.logger.error(`User with ID ${username} not found for token resend.`);
      throw new NotFoundException('User not found');
    }
      const userId = user.id;
    // Kullanıcının mevcut durumunu kontrol et
    if (user.status !== UserStatus.PENDING_VERIFICATION) {
      this.logger.warn(`User ${userId} is not in PENDING_VERIFICATION status. Current status: ${user.status}`);
      throw new Error('User is not in a state to resend verification token.');
    }

    //Token var mı kontrol et
    const existingToken = await this.cacheService.get<string>(`${this.verificationTokenPrefix2}${userId}`);
    if (existingToken) {
      this.logger.warn(`Existing verification token found for user ${userId}. Token: ${existingToken}`);
      this.mailService.sendUserConfirmation(user.email, user.username, existingToken); // Mevcut token ile email gönder
      return existingToken; // Eğer varsa mevcut token'ı döndür
    }

    // Yeni token oluştur ve email gönder
    const newToken = await this.createVerificationToken(userId);
    this.logger.log(`New verification token created for user ${userId}. Token: ${newToken}`);
    this.mailService.sendUserConfirmation(user.email, user.username, newToken); // Yeni token ile email gönder
    return newToken; // Yeni token'ı döndür
    
  }

  /**
   * Kullanıcı için benzersiz bir doğrulama token'ı oluşturur ve Redis'e kaydeder.
   * @param userId Doğrulama yapılacak kullanıcının ID'si
   * @returns Oluşturulan token string'i
   */
  async createVerificationToken(userId: string): Promise<string> {
    const token = uuidv4();
    const key = `${this.verificationTokenPrefix}${token}`;
    const key2= `${this.verificationTokenPrefix2}${userId}`;
    const ttlMilliseconds = this.tokenTtlSeconds * 1000;

    try {
      // Redis'e token'ı anahtar, kullanıcı ID'sini değer olarak kaydet
      await this.cacheService.set(key, userId, ttlMilliseconds);
      await this.cacheService.set(key2, token, ttlMilliseconds);
      this.logger.log(`Verification token created for user ${userId}. Token: ${token} (Expires in ${this.tokenTtlSeconds}s)`);

      //--- BURADA EMAIL GÖNDERME İŞLEMİ YAPILACAK ---
      const user = await this.usersService.findById(userId); // Kullanıcı bilgisi alınır
      if (user) {
        await this.mailService.sendUserConfirmation(user.email, user.username, token);
        this.logger.log(`Verification email potentially sent to ${user.email}`);
      } else {
         this.logger.error(`User not found for ID ${userId} while trying to send verification email.`);
      }
      // --- EMAIL GÖNDERME SONU ---

      return token;
    } catch (error) {
      this.logger.error(`Failed to create verification token for user ${userId}`, error);
      // Hata durumunda null dönebilir veya özel bir exception fırlatılabilir
      throw new Error('Could not create verification token.');
    }
  }

  /**
   * Verilen token'ı doğrular, Redis'ten kontrol eder ve kullanıcı durumunu günceller.
   * @param token Doğrulanacak token
   * @returns Başarılı ise güncellenmiş User nesnesi, değilse null
   */
  async verifyToken(token: string): Promise<User | null> {
    const key = `${this.verificationTokenPrefix}${token}`;
    this.logger.log(`Attempting to verify token: ${token}`);

    try {
      // 1. Token Redis'te var mı ve ilişkili kullanıcı ID'sini al
      const userId = await this.cacheService.get<string>(key);

      if (!userId) {
        this.logger.warn(`Verification token not found or expired: ${token}`);
        return null; // Token bulunamadı veya süresi dolmuş
      }

      this.logger.log(`Token found, associated userId: ${userId}`);

      // 2. Kullanıcıyı veritabanından bul
      const user = await this.usersService.findById(userId); // UsersService'de findById metodu olmalı

      if (!user) {
        this.logger.error(`User with ID ${userId} associated with token ${token} not found in DB.`);
        // Token'ı cache'den silelim, çünkü geçersiz bir kullanıcıya işaret ediyor
        await this.cacheService.delete(key);
        return null;
      }

      // 3. Kullanıcının durumu zaten aktif mi kontrol et
      if (user.status === UserStatus.ACTIVE) {
        this.logger.warn(`User ${userId} is already active. Token ${token} might be redundant.`);
        // Token'ı cache'den silelim, artık gerekli değil
        await this.cacheService.delete(key);
        return user; // Kullanıcı zaten aktifse işlem tamam
      }

      // 4. Kullanıcının durumu PENDING_VERIFICATION mı kontrol et
      if (user.status !== UserStatus.PENDING_VERIFICATION) {
        this.logger.error(`User ${userId} has an unexpected status (${user.status}) for verification.`);
         // Token'ı cache'den silelim, bu token bu durumda kullanılmamalı
        await this.cacheService.delete(key);
        return null; // Beklenmeyen durum
      }

      // 5. Kullanıcı durumunu ACTIVE yap ve kaydet
      const updatedUser = await this.usersService.update(userId, { status: UserStatus.ACTIVE }); // UsersService'de update metodu olmalı
      this.logger.log(`User ${userId} status updated to ACTIVE.`);

      // 6. Başarıyla kullanılan token'ı Redis'ten sil
      await this.cacheService.delete(key);
      this.logger.log(`Verification token ${token} deleted from cache.`);

      return updatedUser;

    } catch (error) {
      this.logger.error(`Error during token verification process for token ${token}`, error);
      // Hata durumunda null dönmek genellikle güvenli bir yaklaşımdır
      return null;
    }
  }
}