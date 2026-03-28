# Reserva de Salas — API

API REST em **NestJS + PostgreSQL** para gerenciamento de reservas de salas em uma fábrica com ~7.000 colaboradores.

## Requisitos

- Node.js 22 LTS
- PostgreSQL 16+
- Docker e Docker Compose (opcional)

## Instalação e execução local

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Edite o .env com os valores corretos

# 3. Criar schema e rodar migrations
npx prisma migrate dev

# 4. Popular banco com dados iniciais
npx prisma db seed

# 5. Iniciar em modo desenvolvimento
npm run start:dev

# A API estará disponível em http://localhost:3000/api/v1
# Swagger em http://localhost:3000/api/v1/docs
```

## Executando com Docker

```bash
# Subir API + PostgreSQL
docker compose up -d

# Rodar migrations no container (primeira vez)
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

## Migrations

```bash
# Criar nova migration após alterar o schema
npx prisma migrate dev --name nome-da-migracao

# Aplicar migrations em produção (sem gerar arquivos de dev)
npx prisma migrate deploy

# Visualizar o banco via Prisma Studio
npx prisma studio
```

## Testes

```bash
# Testes unitários
npm test

# Testes com relatório de cobertura
npm run test:cov

# Testes de integração (requer banco rodando)
INTEGRATION_TEST=true npm test
```

## Variáveis de ambiente

Crie um arquivo `.env` baseado no `.env.example`:

| Variável | Descrição | Obrigatória |
|---|---|---|
| `DATABASE_URL` | URL de conexão PostgreSQL | Sim |
| `AUTH_SERVICE_URL` | URL do serviço de autenticação externo | Sim |
| `NOTIFICATION_SERVICE_URL` | URL do serviço de notificação externo | Sim |
| `PORT` | Porta da API (padrão: 3000) | Não |
| `NODE_ENV` | Ambiente (`development`, `production`, `test`) | Não |
| `JWT_SECRET` | Segredo JWT para verificação local | Não |
| `RATE_LIMIT_MAX` | Máximo de requisições por janela (padrão: 100) | Não |
| `RATE_LIMIT_WINDOW` | Janela de rate limiting em ms (padrão: 60000) | Não |

## Módulos e endpoints

| Módulo | Endpoints | Roles |
|---|---|---|
| Health | `GET /health` | Público |
| Rooms | `GET /rooms`, `POST /rooms`, `PUT /rooms/:id`, `DELETE /rooms/:id` | Todos / ADMIN |
| Bookings | `GET /bookings`, `POST /bookings`, `PUT /bookings/:id`, `DELETE /bookings/:id` | Todos |
| Bookings | `POST /bookings/:id/approve`, `POST /bookings/:id/reject` | MANAGER, ADMIN |
| Additional Requests | `GET /additional-requests`, `PUT /additional-requests/:id` | FACILITIES, ADMIN |
| Dashboard | `GET /dashboard` | MANAGER, ADMIN |
| Reports | `GET /reports/bookings`, `GET /reports/bookings/export` | ADMIN, MANAGER |
| Reports | `GET /reports/rooms/usage`, `GET /reports/rooms/usage/export` | ADMIN |

## Arquitetura

```
src/
├── config/          # Validação de variáveis de ambiente
├── prisma/          # PrismaService e PrismaModule
├── health/          # Health check
├── modules/
│   ├── rooms/       # CRUD de salas com soft delete
│   ├── bookings/    # Reservas com recorrência e aprovação
│   ├── additional-requests/  # Fila de preparo (Facilities)
│   ├── dashboard/   # Métricas agregadas
│   └── reports/     # Relatórios com exportação CSV/XLSX
└── shared/
    ├── guards/      # AuthGuard, RolesGuard
    ├── decorators/  # @Roles, @CurrentUser, @Public
    ├── filters/     # HttpExceptionFilter global
    ├── interceptors/ # LoggingInterceptor
    ├── exceptions/  # BookingConflictException, RoomNotAvailableException
    └── utils/       # NotifyService, rrule.util
```
