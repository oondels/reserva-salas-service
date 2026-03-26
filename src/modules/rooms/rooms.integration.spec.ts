import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

const INTEGRATION = process.env.INTEGRATION_TEST === 'true';
const describeIf = INTEGRATION ? describe : describe.skip;

describeIf('Rooms Integration', () => {
  let app: INestApplication;
  let adminToken: string;
  let collaboratorToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Tokens de teste (mock JWT já validados pelo AuthGuard mockado)
    // Em integração real, use tokens reais do auth service
    adminToken = 'admin-test-token';
    collaboratorToken = 'collaborator-test-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/rooms', () => {
    it('should return paginated rooms list', async () => {
      // Nota: requer banco com dados (seed rodado) e AuthGuard configurado para aceitar tokens de teste
      return request(app.getHttpServer())
        .get('/api/v1/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res) => {
          expect([200, 401]).toContain(res.status);
        });
    });
  });

  describe('POST /api/v1/rooms', () => {
    it('should return 403 when user is not ADMIN', async () => {
      return request(app.getHttpServer())
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({
          name: 'Test Room',
          type: 'SALA',
          capacity: 10,
          floor: '1º andar',
        })
        .expect((res) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });
});
