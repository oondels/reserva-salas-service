# DESIGN_SPEC.md — Especificação de Design

Sistema de Gerenciamento de Reservas de Salas — Back-end API

---

## 1. Contexto e Escopo

Uma fábrica com ~7.000 colaboradores precisa substituir o controle manual de reservas de salas (feito em Excel) por um sistema web centralizado.

**Este documento especifica exclusivamente o back-end.** O front-end, o serviço de autenticação e o serviço de notificação já estão desenvolvidos e em produção.

### Serviços existentes

| Serviço | Responsabilidade | Integração |
|---|---|---|
| Front-end | Interface web | Consome esta API |
| Auth Service | Login, JWT, sessão | Esta API valida tokens emitidos por ele |
| Notification Service | Envio de e-mail | Esta API dispara eventos via HTTP |

---

## 2. Perfis de Usuário

O perfil (`role`) é uma claim presente no JWT emitido pelo Auth Service. O back-end **nunca** gerencia perfis — apenas os lê e os aplica.

| Perfil | Identificador | Descrição |
|---|---|---|
| Colaborador | `COLLABORATOR` | Cria e gerencia as próprias reservas |
| Gestor | `MANAGER` | Aprova/recusa reservas; pode cancelar reservas da equipe |
| Facilities | `FACILITIES` | Visualiza e confirma preparo de solicitações adicionais |
| Administrador | `ADMIN` | Acesso total ao sistema |

### Matriz de Permissões

| Ação | COLLABORATOR | MANAGER | FACILITIES | ADMIN |
|---|:---:|:---:|:---:|:---:|
| Listar/buscar salas | ✅ | ✅ | ✅ | ✅ |
| Criar sala | ❌ | ❌ | ❌ | ✅ |
| Editar/desativar sala | ❌ | ❌ | ❌ | ✅ |
| Criar reserva | ✅ | ✅ | ❌ | ✅ |
| Ver próprias reservas | ✅ | ✅ | ❌ | ✅ |
| Ver todas as reservas | ✅ | ✅ (equipe) | ❌ | ✅ |
| Cancelar própria reserva | ✅ | ✅ | ❌ | ✅ |
| Cancelar reserva de outros | ❌ | ✅ (equipe) | ❌ | ✅ |
| Aprovar/rejeitar reserva | ❌ | ✅ | ❌ | ✅ |
| Ver fila de solicitações | ❌ | ❌ | ✅ | ✅ |
| Atualizar preparo | ❌ | ❌ | ✅ | ✅ |
| Acessar dashboard | ❌ | ✅ | ❌ | ✅ |
| Acessar relatórios | ❌ | ❌ | ❌ | ✅ |

---

## 3. Modelo de Dados

### 3.1 Diagrama de Entidades (simplificado)

```
Room
 └── Booking (N reservas por sala)
      └── AdditionalRequestItem (N itens por reserva)
```

---

### 3.2 Room

```prisma
model Room {
  id                  String    @id @default(uuid())
  name                String
  type                RoomType
  capacity            Int
  floor               String
  resources           Resource[]
  restrictedToRoles   Role[]
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  bookings            Booking[]
}

enum RoomType {
  SALA
  AUDITORIO
  LABORATORIO
}

enum Resource {
  PROJETOR
  TV
  VIDEO_CONFERENCIA
  MICROFONE
  FLIPCHART
}
```

**Regras:**
- `restrictedToRoles` vazio = qualquer perfil pode reservar
- `isActive: false` = sala não aparece em listagens nem aceita novas reservas
- Salas não são deletadas fisicamente

---

### 3.3 Booking

