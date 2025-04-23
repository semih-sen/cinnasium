import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { UserForRegisterDto } from 'src/auth/dtos/user_for_register.dto';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from 'src/user/entities/user.entity';
import { UserForCreateDto } from 'src/user/entities/user_for_create.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly usersService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  


  async register(user: UserForRegisterDto) {

    //Kullanıcıyı veritabanına eklemeden önce e-posta adresinin daha önce kullanılıp kullanılmadığını kontrol et
    // Bu kontrol, kullanıcı kaydı sırasında yapılmalıdır.
    const existingUserByEmail = await this.usersService.findByEmail(user.email);
    const existingUserByUsername = await this.usersService.findByUsername(user.username);
    
    if (existingUserByEmail || existingUserByUsername) {
      throw new ConflictException('Bu e-posta adresi veya kullanıcı adı zaten kullanılıyor.');
    }

    //Password'ü hashle
    const saltRounds = 10; // Hashleme için kullanılacak tuz sayısı
    const hashedPassword = await bcrypt.hash(user.password, saltRounds);

    // Kullanıcıyı oluştur ve veritabanına kaydet
    try {
        const userEntity:UserForCreateDto={
            username: user.username,
            email: user.email,
            passwordHash: hashedPassword, // Hashlenmiş parolayı kullan
            role: UserRole.USER, // Varsayılan rol 'user'
            status: UserStatus.PENDING_VERIFICATION, // Varsayılan durum 'pending_verification'
            avatarUrl: "default_avatar.png", // Varsayılan avatar URL'i (opsiyonel)
           
        }
        const newUser = await this.usersService.createUser(userEntity);
        
        const { passwordHash, ...result } = newUser; // Dönen yanıttan şifreyi çıkar
       
        return result;
      } catch (error) {
         // Veritabanı hatalarını yakala (örn: unique constraint ihlali - nadir ama olabilir)
        console.error('Kayıt sırasında hata:', error);
         throw new InternalServerErrorException('Kullanıcı kaydedilemedi.');
      }
  }


  /**
   * Kullanıcı adı/email ve parola ile kullanıcıyı doğrular.
   * LocalStrategy tarafından kullanılır.
   * @param usernameOrEmail Kullanıcının girdiği username veya email
   * @param pass Kullanıcının girdiği parola
   * @returns Başarılı ise User nesnesi (parola olmadan), değilse null
   */
  async validateUser(usernameOrEmail: string, pass: string): Promise<Omit<User, 'passwordHash'> | null> {
    this.logger.debug(`Attempting to validate user: ${usernameOrEmail}`);
    // Önce username ile bulmayı dene, sonra email ile
    let userPasswordHash = await this.usersService.findPasswordHashByUsernameOrEmail(usernameOrEmail);
    let user = await this.usersService.findByUsernameOrEmail(usernameOrEmail);

    if (!userPasswordHash || !user) {
        this.logger.warn(`Validation failed: User ${usernameOrEmail} not found.`);
        return null;
    }
    this.logger.debug(userPasswordHash)
    // Parolaları karşılaştır
    const isPasswordMatching = await bcrypt.compare(pass, userPasswordHash);

    if (userPasswordHash && isPasswordMatching) {
      this.logger.debug(`Validation successful for user: ${user?.username}`);
      // Başarılı doğrulamada parola hash'ini döndürme!
      const { passwordHash, ...result } = user;
      return result;
    }

    this.logger.warn(`Validation failed: Invalid password for user ${usernameOrEmail}`);
    return null;
  }

  /**
   * Doğrulanmış kullanıcı için JWT oluşturur ve döndürür.
   * @param user Doğrulanmış kullanıcı nesnesi (validateUser'dan gelen)
   * @returns Access token içeren nesne
   * @throws ForbiddenException Kullanıcı aktif değilse
   */
  async login(user: Omit<User, 'passwordHash'>): Promise<{ access_token: string }> {
    this.logger.log(`Attempting to log in user: ${user.username} (ID: ${user.id})`);

    // --- KULLANICI DURUM KONTROLÜ ---
    // Login olmadan önce kullanıcının aktif olup olmadığını kontrol et!
    const fullUser = await this.usersService.findById(user.id); // Status bilgisini almak için tekrar çekelim
    if (!fullUser) {
         // Bu durum normalde validateUser sonrası olmamalı ama garantiye alalım
         this.logger.error(`User ${user.id} validated but not found for status check.`);
         throw new UnauthorizedException('Login failed.');
    }

    if (fullUser.status !== UserStatus.ACTIVE) {
        this.logger.warn(`Login attempt failed for user ${user.username}: Status is ${fullUser.status}`);
        if (fullUser.status === UserStatus.PENDING_VERIFICATION) {
            throw new ForbiddenException('Account not verified. Please check your email.');
        } else if (fullUser.status === UserStatus.BANNED || fullUser.status === UserStatus.SUSPENDED) {
             throw new ForbiddenException('Your account is suspended or banned.');
        } else {
             throw new ForbiddenException('Account is not active.');
        }
    }
     // --- DURUM KONTROLÜ SONU ---


    // JWT Payload'ını hazırla (token içine gömülecek veri)
    // Hassas bilgileri (parola vs.) ASLA payload'a koyma!
    const payload = {
        username: user.username,
        sub: user.id, // 'sub' (subject) standardı genellikle kullanıcı ID'si için kullanılır
        role: user.role, // Kullanıcının rolünü de ekleyebiliriz yetkilendirme için
        // İhtiyaca göre başka bilgiler eklenebilir (örn: email)
        };
    this.logger.debug(`Generating JWT for user: ${user.username} with payload:`, payload);

    // Token'ı imzala ve döndür
    const accessToken = this.jwtService.sign(payload);
     this.logger.log(`User ${user.username} logged in successfully.`);

    return {
      access_token: accessToken,
    };
  }
}
