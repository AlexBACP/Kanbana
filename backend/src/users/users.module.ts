import { Module }              from '@nestjs/common';
import { TypeOrmModule }        from '@nestjs/typeorm';
import { MulterModule }         from '@nestjs/platform-express';
import { UsersController }      from './users.controller';
import { UsersService }         from './users.service';
import { User }                 from './entities/user.entity';
import { Project }              from '../projects/entities/project.entity';
import { Ficha }                from '../fichas/entities/ficha.entity';
import { NotificationsModule }  from '../notifications/notifications.module';
import * as path from 'path';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Project, Ficha]),
    NotificationsModule,
    MulterModule.register({
      dest: path.join(process.cwd(), 'uploads', 'avatars'),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