```prisma
model Booking {
  id                  String          @id @default(uuid())
  roomId              String
  userId              String          // matricula funcionario
  userName            String          // cache do nome do usuário
  title               String
  description         String?
  startAt             DateTime
  endAt               DateTime
  isFullDay           Boolean         @default(false)
  status              BookingStatus   @default(CONFIRMED)
  recurrenceRule      String?         // RRULE string (RFC 5545)
  recurrenceGroupId   String?         // UUID compartilhado entre ocorrências
  additionalNotes     String?
  approvedBy          String?
  approvedAt          DateTime?
  cancelledBy         String?
  cancelledAt         DateTime?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
  number_participants Number          @default(1)
  particupant_type    ParticipantType @default(EMPLOYEE)
  invites             Boolean         @default(false)
  inviteStatus        InviteStatus?    

  room                Room            @relation(fields: [roomId], references: [id])
  additionalItems     AdditionalRequestItem[]
  additionalUtemsStatus AdditionalStatus? @default(PENDING)
}

enum AdditionalStatus {
  PENDING
  PREPARED
  CANCELLED
}

enum InviteStatus {
  ENTREGUE
  NAO_ENTREGUE
  PENDENTE
}

enum ParticipantType{
  AUXILIAR
  LIDER
  COORDENADOR
  GERENTE
  NOVO_COLABORADOR
  AREA_APOIO
  COLABORADOR
  APREDIZ
  LIDERES_E_COORDENADORES
  MECANICOS
  COLABORADORES_ESPECIFICOS
  PROCESSO_SELETIVO
  VISISTAS
  GESTANTES
  J9VEM_APRENDIZES
  CIPISTAS
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  REJECTED
}
```

**Regras:**
- `userId`, `userName`, `userEmail` vêm do JWT e são cacheados localmente para histórico
- `status` inicial:
  - `additionalItems` não vazio → `PENDING`
  - `additionalItems` vazio → `CONFIRMED`
- Para `isFullDay: true`, ignorar `startAt`/`endAt` e tratar como 00:00–23:59

---

### 3.4 AdditionalRequestItem

```prisma
model AdditionalRequestItem {
  id          String                @id @default(uuid())
  bookingId   String
  type        AdditionalRequestType
  status      AdditionalStatus      @default(PENDING)
  notes       String?
  preparedBy  String?
  preparedAt  DateTime?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  booking     Booking               @relation(fields: [bookingId], references: [id])
}

enum AdditionalRequestType {
  CAFE_SIMPLES
  LANCHE
  COMPLETO
  PERSONALIZADO
  EQUIPAMENTO_EXTRA
}

enum AdditionalStatus {
  PENDING
  PREPARED
  CANCELLED
}
```

---

## 4. Regras de Negócio

### 4.1 Verificação de Conflito de Horário

Uma reserva conflita com outra quando:
```
novaReserva.startAt < existente.endAt
AND novaReserva.endAt > existente.startAt
AND existente.roomId = novaReserva.roomId
AND existente.status IN ('CONFIRMED', 'PENDING')
```

**Implementação obrigatória com lock:**
```sql
SELECT id FROM bookings
WHERE room_id = $1
  AND status IN ('CONFIRMED', 'PENDING')
  AND start_at < $3
  AND end_at > $2
FOR UPDATE
```

Executar dentro de uma transação Prisma para evitar race conditions.

---

### 4.2 Fluxo de Aprovação

```
Reserva sem pedidos adicionais
  → status: CONFIRMED
  → Notificar solicitante (confirmação)

Reserva COM pedidos adicionais (CAFE, LANCHE, EQUIPAMENTO_EXTRA)
  → status: PENDING
  → Notificar solicitante (aguardando aprovação)
  → Notificar Managers e Facilities

Gestor ou Admin aprova (POST /bookings/:id/approve)
  → status: CONFIRMED
  → Notificar solicitante (aprovado)
  → Facilities vê na fila de preparo

Gestor ou Admin rejeita (POST /bookings/:id/reject)
  → status: REJECTED
  → Notificar solicitante (rejeitado)
```

---

### 4.3 Reservas Recorrentes

- Formato: **RRULE (RFC 5545)** — ex: `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10`
- Ao criar, expandir todas as ocorrências e verificar conflitos em cada uma antes de persistir
- Se qualquer ocorrência tiver conflito, rejeitar **toda** a criação
- Todas as ocorrências compartilham o mesmo `recurrenceGroupId`
- Ao cancelar:
  - `cancelMode: 'single'` → cancela apenas a ocorrência informada
  - `cancelMode: 'this_and_following'` → cancela a ocorrência e todas as futuras do grupo

---

### 4.4 Regras de Cancelamento

| Quem cancela | Pode cancelar |
|---|---|
| Dono da reserva | Próprias reservas (CONFIRMED ou PENDING) |
| MANAGER | Reservas da própria equipe |
| ADMIN | Qualquer reserva |
| FACILITIES | ❌ Proibido |

- Reservas com status `CANCELLED` ou `REJECTED` não podem ser canceladas novamente → HTTP 422
- Ao cancelar, registrar `cancelledBy` (userId) e `cancelledAt`

---

