// Dispara N POSTs idênticos em paralelo contra a API no ar e mostra que o dedup resiste à corrida.
// Uso: pnpm demo:concurrency [N]   (API_URL=http://localhost:3000 por padrão)

const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const total = Number(process.argv[2] ?? 20)
if (!Number.isInteger(total) || total < 1) {
  console.error('N precisa ser um inteiro positivo')
  process.exit(1)
}

// Site único por execução, para não agrupar com rodadas anteriores
const siteId = `demo-${Date.now()}`
const alert = {
  site_id: siteId,
  drone_id: 'drone-demo',
  type: 'intrusion',
  severity: 1,
  detected_at: new Date().toISOString(),
}

console.log(`→ ${total} POSTs idênticos e simultâneos em ${apiUrl}/occurrences (site_id=${siteId})`)

const statuses = await Promise.all(
  Array.from({ length: total }, async () => {
    const res = await fetch(`${apiUrl}/occurrences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    })
    return res.status
  }),
).catch((error: unknown) => {
  console.error(`Não foi possível falar com a API em ${apiUrl}. Ela está no ar?`, error)
  process.exit(1)
})

const byStatus = Object.groupBy(statuses, (status) => String(status))
for (const [status, list] of Object.entries(byStatus)) {
  const meaning = status === '201' ? 'criou' : status === '200' ? 'agrupou' : 'erro'
  console.log(`  HTTP ${status} (${meaning}): ${list?.length ?? 0}`)
}

const res = await fetch(`${apiUrl}/occurrences?site_id=${encodeURIComponent(siteId)}`)
const occurrences = (await res.json()) as Array<{ id: string; count: number; severity: number }>

console.log(`\nOcorrências para ${siteId}: ${occurrences.length}`)
for (const o of occurrences) console.log(`  id=${o.id} count=${o.count} severity=${o.severity}`)

const ok = occurrences.length === 1 && occurrences[0]?.count === total
console.log(ok ? `\n✔ 1 ocorrência com count = ${total}` : '\n✘ dedup falhou sob concorrência')
process.exit(ok ? 0 : 1)
