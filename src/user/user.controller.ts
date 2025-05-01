import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRole } from './entities/user.entity';
import { FindUsersQueryDto } from './dtos/find_users_query.dto';
import { UserService } from './user.service';

@Controller()
export class UserController {

constructor(
    private readonly userService:UserService
){}

    @Get("users")
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async getUsers(@Query() queryDto: FindUsersQueryDto,){
        return this.userService.getList(queryDto);
    }
}
