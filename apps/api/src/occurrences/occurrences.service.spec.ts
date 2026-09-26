import { MAX_ALERT_AGE_MS, MAX_FUTURE_SKEW_MS, type CreateOccurrenceInput } from '@aeroscan/shared'
import { AppException } from '../common/errors/app.exception'
import type { ClockService } from '../infra/clock/clock.service'
import type { Occurrence } from './occurrence'
import type { OccurrencesRepository } from './occurrences.repository'
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
    | 'groupIntoOpenOccurrence'
    | 'insertAtVersion'
    | 'list'
    | 'findById'
    | 'changeStatus'
  >
>

function setup() {
  const repository: RepositoryMock = {
    creationVersion: jest.fn().mockResolvedValue(0),
    groupIntoOpenOccurrence: jest.fn().mockResolvedValue(null),
    insertAtVersion: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    changeStatus: jest.fn().mockResolvedValue(null),
  }
  const clock: ClockService = { now: () => NOW }
  const service = new OccurrencesService(repository as unknown as OccurrencesRepository, clock)

  return { service, repository }
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
  it('agrupa quando há ocorrência aberta na janela, sem tentar criar', async () => {
    const { service, repository } = setup()
    const grouped = occurrence({ count: 2, severity: 3 })
    repository.groupIntoOpenOccurrence.mockResolvedValue(grouped)

    await expect(service.register(alert)).resolves.toEqual({ occurrence: grouped, created: false })
    expect(repository.insertAtVersion).not.toHaveBeenCalled()
  })

  it('lê a versão antes de buscar e a repassa para o insert', async () => {
    const { service, repository } = setup()
    const created = occurrence()
    repository.creationVersion.mockResolvedValue(4)
    repository.insertAtVersion.mockResolvedValue(created)

    await expect(service.register(alert)).resolves.toEqual({ occurrence: created, created: true })

    expect(repository.insertAtVersion).toHaveBeenCalledWith(alert, 4)
    expect(firstCallOrder(repository.creationVersion)).toBeLessThan(
      firstCallOrder(repository.groupIntoOpenOccurrence),
    )
  })

  it('perdeu a corrida no insert (E11000): relê a versão e agrupa no que a outra requisição criou', async () => {
    const { service, repository } = setup()
    const grouped = occurrence({ count: 2 })
    repository.groupIntoOpenOccurrence.mockResolvedValueOnce(null).mockResolvedValueOnce(grouped)

    await expect(service.register(alert)).resolves.toEqual({ occurrence: grouped, created: false })
    expect(repository.creationVersion).toHaveBeenCalledTimes(2)
    expect(repository.insertAtVersion).toHaveBeenCalledTimes(1)
  })

  it(`desiste após ${MAX_DEDUP_ATTEMPTS} tentativas com WRITE_CONFLICT (503)`, async () => {
    const { service, repository } = setup()

    const error = await appError(service.register(alert))

    expect(error.code).toBe('WRITE_CONFLICT')
    expect(error.getStatus()).toBe(503)
    expect(repository.insertAtVersion).toHaveBeenCalledTimes(MAX_DEDUP_ATTEMPTS)
  })

  it.each([
    ['no futuro além da tolerância', MAX_FUTURE_SKEW_MS + 1_000],
    ['com mais de 24 h de atraso', -MAX_ALERT_AGE_MS - 1_000],
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

  it('open → acknowledged: update condicional a partir de open', async () => {
    const { service, repository } = setup()
    const updated = occurrence({ status: 'acknowledged' })
    repository.changeStatus.mockResolvedValue(updated)

    await expect(service.changeStatus(id, { status: 'acknowledged' })).resolves.toBe(updated)
    expect(repository.changeStatus).toHaveBeenCalledWith(id, ['open'], { status: 'acknowledged' })
    expect(repository.findById).not.toHaveBeenCalled()
  })

  it('acknowledged → resolved: exige acknowledged como origem e repassa a nota', async () => {
    const { service, repository } = setup()
    const change = { status: 'resolved', note: 'falso positivo' } as const
    repository.changeStatus.mockResolvedValue(occurrence({ status: 'resolved', note: change.note }))

    await service.changeStatus(id, change)

    expect(repository.changeStatus).toHaveBeenCalledWith(id, ['acknowledged'], change)
  })

  it('404 quando o update não aplica e a ocorrência não existe', async () => {
    const { service } = setup()

    const error = await appError(service.changeStatus(id, { status: 'acknowledged' }))

    expect(error.code).toBe('OCCURRENCE_NOT_FOUND')
    expect(error.getStatus()).toBe(404)
  })

  it('409 com from/to quando o status atual não permite a transição', async () => {
    const { service, repository } = setup()
    repository.findById.mockResolvedValue(occurrence({ status: 'open' }))

    const error = await appError(
      service.changeStatus(id, { status: 'resolved', note: 'pulando etapa' }),
    )

    expect(error.code).toBe('INVALID_STATUS_TRANSITION')
    expect(error.getStatus()).toBe(409)
    expect(error.details).toEqual({ from: 'open', to: 'resolved' })
  })

  it('voltar para open nem tenta o update: 409', async () => {
    const { service, repository } = setup()
    repository.findById.mockResolvedValue(occurrence({ status: 'acknowledged' }))

    const error = await appError(service.changeStatus(id, { status: 'open' }))

    expect(repository.changeStatus).not.toHaveBeenCalled()
    expect(error.details).toEqual({ from: 'acknowledged', to: 'open' })
  })
})

describe('OccurrencesService.list', () => {
  it('repassa os filtros ao repository', async () => {
    const { service, repository } = setup()
    const items = [occurrence()]
    repository.list.mockResolvedValue(items)

    await expect(service.list({ status: 'open', siteId: 'site-a' })).resolves.toBe(items)
    expect(repository.list).toHaveBeenCalledWith({ status: 'open', siteId: 'site-a' })
  })
})
