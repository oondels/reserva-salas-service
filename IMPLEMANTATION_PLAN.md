# IMPLEMENTATION_PLAN.md — Plano de Implementação

Sistema de Gerenciamento de Reservas de Salas — Back-end API

> Execute as fases **em ordem**. Cada fase tem pré-requisitos das anteriores.
> Marque cada tarefa com `[x]` ao concluir.

---

## Visão Geral das Fases

| Fase | Nome | Semanas |
|---|---|---|
| 1 | Fundação e Setup | 1–2 |
| 2 | Módulo de Salas | 2–3 |
| 3 | Reservas Core | 3–5 |
| 4 | Recorrência e Aprovação | 5–6 |
| 5 | Módulo Facilities | 6–7 |
| 6 | Dashboard e Relatórios | 7–8 |
| 7 | Qualidade e Entrega | 8–9 |

---

## Fase 1 — Fundação e Setup

**Objetivo:** projeto rodando, banco conectado, autenticação funcionando.

### 1.1 Inicialização do Projeto

- [ ] Criar projeto NestJS via CLI: `npx @nestjs/cli new reservas-api`
- [ ] Instalar dependências base:
  ```
  @nestjs/config
  @nestjs/swagger
  @nestjs/axios
  @nestjs/throttler
  prisma @prisma/client
  class-validator class-transformer
  rrule
  axios
  xlsx
  ```
- [ ] Instalar dependências de dev:
  ```
  @nestjs/testing
  jest @types/jest supertest @types/supertest ts-jest
  eslint prettier
  ```
- [ ] Configurar ESLint + Prettier
- [ ] Criar `.env.example` com todas as variáveis (ver `CLAUDE.md`)
- [ ] Configurar `ConfigModule.forRoot({ isGlobal: true, validationSchema })` no `AppModule` com validação das variáveis obrigatórias ao iniciar

### 1.2 Estrutura de Módulos

