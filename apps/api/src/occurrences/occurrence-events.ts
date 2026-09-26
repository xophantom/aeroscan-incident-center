import { Injectable } from '@nestjs/common'
import { Subject } from 'rxjs'

/** O que mudou: o front só precisa saber que deve recarregar a lista. */
export interface OccurrenceChange {
  kind: 'created' | 'grouped' | 'status'
  id: string
}

/** Canal em memória entre quem muda as ocorrências (service) e quem avisa os fronts (gateway). */
@Injectable()
export class OccurrenceEvents {
  private readonly subject = new Subject<OccurrenceChange>()
  readonly changes = this.subject.asObservable()

  publish(change: OccurrenceChange): void {
    this.subject.next(change)
  }
}
