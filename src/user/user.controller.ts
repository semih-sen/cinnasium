import { BadRequestException, Body, ClassSerializerInterceptor, Controller, Get, Param, Patch, Post, Put, Query, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRole } from './entities/user.entity';
import { FindUsersQueryDto } from './dtos/find_users_query.dto';
import { UserService } from './user.service';
import { UpdateUserDto } from './dtos/update_user.dto';
import { Public } from 'src/auth/decorators/public.decorator';

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

    @Patch("users/me")
    async update(@Request() req, @Body() body){

        return await this.userService.update(req.user._id, body)

    }


    @Public() // Herkesin erişebilmesi için
    @Get('users/:username')
    //@UseInterceptors(ClassSerializerInterceptor) // Eğer DTO'da @Expose kullandıysan bunu ekle
    async getUserProfile(@Param('username') username: string) /*: Promise<UserProfileDto>*/ {
     // this.logger.log(`Request received for user profile: ${username}`);
      return this.userService.findProfileByUsername(username);
    }


    @Put("users/:id")
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async updateUser(
        @Param("id") userId:string,
        @Body() body:UpdateUserDto
    ){
        if(!(body.role) && !(body.status)){
            throw new BadRequestException()
        }

       return await this.userService.update(userId, {...body})
      
    }
}