### 4.5 Restrição de Acesso a Salas

- Se `room.restrictedToRoles` não for vazio, verificar se `request.user.role` está na lista
- Se não estiver → HTTP 403 com mensagem: `"Seu perfil não tem permissão para reservar esta sala"`

---

### 4.6 Reserva de Dia Inteiro

- Quando `isFullDay: true`:
  - `startAt` = início do dia (`00:00:00`) na data informada
  - `endAt` = fim do dia (`23:59:59`) na data informada
  - Nenhuma outra reserva pode ser criada na mesma sala neste dia

---

## 5. Endpoints da API

Base path: `/api/v1`

Todas as rotas requerem `Authorization: Bearer <token>` exceto `/health`.

---

### 5.1 Health

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | Não | Health check |

**Response 200:**
```json
{ "status": "ok", "timestamp": "2026-03-26T14:00:00Z" }
```

---

### 5.2 Salas (`/rooms`)

| Método | Rota | Roles | Descrição |
|---|---|---|---|
| GET | `/rooms` | Todos | Lista salas ativas com filtros |
| GET | `/rooms/:id` | Todos | Detalhes de uma sala |
| GET | `/rooms/:id/availability` | Todos | Disponibilidade em um período |
| POST | `/rooms` | ADMIN | Cria sala |
| PUT | `/rooms/:id` | ADMIN | Atualiza sala |
| DELETE | `/rooms/:id` | ADMIN | Desativa sala (soft delete) |

**Query params — GET /rooms:**
```
type        RoomType (SALA | AUDITORIO | LABORATORIO)
capacity    number (mínimo)
resources   string[] (PROJETOR, TV, ...)
floor       string
page        number (default: 1)
limit       number (default: 20)
```

**Query params — GET /rooms/:id/availability:**
```
startDate   string (ISO 8601, obrigatório)
endDate     string (ISO 8601, obrigatório)
```

**Response — POST /rooms (201):**
```json
{
  "id": "uuid",
  "name": "Sala Alfa",
  "type": "SALA",
  "capacity": 10,
  "floor": "2º andar",
  "resources": ["PROJETOR", "TV"],
  "restrictedToRoles": [],
  "isActive": true,
  "createdAt": "2026-03-26T14:00:00Z"
}
```

---

### 5.3 Reservas (`/bookings`)

| Método | Rota | Roles | Descrição |
|---|---|---|---|
| GET | `/bookings` | MANAGER, ADMIN | Lista todas as reservas com filtros |
| GET | `/bookings/:id` | Dono, MANAGER, ADMIN | Detalhes |
| POST | `/bookings` | COLLABORATOR, MANAGER, ADMIN | Cria reserva |
| PUT | `/bookings/:id` | Dono, ADMIN | Edita reserva |
| DELETE | `/bookings/:id` | Dono, MANAGER, ADMIN | Cancela reserva |
| POST | `/bookings/:id/approve` | MANAGER, ADMIN | Aprova reserva PENDING |
| POST | `/bookings/:id/reject` | MANAGER, ADMIN | Rejeita reserva PENDING |
| GET | `/me/bookings` | Todos | Reservas do usuário autenticado |

**Body — POST /bookings:**
```json
{
  "roomId": "uuid",
  "title": "Reunião de planejamento",
  "description": "Opcional",
  "startAt": "2026-04-01T09:00:00Z",
  "endAt": "2026-04-01T10:00:00Z",
  "isFullDay": false,
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=TU;COUNT=4",
  "additionalRequests": ["CAFE", "LANCHE"],
  "additionalNotes": "Café para 10 pessoas, lanche leve"
}
```

**Body — DELETE /bookings/:id:**
```json
{
  "cancelMode": "single"
}
```
`cancelMode`: `"single"` | `"this_and_following"` (obrigatório apenas para recorrentes)

**Query params — GET /bookings:**
```
roomId      uuid
userId      uuid
status      BookingStatus
startDate   ISO 8601
endDate     ISO 8601
page        number
limit       number
```

---

### 5.4 Solicitações Adicionais (`/additional-requests`)

| Método | Rota | Roles | Descrição |
|---|---|---|---|
| GET | `/additional-requests` | FACILITIES, ADMIN | Lista itens pendentes de preparo |
| PUT | `/additional-requests/:id` | FACILITIES, ADMIN | Atualiza status do preparo |

