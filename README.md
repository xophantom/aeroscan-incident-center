# AeroScan · Triagem de Ocorrências

Mini central de ocorrências: recebe alertas de drones, agrupa os repetidos, lista por prioridade e
acompanha cada ocorrência até a resolução. Monorepo TypeScript (NestJS + MongoDB + React).

## Como rodar

**Com Docker** (não precisa de `.env`):

```bash
docker compose up --build
```

Tudo em **http://localhost:3000**: o front, a API, o Swagger em `/docs` e o `/health`.

A imagem da API também roda sozinha (Dockerfile na raiz), com um MongoDB que o container alcance:

```bash
docker build -t aeroscan-api .
docker run -p 3000:3000 -e MONGO_URI=mongodb://<host-do-mongo>:27017/aeroscan aeroscan-api
```

**Sem Docker** (Node ≥ 22.12 e um MongoDB 7 em `localhost:27017`; `docker compose up -d mongo` serve):

```bash
corepack enable
pnpm install
pnpm dev          # API em :3000 e web em :5173 (o Vite faz proxy para a API)
```

Nenhuma variável é obrigatória: os padrões já apontam para o Mongo local. Para mudar alguma, copie
`apps/api/.env.example` para `apps/api/.env`; o `pnpm dev` lê esse arquivo e reinicia a API ao salvar.

## Frontend compilado

Fica em **[`frontend-dist/`](frontend-dist/)**: HTML, CSS e JS estáticos, versionados no git.

- Abra `frontend-dist/index.html` direto no navegador. Via `file://`, ele usa a API em `http://localhost:3000`.
- Ou acesse `http://localhost:3000`, onde a própria API serve essa pasta.
- Para regerar: `pnpm build:web`. O CI falha se a pasta estiver desatualizada.

## API

Campos em **camelCase**, com os mesmos nomes do modelo do enunciado. Erros no envelope
`{ "error": { "code", "message", "details?" } }`, exceto o 503 do `/health`, que responde
`{ status, mongo }`.

| Rota                            | O que faz                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `POST /occurrences`             | **201** cria · **200** agrupa na ocorrência aberta do mesmo site+tipo (10 min) |
| `GET /occurrences`              | Filtros opcionais `?status=` (repetível) e `?siteId=`, ordenado por prioridade |
| `PATCH /occurrences/:id/status` | `open → acknowledged → resolved`; `resolved` exige `note`                      |
| WebSocket `/events`             | Avisa cada mudança: `{ "type": "occurrences.changed", "kind", "id" }`          |

```bash
curl -X POST localhost:3000/occurrences -H 'Content-Type: application/json' \
  -d "{\"siteId\":\"hangar-norte\",\"droneId\":\"dr-07\",\"type\":\"intrusion\",\"severity\":3,\"detectedAt\":\"$(date -u +%FT%TZ)\"}"
```

O `detectedAt` precisa estar entre 7 dias atrás e 1 min à frente; a janela de 10 min conta por ele.

Códigos das rotas de ocorrências: **422** dado inválido · **404** id inexistente · **409** transição
inválida (`details: { from, to }`) · **400** JSON malformado ou id com escape `%` inválido · **413**
corpo acima do limite · **415** codificação não suportada · **503** passageiro, com `Retry-After`
(banco fora do ar ou retentativas do dedup esgotadas). O Swagger em `/docs` documenta os de cada
rota.

## Como testar

```bash
pnpm bootstrap                                   # build do shared (api/web leem os tipos do dist)
pnpm test                                        # tudo: shared, api (unit + e2e) e web
pnpm --filter @aeroscan/shared test --coverage   # regras de domínio, com gate de cobertura
pnpm --filter @aeroscan/api test:e2e             # API real contra MongoDB em memória
pnpm demo:concurrency 20                         # com a API no ar: 20 drones alertando juntos → 1 ocorrência, count 20
pnpm smoke                                       # com a API no ar: front servido, health, 422, reenvio e ciclo de status
```

O e2e cobre as regras, os erros HTTP, o banco fora do ar, os índices (pelo profiler do Mongo) e
**concorrência**: 20 drones alertando juntos viram 1 ocorrência com `count = 20`, 120 alertas de 40
janelas, em paralelo, viram 40, e 10 reenvios simultâneos do mesmo alerta contam uma vez. Sem o
índice único de versão, o teste determinístico da corrida falha. Toda resposta de sucesso é
conferida contra o schema do contrato, e o CI também sobe a imagem Docker e roda `smoke` e
`demo:concurrency`.

