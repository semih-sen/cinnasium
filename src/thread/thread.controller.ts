import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request, // req.user'ı almak için
    Query,
    HttpCode,
    HttpStatus,
    Logger,
    ParseUUIDPipe,
    Put
  } from '@nestjs/common';
  import { ThreadService } from './thread.service';
  import { ThreadForCreateDto } from './dtos/thread_for_create.dto';
  import { ThreadForUpdateDto } from './dtos/thread_for_update.dto';
  import { FindThreadsQueryDto } from './dtos/find_threads_query.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { Public } from '../auth/decorators/public.decorator';
  import { User } from '../user/entities/user.entity'; // User tipini almak için
import { UserService } from 'src/user/user.service';
  
  @Controller("threads") // Ana path'i modül bazında (örn: AppModule'de /forum) veya burada belirleyebiliriz
  export class ThreadController {
     private readonly logger = new Logger(ThreadController.name);
  
    constructor(private readonly threadsService: ThreadService, private readonly userService:UserService) {}
  
    // Yeni konu oluşturma (Giriş yapmış kullanıcılar)
    @Post('create') // POST /threads // Sadece giriş yapmış kullanıcılar
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createThreadDto: ThreadForCreateDto, @Request() req) {
        const _user = req.user; 
        
         // req.user, JwtAuthGuard tarafından eklenir
        const user = await this.userService.findById(_user.userId); 
        if (!user) {
            this.logger.error(`User not found: ${_user.id}`);   
            throw new Error('User not found');
        }
        // Kullanıcıyı bulma işlemi
         // req.user, JwtAuthGuard tarafından eklenir
         //JwtAuthGuard user nesnesini request'e ekler
        this.logger.log(`User ${user.username} requesting to create thread`);
        return this.threadsService.create(createThreadDto, user);
    }
  
    // Bir kategoriye ait konuları listeleme (Public)
    @Public()
    @Get('category/:categoryIdOrSlug/list') // GET /categories/kategori-slug/threads
    findAllByCategory(
        @Param('categoryIdOrSlug') categoryIdOrSlug: string,
        @Query() queryDto: FindThreadsQueryDto,
        @Request() req
        ) {
            const user: User | undefined = req.user;
            console.log(req.user); // req.user, JwtAuthGuard tarafından eklenir
        this.logger.log(`Request received to list threads for category: ${categoryIdOrSlug}`);
        return this.threadsService.findAllByCategory(categoryIdOrSlug, queryDto,user);
    }
  
    // Belirli bir konuyu ID veya Slug ile getirme (Public)
    @Public()
    @Get(':idOrSlug') // GET /threads/konu-slug veya /threads/uuid
    findOne(@Param('idOrSlug') idOrSlug: string, @Request() req) {
        const user: User | undefined = req.user;
        const ipAddress: string | undefined = req.ip;
        this.logger.log(`Request received to find thread: ${idOrSlug}`);
        return this.threadsService.findOne(idOrSlug, user,ipAddress);
    }
  
    // Konu güncelleme (Yazar veya Admin/Mod)
    @Put(':id') // PUT /threads/uuid
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateThreadDto: ThreadForUpdateDto,
        @Request() req
        ) {
         const user: User = req.user;
         this.logger.log(`User ${user.username} requesting to update thread ID: ${id}`);
        // Yetki kontrolü service katmanında yapılıyor
        return this.threadsService.update(id, updateThreadDto, user);
    }
  
    // Konu silme (Yazar veya Admin/Mod)
    @Delete(':id') // DELETE /threads/uuid
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
         const user: User = req.user;
         this.logger.log(`User ${user.username} requesting to remove thread ID: ${id}`);
         // Yetki kontrolü service katmanında yapılıyor
        return this.threadsService.remove(id, user);
    }
  }