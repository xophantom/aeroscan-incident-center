import { ClockService } from '../../src/infra/clock/clock.service'

/** Relógio controlável: fixa o "agora" contra o qual a API valida o detectedAt dos alertas. */
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
