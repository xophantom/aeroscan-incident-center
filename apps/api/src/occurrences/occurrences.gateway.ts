import type { OnModuleDestroy } from '@nestjs/common'
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayInit,
} from '@nestjs/websockets'
import type { IncomingMessage } from 'node:http'
import type { Subscription } from 'rxjs'
import type { Server, WebSocket } from 'ws'
import { AppConfig } from '../config/app-config'
import { OccurrenceEvents, type OccurrenceChange } from './occurrence-events'

export const EVENTS_PATH = '/events'

/**
 * Avisa os fronts conectados que as ocorrências mudaram; eles recarregam a lista pelo GET, que
 * continua dono do filtro e da ordem. Os avisos saem deste processo: com várias instâncias da API,
 * precisariam de um pub/sub entre elas.
 */
@WebSocketGateway({ path: EVENTS_PATH })
export class OccurrencesGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() private readonly server!: Server
  private subscription?: Subscription

  constructor(
    private readonly events: OccurrenceEvents,
    private readonly config: AppConfig,
  ) {}

  afterInit(): void {
    this.subscription = this.events.changes.subscribe((change) => this.broadcast(change))
  }

  // Mesmas origens do CORS: o WebSocket não é barrado pelo navegador e não pode virar porta lateral
  handleConnection(client: WebSocket, request: IncomingMessage): void {
    if (!isAllowedOrigin(request, this.config.corsOrigins)) {
      client.close(1008, 'Origem não permitida')
    }
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe()
  }

  private broadcast(change: OccurrenceChange): void {
    const message = JSON.stringify({ type: 'occurrences.changed', ...change })
    for (const client of this.server.clients) {
      if (client.readyState === client.OPEN) client.send(message)
    }
  }
}

// Sem Origin é cliente fora do navegador, que o CORS também não barra; a própria API é a mesma origem
function isAllowedOrigin(request: IncomingMessage, allowed: readonly string[]): boolean {
  const { origin, host } = request.headers
  if (origin === undefined || allowed.includes(origin)) return true
  return URL.canParse(origin) && new URL(origin).host === host
}
