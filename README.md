# Flowlet

> Plataforma de automação visual — conecte apps, APIs e serviços por meio de fluxos drag-and-drop sem escrever código.

Flowlet é uma ferramenta no estilo n8n/Zapier construída do zero com **Angular 21** no front-end e **Fastify + Prisma** no back-end. Você monta fluxos encadeando blocos visuais, dispara execuções via webhook, agendamento ou manualmente, e acompanha o log completo de cada passo em tempo real.

---

## Funcionalidades principais

| Recurso | Detalhe |
|---|---|
| **Editor visual de fluxos** | Canvas drag-and-drop para montar e conectar blocos |
| **Triggers múltiplos** | Manual, Webhook (URL única por fluxo) e Agendamento (cron) |
| **Motor de execução** | Executa blocos em ordem topológica com contexto compartilhado entre steps |
| **Blocos de integração** | HTTP, Slack, Discord, Telegram, OpenAI, GitHub Issues, Webhook Send |
| **Blocos de lógica** | If/Else, Filter, Delay, Set Variable, Transform Data, JavaScript Code |
| **Blocos de saída** | Console Log, Browser Notification, Alert Dialog, Save to Storage |
| **Credenciais seguras** | Vault de credenciais por usuário (tokens, keys) reutilizáveis nos blocos |
| **Histórico de execuções** | Log detalhado de cada bloco: status, duração, output e erros |
| **Agendador** | Scheduler interno com suporte a `every_minute`, `every_hour`, `every_day`, `every_week` |
| **Auth JWT** | Registro/login com Argon2 + JWT (7 dias) |
| **Tema claro/escuro** | Alternância de tema persistida |
| **i18n** | Internacionalização via script de tradução automatizado (Google Translate) |

---

## Stack

### Front-end (`/frontend`)

- **Angular 21** com standalone components e Signals
- **Angular CDK** para primitivos de acessibilidade e drag-and-drop
- **RxJS 7** para streams reativos
- **SCSS** com variáveis e mixins centralizados
- Build otimizado com `@angular/build` (esbuild)

### Back-end (`/backend`)

- **Fastify 5** — framework HTTP de alta performance
- **Prisma 6** — ORM type-safe com migrations
- **PostgreSQL 16** — banco de dados relacional
- **Zod** — validação de schemas em runtime
- **Argon2** — hash de senhas
- **@fastify/jwt** — autenticação JWT
- **node-cron** — agendamento de fluxos
- **Docker Compose** — Postgres local em um comando

---

## Estrutura do projeto

```
Flowlet/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/          # Registro, login, JWT
│   │   │   ├── flows/         # CRUD de fluxos
│   │   │   ├── executions/    # Motor de execução + blocos
│   │   │   │   └── blocks/    # Um arquivo por bloco (http, slack, openai…)
│   │   │   ├── credentials/   # Vault de credenciais
│   │   │   ├── webhooks/      # Recebimento de webhooks
│   │   │   └── scheduler/     # Agendamento cron
│   │   ├── lib/               # Prisma client, logger, erros, seed
│   │   ├── plugins/           # Plugin de auth do Fastify
│   │   └── server.ts          # Entry point
│   ├── prisma/
│   │   ├── schema.prisma      # Modelos: User, Flow, Execution, Credential
│   │   └── migrations/
│   ├── docker-compose.yml     # Postgres local
│   └── .env.example
│
└── frontend/
    ├── src/app/
    │   ├── pages/
    │   │   ├── dashboard/          # Visão geral dos fluxos
    │   │   ├── flow-editor/        # Editor visual
    │   │   ├── execution-history/  # Histórico de execuções
    │   │   ├── credentials/        # Gerenciamento de credenciais
    │   │   ├── login/
    │   │   └── register/
    │   ├── core/
    │   │   ├── services/           # api, auth, execução, tema, toast, translate
    │   │   └── guards/             # Auth guard
    │   ├── shared/
    │   │   └── components/         # Sidebar, Toast, BlockIcon
    │   └── layout/
    │       └── main-layout/
    └── scripts/
        └── translate.mjs           # Auto-tradução de strings i18n
```

---

## Pré-requisitos

- **Node.js** 20+
- **npm** 10+
- **Docker** e **Docker Compose** (para o Postgres local)

---

## Como rodar localmente

### 1. Clone o repositório

```bash
git clone https://github.com/Kaylan00/Flowlet.git
cd Flowlet
```

### 2. Suba o banco de dados

