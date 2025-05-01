import { Body, Post, Controller, Get, Param, Query, UseGuards, HttpCode, HttpStatus,Request, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserForRegisterDto } from 'src/auth/dtos/user_for_register.dto';
import { VerificationService } from 'src/verification/verification.service';
import { UserForLoginDto } from './dtos/user_for_login.dto';
import { Public } from './decorators/public.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from 'src/user/user.service';
import { MailService } from 'src/mail/mail.service';
import { RegistrationGuard } from './guards/registration.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly verificationService: VerificationService,
  ) {}

  @Public()
  @UseGuards(RegistrationGuard)
  @Post('register') // POST /auth/register
  async register(@Body() registerDto: UserForRegisterDto) {
    return await this.authService.register(registerDto);
  }

  @Public() // Bu endpoint JWT gerektirmez
  @Get('verify_email')
  async verifyEmail(@Query() query) {
    
    return await this.verificationService.verifyToken(query.token);
  }

  @Public()
  @Get("testistanbul")
  async testIstanbul() {
    this.mailService.testistanbul("elyasiniozelsorular@gmail.com")
    return "ok"; // Başarılı olursa 200 döndür
  }
  
  @Public()
  @Post('resend_verification_email')
  async resendVerificationEmail(@Body("username") username:string) { 
    // Kullanıcıyı bul ve doğrulama e-postasını yeniden gönder
    await this.verificationService.resendVerificationToken(username);
    return {message:"Resent"} // Başarılı olursa 200 döndür
  }

  /**
   * Kullanıcı girişi için endpoint.
   * LocalAuthGuard, isteği yakalar, LocalStrategy'yi çalıştırır.
   * Başarılı olursa, request.user nesnesi doldurulur ve bu metoda geçilir.
   * @param req İstek nesnesi (request.user'ı içerir)
   * @param loginDto Body'den gelen DTO (Aslında LocalAuthGuard kullandığımız için DTO'ya direkt ihtiyaç yok ama validasyon için kalabilir)
   * @returns Access token içeren nesne
   */
  @Public() // Bu endpoint'in JWT koruması olmadığını belirtmek için (opsiyonel decorator)
  @UseGuards(AuthGuard('local')) // LocalStrategy'yi kullan
  @Post('login')
  @HttpCode(HttpStatus.OK) // Başarılı login için 200 OK döndür
  async login(@Request() req, @Body() loginDto: UserForLoginDto) {
      // LocalAuthGuard başarılı olursa, req.user içinde validateUser'dan dönen
      // kullanıcı nesnesi bulunur (parola hash'i olmadan).
      this.logger.log(`Login request successful for user: ${req.user.username}`);
      // AuthService.login'e bu kullanıcıyı gönderip JWT alalım
      return this.authService.login(req.user);
  }

   // --- Test Endpoint'i (JWT korumalı) ---
   /**
    * JWT korumalı örnek bir endpoint. Sadece geçerli token ile erişilebilir.
    * @param req İstek nesnesi (JwtAuthGuard tarafından doldurulan request.user'ı içerir)
    * @returns Giriş yapmış kullanıcının bilgileri (JwtStrategy.validate'den dönen)
    */
    // JwtStrategy'yi kullan
   @Get('profile')
   getProfile(@Request() req) {
       this.logger.log(`Profile request for user: ${req.user.username}`);
       // req.user, JwtStrategy'nin validate metodundan dönen değeri içerir.
       return req.user;
   }



    // --- Public Endpoint Örneği ---
    @Public() // Bu endpoint JWT gerektirmez
    @Get('status')
    getStatus() {
        return { status: 'Auth service is running' };
    }
}
