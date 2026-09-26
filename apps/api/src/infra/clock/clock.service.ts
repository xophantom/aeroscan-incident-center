import { Injectable } from '@nestjs/common'

/** Relógio injetável: nos testes é trocado por um relógio controlável. */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date()
  }
}