```bash
cd backend
docker compose up -d
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite .env se necessário (as defaults já funcionam com o docker-compose)
```

### 4. Instale dependências e rode as migrations

```bash
npm install
npm run prisma:migrate   # aplica as migrations
npm run db:seed          # opcional: popula com dados de exemplo
```

### 5. Inicie o back-end

```bash
npm run dev
# API disponível em http://localhost:3333
```

### 6. Inicie o front-end (nova aba/terminal)

```bash
cd ../frontend
npm install
npm start
# App disponível em http://localhost:4200
```

---

## Variáveis de ambiente (backend)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3333` | Porta do servidor |
| `HOST` | `0.0.0.0` | Interface de escuta |
| `NODE_ENV` | `development` | Ambiente |
| `CORS_ORIGIN` | `http://localhost:4200` | Origens permitidas (separe por vírgula) |
| `DATABASE_URL` | `postgresql://flowlet:flowlet@localhost:5432/flowlet` | Connection string do Postgres |
| `JWT_SECRET` | — | **Obrigatório em produção** — string aleatória ≥ 32 chars |
| `JWT_EXPIRES_IN` | `7d` | Expiração do token |
| `PUBLIC_URL` | `http://localhost:3333` | URL pública (usada nos webhooks) |

> Para usar **Supabase** basta trocar `DATABASE_URL` pela connection string do painel: *Project Settings → Database → URI*.

---

## API REST

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Cria conta |
| `POST` | `/api/auth/login` | Autentica e retorna JWT |
| `GET` | `/api/auth/me` | Dados do usuário autenticado |
| `GET/POST` | `/api/flows` | Lista / cria fluxos |
| `GET/PATCH/DELETE` | `/api/flows/:id` | Detalhe / atualiza / remove fluxo |
| `POST` | `/api/flows/:id/run` | Executa fluxo manualmente |
| `GET` | `/api/executions` | Lista execuções |
| `GET` | `/api/executions/:id` | Detalhe de uma execução |
| `POST` | `/api/webhooks/:token` | Dispara fluxo via webhook |
| `GET/POST` | `/api/credentials` | Lista / cria credenciais |
| `DELETE` | `/api/credentials/:id` | Remove credencial |

---

## Blocos disponíveis

### Triggers
| ID | Nome |
|---|---|
| `manual-trigger` | Manual |
| `webhook-trigger` | Webhook |
| `schedule-trigger` | Agendamento (cron) |

### Lógica
| ID | Nome |
|---|---|
| `if-else` | Condição If/Else |
| `filter` | Filter |
| `delay` | Delay |
| `set-variable` | Definir Variável |
| `transform-data` | Transformar Dados |
| `javascript-code` | Código JavaScript |

### Integrações
| ID | Nome |
|---|---|
| `http-request` | Requisição HTTP |
| `slack-message` | Mensagem no Slack |
| `discord-message` | Mensagem no Discord |
| `telegram-message` | Mensagem no Telegram |
| `openai-chat` | OpenAI Chat |
| `github-issue` | Criar Issue no GitHub |
| `webhook-send` | Enviar Webhook |

### Saída
| ID | Nome |
|---|---|
| `console-log` | Console Log |
| `browser-notification` | Notificação no browser |
| `alert-dialog` | Alert Dialog |
| `save-to-storage` | Salvar no Storage |

---

## Motor de execução

O engine em `backend/src/modules/executions/engine.ts` resolve a ordem de execução topologicamente a partir das conexões do fluxo. Cada bloco recebe um `ExecutionContext` com:

- `data` — payload inicial do trigger
- `variables` — variáveis definidas por blocos `set-variable`
- `previousOutput` — saída do bloco anterior
- `logs` — log acumulado de todos os passos

Os blocos podem usar **template strings** (`{{variavel}}`) nos seus campos — o valor é interpolado em runtime antes da execução.

---

## Scripts úteis

```bash
# Backend
npm run dev              # desenvolvimento com hot-reload (tsx watch)
npm run build            # compila TypeScript para dist/
npm run prisma:studio    # Prisma Studio (GUI do banco)
npm run db:seed          # seed com dados de exemplo

# Frontend
npm start                # servidor de desenvolvimento (ng serve)
npm run build            # build de produção
npm run translate        # traduz novas strings i18n automaticamente
npm run translate:all    # força retradução de todas as strings
npm run translate:dry    # simula tradução sem gravar arquivos
```

---

## Licença

MIT
