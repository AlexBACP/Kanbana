import { Test, TestingModule } from '@nestjs/testing';
import { FichasService } from './fichas.service';

describe('FichasService', () => {
  let service: FichasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FichasService],
    }).compile();

    service = module.get<FichasService>(FichasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