## Estrutura

```
apps/api/          NestJS: occurrences (controller → service → repository), health, common, infra
apps/web/          Vite + React: components/ui, features/occurrences, lib/api
packages/shared/   Domínio (prioridade, transições, janela, limites), schemas Zod e contratos
frontend-dist/     Build estático do web (entrega)
scripts/           demo de concorrência, smoke test e cópia do build para frontend-dist
```

As regras vivem no `shared` e valem para API e front: o formulário "Resolver" usa a mesma regra de
nota do PATCH e os botões saem da mesma tabela de transições. Nas ocorrências, só o repository e o
schema conhecem Mongoose.

### Dedup sob concorrência

"Buscar e depois inserir" tem corrida: duas requisições simultâneas não acham nada e as duas
criam. O controle é otimista, por versão: cada ocorrência grava `seq`, a ordem de criação no
site+tipo, e um **índice único** `{ siteId, type, seq }` impede duas criações na mesma versão.

1. Lê a versão do site+tipo (o maior `seq`).
2. `findOneAndUpdate` atômico na ocorrência mais antiga da janela, com update em pipeline. Aberta:
   `count + 1`, `severity = min(severity + 1, 5)`, prioridade recalculada. Já reconhecida, se o
   alerta foi detectado antes do reconhecimento por um drone que já estava nela: só `count + 1`.
   Achou → 200.
3. Não achou → insere com `seq = versão + 1` → 201.
4. Deu E11000? Outra requisição criou no meio: volta ao passo 1, já enxergando a criação nova.

Cada alerta tem uma chave (site, drone, tipo e `detectedAt`), gravada junto no mesmo update ou
insert, sob outro índice único. Se a chave já existe, é reenvio: a API responde 200 com a
ocorrência em que o alerta entrou, sem contar de novo, inclusive com cópias chegando em paralelo.

Cada volta significa uma ocorrência nova, aberta por outra requisição a mais de 10 min das demais.
Sem mudanças de status no meio, cabem no máximo 1009 delas no intervalo aceito de `detectedAt`, e a
tentativa depois da última agrupa ou cria: por isso o limite é de 1010 tentativas antes do 503.

O PATCH é um update condicional (`status` precisa ser uma origem válida da transição): dois
"Reconhecer" simultâneos não passam os dois. A `priority` fica gravada para a listagem ordenar por
índice; no boot, a API recalcula as que divergirem dos pesos atuais.

## Como usei IA

- **Ferramentas:** Claude Code.
- **Como usei:** escrevi a especificação (estrutura do monorepo, camadas, regras de negócio e o
  algoritmo do dedup) e a IA montou o projeto a partir dela. Depois revisei parte por parte e pedi
  revisões até código, testes e README não se contradizerem.
- **Prompt de exemplo** (trecho resumido do prompt que montou o projeto):

  > Monte um monorepo para uma mini central de ocorrências para um gestor de segurança que recebe
  > alertas de drones em vários sites. O foco é corretude da regra de negócio e concorrência bem
  > resolvida.
  >
  > - `packages/shared`: regras puras, sem I/O e 100% testadas: `computePriority(severity, type)`,
  >   severidade com teto em 5, transições de status e a janela de 10 min.
  > - API: controller → service → repository. Só o repository conhece Mongoose; o service usa as
  >   regras do shared.
  > - O "find e depois insert" tem condição de corrida. Agrupe de forma atômica: `findOneAndUpdate`
  >   com update em pipeline (`count + 1`, `severity = min(severity + 1, 5)`, `priority`
  >   recalculado).

- **O que a IA errou e eu corrigi:** os erros mais trabalhosos foram de monorepo, e só apareciam
  fora da minha máquina.
  - **Os testes da API dependiam do build do shared.** O Jest lia o `src` do shared, mas o ts-jest
    conferia os tipos pelo `dist/`. Na minha máquina o `dist/` já existia e tudo passava; num clone
    limpo, quebrava com `Cannot find module '@aeroscan/shared'`. A primeira correção da IA
    (`isolatedModules`) só trocou o erro por `Must use import to load ES Module`. Ficou um
    `tsconfig.spec.json` que transpila cada arquivo para CommonJS, conferido num clone limpo, sem
    build do shared.
  - **Cada pacote com um rigor de TypeScript.** A IA criou um `tsconfig` por pacote, e a API ficou
    sem o `noUncheckedIndexedAccess` que o shared e o web tinham. Juntei as opções num
    `tsconfig.base.json`, e o compilador logo apontou um acesso a índice sem checagem num teste.
  - **`nestjs-zod` 4 com `@nestjs/swagger` 11.4.3.** O `patchNestJsSwagger()` importava um caminho
    interno do swagger, que passou a declarar `exports`. O sintoma enganava: o e2e "travava",
    porque o boot falhava, o `mongod` em memória ficava vivo e o Jest nunca terminava. Migrei para o
    `nestjs-zod` 5 e fiz o `createTestApp` derrubar o Mongo quando o boot falha.

