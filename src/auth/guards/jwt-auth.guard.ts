import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { // Strateji adı 'jwt'
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // @Public kontrolünü burada yapıp hemen true dönmek yerine,
    // canActivate'in normal akışına devam etmesine izin veriyoruz.
    // Kararı handleRequest içinde vereceğiz.
    this.logger.verbose(`JwtAuthGuard activated for: ${context.getClass().name}.${context.getHandler().name}`);
    return super.canActivate(context); // Passport stratejisini her zaman tetikle
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext): any {
    // Bu metot, Passport stratejisi (JwtStrategy) çalıştıktan sonra çağrılır.
    // err: Strateji hatası (örn: token geçersiz)
    // user: Stratejinin validate metodundan dönen değer (başarılı ise)
    // info: Hata detayları (örn: TokenExpiredError, JsonWebTokenError)
    // context: İstek context'i

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 1. Hata var mı VEYA kullanıcı bulunamadı mı?
    if (err || !user) {
      // 2. Eğer endpoint @Public ise, hata fırlatma, null/undefined döndür.
      //    Böylece istek devam eder ama req.user olmaz.
      if (isPublic) {
        this.logger.verbose(`Public route. Authentication failed or no token provided. Proceeding as guest. Info: ${info?.message || err?.message}`);
        return undefined; // Veya null - controller tarafında undefined kontrolü daha yaygın
      }
      // 3. Eğer endpoint public DEĞİLSE, normal Unauthorized hatasını fırlat.
      else {
        this.logger.warn(`Authentication Error on protected route: ${info?.message || err?.message || 'No user object returned'}`);
        throw err || new UnauthorizedException(info?.message || 'Invalid or missing token');
      }
    }

    // 4. Hata yok VE kullanıcı varsa (token geçerli), kullanıcı nesnesini döndür.
    //    Bu, req.user'a atanacak.
    this.logger.verbose(`Authentication successful. User attached to request: ${user.username}`);
    return user;
  }
}