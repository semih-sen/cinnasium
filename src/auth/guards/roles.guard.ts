import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";

@Injectable()
export class RolesGuard implements CanActivate{

    constructor(private reflector: Reflector) {}

    matchRoles(roles: string[], userrole: string): boolean {
        return roles.some(role => role === userrole);
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const roles = this.reflector.get<string[]>('roles', context.getHandler());
        if (!roles) {
            return true; // Eğer rol yoksa, erişime izin ver
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user; // JWT'den gelen kullanıcı bilgileri
        return this.matchRoles(roles, user.role); // Kullanıcının rolü ile eşleşme kontrolü
    }

}