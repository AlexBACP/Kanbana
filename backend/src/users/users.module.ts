import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import * as path from 'path';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MulterModule.register({
      dest: path.join(process.cwd(), 'uploads', 'avatars'),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
