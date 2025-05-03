import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service'; // Kullanıcının varlığını kontrol etmek için
import { UserStatus } from '../../user/entities/user.entity'; // Status enum

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') { // 'jwt' ismini veriyoruz
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UserService // Kullanıcı kontrolü için inject et
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false, // Süresi dolmuş token'ları reddet
            secretOrKey:configService.get<string>("JWT_SECRET") || "MY_SUPER_SECRET_KEY_NOBODY_KNOWS_IT" // Token'ın header'dan nasıl alınacağı
        })
    
     this.logger.log('JwtStrategy initialized');
  }

  /**
   * Passport tarafından otomatik çağrılır.
   * Gelen JWT doğrulanıp (imza, süre) decode edildikten sonra bu metot payload ile çağrılır.
   * Döndürülen değer request.user'a eklenir.
   * @param payload JWT içindeki decode edilmiş veri (AuthService.login'de oluşturduğumuz)
   * @returns request.user'a eklenecek kullanıcı bilgisi
   */
  async validate(payload: any): Promise<any> {
    this.logger.debug(`JwtStrategy validating payload for user ID: ${payload.sub}`);
    // Payload içindeki kullanıcı ID'si ile kullanıcının hala var olup olmadığını
    // ve durumunun aktif olup olmadığını kontrol etmek güvenlik açısından ÖNEMLİDİR.
    // Token geçerli olsa bile kullanıcı silinmiş veya banlanmış olabilir.
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
        this.logger.warn(`JWT validation failed: User with ID ${payload.sub} not found.`);
        throw new UnauthorizedException('User not found.');
    }

    if (user.status !== UserStatus.ACTIVE) {
        this.logger.warn(`JWT validation failed: User with ID ${payload.sub} is not active (Status: ${user.status}).`);
         throw new UnauthorizedException('User account is not active.');
    }

    // Payload'dan gerekli bilgileri alıp request.user'a ekleyelim.
    // Parola gibi hassas bilgileri ASLA buraya ekleme!
    const {passwordHash, ...result} = user
    const userDataForRequest = result;

         // Kullanıcı rolü (admin, user vs.)
        // email: user.email // Gerekirse eklenebilir

     this.logger.debug(`JWT validation successful for user: ${payload.username}`);

    return userDataForRequest;
  }
}