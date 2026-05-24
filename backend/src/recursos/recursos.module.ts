import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecursosService }    from './recursos.service';
import { RecursosController } from './recursos.controller';
import { ProyectoRecurso }    from './entities/proyecto-recurso.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProyectoRecurso])],
  controllers: [RecursosController],
  providers: [RecursosService],
  exports: [RecursosService],
})
export class RecursosModule {}
