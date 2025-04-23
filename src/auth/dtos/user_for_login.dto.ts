import { IsNotEmpty, IsString, MinLength, MaxLength, IsEmail, ValidateIf } from 'class-validator';

export class UserForLoginDto {
  // Kullanıcı adı veya email olabilir. Biri zorunlu.
  @IsNotEmpty({ message: 'Username or email should not be empty' })
  @IsString()
  @MaxLength(255)
  username: string; // LocalStrategy'de usernameField: 'username' dediğimiz için bu isim önemli

  @IsNotEmpty({ message: 'Password should not be empty' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' }) // Güvenlik için min uzunluk
  password: string;
}