**Body — PUT /additional-requests/:id:**
```json
{
  "status": "PREPARED",
  "notes": "Café entregue às 9h"
}
```

**Query params — GET /additional-requests:**
```
status      AdditionalStatus (default: PENDING)
date        ISO 8601 (filtra por data da reserva)
```

---

### 5.5 Dashboard e Relatórios

| Método | Rota | Roles | Descrição |
|---|---|---|---|
| GET | `/dashboard` | MANAGER, ADMIN | Métricas gerais |
| GET | `/reports/bookings` | ADMIN | Relatório de reservas |
| GET | `/reports/bookings/export` | ADMIN | Exportação CSV ou XLSX |
| GET | `/reports/rooms/usage` | ADMIN | Taxa de uso por sala |

**Response — GET /dashboard:**
```json
{
  "totalBookingsToday": 12,
  "totalBookingsThisMonth": 134,
  "pendingApprovals": 3,
  "occupancyRateToday": 0.68,
  "topRooms": [
    { "roomId": "uuid", "roomName": "Auditório Principal", "bookings": 22 }
  ]
}
```

**Query params — GET /reports/bookings:**
```
startDate   ISO 8601 (obrigatório)
endDate     ISO 8601 (obrigatório)
roomId      uuid (opcional)
userId      uuid (opcional)
status      BookingStatus (opcional)
page        number
limit       number
```

**Query params — GET /reports/bookings/export:**
```
startDate   ISO 8601 (obrigatório)
endDate     ISO 8601 (obrigatório)
format      "csv" | "xlsx" (default: csv)
```

---

## 6. Notificações

O back-end dispara eventos ao **Notification Service** via POST. Nunca deixe falha de notificação quebrar o fluxo principal — use `try/catch` e logue o erro.

**Contrato esperado (POST para NOTIFICATION_SERVICE_URL):**
```json
{
  "to": ["email@empresa.com"],
  "event": "BOOKING_CONFIRMED",
  "data": {
    "bookingId": "uuid",
    "roomName": "Sala Alfa",
    "startAt": "2026-04-01T09:00:00Z",
    "endAt": "2026-04-01T10:00:00Z",
    "userName": "João Silva"
  }
}
```

**Eventos disponíveis:**

| Evento | Trigger | Destinatários |
|---|---|---|
| `BOOKING_CONFIRMED` | Reserva criada/aprovada sem pedidos | Solicitante |
| `BOOKING_PENDING_APPROVAL` | Reserva criada com pedidos adicionais | Solicitante + todos MANAGER + todos FACILITIES |
| `BOOKING_APPROVED` | Gestor/Admin aprova | Solicitante |
| `BOOKING_REJECTED` | Gestor/Admin rejeita | Solicitante |
| `BOOKING_CANCELLED` | Reserva cancelada | Solicitante |

---

## 7. Requisitos Não-Funcionais

### Performance
- Listagem de disponibilidade (até 30 dias): < 500ms
- Criação de reserva (incluindo verificação de conflito): < 1s
- Suporte a 500 requisições simultâneas

### Segurança
- JWT validado em 100% das rotas protegidas
- RBAC aplicado em todos os endpoints
- Queries parametrizadas (Prisma garante por padrão)
- Rate limiting: máx. 100 req/min por usuário nas rotas de criação

### Confiabilidade
- Todas as escritas críticas em transações atômicas
- Verificação de conflito com `FOR UPDATE` (lock de linha)
- Logs estruturados (JSON) em todas as operações de escrita

### Manutenibilidade
- Arquitetura Controller → Service → Repository
- Documentação Swagger em `/docs`
- Cobertura de testes ≥ 80% na camada Service

---

## 8. Pontos em Aberto

> Itens que precisam ser definidos antes ou durante o desenvolvimento

| # | Ponto | Impacto |
|---|---|---|
| 1 | Atributos adicionais de sala (cliente mencionou que tem mais) | Schema do banco, endpoints de sala |
| 2 | Critério de "equipe" para MANAGER | Lógica de quais reservas o gestor pode aprovar/cancelar |
| 3 | Antecedência mínima para cancelamento | Regra de negócio no BookingService |
| 4 | Tempo de antecedência do lembrete por e-mail | Configuração do evento de notificação |
| 5 | Fuso horário | Se há múltiplas unidades, avaliar suporte a multi-timezone |
| 6 | Cache de usuários do Auth Service | Performance: consulta em tempo real vs cache local com TTL |