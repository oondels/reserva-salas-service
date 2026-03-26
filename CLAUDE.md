# CLAUDE.md — Sistema de Gerenciamento de Reservas de Salas

Este arquivo guia o agente de IA no desenvolvimento do back-end. Leia-o integralmente antes de escrever qualquer código.

---

## Visão Geral do Projeto

API REST em **NestJS + PostgreSQL** para gerenciamento de reservas de salas em uma fábrica com ~7.000 colaboradores. O front-end e os serviços de autenticação e notificação já estão prontos — sua responsabilidade é exclusivamente o back-end.

**Referências obrigatórias:**
- `DESIGN_SPEC.md` — modelo de dados, regras de negócio, endpoints e requisitos
- `IMPLEMENTATION_PLAN.md` — fases, tarefas e ordem de execução

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js LTS |
| Framework | NestJS |
| Banco de dados | PostgreSQL |
| ORM / Migrations | Prisma |
| Autenticação | JWT Guard customizado (valida contra serviço externo) |
| Validação | `class-validator` + `class-transformer` (DTOs) |
| Testes | Jest + Supertest (`@nestjs/testing`) |
| Documentação | Swagger via `@nestjs/swagger` |
| Linting | ESLint + Prettier |

---

## Estrutura de Pastas

```
src/
├── config/                   # ConfigModule — variáveis de ambiente tipadas
├── prisma/                   # PrismaService (wrapper do PrismaClient)
├── modules/
│   ├── rooms/
│   │   ├── rooms.module.ts
│   │   ├── rooms.controller.ts
│   │   ├── rooms.service.ts
│   │   ├── rooms.repository.ts
│   │   └── dto/              # CreateRoomDto, UpdateRoomDto, RoomFiltersDto
│   ├── bookings/
│   │   ├── bookings.module.ts
│   │   ├── bookings.controller.ts
│   │   ├── bookings.service.ts
│   │   ├── bookings.repository.ts
│   │   └── dto/
│   ├── additional-requests/
│   │   ├── additional-requests.module.ts
│   │   ├── additional-requests.controller.ts
│   │   ├── additional-requests.service.ts
│   │   ├── additional-requests.repository.ts
│   │   └── dto/
│   ├── dashboard/
│   │   ├── dashboard.module.ts
│   │   ├── dashboard.controller.ts
│   │   └── dashboard.service.ts
│   └── reports/
│       ├── reports.module.ts
│       ├── reports.controller.ts
│       └── reports.service.ts
├── shared/
│   ├── guards/               # AuthGuard, RolesGuard
│   ├── decorators/           # @Roles(), @CurrentUser()
│   ├── filters/              # HttpExceptionFilter global
│   ├── interceptors/         # LoggingInterceptor
│   ├── exceptions/           # ConflictException, classes de erro customizadas
│   └── utils/                # helpers de data, rrule, paginação, notify
├── health/
│   ├── health.module.ts
│   └── health.controller.ts
└── app.module.ts             # módulo raiz — importa todos os módulos
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
test/
├── unit/
├── integration/
└── fixtures/
```

Cada módulo NestJS segue a arquitetura em camadas: **Controller → Service → Repository**. Nunca pule camadas (ex: Controller chamando Repository diretamente).

### Padrão de Módulo NestJS