## Premissas

- **Janela de 10 min pelo tempo do evento** (`detectedAt`), não pelo relógio do server. É
  **fixa**, contada da detecção que abriu a ocorrência; exatamente 10 min ainda agrupa.
- **A janela vale pros dois lados:** um alerta atrasado agrupa numa ocorrência aberta até 10 minutos
  depois dele, mais atrasado que isso, abre outra. Se mais de uma servir, vale a mais antiga.
- **Ao agrupar:** `detectedAt` continua o da abertura e `lastDetectedAt` guarda a detecção mais
  recente; o horário de um alerta atrasado não fica guardado, só entra no `count`. A severidade
  recebida é ignorada: a da ocorrência sobe +1 (teto 5), como diz o enunciado.
- **Drones:** o dedup é por site+tipo, como no enunciado. `droneId` é o drone que abriu a ocorrência
  e `droneIds` lista todos os que reportaram, para a bateria baixa de outro drone não sumir.
- **`detectedAt` vale de 7 dias atrás até 1 min à frente** (drone dias sem sinal e relógio de drone);
  fora disso → 422.
- **Ocorrência já tratada:** alerta detectado depois do reconhecimento abre outra ocorrência. Alerta
  atrasado, detectado antes do reconhecimento, entra na ocorrência mesmo reconhecida ou resolvida,
  se vier de um drone que já estava nela: soma no `count`, sem mudar status nem severidade. De um
  drone que não estava nela, abre outra ocorrência.
- **Reenvio do mesmo alerta** (mesmos `siteId`, `droneId`, `type` e `detectedAt`) não conta de
  novo: a API responde 200 com a ocorrência em que ele entrou.
- **Desempate** pelo `detectedAt` mais recente e, por fim, pelo `_id`, para a ordem ser estável.
- **Filtro vazio** (`?status=&siteId=`, como na URL do enunciado) vale como ausente. `status` aceita
  vários valores repetindo o parâmetro; os vazios são ignorados.
- **Transições:** qualquer coisa fora de `open → acknowledged → resolved` → 409. `note` só é
  gravada ao resolver. Resolver sem `note` → 422, mas só depois de conferir que a ocorrência existe
  (404) e que a transição vale (409).
- **Dado inválido → 422**, inclusive corpo que não é objeto JSON. Id que não é ObjectId → 404, como
  id inexistente. Campos desconhecidos no corpo são ignorados.
- **CORS** liberado por padrão para `Origin: null`, o front aberto via `file://` (`CORS_ORIGINS`).
  Não é barreira de segurança: a API não tem autenticação, e iframes sandbox também mandam `null`.
- **Real time:** a API avisa por WebSocket que algo mudou (criação, agrupamento ou status; reenvio
  não muda nada e não avisa) e a tela recarrega a lista do filtro atual, juntando rajadas numa recarga
  só. O servidor continua dono do filtro e da ordem. A tela reconecta sozinha, recarrega ao
  reconectar e mostra se está "Ao vivo". O WebSocket aceita as mesmas origens do CORS.

## O que ficou de fora

- Severidade do alerta mais grave: ao agrupar, a ocorrência sobe +1 e ignora a severidade recebida;
  um alerta mais grave poderia levá-la até a dele.
- Bateria baixa e perda de sinal por drone: hoje agrupam por site+tipo, como no enunciado, mas são
  problemas do próprio drone e poderiam agrupar por drone.
- Separar incidentes que coincidem: dois do mesmo tipo no mesmo site, dentro dos 10 min, viram uma
  ocorrência enquanto ela está aberta. Só um id do evento ou a zona vindos do drone separariam de
  verdade; o modelo do enunciado não tem esses dados.
- Avisos entre várias instâncias da API: hoje saem do próprio processo; com réplicas, iriam por um
  pub/sub.
- Migrações fora do boot: `syncIndexes` e a reconciliação de prioridade rodam ao subir a API,
  pensando em uma instância; com várias réplicas, iriam para um passo de migração.
