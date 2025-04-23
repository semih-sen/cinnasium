import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Reflector ile IS_PUBLIC_KEY metadata'sını kontrol et
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // Metot seviyesinde decorator var mı?
      context.getClass(),   // Class seviyesinde decorator var mı?
    ]);

    // Eğer @Public() decorator'ı varsa, guard'ı atla (true dön)
    if (isPublic) {
      this.logger.verbose(`Public route detected: ${context.getClass().name}.${context.getHandler().name}`);
      return true;
    }

    // @Public() yoksa, normal AuthGuard('jwt') davranışını uygula
    this.logger.verbose(`JWT Auth Guard activated for: ${context.getClass().name}.${context.getHandler().name}`);
    return super.canActivate(context);
  }

   // handleRequest, token yoksa veya geçersizse fırlatılacak hatayı özelleştirmek için override edilebilir.
   handleRequest(err, user, info) {
    if (err || !user) {
      this.logger.fatal(user)
      this.logger.warn(`JWT Authentication Error: ${info?.message || err?.message || 'No user found'}`);
      throw err || new UnauthorizedException(info?.message || 'Invalid or missing token');
    }
    // Kullanıcı doğrulandıysa kullanıcı nesnesini döndürür.
    return user;
  }
}