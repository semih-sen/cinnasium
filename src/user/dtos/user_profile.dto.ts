import { Expose } from 'class-transformer'; // Response'ları şekillendirmek için (opsiyonel)
import { UserRole } from '../entities/user.entity';

// ClassSerializerInterceptor kullanırsak @Expose ile işaretli alanlar döner.
// Kullanmazsak, service katmanında manuel mapping yaparız.
export class UserProfileDto {
  @Expose()
  username: string;

  @Expose()
  avatarUrl?: string | null;

  @Expose()
  createdAt: Date; // Katılım tarihi

  @Expose()
  lastLoginAt?: Date | null; // Son görülme (veya daha sofistike bir 'lastActivityAt')

  @Expose()
  location?: string | null;

//   @Expose()
//   aboutMe?: string | null;

  @Expose()
  signature?: string | null;

//   @Expose()
//   postCount: number;

//   @Expose()
//   threadCount: number;

  // Rolü direkt enum olarak değil de belki daha okunabilir bir string olarak döndürmek isteyebiliriz.
  // @Transform(({ value }) => value.toUpperCase()) // Örnek transformasyon
  @Expose()
  role: UserRole; // Veya roleDisplayName: string;

  // Exclude passwordHash, email, status, id etc.
}