import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FichasService } from './fichas.service';
import { FichasController } from './fichas.controller';
import { Ficha } from './entities/ficha.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ficha, User]),
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [FichasController],
  providers: [FichasService],
  exports: [FichasService],
})
export class FichasModule {}
