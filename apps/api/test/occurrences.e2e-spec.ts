import {
  DEDUP_WINDOW_MS,
  HOUR_MS,
  MAX_ALERT_AGE_MS,
  MAX_FUTURE_SKEW_MS,
  MAX_SEVERITY,
  MINUTE_MS,
  MIN_SEVERITY,
  OCCURRENCE_TYPES,
  computePriority,
  occurrenceResponseSchema,
  type CreateOccurrenceBody,
  type ErrorResponse,
  type OccurrenceFilter,
  type OccurrenceResponse,
} from '@aeroscan/shared'
import { getModelToken } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { z } from 'zod'
import { OCCURRENCE_MODEL, type OccurrenceDocument } from '../src/occurrences/occurrence.schema'
import {
  LIST_ORDER,
  OccurrencesRepository,
  PRIORITY_EXPRESSION,
  listFilter,
} from '../src/occurrences/occurrences.repository'
import { T0, createTestApp, type TestApp } from './support/create-test-app'

const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE_MS).toISOString()

describe('Occurrences (e2e)', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  }, 120_000)

  afterAll(async () => {
    await t?.close()
  })

  beforeEach(async () => {
    await t.reset()
  })

  function alert(overrides: Partial<CreateOccurrenceBody> = {}): CreateOccurrenceBody {
    return {
      siteId: 'site-a',
      droneId: 'drone-1',
      type: 'intrusion',
      severity: 2,
      detectedAt: t.clock.now().toISOString(),
      ...overrides,
    }
  }

  const post = (body: object) => t.http.post('/occurrences').send(body)
  const patch = (id: string, body: object) => t.http.patch(`/occurrences/${id}/status`).send(body)

  // Os helpers validam as respostas com o schema do contrato, o mesmo que o front usa
  async function list(query = ''): Promise<OccurrenceResponse[]> {
    const res = await t.http.get(`/occurrences${query}`).expect(200)
    return z.array(occurrenceResponseSchema).parse(res.body)
  }

  async function create(overrides: Partial<CreateOccurrenceBody> = {}) {
    const res = await post(alert(overrides)).expect(201)
    return occurrenceResponseSchema.parse(res.body)
  }

  const errorOf = (res: { body: unknown }) => (res.body as ErrorResponse).error

  describe('POST /occurrences', () => {
    it('cria com 201, count 1 e prioridade = severity × peso', async () => {
      const created = await create({ severity: 2, type: 'intrusion' })

      expect(created).toMatchObject({
        siteId: 'site-a',
        droneId: 'drone-1',
        type: 'intrusion',
        severity: 2,
        priority: 6,
        status: 'open',
        count: 1,
        note: null,
        detectedAt: T0.toISOString(),
        lastDetectedAt: T0.toISOString(),
      })
      expect(created.id).toMatch(/^[0-9a-f]{24}$/)
      expect(created).not.toHaveProperty('seq')
    })

    it('agrupa alerta repetido na janela: 200, count +1, severity +1, prioridade recalculada', async () => {
      const first = await create({ severity: 2 })
      t.clock.advance(5 * MINUTE_MS)

      const res = await post(alert({ droneId: 'drone-2', severity: 1 })).expect(200)

      expect(occurrenceResponseSchema.parse(res.body)).toMatchObject({
        id: first.id,
        count: 2,
        severity: 3,
        priority: 9,
        droneId: 'drone-1',
        detectedAt: T0.toISOString(),
        lastDetectedAt: t.clock.now().toISOString(),
      })
      expect(await list()).toHaveLength(1)
    })

    it('agrupa no limite exato de 10 minutos', async () => {
      await create()
      t.clock.advance(DEDUP_WINDOW_MS)

      await post(alert()).expect(200)
    })

    it('10 min + 1 s depois abre nova ocorrência, que passa a agrupar', async () => {
      const first = await create()
      t.clock.advance(DEDUP_WINDOW_MS + 1_000)

      const second = await create()
      const grouped = await post(alert()).expect(200)

      expect(second.id).not.toBe(first.id)
      expect(grouped.body).toMatchObject({ id: second.id, count: 2 })
      const byId = new Map((await list()).map((o) => [o.id, o]))
      expect(byId.get(first.id)?.count).toBe(1)
    })

    it('não agrupa com ocorrência acknowledged: o alerta novo abre outra', async () => {
      const first = await create()
      await patch(first.id, { status: 'acknowledged' }).expect(200)

      const second = await create()

      expect(second.id).not.toBe(first.id)
      expect(await list('?status=open')).toEqual([second])
    })

    it('não agrupa site ou tipo diferentes', async () => {
      await create()
      await create({ siteId: 'site-b' })
      await create({ type: 'signal_loss' })

      expect(await list()).toHaveLength(3)
    })

    it('severidade trava em 5', async () => {
      await create({ severity: 4 })
      await post(alert()).expect(200)
      const res = await post(alert()).expect(200)

      expect(res.body).toMatchObject({ count: 3, severity: MAX_SEVERITY, priority: 15 })
    })

    it.each([
      [
        'no futuro',
        MAX_FUTURE_SKEW_MS + 1_000,
        'detectedAt não pode estar mais de 1 min no futuro',
      ],
      ['atrasado', -MAX_ALERT_AGE_MS - 1_000, 'detectedAt não pode ter mais de 24 h de atraso'],
    ])('422 para detectedAt %s além do limite', async (_case, offset, message) => {
      const detectedAt = new Date(T0.getTime() + offset).toISOString()

      const res = await post(alert({ detectedAt })).expect(422)

      expect(errorOf(res)).toMatchObject({ code: 'VALIDATION_ERROR', message })
    })

    it('corrida: quem leu a versão antes de outra criação não cria duplicata', async () => {
      const repository = t.app.get(OccurrencesRepository)
      const slow = { ...alert(), severity: 1, detectedAt: T0 }
      const version = await repository.creationVersion(slow)
      expect(await repository.groupIntoOpenOccurrence(slow)).toBeNull()

      // Enquanto a requisição lenta está entre a busca e o insert, outras criam em T0 e em T0+15
      const first = await create()
      t.clock.advance(15 * MINUTE_MS)
      await create()

      expect(await repository.insertAtVersion(slow, version)).toBeNull()
      const res = await post(alert({ detectedAt: at(0) })).expect(200)
      expect(res.body).toMatchObject({ id: first.id, count: 2 })
    })

    it('concorrência fora de ordem: alertas de T0 e T0+15 min em paralelo viram 2 ocorrências, sem 409', async () => {
      t.clock.advance(15 * MINUTE_MS)

      for (let round = 0; round < 5; round++) {
        const siteId = `stress-${round}`
        const bodies = Array.from({ length: 40 }, (_, i) =>
          alert({ siteId, detectedAt: at(i % 2 === 0 ? 0 : 15) }),
        )

        const responses = await Promise.all(bodies.map((body) => post(body)))

        expect(responses.map((r) => r.status).sort()).toEqual([
          ...Array<number>(38).fill(200),
          201,
          201,
        ])
        const counts = (await list(`?siteId=${siteId}`)).map((o) => o.count)
        expect(counts).toEqual([20, 20])
      }
    })

    it('alerta fora de ordem agrupa na ocorrência cuja janela o contém, não na mais recente', async () => {
      const first = await create()
      t.clock.advance(15 * MINUTE_MS)
      const second = await create()

      const res = await post(alert({ detectedAt: at(5) })).expect(200)

      expect(second.id).not.toBe(first.id)
      expect(res.body).toMatchObject({ id: first.id, count: 2 })
    })

    it('alerta atrasado até 10 min antes da ocorrência agrupa nela; detectedAt continua o da abertura', async () => {
      const open = await create()

      const res = await post(alert({ detectedAt: at(-DEDUP_WINDOW_MS / MINUTE_MS) })).expect(200)

      expect(res.body).toMatchObject({
        id: open.id,
        count: 2,
        detectedAt: T0.toISOString(),
        lastDetectedAt: T0.toISOString(),
      })
    })

    it('alerta mais atrasado que a janela abre outra ocorrência', async () => {
      const open = await create()

      const late = await create({ detectedAt: new Date(T0.getTime() - 3 * HOUR_MS).toISOString() })

      expect(late.id).not.toBe(open.id)
      expect((await list()).map((o) => o.count)).toEqual([1, 1])
    })

    it('422 (e não 500) para detectedAt com offset que não vira data', async () => {
      const res = await post(alert({ detectedAt: '2026-09-25T12:00:00+24:00' })).expect(422)

      expect(errorOf(res).details).toEqual([
        { path: 'detectedAt', message: expect.stringContaining('ISO 8601') as unknown },
      ])
    })

    it('422 com envelope e detalhes por campo para body inválido', async () => {
      const res = await post({ siteId: '', type: 'fire', severity: 9 }).expect(422)

      const error = errorOf(res)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.details).toEqual(
        expect.arrayContaining([
          { path: 'siteId', message: 'siteId é obrigatório' },
          { path: 'severity', message: 'severity deve estar entre 1 e 5' },
          { path: 'detectedAt', message: 'detectedAt é obrigatório' },
        ]),
      )
    })

    it.each([
      ['text/plain', 'oi'],
      ['application/json', '[]'],
      ['application/json', '42'],
      ['application/json', 'null'],
      ['application/json', '"texto"'],
    ])('422 em PT-BR para corpo que não é objeto JSON (%s %s)', async (contentType, body) => {
      const res = await t.http
        .post('/occurrences')
        .set('Content-Type', contentType)
        .send(body)
        .expect(422)

      expect(errorOf(res).message).toBe('O corpo da requisição deve ser um objeto JSON')
    })

    it('400 no envelope para JSON malformado', async () => {
      const res = await t.http
        .post('/occurrences')
        .set('Content-Type', 'application/json')
        .send('{"siteId":')
        .expect(400)

      expect(errorOf(res).code).toBe('BAD_REQUEST')
    })

    it('413 no envelope para corpo acima do limite do body-parser', async () => {
      const res = await post(alert({ siteId: 'x'.repeat(200_000) })).expect(413)

      expect(errorOf(res).code).toBe('PAYLOAD_TOO_LARGE')
    })

    it('415 no envelope para charset não suportado', async () => {
      const res = await t.http
        .post('/occurrences')
        .set('Content-Type', 'application/json; charset=latin1')
        .send(JSON.stringify(alert()))
        .expect(415)

      expect(errorOf(res).code).toBe('UNSUPPORTED_MEDIA_TYPE')
    })

    it('concorrência: 20 POSTs idênticos em paralelo → 1 ocorrência com count 20', async () => {
      const total = 20
      const initialSeverity = 1
      const body = alert({ severity: initialSeverity })

      const responses = await Promise.all(Array.from({ length: total }, () => post(body)))

      const statuses = responses.map((r) => r.status)
      expect(statuses.filter((s) => s === 201)).toHaveLength(1)
      expect(statuses.filter((s) => s === 200)).toHaveLength(total - 1)

      const items = await list()
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({
        count: total,
        severity: Math.min(initialSeverity + total - 1, MAX_SEVERITY),
      })
    })
  })

  describe('GET /occurrences', () => {
    it('ordena por prioridade desc; no empate, a detecção mais recente primeiro', async () => {
      t.clock.advance(10 * MINUTE_MS)

      // Exemplo do enunciado: intrusion 3 (9) > perimeter_breach 4 (8) > low_battery 5 (5)
      await create({ type: 'low_battery', severity: 5, detectedAt: at(1) })
      await create({ type: 'perimeter_breach', severity: 4, detectedAt: at(2) })
      await create({ type: 'intrusion', severity: 3, detectedAt: at(0) })
      // Empata com low_battery (5), mas é mais recente
      await create({ type: 'signal_loss', severity: 5, detectedAt: at(3) })

      const items = await list()

      expect(items.map((o) => [o.type, o.priority])).toEqual([
        ['intrusion', 9],
        ['perimeter_breach', 8],
        ['signal_loss', 5],
        ['low_battery', 5],
      ])
    })

    it('filtra por status', async () => {
      const acked = await create({ type: 'intrusion' })
      await create({ type: 'low_battery' })
      await patch(acked.id, { status: 'acknowledged' }).expect(200)

      expect((await list('?status=acknowledged')).map((o) => o.id)).toEqual([acked.id])
      expect(await list('?status=open')).toHaveLength(1)
      expect(await list('?status=resolved')).toEqual([])
    })

    it('filtra por siteId', async () => {
      await create({ siteId: 'site-a' })
      await create({ siteId: 'site-b' })

      expect((await list('?siteId=site-b')).map((o) => o.siteId)).toEqual(['site-b'])
      expect(await list('?status=open&siteId=site-a')).toHaveLength(1)
    })

    it('filtros vazios valem como ausentes (?status=&siteId=)', async () => {
      await create({ siteId: 'site-a' })
      await create({ siteId: 'site-b' })

      expect(await list('?status=&siteId=')).toHaveLength(2)
    })

    it('422 para status desconhecido', async () => {
      const res = await t.http.get('/occurrences?status=closed').expect(422)

      expect(errorOf(res).message).toBe('status deve ser um de: open, acknowledged, resolved')
    })

    it('422 para siteId repetido na query', async () => {
      const res = await t.http.get('/occurrences?siteId=a&siteId=b').expect(422)

      expect(errorOf(res).message).toBe('siteId deve ser um texto')
    })

    it.each<OccurrenceFilter>([
      {},
      { status: 'open' },
      { siteId: 'site-a' },
      { status: 'open', siteId: 'site-a' },
    ])('filtro %j usa índice e não ordena em memória', async (filter) => {
      await create()
      const model = t.app.get<Model<OccurrenceDocument>>(getModelToken(OCCURRENCE_MODEL))

      const explain = (await model
        .find(listFilter(filter))
        .sort(LIST_ORDER)
        .explain('queryPlanner')) as unknown as { queryPlanner: { winningPlan: unknown } }
      const plan = JSON.stringify(explain.queryPlanner.winningPlan)

      expect(plan).toContain('"stage":"IXSCAN"')
      expect(plan).not.toContain('"stage":"SORT"')
    })

    it('empate total (prioridade e detecção): a criada por último primeiro, em ordem estável', async () => {
      const older = await create({ siteId: 'site-a' })
      const newer = await create({ siteId: 'site-b' })

      expect((await list()).map((o) => o.id)).toEqual([newer.id, older.id])
    })
  })

  describe('PATCH /occurrences/:id/status', () => {
    it('open → acknowledged → resolved, com nota (trim)', async () => {
      const { id } = await create()

      const acked = await patch(id, { status: 'acknowledged' }).expect(200)
      expect(occurrenceResponseSchema.parse(acked.body)).toMatchObject({
        id,
        status: 'acknowledged',
        note: null,
      })

      const resolved = await patch(id, { status: 'resolved', note: '  falso alarme  ' }).expect(200)
      expect(occurrenceResponseSchema.parse(resolved.body)).toMatchObject({
        id,
        status: 'resolved',
        note: 'falso alarme',
      })
    })

    it.each([
      [
        'pulo de etapa',
        'open',
        { status: 'resolved', note: 'x' },
        'De open só é possível ir para acknowledged.',
      ],
      [
        'transição reversa',
        'acknowledged',
        { status: 'open' },
        'De acknowledged só é possível ir para resolved.',
      ],
      ['mesmo status', 'open', { status: 'open' }, 'De open só é possível ir para acknowledged.'],
      ['saindo de resolved', 'resolved', { status: 'acknowledged' }, 'resolved é um status final.'],
    ] as const)('409 em %s (%s → %j)', async (_case, from, body, hint) => {
      const { id } = await create()
      if (from !== 'open') await patch(id, { status: 'acknowledged' }).expect(200)
      if (from === 'resolved') await patch(id, { status: 'resolved', note: 'ok' }).expect(200)

      const res = await patch(id, body).expect(409)

      expect(errorOf(res)).toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Transição inválida: ${from} → ${body.status}. ${hint}`,
        details: { from, to: body.status },
      })
    })

    it('422 ao resolver sem nota, sem alterar a ocorrência', async () => {
      const { id } = await create()
      await patch(id, { status: 'acknowledged' }).expect(200)

      for (const body of [{ status: 'resolved' }, { status: 'resolved', note: '   ' }]) {
        const res = await patch(id, body).expect(422)
        expect(errorOf(res)).toMatchObject({
          code: 'VALIDATION_ERROR',
          details: [{ path: 'note', message: 'A nota é obrigatória para resolver a ocorrência' }],
        })
      }
      expect((await list())[0]?.status).toBe('acknowledged')
    })

    it('422 para status desconhecido', async () => {
      const { id } = await create()

      const res = await patch(id, { status: 'closed' }).expect(422)

      expect(errorOf(res).code).toBe('VALIDATION_ERROR')
    })

    it('422 em PT-BR para PATCH sem corpo', async () => {
      const { id } = await create()

      const res = await t.http.patch(`/occurrences/${id}/status`).expect(422)

      expect(errorOf(res).message).toBe('O corpo da requisição deve ser um objeto JSON')
    })

    it.each([
      ['id inexistente', '66f4a1c2e4b0a1b2c3d4e5f6'],
      ['ObjectId malformado', 'nao-e-um-id'],
    ])('404 para %s', async (_case, id) => {
      const res = await patch(id, { status: 'acknowledged' }).expect(404)

      expect(errorOf(res).code).toBe('OCCURRENCE_NOT_FOUND')
    })

    it('dois "Reconhecer" simultâneos: um passa, o outro recebe 409', async () => {
      const { id } = await create()

      const responses = await Promise.all([
        patch(id, { status: 'acknowledged' }),
        patch(id, { status: 'acknowledged' }),
      ])

      expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    })
  })

  describe('prioridade denormalizada', () => {
    it('o boot (onModuleInit) recalcula prioridades gravadas com peso desatualizado', async () => {
      const created = await create({ type: 'intrusion', severity: 2 })
      await t.connection.collection('occurrences').updateOne({}, { $set: { priority: 99 } })

      await t.app.get(OccurrencesRepository).onModuleInit()

      expect(await list()).toMatchObject([
        { id: created.id, priority: 6, updatedAt: created.updatedAt },
      ])
    })

    it('a fórmula no Mongo bate com computePriority em todo tipo e severidade', async () => {
      const cases = OCCURRENCE_TYPES.flatMap((type) =>
        Array.from({ length: MAX_SEVERITY - MIN_SEVERITY + 1 }, (_, i) => ({
          type,
          severity: MIN_SEVERITY + i,
        })),
      )
      const db = t.connection.db
      if (!db) throw new Error('sem conexão com o Mongo')

      const rows = await db
        .aggregate<{ priority: number }>([
          { $documents: cases },
          { $set: { priority: PRIORITY_EXPRESSION } },
        ])
        .toArray()

      expect(rows.map((row) => row.priority)).toEqual(
        cases.map(({ type, severity }) => computePriority(severity, type)),
      )
    })
  })

  describe('infra', () => {
    it('GET /health reporta o Mongo', async () => {
      const res = await t.http.get('/health').expect(200)

      expect(res.body).toEqual({ status: 'ok', mongo: 'up' })
    })

    it('Swagger: filtros da listagem opcionais e erros de corpo documentados', async () => {
      interface Operation {
        parameters?: Array<{ name: string; required?: boolean }>
        responses: Record<string, { description?: string }>
      }
      const doc = (await t.http.get('/docs-json').expect(200)).body as {
        paths: Record<string, Record<string, Operation>>
      }
      const list = doc.paths['/occurrences']?.['get']
      const register = doc.paths['/occurrences']?.['post']
      const changeStatus = doc.paths['/occurrences/{id}/status']?.['patch']

      expect(list?.parameters?.map((p) => [p.name, p.required ?? false])).toEqual([
        ['status', false],
        ['siteId', false],
      ])
      expect(Object.keys(register?.responses ?? {})).toEqual(
        expect.arrayContaining(['200', '201', '400', '409', '413', '415', '422']),
      )
      expect(Object.keys(changeStatus?.responses ?? {})).toEqual(
        expect.arrayContaining(['200', '400', '404', '409', '413', '415', '422']),
      )
      expect(changeStatus?.responses['200']?.description).toBeTruthy()
    })

    it('GET / serve o front compilado', async () => {
      const res = await t.http.get('/').expect(200)

      expect(res.headers['content-type']).toContain('text/html')
      expect(res.text).toContain('<div id="root">')
    })

    it('rota desconhecida → 404 no envelope (sem fallback para o index.html)', async () => {
      const res = await t.http.get('/occurrences/abc/nada').expect(404)

      expect(errorOf(res).code).toBe('NOT_FOUND')
    })

    it('libera CORS para Origin null (front aberto via file://)', async () => {
      const res = await t.http
        .options('/occurrences/66f4a1c2e4b0a1b2c3d4e5f6/status')
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', 'PATCH')
        .expect(204)

      expect(res.headers['access-control-allow-origin']).toBe('null')
      expect(res.headers['access-control-allow-methods']).toContain('PATCH')
    })

    it('não libera CORS para outras origens', async () => {
      const res = await t.http.get('/occurrences').set('Origin', 'https://site-qualquer.example')

      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })
  })
})
