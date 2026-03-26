import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { of, throwError } from 'rxjs';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let httpService: jest.Mocked<HttpService>;

  const mockReflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://auth.internal/validate'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: HttpService, useValue: { post: jest.fn() } },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    httpService = module.get(HttpService);
  });

  const buildContext = (headers: Record<string, string>): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ headers, user: null }),
      }),
    }) as unknown as ExecutionContext;

  it('should throw UnauthorizedException when no token is provided', async () => {
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    (httpService.post as jest.Mock).mockReturnValue(throwError(() => ({ status: 401 })));
    const ctx = buildContext({ authorization: 'Bearer invalid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access with a valid token', async () => {
    const user = { userId: '1', role: 'COLLABORATOR', name: 'Test', email: 'test@test.com' };
    (httpService.post as jest.Mock).mockReturnValue(of({ data: user }));
    const request = { headers: { authorization: 'Bearer valid-token' }, user: null };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(request.user).toEqual(user);
  });
});
