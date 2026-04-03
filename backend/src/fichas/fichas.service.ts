import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ficha } from './entities/ficha.entity';

@Injectable()
export class FichasService {
  constructor(
    @InjectRepository(Ficha)
    private fichasRepository: Repository<Ficha>,
  ) {}

  async create(createFichaDto: any): Promise<Ficha> {
    const ficha = this.fichasRepository.create(createFichaDto);
    return this.fichasRepository.save(ficha as any);
  }

  async findAll(): Promise<Ficha[]> {
    return this.fichasRepository.find();
  }

  async findOne(id: number): Promise<Ficha> {
    return this.fichasRepository.findOne({ where: { id } });
  }

  async update(id: number, updateFichaDto: any): Promise<Ficha> {
    await this.fichasRepository.update(id, updateFichaDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.fichasRepository.delete(id);
  }
}
