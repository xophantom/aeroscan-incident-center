import {
  MAX_ALERT_AGE_MS,
  MAX_FUTURE_SKEW_MS,
  alertKey,
  type CreateOccurrenceInput,
} from '@aeroscan/shared'
import { AppException } from '../common/errors/app.exception'
import type { ClockService } from '../infra/clock/clock.service'
import type { Occurrence } from './occurrence'
import type { OccurrenceEvents } from './occurrence-events'
import { DuplicateAlertError, type OccurrencesRepository } from './occurrences.repository'
import { MAX_DEDUP_ATTEMPTS, OccurrencesService } from './occurrences.service'

const NOW = new Date('2026-09-25T12:00:00.000Z')

const alert: CreateOccurrenceInput = {
  siteId: 'site-a',
  droneId: 'drone-1',
  type: 'intrusion',
  severity: 2,
  detectedAt: NOW,
}

function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: '66f4a1c2e4b0a1b2c3d4e5f6',
    siteId: 'site-a',
    droneId: 'drone-1',
    droneIds: ['drone-1'],
    alerts: [{ droneId: 'drone-1', detectedAt: NOW }],
    type: 'intrusion',
    severity: 2,
    priority: 6,
    status: 'open',
    count: 1,
    note: null,
    detectedAt: NOW,
    lastDetectedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

type RepositoryMock = jest.Mocked<
  Pick<
    OccurrencesRepository,
    | 'creationVersion'
    | 'groupIntoOccurrence'
    | 'insertAtVersion'
    | 'findByAlertKey'
    | 'findById'
    | 'changeStatus'
  >
>

function setup() {
  const repository: RepositoryMock = {
    creationVersion: jest.fn().mockResolvedValue(0),
    groupIntoOccurrence: jest.fn().mockResolvedValue(null),
    insertAtVersion: jest.fn().mockResolvedValue(null),
    findByAlertKey: jest.fn().mockResolvedValue(occurrence()),
    findById: jest.fn().mockResolvedValue(null),
    changeStatus: jest.fn().mockResolvedValue(null),
  }
  const clock: ClockService = { now: () => NOW }
  const events = { publish: jest.fn() }
  const service = new OccurrencesService(
    repository as unknown as OccurrencesRepository,
    clock,
    events as unknown as OccurrenceEvents,
  )

  return { service, repository, events }
}

const firstCallOrder = (fn: { mock: { invocationCallOrder: number[] } }) =>
  fn.mock.invocationCallOrder[0] ?? Number.NaN

async function appError(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AppException) return error
    throw error
  }
  throw new Error('esperava AppException')
}

describe('OccurrencesService.register', () => {
  it('agrupa quando há ocorrência aberta na janela, sem tentar criar, e avisa a mudança', async () => {
    const { service, repository, events } = setup()
    const grouped = occurrence({ count: 2, severity: 3 })
    repository.groupIntoOccurrence.mockResolvedValue(grouped)

    await expect(service.register(alert)).resolves.toEqual({
      occurrence: grouped,
      outcome: 'grouped',
    })
    expect(repository.insertAtVersion).not.toHaveBeenCalled()
    expect(events.publish).toHaveBeenCalledWith({ kind: 'grouped', id: grouped.id })
  })

  it('lê a versão antes de buscar e a repassa para o insert', async () => {
    const { service, repository, events } = setup()
    const created = occurrence()
    repository.creationVersion.mockResolvedValue(4)
    repository.insertAtVersion.mockResolvedValue(created)

    await expect(service.register(alert)).resolves.toEqual({
      occurrence: created,
      outcome: 'created',
    })
    expect(events.publish).toHaveBeenCalledWith({ kind: 'created', id: created.id })

    expect(repository.insertAtVersion).toHaveBeenCalledWith(alert, 4, alertKey(alert))
    expect(firstCallOrder(repository.creationVersion)).toBeLessThan(
      firstCallOrder(repository.groupIntoOccurrence),
    )
  })

  it('perdeu a corrida no insert (E11000): relê a versão e agrupa no que a outra requisição criou', async () => {
    const { service, repository } = setup()
    const grouped = occurrence({ count: 2 })
    repository.groupIntoOccurrence.mockResolvedValueOnce(null).mockResolvedValueOnce(grouped)

    await expect(service.register(alert)).resolves.toEqual({
      occurrence: grouped,
      outcome: 'grouped',
    })
    expect(repository.creationVersion).toHaveBeenCalledTimes(2)
    expect(repository.insertAtVersion).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['ao agrupar', 'groupIntoOccurrence'],
    ['ao criar', 'insertAtVersion'],
  ] as const)(
    'reenvio (a chave do alerta já foi contada, recusada %s) devolve a ocorrência dele, sem aviso',
    async (_case, step) => {
      const { service, repository, events } = setup()
      const counted = occurrence({ count: 2 })
      repository[step].mockRejectedValue(new DuplicateAlertError())
      repository.findByAlertKey.mockResolvedValue(counted)

      await expect(service.register(alert)).resolves.toEqual({
        occurrence: counted,
        outcome: 'resent',
      })
      expect(repository.findByAlertKey).toHaveBeenCalledWith(alertKey(alert))
      // Nada mudou: os fronts não precisam recarregar
      expect(events.publish).not.toHaveBeenCalled()
    },
  )

  it(`desiste após ${MAX_DEDUP_ATTEMPTS} tentativas com WRITE_CONFLICT (503)`, async () => {
    const { service, repository } = setup()

    const error = await appError(service.register(alert))

    expect(error.code).toBe('WRITE_CONFLICT')
    expect(error.getStatus()).toBe(503)
    expect(repository.insertAtVersion).toHaveBeenCalledTimes(MAX_DEDUP_ATTEMPTS)
  })

  it.each([
    ['no futuro além da tolerância', MAX_FUTURE_SKEW_MS + 1_000],
    ['com mais de 7 dias de atraso', -MAX_ALERT_AGE_MS - 1_000],
  ])('rejeita detectedAt %s (422) sem tocar no banco', async (_case, offset) => {
    const { service, repository } = setup()

    const error = await appError(
      service.register({ ...alert, detectedAt: new Date(NOW.getTime() + offset) }),
    )

    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.getStatus()).toBe(422)
    expect(repository.creationVersion).not.toHaveBeenCalled()
  })
})

