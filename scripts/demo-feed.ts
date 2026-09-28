import { setTimeout as sleep } from 'node:timers/promises'

const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const intervalSeconds = Number(process.argv[2] ?? 3)
if (!(intervalSeconds > 0)) {
  console.error('O intervalo precisa ser um número de segundos maior que zero')
  process.exit(1)
}

const SITES = ['hangar-norte', 'cerca-leste', 'patio-sul', 'torre-oeste']
const TYPES = ['intrusion', 'perimeter_breach', 'low_battery', 'signal_loss']
const DRONES = Array.from({ length: 12 }, (_, i) => `dr-${String(i + 1).padStart(2, '0')}`)

const GROUPING_MS = 9 * 60_000

interface Alert {
  siteId: string
  droneId: string
  type: string
  severity: number
  detectedAt: string
}

interface Occurrence {
  id: string
  count: number
  severity: number
  priority: number
  droneIds: string[]
  detectedAt: string
}

interface ErrorBody {
  error: { code: string; message: string }
}

type Kind = 'novo' | 'outro drone' | 'reenvio'

const known = new Map<string, { occurrence: Occurrence; last: Alert }>()

const keyOf = (alert: Alert): string => `${alert.siteId}|${alert.type}`
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T
const randomSeverity = (): number => 1 + Math.floor(Math.random() * 5)
const clock = (): string => new Date().toLocaleTimeString('pt-BR')

function nextAlert(): { kind: Kind; alert: Alert } {
  for (const [key, { occurrence }] of known) {
    if (Date.now() - Date.parse(occurrence.detectedAt) > GROUPING_MS) known.delete(key)
  }
  const entries = [...known.values()]
  const withRoom = entries.filter((e) => e.occurrence.droneIds.length < DRONES.length)
  const free = SITES.flatMap((siteId) => TYPES.map((type) => ({ siteId, type }))).filter(
    (pair) => !known.has(`${pair.siteId}|${pair.type}`),
  )
  const detectedAt = new Date().toISOString()
  const roll = Math.random()

  if (entries.length > 0 && (roll < 0.2 || (withRoom.length === 0 && free.length === 0))) {
    return { kind: 'reenvio', alert: pick(entries).last }
  }
  if (withRoom.length > 0 && (roll < 0.65 || free.length === 0)) {
    const { occurrence, last } = pick(withRoom)
    const droneId = pick(DRONES.filter((d) => !occurrence.droneIds.includes(d)))
    return {
      kind: 'outro drone',
      alert: { ...last, droneId, severity: randomSeverity(), detectedAt },
    }
  }
  const { siteId, type } = pick(free)
  return {
    kind: 'novo',
    alert: { siteId, type, droneId: pick(DRONES), severity: randomSeverity(), detectedAt },
  }
}

function describe(status: number, body: Occurrence | ErrorBody, previous?: Occurrence): string {
  if ('error' in body) return `HTTP ${status} ${body.error.code}: ${body.error.message}`
  const outcome =
    status === 201
      ? '201 criou'
      : previous?.id === body.id && previous.count === body.count
        ? '200 reenvio, não contou'
        : '200 agrupou'
  return `${outcome}  count ${body.count}  sev ${body.severity}  prioridade ${body.priority}`
}

console.log(
  `→ Um alerta a cada ${intervalSeconds} s em ${apiUrl}/occurrences. Ctrl+C para parar.\n`,
)

for (;;) {
  const { kind, alert } = nextAlert()
  const sent =
    `${clock()}  ${kind.padEnd(11)}  ${alert.siteId.padEnd(12)}  ${alert.type.padEnd(16)}  ` +
    `${alert.droneId}  sev ${alert.severity}  →  `
  try {
    const res = await fetch(`${apiUrl}/occurrences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    })
    const body = (await res.json()) as Occurrence | ErrorBody
    const key = keyOf(alert)
    console.log(sent + describe(res.status, body, known.get(key)?.occurrence))
    if (!('error' in body)) known.set(key, { occurrence: body, last: alert })
  } catch {
    console.log(`${clock()}  sem resposta de ${apiUrl}, tentando de novo`)
  }
  await sleep(intervalSeconds * 1000)
}
