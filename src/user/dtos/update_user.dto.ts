import { IsOptional } from "class-validator";
import { UserRole, UserStatus } from "../entities/user.entity";

export class UpdateUserDto{

    @IsOptional()
    status?:UserStatus

    @IsOptional()
    role?:UserRole
}