describe('OccurrencesService.changeStatus', () => {
  const id = '66f4a1c2e4b0a1b2c3d4e5f6'

  it('open → acknowledged: update condicional a partir de open, e avisa a mudança', async () => {
    const { service, repository, events } = setup()
    const updated = occurrence({ status: 'acknowledged' })
    repository.changeStatus.mockResolvedValue(updated)

    await expect(service.changeStatus(id, { status: 'acknowledged' })).resolves.toBe(updated)
    // A hora do reconhecimento vem do relógio: alerta detectado antes dela ainda entra na ocorrência
    expect(repository.changeStatus).toHaveBeenCalledWith(
      id,
      ['open'],
      { status: 'acknowledged' },
      NOW,
    )
    expect(repository.findById).not.toHaveBeenCalled()
    expect(events.publish).toHaveBeenCalledWith({ kind: 'status', id })
  })

  it('acknowledged → resolved: exige acknowledged como origem e repassa a nota', async () => {
    const { service, repository } = setup()
    const change = { status: 'resolved', note: 'falso positivo' } as const
    repository.changeStatus.mockResolvedValue(occurrence({ status: 'resolved', note: change.note }))

    await service.changeStatus(id, change)

    expect(repository.changeStatus).toHaveBeenCalledWith(id, ['acknowledged'], change, NOW)
  })

  it('corrida: se o status virou uma origem válida no meio, tenta de novo e aplica', async () => {
    const { service, repository } = setup()
    const change = { status: 'resolved', note: 'ok' } as const
    const resolved = occurrence({ status: 'resolved', note: 'ok' })
    repository.changeStatus.mockResolvedValueOnce(null).mockResolvedValueOnce(resolved)
    repository.findById.mockResolvedValue(occurrence({ status: 'acknowledged' }))

    await expect(service.changeStatus(id, change)).resolves.toBe(resolved)
    expect(repository.changeStatus).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['404 se a ocorrência não existe', null, 'OCCURRENCE_NOT_FOUND'],
    ['409 se a transição não vale (pular etapa)', 'open', 'INVALID_STATUS_TRANSITION'],
    ['422 só quando a transição vale', 'acknowledged', 'VALIDATION_ERROR'],
  ] as const)('resolver sem nota: %s', async (_case, current, code) => {
    const { service, repository } = setup()
    repository.findById.mockResolvedValue(current && occurrence({ status: current }))

    const error = await appError(service.changeStatus(id, { status: 'resolved' }))

    expect(error.code).toBe(code)
    expect(repository.changeStatus).not.toHaveBeenCalled()
  })

  it('404 quando o update não aplica e a ocorrência não existe', async () => {
    const { service } = setup()

    const error = await appError(service.changeStatus(id, { status: 'acknowledged' }))

    expect(error.code).toBe('OCCURRENCE_NOT_FOUND')
    expect(error.getStatus()).toBe(404)
  })

  it('409 com from/to quando o status atual não permite a transição (sem aviso)', async () => {
    const { service, repository, events } = setup()
    repository.findById.mockResolvedValue(occurrence({ status: 'open' }))

    const error = await appError(
      service.changeStatus(id, { status: 'resolved', note: 'pulando etapa' }),
    )

    expect(error.code).toBe('INVALID_STATUS_TRANSITION')
    expect(error.getStatus()).toBe(409)
    expect(error.details).toEqual({ from: 'open', to: 'resolved' })
    expect(events.publish).not.toHaveBeenCalled()
  })

  it('voltar para open nem tenta o update: 409', async () => {
    const { service, repository } = setup()
    repository.findById.mockResolvedValue(occurrence({ status: 'acknowledged' }))

    const error = await appError(service.changeStatus(id, { status: 'open' }))

    expect(repository.changeStatus).not.toHaveBeenCalled()
    expect(error.details).toEqual({ from: 'acknowledged', to: 'open' })
  })
})
