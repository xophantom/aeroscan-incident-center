// Confere a API no ar do jeito que ela é entregue (build real, não o src que o Jest usa):
// front servido, health, validação com detalhes por campo e o ciclo de status.
// Uso: pnpm smoke   (API_URL=http://localhost:3000 por padrão)

const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

interface Reply {
  status: number
  text: string
  body: unknown
}

async function request(path: string, method = 'GET', body?: unknown): Promise<Reply> {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: unknown = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // resposta não-JSON (ex.: o index.html do front)
  }
  return { status: res.status, text, body: parsed }
}

function assert(condition: boolean, reply: Reply): void {
  if (!condition) throw new Error(`HTTP ${reply.status}: ${reply.text.slice(0, 300)}`)
}

const alert = {
  siteId: `smoke-${Date.now()}`,
  droneId: 'drone-smoke',
  type: 'intrusion',
  severity: 2,
  detectedAt: new Date().toISOString(),
}

const checks: Array<[string, () => Promise<void>]> = [
  [
    'GET / serve o front compilado',
    async () => {
      const reply = await request('/')
      assert(reply.status === 200 && reply.text.includes('<div id="root">'), reply)
    },
  ],
  [
    'GET /health com o Mongo no ar',
    async () => {
      const reply = await request('/health')
      assert(reply.status === 200, reply)
    },
  ],
  [
    'POST inválido → 422 com detalhes por campo',
    async () => {
      const reply = await request('/occurrences', 'POST', {})
      const details = (reply.body as { error?: { details?: Array<{ path: string }> } }).error
        ?.details
      assert(reply.status === 422 && details?.some((d) => d.path === 'siteId') === true, reply)
    },
  ],
  [
    'POST cria, repetido agrupa, e o status vai até resolved',
    async () => {
      const created = await request('/occurrences', 'POST', alert)
      assert(created.status === 201, created)
      const grouped = await request('/occurrences', 'POST', alert)
      assert(grouped.status === 200 && (grouped.body as { count: number }).count === 2, grouped)

      const { id } = created.body as { id: string }
      const acknowledged = await request(`/occurrences/${id}/status`, 'PATCH', {
        status: 'acknowledged',
      })
      assert(acknowledged.status === 200, acknowledged)
      const resolved = await request(`/occurrences/${id}/status`, 'PATCH', {
        status: 'resolved',
        note: 'smoke test',
      })
      assert(resolved.status === 200, resolved)
    },
  ],
]

let failures = 0
for (const [name, run] of checks) {
  try {
    await run()
    console.log(`✔ ${name}`)
  } catch (error) {
    failures++
    console.error(`✘ ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
process.exit(failures === 0 ? 0 : 1)