Cada feature module deve:
1. Declarar o `Controller` em `controllers`
2. Declarar o `Service` e `Repository` em `providers`
3. Importar o `PrismaModule` se precisar de acesso ao banco
4. Exportar o `Service` se outro módulo precisar consumi-lo

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsRepository],
  exports: [RoomsService],
})
export class RoomsModule {}
```

---

## Convenções de Código

### Geral
- **TypeScript** em todo o projeto (`strict: true`)
- Arquivos em `kebab-case` (ex: `booking.service.ts`)
- Classes e interfaces em `PascalCase`
- Funções e variáveis em `camelCase`
- Constantes em `UPPER_SNAKE_CASE`
- Sem `any` — use tipos explícitos ou `unknown`

### NestJS
- Use **decoradores nativos** do NestJS: `@Controller`, `@Get`, `@Post`, `@Body`, `@Param`, `@Query`, `@UseGuards`
- Valide todos os inputs com **DTOs** anotados com `class-validator`:
  ```typescript
  export class CreateBookingDto {
    @IsUUID()
    roomId: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsISO8601()
    startAt: string;

    @IsISO8601()
    endAt: string;

    @IsEnum(AdditionalRequestType, { each: true })
    @IsOptional()
    additionalRequests?: AdditionalRequestType[];
  }
  ```
- Registre o `ValidationPipe` globalmente no `main.ts` com `whitelist: true` e `forbidNonWhitelisted: true`
- Use `@ApiProperty()` em todos os campos dos DTOs para gerar Swagger automaticamente
- Erros HTTP devem usar as exceções do NestJS: `NotFoundException`, `ForbiddenException`, `ConflictException`, `UnauthorizedException`
- Para erros de domínio não cobertos, crie classes em `src/shared/exceptions/` estendendo `HttpException`

### Funções e Módulos
- Funções com responsabilidade única
- Máximo 40 linhas por função — extraia helpers se necessário
- Prefira `async/await` em vez de `.then().catch()`
- Trate erros com `try/catch` ou deixe o filtro global do NestJS capturar as `HttpException`

### Banco de dados
- Toda operação crítica (criação/cancelamento de reserva) deve usar **transações Prisma**
- Use `prisma.$transaction()` sempre que houver múltiplas escritas
- Verificação de conflito de horário deve usar **query com `FOR UPDATE`** (via `$queryRaw`) para evitar race conditions
- Nunca faça queries dentro de loops — use bulk operations
- O banco de dados deve ter um schema claro proprio, com chaves estrangeiras, índices e constraints para garantir integridade dos dados e tabelas.

### API
- Retorne erros no formato padrão do NestJS (já garantido pelo `HttpExceptionFilter` global):
  ```json
  { "statusCode": 400, "error": "Bad Request", "message": "Descrição do erro" }
  ```
- Paginação padrão: `?page=1&limit=20`
- Datas sempre em **ISO 8601 UTC** (`2026-03-26T14:00:00Z`)
- Todos os IDs são **UUID v4**

---

## Autenticação e Autorização

### JWT Guard
- Crie `src/shared/guards/auth.guard.ts` implementando `CanActivate`
- Extraia o Bearer token do header `Authorization`
- Valide chamando o `AUTH_SERVICE_URL` (serviço externo)
- Em caso de 401 externo → lance `UnauthorizedException`
- Popule `request.user` com `{ userId, role, name, email }` extraídos do token
- Aplique o guard **globalmente** via `APP_GUARD` no `AppModule`:
  ```typescript
  { provide: APP_GUARD, useClass: AuthGuard }
  ```
- Use `@Public()` decorator para marcar rotas que não requerem autenticação (ex: `/health`)

### Roles Guard
- Crie `src/shared/guards/roles.guard.ts` implementando `CanActivate`
- Leia os roles permitidos via `Reflector` (metadados do decorator `@Roles()`)
- Se `request.user.role` não estiver nos roles → lance `ForbiddenException`
- Aplique também globalmente via `APP_GUARD` após o `AuthGuard`

### Decorators customizados
```typescript
// src/shared/decorators/roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// src/shared/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user
);

// src/shared/decorators/public.decorator.ts
export const Public = () => SetMetadata('isPublic', true);
```

### Perfis (roles)
```typescript
enum Role {
  COLLABORATOR = 'COLLABORATOR',
  MANAGER      = 'MANAGER',
  FACILITIES   = 'FACILITIES',
  ADMIN        = 'ADMIN',
}
```

- Nunca confie no role enviado pelo cliente — use sempre o que vem do JWT
- Exemplo de uso nos controllers:
  ```typescript
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: AuthUser) { ... }
  ```

---

## Regras de Negócio Críticas

> Consulte `DESIGN_SPEC.md` seção 5 para detalhes completos. Resumo dos pontos mais sensíveis:

1. **Conflito de horário**: use lock no banco para garantir atomicidade. Dois usuários não podem confirmar a mesma sala no mesmo horário mesmo com requisições simultâneas.

2. **Fluxo de aprovação**: reservas com `additionalRequests` não vazios são criadas com `status: PENDING`. Sem pedidos adicionais → `status: CONFIRMED` direto.

3. **Recorrência**: use a lib `rrule` para expandir as ocorrências. Verifique conflitos em **todas** as ocorrências antes de persistir qualquer uma.

4. **Cancelamento em cascata**: ao cancelar ocorrência recorrente, aceitar parâmetro `cancelMode: 'single' | 'this_and_following'`.

5. **Soft delete em salas**: nunca delete fisicamente — use `is_active: false`.

---

## Variáveis de Ambiente

```env
# Banco de dados
DATABASE_URL=postgresql://user:pass@localhost:5432/reservas

