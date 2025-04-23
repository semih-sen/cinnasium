import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') { // 'local' ismini veriyoruz
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
        usernameField: 'username', // İstekte hangi alanın username olduğunu belirtiyoruz (email de olabilir, DTO'ya bağlı)
        // passwordField: 'password' // Varsayılan 'password' olduğu için genelde belirtmeye gerek yok
    });
    this.logger.log('LocalStrategy initialized');
  }

  /**
   * Passport tarafından otomatik çağrılır.
   * İstekten username/email ve password'ü alır, AuthService.validateUser'ı çağırır.
   * Eğer validateUser null dönerse, Passport otomatik olarak UnauthorizedException fırlatır.
   * Başarılı ise kullanıcı nesnesini döner.
   */
  async validate(usernameOrEmail: string, pass: string): Promise<any> {
    this.logger.debug(`LocalStrategy validating user: ${usernameOrEmail}`);
    const user = await this.authService.validateUser(usernameOrEmail, pass);
    if (!user) {
      this.logger.warn(`LocalStrategy validation failed for user: ${usernameOrEmail}`);
      throw new UnauthorizedException('Invalid credentials'); // Hata mesajını daha genel tutabiliriz
    }
    this.logger.debug(`LocalStrategy validation successful for user: ${user.username}`);
    return user; // Başarılı ise kullanıcı nesnesi dönülür (AuthGuard('local') bunu request.user'a ekler)
  }
}