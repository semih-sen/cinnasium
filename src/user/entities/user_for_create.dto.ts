import { UserRole, UserStatus } from "./user.entity";

export class UserForCreateDto {
  username: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  role:UserRole
  avatarUrl: string;  
}