# Serviço de autenticação externo
AUTH_SERVICE_URL=https://auth.internal/validate

# Serviço de notificação externo
NOTIFICATION_SERVICE_URL=https://notifications.internal/send

# App
PORT=3000
NODE_ENV=development
JWT_SECRET=...        # usado apenas para verificar assinatura local se necessário

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

Nunca commite `.env`. Use `.env.example` com as chaves sem valores.

---

## Testes

- **Unitários**: use `@nestjs/testing` com `Test.createTestingModule()` e mocks do Repository via `jest.fn()`
- **Integração**: use `@nestjs/testing` com banco PostgreSQL real em container Docker
- **Nomenclatura**: `describe('BookingService')` → `it('should throw ConflictException when room is already booked')`
- Mínimo de **80% de cobertura** nas camadas Service
- Rode `jest --coverage` antes de cada commit

### Exemplo de teste unitário com NestJS
```typescript
describe('RoomsService', () => {
  let service: RoomsService;
  let repository: jest.Mocked<RoomsRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: RoomsRepository, useValue: { findById: jest.fn(), ... } },
      ],
    }).compile();

    service = module.get(RoomsService);
    repository = module.get(RoomsRepository);
  });

  it('should throw NotFoundException when room does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.getRoomById('uuid')).rejects.toThrow(NotFoundException);
  });
});
```

### Casos obrigatórios a testar
- Conflito de reserva simultânea (race condition)
- Criação com pedido adicional → status PENDING
- Aprovação e rejeição de reserva
- Cancelamento: dono, gestor, admin, facilities (deve falhar)
- Reserva em sala restrita por perfil → HTTP 403
- Geração e conflito em reservas recorrentes

---

## Integração com Serviços Externos

### Autenticação
```typescript
// src/shared/guards/auth.guard.ts
// Injete HttpService (do @nestjs/axios) para chamar AUTH_SERVICE_URL
// Em caso de 401 do serviço externo → throw new UnauthorizedException()
// Cache de validação por 60s com Map<token, user> (opcional, para reduzir latência)
```

### Notificação
```typescript
// src/shared/utils/notify.service.ts  ← Injectable NestJS Service
// Injete HttpService para fazer POST no NOTIFICATION_SERVICE_URL
// Nunca deixe falha de notificação quebrar o fluxo principal
// Use try/catch e this.logger.error() — a reserva já foi criada/aprovada
```

Registre o `NotifyService` no `SharedModule` e exporte-o para ser injetado nos demais módulos.

**Eventos que disparam notificação:**

| Evento | Destinatário |
|---|---|
| Reserva criada (CONFIRMED) | Solicitante |
| Reserva criada (PENDING) | Solicitante + Gestor + Facilities |
| Reserva aprovada | Solicitante |
| Reserva rejeitada | Solicitante |
| Reserva cancelada | Solicitante (+ organizador se for diferente) |

---

## Erros e HTTP Status

| Situação | Status |
|---|---|
| Token inválido/expirado | 401 |
| Sem permissão (perfil) | 403 |
| Sala ou reserva não encontrada | 404 |
| Conflito de horário | 409 |
| Dados inválidos (body/query) | 422 |
| Erro interno | 500 |

---

## Checklist antes de marcar uma tarefa como concluída

- [ ] Código compila sem erros TypeScript
- [ ] Testes unitários passando (`npm test`)
- [ ] Endpoint documentado no Swagger (`@ApiOperation`, `@ApiResponse` no controller)
- [ ] DTOs com `@ApiProperty()` em todos os campos
- [ ] Erros tratados e retornando formato padrão via `HttpExceptionFilter`
- [ ] Logs adicionados para operações críticas (`this.logger = new Logger(ClassName.name)`)
- [ ] Nenhum secret ou `.env` commitado
- [ ] Migration criada se houve mudança no schema

---

## O que NÃO fazer

- ❌ Não implemente autenticação do zero — o serviço externo já existe
- ❌ Não delete registros fisicamente (use soft delete)
- ❌ Não faça lógica de negócio no Controller — pertence ao Service
- ❌ Não ignore erros de notificação quebrando o fluxo principal
- ❌ Não use `any` no TypeScript
- ❌ Não commite sem rodar os testes
- ❌ Não crie endpoints sem decoradores Swagger (`@ApiOperation`, `@ApiResponse`)
- ❌ Não injete `PrismaService` diretamente no Controller — passe pelo Repository
- ❌ Não use `@nestjs/passport` nem `passport` — a validação JWT é feita via guard customizado chamando o serviço externo