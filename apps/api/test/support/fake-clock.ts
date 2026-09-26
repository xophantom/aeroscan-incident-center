import { ClockService } from '../../src/infra/clock/clock.service'

/** Relógio controlável: permite testar a janela de 10 min sem esperar. */
export class FakeClock extends ClockService {
  constructor(private current: Date) {
    super()
  }

  override now(): Date {
    return new Date(this.current)
  }

  set(date: Date): void {
    this.current = new Date(date)
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }
}
