import { Test, TestingModule } from '@nestjs/testing';
import { FichasController } from './fichas.controller';

describe('FichasController', () => {
  let controller: FichasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FichasController],
    }).compile();

    controller = module.get<FichasController>(FichasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
