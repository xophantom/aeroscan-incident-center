import {
  DEDUP_WINDOW_MS,
  MAX_SEVERITY,
  type CreateOccurrenceBody,
  type ErrorResponse,
  type OccurrenceResponse,
} from '@aeroscan/shared'
import { T0, createTestApp, type TestApp } from './support/create-test-app'

const MINUTE = 60_000

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
      site_id: 'site-a',
      drone_id: 'drone-1',
      type: 'intrusion',
      severity: 2,
      detected_at: t.clock.now().toISOString(),
      ...overrides,
    }
  }

  const post = (body: object) => t.http.post('/occurrences').send(body)
  const patch = (id: string, body: object) => t.http.patch(`/occurrences/${id}/status`).send(body)

  async function list(query = ''): Promise<OccurrenceResponse[]> {
    const res = await t.http.get(`/occurrences${query}`).expect(200)
    return res.body as OccurrenceResponse[]
  }

  async function create(overrides: Partial<CreateOccurrenceBody> = {}) {
    const res = await post(alert(overrides)).expect(201)
    return res.body as OccurrenceResponse
  }

  const errorOf = (res: { body: unknown }) => (res.body as ErrorResponse).error

  describe('POST /occurrences', () => {
    it('cria com 201, count 1 e prioridade = severity × peso', async () => {
      const created = await create({ severity: 2, type: 'intrusion' })

      expect(created).toMatchObject({
        site_id: 'site-a',
        drone_id: 'drone-1',
        type: 'intrusion',
        severity: 2,
        priority: 6,
        status: 'open',
        count: 1,
        note: null,
        detected_at: T0.toISOString(),
        last_detected_at: T0.toISOString(),
      })
      expect(created.id).toMatch(/^[0-9a-f]{24}$/)
    })

    it('agrupa alerta repetido na janela: 200, count +1, severity +1, prioridade recalculada', async () => {
      const first = await create({ severity: 2 })
      t.clock.advance(5 * MINUTE)

      const res = await post(alert({ drone_id: 'drone-2', severity: 1 })).expect(200)

      expect(res.body).toMatchObject({
        id: first.id,
        count: 2,
        severity: 3,
        priority: 9,
        drone_id: 'drone-1',
        detected_at: T0.toISOString(),
        last_detected_at: t.clock.now().toISOString(),
      })
      expect(await list()).toHaveLength(1)
    })

    it('agrupa no limite exato de 10 minutos', async () => {
      await create()
      t.clock.advance(DEDUP_WINDOW_MS)

      await post(alert()).expect(200)
    })

    it('fora da janela (relógio avançado) abre nova ocorrência, que passa a agrupar', async () => {
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
      await create({ site_id: 'site-b' })
      await create({ type: 'signal_loss' })

      expect(await list()).toHaveLength(3)
    })

    it('severidade trava em 5', async () => {
      await create({ severity: 4 })
      await post(alert()).expect(200)
      const res = await post(alert()).expect(200)

      expect(res.body).toMatchObject({ count: 3, severity: MAX_SEVERITY, priority: 15 })
    })

    it('422 para detected_at além de 1 min no futuro; aceita dentro da tolerância', async () => {
      const future = (ms: number) => new Date(T0.getTime() + ms).toISOString()

      const res = await post(alert({ detected_at: future(MINUTE + 1_000) })).expect(422)
      expect(errorOf(res)).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'detected_at não pode estar no futuro',
      })

      await post(alert({ detected_at: future(MINUTE) })).expect(201)
    })

    it('422 com envelope e detalhes por campo para body inválido', async () => {
      const res = await post({ site_id: '', type: 'fire', severity: 9 }).expect(422)

      const error = errorOf(res)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.details).toEqual(
        expect.arrayContaining([
          { path: 'site_id', message: 'site_id é obrigatório' },
          { path: 'severity', message: 'severity deve estar entre 1 e 5' },
          { path: 'detected_at', message: 'detected_at é obrigatório' },
        ]),
      )
    })

    it('400 no envelope para JSON malformado', async () => {
      const res = await t.http
        .post('/occurrences')
        .set('Content-Type', 'application/json')
        .send('{"site_id":')
        .expect(400)

      expect(errorOf(res).code).toBe('BAD_REQUEST')
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
      t.clock.advance(10 * MINUTE)
      const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE).toISOString()

      // Exemplo do enunciado: intrusion 3 (9) > perimeter_breach 4 (8) > low_battery 5 (5)
      await create({ type: 'low_battery', severity: 5, detected_at: at(1) })
      await create({ type: 'perimeter_breach', severity: 4, detected_at: at(2) })
      await create({ type: 'intrusion', severity: 3, detected_at: at(0) })
      // Empata com low_battery (5), mas é mais recente
      await create({ type: 'signal_loss', severity: 5, detected_at: at(3) })

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

    it('filtra por site_id e aceita siteId (grafia do enunciado)', async () => {
      await create({ site_id: 'site-a' })
      await create({ site_id: 'site-b' })

      expect((await list('?site_id=site-b')).map((o) => o.site_id)).toEqual(['site-b'])
      expect((await list('?siteId=site-a')).map((o) => o.site_id)).toEqual(['site-a'])
      expect(await list('?status=open&site_id=site-a')).toHaveLength(1)
    })

    it('filtros vazios valem como ausentes (?status=&siteId=)', async () => {
      await create({ site_id: 'site-a' })
      await create({ site_id: 'site-b' })

      expect(await list('?status=&siteId=')).toHaveLength(2)
    })

    it('422 para status desconhecido', async () => {
      const res = await t.http.get('/occurrences?status=closed').expect(422)

      expect(errorOf(res).message).toBe('status deve ser um de: open, acknowledged, resolved')
    })
  })

  describe('PATCH /occurrences/:id/status', () => {
    it('open → acknowledged → resolved, com nota (trim)', async () => {
      const { id } = await create()

      const acked = await patch(id, { status: 'acknowledged' }).expect(200)
      expect(acked.body).toMatchObject({ id, status: 'acknowledged', note: null })

      const resolved = await patch(id, { status: 'resolved', note: '  falso alarme  ' }).expect(200)
      expect(resolved.body).toMatchObject({ id, status: 'resolved', note: 'falso alarme' })
    })

    it.each([
      ['pulo de etapa', 'open', { status: 'resolved', note: 'x' }],
      ['transição reversa', 'acknowledged', { status: 'open' }],
      ['mesmo status', 'open', { status: 'open' }],
      ['saindo de resolved', 'resolved', { status: 'acknowledged' }],
    ] as const)('409 em %s (%s → %j)', async (_case, from, body) => {
      const { id } = await create()
      if (from !== 'open') await patch(id, { status: 'acknowledged' }).expect(200)
      if (from === 'resolved') await patch(id, { status: 'resolved', note: 'ok' }).expect(200)

      const res = await patch(id, body).expect(409)

      expect(errorOf(res)).toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
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

  describe('infra', () => {
    it('GET /health reporta o Mongo', async () => {
      const res = await t.http.get('/health').expect(200)

      expect(res.body).toEqual({ status: 'ok', mongo: 'up' })
    })

    it('rota desconhecida → 404 no envelope (sem fallback para o index.html)', async () => {
      const res = await t.http.get('/occurrences/abc/nada').expect(404)

      expect(errorOf(res).code).toBe('NOT_FOUND')
    })

    it('aceita Origin null (front aberto via file://)', async () => {
      const res = await t.http.get('/occurrences').set('Origin', 'null').expect(200)

      expect(res.headers['access-control-allow-origin']).toBe('*')
    })
  })
})
