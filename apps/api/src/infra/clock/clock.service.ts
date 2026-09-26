import { Injectable } from '@nestjs/common'

/** "Agora" do servidor, usado para validar detectedAt; nos testes é trocado por um FakeClock. */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date()
  }
}
