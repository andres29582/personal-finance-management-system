import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GetCepDto } from './dto/get-cep.dto';
import { CepService } from './cep.service';

@Controller('cep')
export class CepController {
  constructor(private readonly cepService: CepService) {}

  @Get(':cep')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  lookup(@Param() params: GetCepDto) {
    return this.cepService.lookup(params.cep);
  }
}
