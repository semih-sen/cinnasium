import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { UserForRegisterDto } from '../auth/dtos/user_for_register.dto';
import { UserForCreateDto } from './entities/user_for_create.dto';
import { VerificationService } from 'src/verification/verification.service';
import { FindUsersQueryDto } from './dtos/find_users_query.dto';
import { paginate, Pagination } from 'nestjs-typeorm-paginate';
import { UserProfileDto } from './dtos/user_profile.dto';

@Injectable()
export class UserService {
  setProfileImage(id: any, newFilename: string) {
    this.update(id, { avatarUrl: newFilename });
  }
  // Kullanıcı ile ilgili işlemler burada tanımlanacak
  // Örneğin: createUser, findUser, updateUser, deleteUser gibi metodlar
  // TypeORM kullanarak veritabanı işlemleri gerçekleştirebilirsiniz.
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly verificationService: VerificationService,
    // Doğrulama servisi
  ) {}

  async createUser(user: UserForCreateDto) {
    let newUser = this.userRepository.create(user);
    let u = await this.userRepository.save(newUser);
    try {
      await this.verificationService.createVerificationToken(u.id);
      // Email gönderme burada tetiklenmiş olacak (VerificationService içinde)
    } catch (error) {
      // Token oluşturma/email gönderme hatasını logla ama kullanıcı oluşturmayı geri alma
      this.logger.error(
        `Failed to initiate verification for user ${u.id}`,
        error,
      );
    }
    return u;
  }

  async findProfileByUsername(username: string): Promise<UserProfileDto> {
    this.logger.log(`Workspaceing profile for username: ${username}`);
    const user = await this.findByUsername(username);

    if (!user) {
      this.logger.warn(`User profile not found for username: ${username}`);
      throw new NotFoundException(`User '${username}' not found.`);
    }

    // Entity'den DTO'ya manuel mapping ve hassas verileri filtreleme
    const userProfile: UserProfileDto = {
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      location: user.location,
     
      signature: user.signature,
      // Bu alanların entity'de olması ve güncel olması lazım!
      role: user.role, // Ham rolü döndürdük, frontend'de gösterim ayarlanabilir.
    };

    this.logger.log(`Profile found for username: ${username}`);
    return userProfile;
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }
  async findByUsername(username: string): Promise<User | null> {
    let user = await this.userRepository.findOneBy({ username });
    console.log(user?.passwordHash);
    return user;
  }
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    if (usernameOrEmail.includes('@')) {
      return this.findByEmail(usernameOrEmail);
    } else {
      return this.findByUsername(usernameOrEmail);
    }
  }

  async findPasswordHashByUsernameOrEmail(
    usernameOrEmail: string,
  ): Promise<string | null> {
    if (usernameOrEmail.includes('@')) {
      const user = await this.userRepository.findOne({
        where: { email: usernameOrEmail },
        select: ['passwordHash'],
      });
      return user ? user.passwordHash : null;
    }
    const user = await this.userRepository.findOne({
      where: { username: usernameOrEmail },
      select: ['passwordHash'],
    });
    return user ? user.passwordHash : null;
  }

  async getList(queryDto: FindUsersQueryDto): Promise<Pagination<User>> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.username', 'ASC');
    return paginate<User>(query, {
      limit: queryDto.limit || 1,
      page: queryDto.page || 20,
    });
  }

  /**
   * Belirtilen ID'ye sahip kullanıcıyı verilen verilerle günceller.
   * @param id Güncellenecek kullanıcının ID'si
   * @param updateUserDto Güncellenecek alanları içeren Partial<User> nesnesi
   * @returns Güncellenmiş kullanıcı nesnesi (parola hash'i olmadan)
   * @throws NotFoundException Kullanıcı bulunamazsa
   */
  async update(id: string, updateUserDto: Partial<User>): Promise<User> {
    this.logger.log(`Attempting to update user with ID: ${id}`);

    // 1. Kullanıcıyı ve mevcut verilerini yükle (preload ile)
    // preload, ID'yi bulur ve updateUserDto'daki alanları mevcut entity üzerine yazar.
    // Eğer ID bulunamazsa undefined döner.
    const userToUpdate = await this.userRepository.preload({
      id: id,
      ...updateUserDto, // Gelen yeni verileri mevcut verilerin üzerine yaz
    });

    // 2. Kullanıcı bulunamadıysa hata fırlat
    if (!userToUpdate) {
      this.logger.warn(`User with ID ${id} not found for update.`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // 3. Değişiklikleri veritabanına kaydet
    try {
      const updatedUser = await this.userRepository.save(userToUpdate);
      this.logger.log(`User with ID: ${id} updated successfully.`);

      // 4. Hassas verileri (parola hash'i) sonuçtan çıkarıp döndür
      const { passwordHash, ...result } = updatedUser;
      return result as User;
    } catch (error) {
      this.logger.error(`Failed to update user with ID: ${id}`, error);
      // Veritabanı hatası veya başka bir sorun olabilir
      // Burada daha spesifik hata yönetimi yapılabilir (örn: duplicate key hatası)
      throw error; // Hatanın yukarıya fırlatılması
    }
  }
}
