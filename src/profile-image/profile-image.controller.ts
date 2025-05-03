import { Controller, Get, Post, UseInterceptors, UploadedFile, Param, Res, Req, BadRequestException, UnauthorizedException, NotFoundException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileImageService } from './profile-image.service';

import { Request, Response } from 'express';

import { Public } from 'src/auth/decorators/public.decorator';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { UserService } from 'src/user/user.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRole } from 'src/user/entities/user.entity';


@Controller('auth')
export class ProfileImageController {
  constructor(
    private readonly profileImageService: ProfileImageService,
    private readonly userService:UserService
  ) {}

  @Post('setProfileImage')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', '..',"..", 'html',"avatars");
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req: any, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const username = req.user.username;
        cb(null, username + ext);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = ['image/jpeg', 'image/png'];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only jpg, png formats are allowed'), false);
      }
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  }))
  async uploadProfileImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const username = req.user.username;
    const ext = path.extname(file.originalname).toLowerCase();

    console.log(req.user);
    // Avatar URL oluştur
    const avatarUrl = `${username}${ext}`;

    // UserService kullanarak DB'de avatarUrl güncelle
    await this.userService.setProfileImage(req.user.userId, avatarUrl);

    return { message: 'Profile image uploaded and avatarUrl updated successfully', avatarUrl };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':username/profileImage')
  async getProfileImage(@Param('username') username: string, @Res() res: Response) {
    const uploadPath = path.join(__dirname, '..', '..', 'profileImages');
    const possibleExtensions = ['.jpg', '.jpeg', '.png', ];

    let foundFile:string|null = null;
    for (const ext of possibleExtensions) {
      const filePath = path.join(uploadPath, username + ext);
      if (fs.existsSync(filePath)) {
        foundFile = filePath;
        break;
      }
    }

    if (foundFile) {
      res.sendFile(foundFile);
    } else {
      res.status(404).json({ message: 'Profile image not found' });
    }
  }

}