- [ ] Criar estrutura de diretórios conforme `CLAUDE.md` seção "Estrutura de Pastas"
- [ ] Criar `PrismaModule` global com `PrismaService` (estende `PrismaClient`, conecta no `onModuleInit`)
- [ ] Criar `SharedModule` com `NotifyService` (exportado para outros módulos)
- [ ] Criar `AppModule` raiz importando todos os feature modules e `ConfigModule`
- [ ] Configurar `main.ts`:
  - `ValidationPipe` global com `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
  - `HttpExceptionFilter` global
  - Swagger com `DocumentBuilder` em `/docs`
  - Porta via `ConfigService`

### 1.3 Banco de Dados

- [ ] Configurar `prisma/schema.prisma` com todas as entidades do `DESIGN_SPEC.md` seção 3:
  - [ ] Enum `RoomType`
  - [ ] Enum `Resource`
  - [ ] Enum `Role`
  - [ ] Enum `BookingStatus`
  - [ ] Enum `AdditionalRequestType`
  - [ ] Enum `AdditionalStatus`
  - [ ] Model `Room`
  - [ ] Model `Booking`
  - [ ] Model `AdditionalRequestItem`
- [ ] Rodar `prisma migrate dev --name init`
- [ ] Criar `prisma/seed.ts` com dados iniciais (pelo menos 5 salas variadas para desenvolvimento)
- [ ] Configurar `src/config/database.ts` exportando instância do PrismaClient

### 1.4 Configurações Globais NestJS

- [ ] Registrar `ThrottlerModule` no `AppModule` com limites do `.env` (rate limiting global)
- [ ] Criar `src/shared/filters/http-exception.filter.ts` — normaliza todas as exceções no formato padrão
- [ ] Criar `src/shared/interceptors/logging.interceptor.ts` — loga método, rota e tempo de resposta
- [ ] Registrar filter e interceptor globalmente via `APP_FILTER` e `APP_INTERCEPTOR` no `AppModule`

### 1.5 Autenticação e Guards

- [ ] Criar `src/shared/guards/auth.guard.ts` (implementa `CanActivate`):
  - Extrai Bearer token do header `Authorization`
  - Faz chamada ao `AUTH_SERVICE_URL` via `HttpService`
  - Em caso de 401 externo → lança `UnauthorizedException`
  - Popula `request.user` com `{ userId, role, name, email }`
  - Respeita decorator `@Public()` para rotas abertas
- [ ] Criar `src/shared/guards/roles.guard.ts` (implementa `CanActivate`):
  - Lê roles via `Reflector`
  - Se role não autorizado → lança `ForbiddenException`
- [ ] Criar decorators: `@Roles()`, `@CurrentUser()`, `@Public()`
- [ ] Registrar `AuthGuard` e `RolesGuard` como `APP_GUARD` no `AppModule` (ordem importa: auth primeiro)
- [ ] Criar exceções customizadas em `src/shared/exceptions/` para erros de domínio não cobertos pelo NestJS padrão:
  - `BookingConflictException` (409)
  - `RoomNotAvailableException` (409)

### 1.6 Health Check

- [ ] Criar `HealthModule` com `HealthController`
- [ ] `GET /health` retorna `{ status: "ok", timestamp: "..." }`
- [ ] Marcar com `@Public()` — não requer autenticação

### 1.7 Testes de Fundação

- [ ] Configurar Jest com `ts-jest` (já vem configurado no template NestJS)
- [ ] Testar que a aplicação inicia sem erros (`Test.createTestingModule`)
- [ ] Testar health check retorna 200
- [ ] Testar que rota protegida sem token retorna 401
- [ ] Testar que rota protegida com role errado retorna 403

**✅ Critério de saída da Fase 1:** `GET /health` retorna 200; rota protegida sem token retorna 401.

---

## Fase 2 — Módulo de Salas

**Pré-requisito:** Fase 1 concluída.

**Objetivo:** CRUD completo de salas com filtros e controle de acesso.

### 2.1 Repository

- [ ] Criar `src/modules/rooms/room.repository.ts`:
  - `findAll(filters)` — com filtros de tipo, capacidade, recursos, andar
  - `findById(id)`
  - `create(data)`
  - `update(id, data)`
  - `softDelete(id)` — `isActive: false`
  - `findAvailability(id, startDate, endDate)` — retorna slots ocupados

### 2.2 Service

- [ ] Criar `src/modules/rooms/room.service.ts`:
  - `listRooms(filters, userRole)` — filtra somente `isActive: true`
  - `getRoomById(id)` — lança `NotFoundError` se não existir ou inativo
  - `checkRoomAccess(room, userRole)` — valida `restrictedToRoles`
  - `createRoom(data)` — somente ADMIN
  - `updateRoom(id, data)` — somente ADMIN
  - `deactivateRoom(id)` — somente ADMIN

### 2.3 Controller, DTOs e Rotas

- [ ] Criar `src/modules/rooms/dto/`:
  - `CreateRoomDto` — com `@IsString`, `@IsEnum`, `@IsInt`, `@IsArray`, `@ApiProperty` em todos os campos
  - `UpdateRoomDto` — estende `PartialType(CreateRoomDto)`
  - `RoomFiltersDto` — com `@IsOptional` em todos os campos
- [ ] Criar `src/modules/rooms/rooms.controller.ts` com os 6 endpoints usando decoradores NestJS
- [ ] Adicionar `@ApiOperation` e `@ApiResponse` em cada endpoint
- [ ] Aplicar `@Roles(Role.ADMIN)` nos endpoints de criação, edição e desativação
- [ ] Criar `RoomsModule` e registrar em `AppModule`

### 2.4 Testes

- [ ] Unit: `RoomService` com mock do Repository
  - [ ] `listRooms` filtra salas inativas
  - [ ] `getRoomById` lança NotFoundError para sala inexistente
  - [ ] `checkRoomAccess` lança ForbiddenError para perfil não autorizado
  - [ ] `deactivateRoom` faz soft delete
- [ ] Integration: endpoints via Supertest
  - [ ] GET /rooms retorna lista paginada
  - [ ] GET /rooms com filtros retorna resultados corretos
  - [ ] POST /rooms sem ADMIN retorna 403
  - [ ] POST /rooms com ADMIN cria sala e retorna 201
  - [ ] DELETE /rooms/:id desativa sala (não deleta)

**✅ Critério de saída da Fase 2:** CRUD de salas funcionando, soft delete implementado, filtros de busca funcionando.

---

## Fase 3 — Reservas Core

**Pré-requisito:** Fase 2 concluída.

**Objetivo:** criar, visualizar e cancelar reservas simples, com verificação de conflito robusta.

### 3.1 Repository

- [ ] Criar `src/modules/bookings/booking.repository.ts`:
  - `findAll(filters)` — com filtros de roomId, userId, status, período
  - `findById(id)`
  - `findByUserId(userId)`
  - `findConflicts(roomId, startAt, endAt, excludeId?)` — com `FOR UPDATE`
  - `create(data)` — dentro de transação
  - `update(id, data)`
  - `cancel(id, cancelledBy)` — atualiza status e registra cancelledBy/At

### 3.2 Service — Criação

- [ ] Criar `src/modules/bookings/booking.service.ts`:
  - [ ] `createBooking(data, user)`:
    - Validar que sala existe e está ativa
    - Validar acesso do perfil à sala (`checkRoomAccess`)
    - Verificar conflito com lock (`findConflicts`)
    - Determinar status inicial:
      - `additionalRequests` não vazio → `PENDING`
      - Vazio → `CONFIRMED`
    - Persistir em transação
    - Disparar notificação (não-bloqueante)
    - Retornar booking criado

### 3.3 Service — Consulta

- [ ] `listBookings(filters, user)`:
  - COLLABORATOR → força `userId = request.user.userId`
  - MANAGER → filtra por equipe (aguardar definição de "equipe" — por ora, aceitar qualquer)
  - ADMIN → sem restrição
- [ ] `getBookingById(id, user)`:
  - Valida que o usuário pode ver a reserva (dono, MANAGER, ADMIN)

### 3.4 Service — Cancelamento

- [ ] `cancelBooking(id, cancelledBy, user)`:
  - Validar status atual (CONFIRMED ou PENDING)
  - Validar permissão de cancelamento (ver `DESIGN_SPEC.md` seção 4.4)
  - Atualizar status para CANCELLED
  - Disparar notificação

### 3.5 Controller, DTOs e Rotas

- [ ] Criar `src/modules/bookings/dto/`:
  - `CreateBookingDto` — com validação completa de todos os campos
  - `BookingFiltersDto` — com `@IsOptional` em todos
  - `CancelBookingDto` — com `cancelMode: 'single' | 'this_and_following'`
- [ ] Criar `BookingsController` com endpoints e decoradores NestJS
- [ ] Adicionar `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` em cada endpoint
- [ ] Criar `BookingsModule` e registrar em `AppModule`

### 3.6 Notificação

- [ ] Criar `src/shared/utils/notify.service.ts` como `@Injectable()`:
  - Injeta `HttpService` do `@nestjs/axios`
  - Método `send(event, to, data)` faz POST no `NOTIFICATION_SERVICE_URL`
  - Envolto em `try/catch` — usa `this.logger.error()` mas não propaga exceção
- [ ] Exportar `NotifyService` do `SharedModule`

### 3.7 Testes

- [ ] Unit: `BookingService`
  - [ ] Cria reserva CONFIRMED quando sem pedidos adicionais
  - [ ] Cria reserva PENDING quando com pedidos adicionais
  - [ ] Lança ConflictError quando há sobreposição de horário
  - [ ] Lança ForbiddenError para sala restrita
  - [ ] Cancela reserva do próprio usuário
  - [ ] Lança ForbiddenError ao FACILITIES tentar cancelar
  - [ ] Lança ValidationError ao cancelar reserva já cancelada
- [ ] Integration: fluxo completo via Supertest com banco real
  - [ ] **Race condition**: duas requisições simultâneas para a mesma sala → apenas uma confirmada
  - [ ] Reserva de dia inteiro bloqueia a sala no dia inteiro

**✅ Critério de saída da Fase 3:** conflito de horário funcionando com concorrência; cancelamento com regras de perfil funcionando.

---

## Fase 4 — Recorrência e Aprovação

**Pré-requisito:** Fase 3 concluída.

**Objetivo:** suporte a reservas recorrentes e fluxo de aprovação/rejeição.

### 4.1 Recorrência

- [ ] Instalar e configurar lib `rrule`
- [ ] Criar `src/shared/utils/rrule.ts`:
  - `expandRecurrence(startAt, endAt, rruleString, maxOccurrences?)` → `Array<{startAt, endAt}>`
  - Limitar expansão a no máximo 365 ocorrências
- [ ] Atualizar `BookingService.createBooking()`:
  - [ ] Se `recurrenceRule` presente, expandir todas as ocorrências
  - [ ] Verificar conflito em **todas** as ocorrências antes de persistir
  - [ ] Se qualquer ocorrência conflitar, rejeitar **toda** a criação com `ConflictError` informando qual ocorrência conflitou
  - [ ] Gerar `recurrenceGroupId` (UUID) e associar a todas as ocorrências
  - [ ] Persistir todas as ocorrências em um único `prisma.$transaction()`
- [ ] Atualizar `BookingService.cancelBooking()`:
  - [ ] Aceitar `cancelMode: 'single' | 'this_and_following'`
  - [ ] `this_and_following`: cancelar todas as ocorrências do `recurrenceGroupId` com `startAt >= ocorrência atual`

### 4.2 Aprovação

- [ ] Adicionar métodos ao `BookingService`:
  - [ ] `approveBooking(id, approvedBy, user)`:
    - Validar que status é PENDING
    - Atualizar para CONFIRMED, registrar `approvedBy` e `approvedAt`
    - Disparar notificação `BOOKING_APPROVED`
  - [ ] `rejectBooking(id, rejectedBy, user, reason?)`:
    - Validar que status é PENDING
    - Atualizar para REJECTED
    - Disparar notificação `BOOKING_REJECTED`
- [ ] Adicionar rotas ao controller com decoradores NestJS:
  - `POST /bookings/:id/approve` — `@Roles(Role.MANAGER, Role.ADMIN)`
  - `POST /bookings/:id/reject` — `@Roles(Role.MANAGER, Role.ADMIN)`
- [ ] Adicionar `PUT /bookings/:id` com `UpdateBookingDto` para edição de reservas próprias (PENDING ou CONFIRMED)

### 4.3 Testes

- [ ] Unit: recorrência
  - [ ] Expande ocorrências corretamente para RRULE semanal
  - [ ] Rejeita criação se qualquer ocorrência tiver conflito
  - [ ] `cancelMode: 'this_and_following'` cancela a partir da ocorrência correta
- [ ] Unit: aprovação
  - [ ] Aprovação muda status para CONFIRMED e dispara notificação
  - [ ] Rejeição muda status para REJECTED e dispara notificação
  - [ ] COLLABORATOR não pode aprovar (403)
  - [ ] Não pode aprovar reserva que não está PENDING
- [ ] Integration: fluxo completo de aprovação via Supertest

**✅ Critério de saída da Fase 4:** reservas recorrentes criadas em batch; fluxo PENDING → CONFIRMED/REJECTED funcionando.

---

## Fase 5 — Módulo Facilities

**Pré-requisito:** Fase 4 concluída.

**Objetivo:** fila de solicitações adicionais para o perfil Facilities.

### 5.1 Repository

- [ ] Criar `src/modules/additional-requests/additional-request.repository.ts`:
  - `findAll(filters)` — filtros por status e data da reserva
  - `findById(id)`
  - `update(id, data)` — atualiza status, preparedBy, preparedAt

### 5.2 Service

- [ ] Criar `src/modules/additional-requests/additional-request.service.ts`:
  - `listRequests(filters, user)` — somente FACILITIES e ADMIN
  - `updateRequestStatus(id, data, user)`:
    - Validar que item existe
    - Validar que `status` é válido (`PREPARED` ou `CANCELLED`)
    - Registrar `preparedBy` e `preparedAt`

### 5.3 Controller, DTOs e Rotas

- [ ] Criar `UpdateAdditionalRequestDto` com `status` e `notes` opcionais
- [ ] Criar `AdditionalRequestFiltersDto`
- [ ] `GET /additional-requests` — `@Roles(Role.FACILITIES, Role.ADMIN)`
- [ ] `PUT /additional-requests/:id` — `@Roles(Role.FACILITIES, Role.ADMIN)`
- [ ] `@ApiOperation` e `@ApiResponse` em cada endpoint
- [ ] Criar `AdditionalRequestsModule` e registrar em `AppModule`

### 5.4 Testes

- [ ] Unit: `AdditionalRequestService`
  - [ ] Somente FACILITIES e ADMIN podem listar
  - [ ] Atualização registra preparedBy e preparedAt corretamente
  - [ ] COLLABORATOR recebe 403
- [ ] Integration: via Supertest

**✅ Critério de saída da Fase 5:** FACILITIES consegue ver e atualizar fila de preparo.

---

## Fase 6 — Dashboard e Relatórios

**Pré-requisito:** Fase 5 concluída.

**Objetivo:** métricas, relatórios com filtros e exportação.

### 6.1 Dashboard

- [ ] Criar `src/modules/dashboard/dashboard.service.ts`:
  - Consultas agregadas para:
    - Total de reservas hoje
    - Total de reservas no mês
    - Reservas PENDING aguardando aprovação
    - Taxa de ocupação do dia (reservas confirmadas / slots disponíveis)
    - Top 5 salas mais reservadas no mês
- [ ] `GET /dashboard` (MANAGER, ADMIN)

### 6.2 Relatório de Reservas

- [ ] Criar `src/modules/reports/report.service.ts`:
  - `getBookingsReport(filters)` — paginado, com todos os filtros do `DESIGN_SPEC.md`
  - `exportBookings(filters, format)` — gera CSV ou XLSX
- [ ] `GET /reports/bookings` (ADMIN)
- [ ] `GET /reports/bookings/export` (ADMIN) — retorna arquivo para download

### 6.3 Relatório de Uso de Salas

- [ ] `getRoomsUsage(startDate, endDate)` — horas reservadas por sala no período
- [ ] `GET /reports/rooms/usage` (ADMIN)

### 6.4 Exportação

- [ ] Instalar `xlsx` (SheetJS) para geração de XLSX
- [ ] CSV: serialização manual (sem dependência extra)
- [ ] Response com headers corretos:
  - CSV: `Content-Type: text/csv; Content-Disposition: attachment; filename="reservas.csv"`
  - XLSX: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 6.5 Testes

- [ ] Unit: `ReportService`
  - [ ] Filtros aplicados corretamente
  - [ ] Exportação CSV gera conteúdo válido
  - [ ] Exportação XLSX gera arquivo válido
- [ ] Integration: via Supertest

**✅ Critério de saída da Fase 6:** dashboard retorna métricas; exportação CSV e XLSX funcionando.

---

## Fase 7 — Qualidade e Entrega

**Pré-requisito:** Fases 1–6 concluídas.

**Objetivo:** qualidade, segurança e prontidão para homologação.

### 7.1 Cobertura de Testes

- [ ] Rodar `jest --coverage`
- [ ] Garantir ≥ 80% de cobertura na camada Service
- [ ] Garantir que todos os casos críticos listados nas fases anteriores estão cobertos
- [ ] Adicionar testes de integração end-to-end para os principais fluxos:
  - [ ] Fluxo completo: criar reserva com pedido → aprovar → Facilities confirma preparo
  - [ ] Fluxo recorrente: criar → cancelar "this_and_following"
  - [ ] Conflito simultâneo (race condition)

### 7.2 Revisão de Segurança

- [ ] Validar que nenhum endpoint retorna dados de outros usuários sem permissão
- [ ] Validar que FACILITIES não consegue criar, editar ou cancelar reservas
- [ ] Validar rate limiting nas rotas de criação
- [ ] Revisar que nenhuma informação sensível aparece em logs (ex: tokens)
- [ ] Confirmar que `.env` não está no repositório (`.gitignore`)

### 7.3 Performance

- [ ] Adicionar índices no banco:
  ```sql
  -- Índices críticos para performance
  CREATE INDEX idx_bookings_room_status ON bookings(room_id, status);
  CREATE INDEX idx_bookings_start_end ON bookings(start_at, end_at);
  CREATE INDEX idx_bookings_user ON bookings(user_id);
  CREATE INDEX idx_bookings_recurrence_group ON bookings(recurrence_group_id);
  CREATE INDEX idx_additional_requests_booking ON additional_request_items(booking_id);
  ```
- [ ] Adicionar via migration Prisma: `prisma migrate dev --name add_performance_indexes`
- [ ] Testar listagem de disponibilidade para 30 dias com dados de carga

### 7.4 Documentação

- [ ] Verificar que todos os controllers têm `@ApiTags`, `@ApiBearerAuth`
- [ ] Verificar que todos os endpoints têm `@ApiOperation` e `@ApiResponse` (incluindo erros 401, 403, 404, 409)
- [ ] Verificar que todos os DTOs têm `@ApiProperty()` em cada campo
- [ ] Acessar `/docs` e validar que o Swagger está completo e funcional
- [ ] Atualizar `README.md` com:
  - Como instalar e rodar localmente
  - Como rodar as migrations (`prisma migrate dev`)
  - Como rodar os testes (`npm test`, `npm run test:cov`)
  - Variáveis de ambiente necessárias

### 7.5 Deploy em Homologação

- [ ] Criar `Dockerfile` e `docker-compose.yml` (app + PostgreSQL)
- [ ] Criar script de CI básico (GitHub Actions ou equivalente):
  - Lint
  - Build TypeScript
  - Testes
- [ ] Rodar migrations em ambiente de homologação
- [ ] Executar seed com dados de teste
- [ ] Validar integração com Auth Service e Notification Service em homologação

**✅ Critério de saída da Fase 7:** cobertura ≥ 80%; Swagger completo; Docker funcionando; CI passando; homologação validada com o time de front-end.

---

## Dependências entre Fases

```
Fase 1 (Fundação)
    └── Fase 2 (Salas)
            └── Fase 3 (Reservas Core)
                    └── Fase 4 (Recorrência + Aprovação)
                            ├── Fase 5 (Facilities)
                            └── Fase 6 (Dashboard + Relatórios)
                                        └── Fase 7 (Qualidade)
```

Fases 5 e 6 podem ser desenvolvidas em paralelo após a Fase 4.

---

## Decisões Pendentes (bloqueiam implementação)

Antes de iniciar as fases indicadas, resolver:

| # | Decisão | Bloqueia | Responsável |
|---|---|---|---|
| 1 | Atributos adicionais de sala | Fase 2 (schema) | Cliente |
| 2 | Critério de "equipe" do MANAGER | Fase 3 (listagem e cancelamento) | Cliente |
| 3 | Antecedência mínima para cancelamento | Fase 3 (regra de cancelamento) | Cliente |
| 4 | Tempo do lembrete por e-mail | Fase 4 (notificação) | Cliente |
| 5 | Fuso horário (único ou multi) | Fase 3 (tratamento de datas) | Cliente |