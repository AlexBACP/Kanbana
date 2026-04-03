import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FichasService } from './fichas.service';
import { FichasController } from './fichas.controller';
import { Ficha } from './entities/ficha.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ficha])],
  controllers: [FichasController],
  providers: [FichasService],
})
export class FichasModule {}
